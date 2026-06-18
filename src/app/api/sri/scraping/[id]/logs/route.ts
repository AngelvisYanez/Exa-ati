import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/sri-api/db';
import { verifyAuth } from '@/lib/sri-api/auth-helper';

export const dynamic = 'force-dynamic';

async function ensureLogsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS scraping_job_logs (
        id SERIAL NOT NULL,
        job_id INTEGER NOT NULL,
        level VARCHAR(20) NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_scraping_job_logs_job_id ON scraping_job_logs(job_id)'
    );
  } catch {
    // table already exists or cannot be created — continue
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureLogsTable();

    const { id } = await params;
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const jobId = parseInt(id, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const job = await db.queryOne<{ id: number; tenant_id: string; status: string }>(
      'SELECT id, tenant_id, status FROM scraping_jobs WHERE id = $1',
      [jobId]
    );
    if (!job) {
      return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 });
    }
    if (job.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const logs = await db.queryAll<{
      id: number;
      level: string;
      message: string;
      created_at: string;
    }>(
      'SELECT id, level, message, created_at FROM scraping_job_logs WHERE job_id = $1 ORDER BY created_at ASC, id ASC',
      [jobId]
    );

    return NextResponse.json({ success: true, logs, jobStatus: job.status });
  } catch (error: any) {
    const isAuthError = error.message?.includes('No autorizado');
    return NextResponse.json(
      { error: isAuthError ? error.message : `Error al cargar logs: ${error.message}` },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
