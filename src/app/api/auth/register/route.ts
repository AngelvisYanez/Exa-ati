import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/services/sri-api/db';
import { registerApiSchema } from '@/lib/schemas/auth';
import { parseBody } from '@/lib/schemas/parse-body';
import { apiError } from '@/lib/auth-cookies';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import {
  addTenantMembership,
  createCuentaWithEmpresa,
} from '@/services/sri-api/membership';
import { resolvePlan } from '@/services/sri-api/plans-service';
import { sendTemplatedEmail, appBaseUrl } from '@/services/email/templates';

export async function POST(req: Request) {
  const limited = rateLimit(clientKey(req, 'register'), { limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    return apiError('Demasiados intentos. Intenta más tarde.', 429, {
      retryAfter: limited.retryAfterSec,
    });
  }

  try {
    const parsed = await parseBody(req, registerApiSchema);
    if ('error' in parsed) return parsed.error;
    const {
      email,
      password,
      tenantId,
      nombre,
      razonSocial,
      ruc,
      telefono,
      ciudad,
      planCodigo,
      periodo,
    } = parsed.data;

    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (existing) {
      return apiError(`Ya existe un usuario con el email ${email}`, 409);
    }

    let assignedTenantId = tenantId || null;
    let cuentaId: string | null = null;
    const empresaNombre =
      (razonSocial && String(razonSocial).trim()) ||
      (nombre && String(nombre).trim()) ||
      email.split('@')[0];

    let planNombre = planCodigo || 'emprendedor';
    if (!assignedTenantId) {
      const plan = await resolvePlan(planCodigo || 'emprendedor');
      if (!plan.activo) {
        return apiError('El plan seleccionado no está activo', 400);
      }
      planNombre = plan.nombre;

      const created = await createCuentaWithEmpresa({
        nombre: empresaNombre,
        planCodigo: plan.codigo,
        periodo: periodo || 'mensual',
        planEstado: 'pendiente',
        planOrigen: 'payphone',
        ruc: ruc ? String(ruc).trim() : null,
        telefono: telefono ? String(telefono).trim() : null,
        ciudad: ciudad ? String(ciudad).trim() : null,
      });
      assignedTenantId = created.tenantId;
      cuentaId = created.cuentaId;
    } else {
      const tenant = await db.queryOne<{ id: string }>(
        `SELECT id FROM tenants WHERE id = $1 AND activo = true`,
        [assignedTenantId]
      );
      if (!tenant) {
        return apiError(`Tenant con ID ${assignedTenantId} no encontrado o inactivo`, 404);
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.insert<{
      id: string;
      email: string;
      rol: string;
      tenant_id: string | null;
    }>('usuarios', {
      email,
      password_hash: passwordHash,
      nombre: nombre || null,
      rol: 'ADMIN',
      tenant_id: assignedTenantId,
      activo: true,
    }, 'id, email, rol, tenant_id');

    if (!user) {
      return apiError('No se pudo crear el usuario', 500);
    }

    if (assignedTenantId) {
      await addTenantMembership({
        tenantId: assignedTenantId,
        usuarioId: user.id,
        rol: 'ADMIN',
      });
    }

    if (cuentaId) {
      try {
        await db.query(
          `UPDATE cuentas SET owner_usuario_id = $1, updated_at = NOW() WHERE id = $2`,
          [user.id, cuentaId]
        );
      } catch {
        /* ok */
      }
    }

    // Bienvenida (no bloquea el registro si SMTP falla)
    void sendTemplatedEmail({
      codigo: 'bienvenida',
      to: email,
      vars: {
        nombre: nombre || email.split('@')[0],
        email,
        empresa: empresaNombre,
        plan_nombre: planNombre,
        periodo: periodo || 'mensual',
        link_pago: `${appBaseUrl()}/suscripcion?plan=${encodeURIComponent(planCodigo || 'emprendedor')}&periodo=${encodeURIComponent(periodo || 'mensual')}`,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        rol: user.rol,
        tenantId: user.tenant_id,
        cuentaId,
        planCodigo: planCodigo || 'emprendedor',
        periodo: periodo || 'mensual',
        requierePago: !tenantId,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[Register Error]', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return apiError(`Error en el servidor: ${message}`, 500);
  }
}
