import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { buildAuditAlerts, fetchTenantComprobantes } from '@/services/sri-api/audit-engine';
import { buildChatSystemPrompt } from '@/services/sri-api/chat-context';
import { getUserRuc } from '@/services/sri-api/user-resolver';
import { encryption } from '@/services/sri-api/encryption';
import {
  handleAiTool,
  isMutatingTool,
  normalizeIsoDate,
  descripcionTipoComprobante,
  formatoFechaEspanol,
} from '@/services/sri-api/ai-tools';
import {
  ChatMessage,
  formatChatHtml,
  generateChatResponse,
  resolveLlmForTenant,
} from '@/services/sri-api/llm-client';
import { normalizeChatHtml } from '@/lib/chat-html';
import { buildFiscalProjection, formatFiscalProjectionHtml } from '@/services/sri-api/tax-calculator';
import { ejecutarTrabajoScraping } from '@/services/scraping/job-runner';

function chatHtmlPayload(html: string, text?: string) {
  const normalized = normalizeChatHtml(html);
  return {
    html: normalized,
    text: text || normalized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  };
}

/** Consultas que deben resolverse con datosCuenta, no con RAG contable. */
function isTributaryContextQuery(text: string): boolean {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/\b(plan de cuentas|asiento contable|cuenta contable|codigo de cuenta)\b/.test(t)) {
    return false;
  }

  // La proyección fiscal tiene cálculo propio (no RAG ni solo texto libre)
  if (isProyeccionFiscalQuery(t)) return false;

  return (
    /\b(iva|obligacion|rimpe|declaracion|retencion|formulario\s*10[34]|impuesto a la renta|credito tributario|saldo a favor|auditoria|alertas? de riesgo|mis obligaciones|cuanto debo)\b/.test(
      t
    ) || /cuanto debo pagar|iva a pagar|iva neto/.test(t)
  );
}

function isProyeccionFiscalQuery(text: string): boolean {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/\bproyeccion fiscal\b/.test(t) || /\bproyecta mi estimacion\b/.test(t)) return true;
  return (
    /\b(estimacion|proyect)\b/.test(t) &&
    /\b(iva|impuesto a la renta|\bir\b)\b/.test(t) &&
    /\b(mes|meses|futuro|proxim)\b/.test(t)
  );
}

function extractMesesProyeccion(text: string): number {
  const m = text.match(/pr[oó]ximos?\s+(\d+)\s+meses/i) || text.match(/(\d+)\s+meses/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) return Math.min(Math.max(n, 1), 12);
  }
  return 3;
}

/** Normaliza el tipo de comprobante (código SRI o texto) a un valor válido. */
function normalizeTipoComprobante(value: unknown): string {
  const raw = value == null ? '' : String(value).trim().toLowerCase();
  const map: Record<string, string> = {
    '1': '1', '01': '1', factura: '1', facturas: '1',
    '2': '2', liquidacion: '2', liquidaciones: '2',
    '3': '3', 'nota de credito': '3', 'notas de credito': '3',
    '4': '4', 'nota de debito': '4', 'notas de debito': '4',
    '6': '6', retencion: '6', retenciones: '6', 'comprobante de retencion': '6',
    todos: 'todos', todo: 'todos',
  };
  return map[raw] || 'todos';
}

function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  let items = raw
    .filter(
      (item): item is ChatMessage =>
        !!item &&
        typeof item === 'object' &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim().length > 0
    )
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 4000),
    }));

  // Gemini requiere que el historial empiece con mensaje de usuario
  while (items.length > 0 && items[0].role === 'assistant') {
    items.shift();
  }

  return items;
}

