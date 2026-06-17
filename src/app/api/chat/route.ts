import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { buildAuditAlerts, fetchTenantComprobantes } from '@/lib/sri-api/audit-engine';
import { buildChatSystemPrompt } from '@/lib/sri-api/chat-context';
import { getUserRuc } from '@/lib/sri-api/user-resolver';
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

    const userRuc = await getUserRuc(user);

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
    });

    const { text, provider: usedProvider, model } = await generateChatResponse({
      systemPrompt,
      history,
      userMessage: message,
      tenantId,
    });

    return NextResponse.json({
      success: true,
      sender: 'ai',
      html: formatChatHtml(text),
      text,
      provider: usedProvider,
      model,
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
