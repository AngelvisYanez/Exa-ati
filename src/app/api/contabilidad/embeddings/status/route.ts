import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { getConfig } from '@/services/sri-api/embeddings';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    requireTenantId(user);

    const config = getConfig();

    if (!config.enabled) {
      return NextResponse.json({
        available: false,
        enabled: false,
        message: 'OLLAMA_ENABLED no está activado en .env',
        provider: config.provider,
        url: config.baseUrl,
        model: config.model,
      });
    }

    const url = config.provider === 'lmstudio'
      ? config.baseUrl.replace(/\/+$/, '') + '/v1/models'
      : config.baseUrl.replace(/\/+$/, '') + '/api/tags';

    let connected = false;
    let version = '';

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        connected = true;
        const data = await res.json();
        version = data?.models?.[0]?.name || data?.data?.[0]?.id || '';
      }
    } catch {
      connected = false;
    }

    return NextResponse.json({
      available: connected,
      enabled: true,
      provider: config.provider,
      url: config.baseUrl,
      model: config.model,
      chatModel: config.chatModel,
      version,
      message: connected
        ? `Conectado a ${config.provider} correctamente`
        : `No se pudo conectar a ${config.provider} en ${config.baseUrl}. Verifica que el servicio esté ejecutándose.`,
    });
  } catch (error: any) {
    console.error('[Embeddings Status Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