function describeMutatingAction(toolName: string, args: Record<string, unknown>): string[] {
  switch (toolName) {
    case 'emitir_factura':
      return [
        `Emitir factura electrónica`,
        args.cliente ? `Cliente: ${args.cliente}` : null,
        args.identificacion ? `Identificación: ${args.identificacion}` : null,
        args.total != null ? `Total: $${Number(args.total).toFixed(2)}` : null,
      ].filter(Boolean) as string[];
    case 'crear_producto':
      return [
        `Crear producto "${args.nombre || args.codigo || '—'}"`,
        args.codigo ? `Código: ${args.codigo}` : null,
        args.precio != null ? `Precio: $${Number(args.precio).toFixed(2)}` : null,
      ].filter(Boolean) as string[];
    case 'crear_contacto':
      return [
        `Crear contacto "${args.nombre || args.razonSocial || '—'}"`,
        args.identificacion ? `Identificación: ${args.identificacion}` : null,
      ].filter(Boolean) as string[];
    case 'registrar_pago':
      return [
        `Registrar pago de $${Number(args.monto ?? 0).toFixed(2)}`,
        args.tipoCuenta ? `Tipo: ${args.tipoCuenta === 'PAGAR' ? 'Cuenta por pagar' : 'Cuenta por cobrar'}` : null,
        args.numeroDocumento ? `Documento: ${args.numeroDocumento}` : null,
      ].filter(Boolean) as string[];
    default:
      return [`Ejecutar acción: ${toolName}`];
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const history = sanitizeHistory(body.history);
    const confirmTool =
      typeof body.confirmTool === 'string' ? body.confirmTool.trim() : '';
    const toolArgs =
      body.toolArgs && typeof body.toolArgs === 'object' ? body.toolArgs : null;

    const tenantId = requireTenantId(user);
    const userRuc = await getUserRuc(user, req);
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const baseUrl = `${protocol}://${host}`;
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';

    // Confirmación explícita de herramienta mutante (sin pasar por LLM)
    if (confirmTool && toolArgs && isMutatingTool(confirmTool)) {
      const result = await handleAiTool(confirmTool, toolArgs, {
        tenantId,
        userRuc,
        token,
        baseUrl,
      });
      return NextResponse.json({
        success: true,
        sender: 'ai',
        ...chatHtmlPayload(result.html, result.text),
        confirmedTool: confirmTool,
        time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
      });
    }

    if (!message) {
      return NextResponse.json({ message: 'El campo "message" es obligatorio' }, { status: 400 });
    }

    const llmResolved = await resolveLlmForTenant(tenantId);

    if (!llmResolved.provider) {
      return NextResponse.json(
        {
          message:
            'Chat IA no configurado. Ve a Configuración > Inteligencia IA o define GEMINI_API_KEY / ANTHROPIC_API_KEY en .env.local.',
        },
        { status: 503 }
      );
    }

    const emisor = await db.queryOne<any>(
      `SELECT razon_social, tipo_contribuyente, ambiente,
              certificado_valido_hasta, cert_valido_hasta,
              whatsapp_numero, whatsapp_estado
       FROM emisores WHERE ruc = ? AND activo = true`,
      [userRuc]
    );

    const certExpiry = emisor?.certificado_valido_hasta || emisor?.cert_valido_hasta || null;
    let certDaysLeft: number | null = null;
    if (certExpiry) {
      certDaysLeft = Math.ceil(
        (new Date(certExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
    }

    const comprobantes = await fetchTenantComprobantes(tenantId, userRuc);
    const alerts = buildAuditAlerts(comprobantes, userRuc, certDaysLeft);

    // Proyección fiscal: cálculo determinístico (chip / consultas de estimación a futuro)
    if (isProyeccionFiscalQuery(message)) {
      const meses = extractMesesProyeccion(message);
      if (!comprobantes.length) {
        return NextResponse.json({
          success: true,
          sender: 'ai',
          ...chatHtmlPayload(
            '<strong>Sin comprobantes para proyectar.</strong><br/>Descarga o importa facturas del SRI y vuelve a pedir la proyección fiscal.',
            'Sin comprobantes para proyectar.'
          ),
          time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        });
      }
      const result = formatFiscalProjectionHtml(
        buildFiscalProjection(comprobantes, userRuc, meses)
      );
      return NextResponse.json({
        success: true,
        sender: 'ai',
        ...chatHtmlPayload(result.html, result.text),
        time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
      });
    }

    // Consultar las tareas de descarga/sincronización más recientes para proveer contexto al asistente
    const { rows: jobsRows } = await db.query<any>(
      `SELECT id, fecha_desde, fecha_hasta, tipo_comprobante, status, progress_message, created_at
       FROM scraping_jobs
       WHERE tenant_id = $1 AND ruc = $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [tenantId, userRuc]
    );

    const systemPrompt = buildChatSystemPrompt({
      userRuc,
      razonSocial: emisor?.razon_social || userRuc,
      regimen: emisor?.tipo_contribuyente || null,
      ambiente: emisor?.ambiente === '2' ? 'Producción' : 'Pruebas',
      certDaysLeft,
      certExpiry: certExpiry ? new Date(certExpiry).toISOString().slice(0, 10) : null,
      whatsappEstado: emisor?.whatsapp_estado || 'DESCONECTADO',
      whatsappNumero: emisor?.whatsapp_numero || null,
      comprobantes,
      alerts,
      recentJobs: jobsRows || [],
    });

    const chatResponse = await generateChatResponse({
      systemPrompt,
      history,
      userMessage: message,
      tenantId,
    });

    if (chatResponse.toolCall) {
      const toolName = chatResponse.toolCall.name;
      const args = chatResponse.toolCall.args;

      // Evitar que IVA/obligaciones/resumen tributario se desvíen al RAG contable
      const ragTools = toolName === 'consultar_sistema_rag' || toolName === 'consultar_contabilidad_rag';
      const ragQuestion =
        (typeof args?.pregunta === 'string' && args.pregunta) ||
        (typeof args?.query === 'string' && args.query) ||
        (typeof args?.consulta === 'string' && args.consulta) ||
        message;

      if (ragTools && isTributaryContextQuery(`${message} ${ragQuestion}`)) {
        const retry = await generateChatResponse({
          systemPrompt:
            systemPrompt +
            '\n\nIMPORTANTE: No uses herramientas. Responde únicamente con datosCuenta / resumenTributario.',
          history,
          userMessage: message,
          tenantId,
          disableTools: true,
        });

        return NextResponse.json({
          success: true,
          sender: 'ai',
          ...chatHtmlPayload(formatChatHtml(retry.text), retry.text),
          time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        });
      }

      // ── Herramientas accionables (inventario, contactos, facturas, pagos, cuentas) ──
      if (toolName !== 'extraer_documentos_sri') {
        const confirmed =
          body.confirmTool === toolName ||
          args?.confirm === true ||
          args?.confirm === 'true';

        if (isMutatingTool(toolName) && !confirmed) {
          const acciones = describeMutatingAction(toolName, args || {});
          const lista = acciones.map((a) => `<li>${a}</li>`).join('');
          return NextResponse.json({
            success: true,
            sender: 'ai',
            ...chatHtmlPayload(
              `<strong>Confirmación requerida</strong><br/>Voy a realizar la siguiente acción:<ul>${lista}</ul><br/>Responde <strong>Confirma: sí</strong> para continuar.`,
              `Confirmación requerida. Acciones: ${acciones.join('; ')}. Responde "Confirma: sí" para continuar.`
            ),
            pendingTool: toolName,
            pendingArgs: args || {},
            time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
          });
        }

        const result = await handleAiTool(toolName, args, {
          tenantId,
          userRuc,
          token,
          baseUrl,
        });

        return NextResponse.json({
          success: true,
          sender: 'ai',
          ...chatHtmlPayload(result.html, result.text),
          time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        });
      }

      const { ruc, sriPassword, fechaDesde, fechaHasta, tipoComprobante } = args;

      // 1. Resolver RUC
      const finalRuc = ruc || userRuc;

      // 1b. Normalizar y validar el rango de fechas antes de crear el job
      let finalDesde = normalizeIsoDate(fechaDesde);
      let finalHasta = normalizeIsoDate(fechaHasta);
      if (!finalDesde || !finalHasta) {
        return NextResponse.json({
          success: true,
          sender: 'ai',
          ...chatHtmlPayload(
            `<strong>Necesito el período exacto para descargar.</strong><br/>Indícame el rango de fechas (ej. del <strong>01/08/2026</strong> al <strong>31/08/2026</strong>) o el mes que quieres descargar (ej. <strong>"agosto 2026"</strong>).`,
            'Falta el rango de fechas para la descarga del SRI.'
          ),
          time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        });
      }
      if (finalDesde > finalHasta) {
        const temp = finalDesde;
        finalDesde = finalHasta;
        finalHasta = temp;
      }
      const finalTipo = normalizeTipoComprobante(tipoComprobante);

      // 2. Resolver Contraseña
      let finalPassword = sriPassword;
      if (!finalPassword) {
        const emisor = await db.queryOne<any>(
          'SELECT clave_sri_encrypted FROM emisores WHERE tenant_id = $1 AND ruc = $2 AND activo = true',
          [tenantId, finalRuc]
        );
        if (emisor?.clave_sri_encrypted) {
          try {
            finalPassword = await encryption.decrypt(emisor.clave_sri_encrypted);
          } catch (e) {
            console.error('[Chat API] Error decrypting password:', e);
          }
        }
      }

      if (!finalPassword) {
        return NextResponse.json({
          success: true,
          sender: 'ai',
          ...chatHtmlPayload(
            '<strong>No se pudo iniciar la descarga.</strong><br/>No tengo configurada tu contraseña del SRI para el RUC ' +
              finalRuc +
              '. Por favor, vincula tu cuenta en Configuración o proporciona tu contraseña en este formato en el chat: "contraseña SRI: [tu_clave]" para poder continuar.',
            'No se pudo iniciar la descarga. No tengo configurada tu contraseña del SRI para el RUC ' + finalRuc + '.'
          ),
          time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        });
      }

      // Si el usuario proporcionó una contraseña en el chat, guardémosla en la DB para comodidad del usuario
      if (sriPassword) {
        const encryptedPass = await encryption.encrypt(sriPassword);
        const existing = await db.queryOne<any>(
          'SELECT id FROM emisores WHERE tenant_id = $1 AND ruc = $2',
          [tenantId, finalRuc]
        );
        if (existing) {
          await db.query(
            'UPDATE emisores SET clave_sri_encrypted = $1, updated_at = NOW() WHERE id = $2',
            [encryptedPass, existing.id]
          );
        } else {
          await db.insert('emisores', {
            ruc: finalRuc,
            razon_social: `Contribuyente ${finalRuc}`,
            nombre_comercial: `Contribuyente ${finalRuc}`,
            tenant_id: tenantId,
            activo: true,
            clave_sri_encrypted: encryptedPass,
            ambiente: '2',
          });
        }
        await db.query(
          `UPDATE tenants SET ruc = $1, updated_at = NOW() WHERE id = $2`,
          [finalRuc, tenantId]
        );
      }

      // 3. Crear el scraping job
      const jobData = {
        ruc: finalRuc,
        clave_sri: finalPassword,
        fecha_desde: finalDesde,
        fecha_hasta: finalHasta,
        tipo_comprobante: finalTipo,
        status: 'PENDING',
        action_type: 'DOWNLOAD_RECEIVED',
        tenant_id: tenantId,
        updated_at: new Date(),
        created_at: new Date(),
      };

      const insertedJob = await db.insert('scraping_jobs', jobData, 'id');
      const jobId = insertedJob ? insertedJob.id : null;

      if (jobId) {
        // Mismo orquestador que /api/sri/scraping (Playwright + SOAP), sin HTTP interno.
        ejecutarTrabajoScraping(jobId).catch((err) => {
          console.error(`[Chat Sync Trigger Error] job ${jobId}:`, err?.message || err);
        });

        const tipoLabel = descripcionTipoComprobante(finalTipo);
        const rango = `${formatoFechaEspanol(finalDesde)} al ${formatoFechaEspanol(finalHasta)}`;
        
        return NextResponse.json({
          success: true,
          sender: 'ai',
          ...chatHtmlPayload(
            `<strong>¡Entendido!</strong> He iniciado la descarga de tus <strong>${tipoLabel}</strong> del SRI desde el <strong>${rango}</strong> para el RUC <code>${finalRuc}</code>.<br/><br/>La tarea se está ejecutando en segundo plano. Puedes ver el estado de la descarga en vivo en el <a href="/documentos?descargas=1" class="underline font-semibold">Historial de descargas</a> o en el panel de control.`,
            `He iniciado la descarga de tus comprobantes del SRI del ${rango} para el RUC ${finalRuc} en segundo plano.`
          ),
          time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        });
      } else {
        return NextResponse.json({
          success: true,
          sender: 'ai',
          ...chatHtmlPayload(
            '<strong>Error al encolar la tarea.</strong> No se pudo registrar la solicitud en la base de datos.',
            'Error al encolar la tarea en la base de datos.'
          ),
          time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }

    return NextResponse.json({
      success: true,
      sender: 'ai',
      ...chatHtmlPayload(formatChatHtml(chatResponse.text), chatResponse.text),
      time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
    });
  } catch (error: any) {
    console.error('[Chat API Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor en el Chat' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
