import { NextResponse } from 'next/server';
import { db } from '@/lib/sri-api/db';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { encryption } from '@/lib/sri-api/encryption';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const body = await req.json();
    const { ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, action_type, options } = body;

    if (!ruc || !fecha_desde || !fecha_hasta) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos (RUC, fecha_desde, fecha_hasta)' },
        { status: 400 }
      );
    }

    if (!tipo_comprobante) {
      return NextResponse.json(
        { error: 'El tipo de comprobante es obligatorio' },
        { status: 400 }
      );
    }
    const validTipos = ['1', '2', '3', '4', '6', 'todos'];
    if (!validTipos.includes(tipo_comprobante)) {
      return NextResponse.json(
        { error: 'Tipo de comprobante inválido' },
        { status: 400 }
      );
    }

    const finalActionType = action_type || 'DOWNLOAD_RECEIVED';

    const optionsStr = options && typeof options === 'object' ? JSON.stringify(options) : undefined;

    let finalClaveSri = clave_sri;
    if (!finalClaveSri) {
      const emisor = await db.queryOne<any>(
        'SELECT clave_sri_encrypted FROM emisores WHERE ruc = $1 AND tenant_id = $2 AND activo = true',
        [ruc, tenantId]
      );
      if (!emisor?.clave_sri_encrypted) {
        return NextResponse.json(
          { error: 'Contraseña SRI requerida. No hay credenciales almacenadas para este RUC. Vincule el RUC en Configuración o proporcione la contraseña.' },
          { status: 400 }
        );
      }
      finalClaveSri = await encryption.decrypt(emisor.clave_sri_encrypted);
    }

    const jobData: Record<string, any> = {
      ruc,
      fecha_desde,
      fecha_hasta,
      tipo_comprobante,
      status: 'PENDING',
      action_type: finalActionType,
      tenant_id: tenantId,
      updated_at: new Date(),
      created_at: new Date(),
    };
    if (finalClaveSri) {
      jobData.clave_sri = finalClaveSri;
    }
    if (optionsStr !== undefined) {
      jobData.options = optionsStr;
    }

    const insertedJob = await db.insert('scraping_jobs', jobData, 'id');
    const jobId = insertedJob ? insertedJob.id : null;

    return NextResponse.json({
      success: true,
      message: 'Trabajo de descarga encolado.',
      jobId,
    });

  } catch (error: any) {
    console.error('Error al encolar trabajo:', error);
    const isAuthError = error.message?.includes('No autorizado');
    return NextResponse.json(
      { error: isAuthError ? error.message : 'Error interno del servidor al encolar la descarga.' },
      { status: isAuthError ? 401 : 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'Falta jobId' }, { status: 400 });
    }

    const job = await db.queryOne("SELECT id, status, tenant_id FROM scraping_jobs WHERE id = $1", [jobId]);
    if (!job) {
      return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 });
    }

    if (job.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return NextResponse.json({ error: 'El trabajo ya ha finalizado' }, { status: 400 });
    }

    await db.query(
      `UPDATE scraping_jobs SET status = 'CANCELLED', progress_message = 'Cancelado por el usuario', updated_at = NOW() WHERE id = $1`,
      [jobId]
    );

    return NextResponse.json({ success: true, message: 'Trabajo cancelado' });
  } catch (error: any) {
    console.error('Error al cancelar trabajo:', error);
    const isAuthError = error.message?.includes('No autorizado');
    return NextResponse.json(
      { error: isAuthError ? error.message : 'Error interno del servidor' },
      { status: isAuthError ? 401 : 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const body = await req.json();
    const { jobId, deleteAll } = body;

    if (deleteAll) {
      // Delete all logs for this tenant's jobs, then all jobs
      await db.query(
        `DELETE FROM scraping_job_logs WHERE job_id IN (SELECT id FROM scraping_jobs WHERE tenant_id = $1)`,
        [tenantId]
      );
      await db.query(
        `DELETE FROM scraping_jobs WHERE tenant_id = $1`,
        [tenantId]
      );
      return NextResponse.json({ success: true, message: 'Historial eliminado completamente' });
    }

    if (!jobId) {
      return NextResponse.json({ error: 'Falta jobId' }, { status: 400 });
    }

    const job = await db.queryOne(
      "SELECT id, tenant_id FROM scraping_jobs WHERE id = $1",
      [jobId]
    );
    if (!job) {
      return NextResponse.json({ error: 'Trabajo no encontrado' }, { status: 404 });
    }
    if (job.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Delete logs first, then the job
    await db.query('DELETE FROM scraping_job_logs WHERE job_id = $1', [jobId]);
    await db.query('DELETE FROM scraping_jobs WHERE id = $1', [jobId]);

    return NextResponse.json({ success: true, message: 'Trabajo eliminado' });
  } catch (error: any) {
    console.error('Error al eliminar trabajo:', error);
    const isAuthError = error.message?.includes('No autorizado');
    return NextResponse.json(
      { error: isAuthError ? error.message : 'Error interno del servidor' },
      { status: isAuthError ? 401 : 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const jobs = await db.queryAll(
      `SELECT id, ruc, fecha_desde, fecha_hasta, tipo_comprobante, mes, anio, status, progress_message, action_type, created_at, updated_at FROM scraping_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [tenantId]
    );

    return NextResponse.json({ success: true, jobs });
  } catch (error: any) {
    console.error('Error al obtener trabajos:', error);
    const isAuthError = error.message?.includes('No autorizado');
    return NextResponse.json(
      { error: isAuthError ? error.message : 'Error interno del servidor al obtener la lista de trabajos.' },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
