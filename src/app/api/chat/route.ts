import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { buildAuditAlerts, fetchTenantComprobantes } from '@/lib/sri-api/audit-engine';
import { buildChatSystemPrompt } from '@/lib/sri-api/chat-context';
import { getUserRuc } from '@/lib/sri-api/user-resolver';
import { encryption } from '@/lib/sri-api/encryption';
import {
  ChatMessage,
  formatChatHtml,
  generateChatResponse,
  resolveLlmForTenant,
} from '@/lib/sri-api/llm-client';

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

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const history = sanitizeHistory(body.history);

    if (!message) {
      return NextResponse.json({ message: 'El campo "message" es obligatorio' }, { status: 400 });
    }

    const tenantId = requireTenantId(user);
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

    const userRuc = await getUserRuc(user, req);

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

    if (chatResponse.toolCall && chatResponse.toolCall.name === 'extraer_documentos_sri') {
      const args = chatResponse.toolCall.args;
      const { ruc, sriPassword, fechaDesde, fechaHasta, tipoComprobante } = args;

      // 1. Resolver RUC
      const finalRuc = ruc || userRuc;

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
          html: '<strong>No se pudo iniciar la descarga.</strong><br/>No tengo configurada tu contraseña del SRI para el RUC ' + finalRuc + '. Por favor, vincula tu cuenta en Configuración o proporciona tu contraseña en este formato en el chat: "contraseña SRI: [tu_clave]" para poder continuar.',
          text: 'No se pudo iniciar la descarga. No tengo configurada tu contraseña del SRI para el RUC ' + finalRuc + '.',
          provider: chatResponse.provider,
          model: chatResponse.model,
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
      const finalTipo = tipoComprobante || 'todos';
      const jobData = {
        ruc: finalRuc,
        clave_sri: finalPassword,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        tipo_comprobante: finalTipo,
        status: 'PENDING',
        action_type: 'DOWNLOAD_RECEIVED',
        tenant_id: tenantId,
      };

      const insertedJob = await db.insert('scraping_jobs', jobData, 'id');
      const jobId = insertedJob ? insertedJob.id : null;

      if (jobId) {
        // Trigger scraping asynchronously using fetch
        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const host = req.headers.get('host');
        const syncUrl = `${protocol}://${host}/api/sri/sync`;

        fetch(syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        }).catch(err => console.error('[Chat Sync Trigger Error]', err));

        const tipoLabel = finalTipo === '1' ? 'Facturas' : finalTipo === '6' ? 'Retenciones' : 'Comprobantes';
        const rangeText = `${fechaDesde} al ${fechaHasta}`;
        
        return NextResponse.json({
          success: true,
          sender: 'ai',
          html: `<strong>¡Entendido!</strong> He iniciado la descarga de tus <strong>${tipoLabel}</strong> del SRI desde el <strong>${fechaDesde}</strong> hasta el <strong>${fechaHasta}</strong> para el RUC <code>${finalRuc}</code>.<br/><br/>La tarea se está ejecutando en segundo plano. Puedes ver el estado de la descarga en vivo en el <a href="/comprobantes" class="underline font-semibold">Historial de descargas</a> o en el panel de control.`,
          text: `He iniciado la descarga de tus comprobantes del SRI del ${rangeText} para el RUC ${finalRuc} en segundo plano.`,
          provider: chatResponse.provider,
          model: chatResponse.model,
          time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        });
      } else {
        return NextResponse.json({
          success: true,
          sender: 'ai',
          html: '<strong>Error al encolar la tarea.</strong> No se pudo registrar la solicitud en la base de datos.',
          text: 'Error al encolar la tarea en la base de datos.',
          provider: chatResponse.provider,
          model: chatResponse.model,
          time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }

    return NextResponse.json({
      success: true,
      sender: 'ai',
      html: formatChatHtml(chatResponse.text),
      text: chatResponse.text,
      provider: chatResponse.provider,
      model: chatResponse.model,
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
