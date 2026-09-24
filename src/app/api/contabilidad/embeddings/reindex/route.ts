import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { reindexAll } from '@/services/sri-api/embeddings';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json().catch(() => ({}));
    const types: string[] | undefined = body.types;

    if (process.env.OLLAMA_ENABLED !== 'true') {
      return NextResponse.json(
        { message: 'El módulo RAG local no está habilitado. Activa OLLAMA_ENABLED=true en .env' },
        { status: 503 }
      );
    }

    const stats = await reindexAll(tenantId, types);

    return NextResponse.json({
      message: 'Reindexación completada',
      indexed: Object.values(stats).reduce((a, b) => a + b, 0),
      types: stats,
    });
  } catch (error: any) {
    console.error('[Embeddings Reindex Error]', error);
    const isAuth = error.message?.startsWith('No autorizado');
    const msg = error.message || '';
    if (isAuth) {
      return NextResponse.json({ message: msg }, { status: 401 });
    }
    if (msg.includes('fetch')) {
      return NextResponse.json({
        message: `No se pudo conectar con Ollama/LM Studio en ${process.env.OLLAMA_URL || 'http://localhost:11434'}. Verifica que el servicio esté instalado y ejecutándose.`,
        detail: msg,
      }, { status: 503 });
    }
    return NextResponse.json({ message: msg || 'Error interno del servidor' }, { status: 500 });
  }
}
