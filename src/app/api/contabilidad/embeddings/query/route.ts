import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { queryRag } from '@/services/sri-api/embeddings';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const threshold = typeof body.threshold === 'number' ? body.threshold : 0.5;
    const topK = typeof body.topK === 'number' ? Math.min(body.topK, 20) : 8;
    const generate = body.generate !== false;

    if (!query) {
      return NextResponse.json(
        { message: 'El campo "query" es obligatorio' },
        { status: 400 }
      );
    }

    if (process.env.OLLAMA_ENABLED !== 'true') {
      return NextResponse.json(
        { message: 'El módulo RAG local no está habilitado. Activa OLLAMA_ENABLED=true en .env' },
        { status: 503 }
      );
    }

    const result = await queryRag(tenantId, query, { threshold, topK, generate });

    return NextResponse.json({
      answer: result.answer,
      generated: result.generated,
      model: result.model,
      data: result.sources.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        contenido: r.contenido,
        referenciaId: r.referenciaId,
        score: Math.round(r.score * 10000) / 10000,
      })),
      total: result.sources.length,
      query,
      threshold,
    });
  } catch (error: any) {
    console.error('[Embeddings Query Error]', error);
    const isAuth = error.message?.startsWith('No autorizado');
    const msg = error.message || '';
    if (isAuth) {
      return NextResponse.json({ message: msg }, { status: 401 });
    }
    if (msg.includes('fetch') || msg.includes('Ollama') || msg.includes('LM Studio')) {
      return NextResponse.json({
        message: `No se pudo conectar con Ollama/LM Studio en ${process.env.OLLAMA_URL || 'http://localhost:11434'}. Verifica que el servicio esté instalado y ejecutándose. Descarga: https://ollama.com`,
        detail: msg,
      }, { status: 503 });
    }
    return NextResponse.json({ message: msg || 'Error interno del servidor' }, { status: 500 });
  }
}
