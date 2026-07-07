import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);

    const usuariosCount = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM usuarios'
    );
    const tenantsCount = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM tenants'
    );
    const emisoresCount = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM emisores'
    );
    const comprobantesCount = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM comprobantes'
    );
    const scrapingJobsCount = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM scraping_jobs'
    );

    const recentLogs = await db.queryAll<any>(
      `SELECT a.id, a.usuario_email, a.accion, a.recurso, a.descripcion,
              a.exitoso, a.created_at
       FROM auditoria a
       ORDER BY a.created_at DESC
       LIMIT 10`
    );

    return NextResponse.json({
      usuarios: parseInt(usuariosCount?.count || '0'),
      tenants: parseInt(tenantsCount?.count || '0'),
      emisores: parseInt(emisoresCount?.count || '0'),
      comprobantes: parseInt(comprobantesCount?.count || '0'),
      scrapingJobs: parseInt(scrapingJobsCount?.count || '0'),
      recentLogs: recentLogs.map((l: any) => ({
        id: l.id,
        usuarioEmail: l.usuario_email,
        accion: l.accion,
        recurso: l.recurso,
        descripcion: l.descripcion,
        exitoso: Boolean(l.exitoso),
        createdAt: l.created_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Error interno' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
