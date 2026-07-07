import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { encryption } from '@/lib/sri-api/encryption';
import { isValidRuc } from '@/lib/sri-api/user-resolver';
import { validateSriPortalCredentials } from '@/lib/sri-api/sri-portal-validator';
import { sincronizarConSri } from '@/lib/sri-api/sync-service';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: 'Usuario sin tenant asignado' }, { status: 403 });
    }

    const { ruc, sriPassword } = await req.json();

    if (!ruc || !sriPassword) {
      return NextResponse.json(
        { message: 'RUC y contraseña del SRI son obligatorios' },
        { status: 400 }
      );
    }

    if (!isValidRuc(ruc)) {
      return NextResponse.json(
        { message: 'El RUC debe tener exactamente 13 dígitos numéricos' },
        { status: 400 }
      );
    }

    const portalCheck = await validateSriPortalCredentials(ruc, sriPassword);
    if (!portalCheck.valid) {
      return NextResponse.json({ message: portalCheck.message }, { status: 400 });
    }

    const encryptedPassword = await encryption.encrypt(sriPassword);

    const existing = await db.queryOne<any>(
      `SELECT id, tenant_id FROM emisores WHERE ruc = $1`,
      [ruc]
    );

    if (existing && existing.tenant_id && existing.tenant_id !== tenantId) {
      return NextResponse.json(
        { message: 'Este RUC ya está vinculado a otra cuenta' },
        { status: 409 }
      );
    }

    if (existing) {
      await db.query(
        `UPDATE emisores SET
          clave_sri_encrypted = $1,
          tenant_id = $2,
          activo = true,
          updated_at = NOW()
         WHERE id = $3`,
        [encryptedPassword, tenantId, existing.id]
      );
    } else {
      await db.insert('emisores', {
        ruc,
        razon_social: `Contribuyente ${ruc}`,
        nombre_comercial: `Contribuyente ${ruc}`,
        tenant_id: tenantId,
        activo: true,
        clave_sri_encrypted: encryptedPassword,
        ambiente: '2',
      });
    }

    await db.query(
      `UPDATE tenants SET ruc = $1, updated_at = NOW() WHERE id = $2`,
      [ruc, tenantId]
    );

    let syncResult = null;
    let syncWarning: string | null = null;
    let syncError: string | null = null;

    try {
      syncResult = await sincronizarConSri(tenantId, ruc, {
        modo: 'emitidos',
        limite: 200,
      });

      if (syncResult.warning === 'NO_LOCAL_DOCUMENTS' || syncResult.procesados === 0) {
        syncWarning =
          'Vinculado correctamente. Emite facturas o importa XML de compras para sincronizar documentos.';
      }

      await db.query(
        `INSERT INTO auditoria (usuario_email, tenant_id, accion, recurso, descripcion, datos_nuevos, exitoso)
         VALUES ($1, $2, 'SINCRONIZAR_SRI', 'comprobantes', $3, $4, true)`,
        [
          user.email,
          tenantId,
          `Vinculación SRI: ${syncResult.importados} importados, ${syncResult.actualizados} actualizados`,
          JSON.stringify(syncResult),
        ]
      );

      const usesPostgres = Boolean(process.env.DATABASE_URL);
      if (usesPostgres) {
        await db.query(
          `INSERT INTO tenant_settings (tenant_id, last_sync_at, last_sync_result, updated_at)
           VALUES ($1, NOW(), $2, NOW())
           ON CONFLICT (tenant_id) DO UPDATE SET last_sync_at = NOW(), last_sync_result = EXCLUDED.last_sync_result, updated_at = NOW()`,
          [tenantId, JSON.stringify(syncResult)]
        );
      } else {
        await db.query(
          `INSERT INTO tenant_settings (tenant_id, last_sync_at, last_sync_result, updated_at)
           VALUES (?, NOW(), ?, NOW())
           ON DUPLICATE KEY UPDATE last_sync_at = NOW(), last_sync_result = VALUES(last_sync_result), updated_at = NOW()`,
          [tenantId, JSON.stringify(syncResult)]
        );
      }
    } catch (syncErr: any) {
      syncError = syncErr.message || 'Error en sincronización inicial';
      console.warn('[Vincular] Sync inicial falló:', syncError);
    }

    return NextResponse.json({
      success: true,
      message: 'RUC vinculado correctamente al SRI',
      ruc,
      portalValidation: portalCheck,
      sync: syncResult
        ? {
            procesados: syncResult.procesados,
            autorizados: syncResult.actualizados + syncResult.importados,
            importados: syncResult.importados,
            actualizados: syncResult.actualizados,
            warning: syncWarning || syncResult.warning,
            error: syncError,
          }
        : { error: syncError, warning: syncWarning },
    });
  } catch (error: any) {
    console.error('[Vincular SRI Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al vincular con el SRI' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
