import { randomUUID } from "crypto";
import { db } from "@/services/sri-api/db";
import { resolvePlan } from "@/services/sri-api/plans-service";
import { invalidatePlanCache } from "@/services/sri-api/rbac";
import { DEFAULT_PLAN } from "@/lib/plans";

export type EmpresaMembership = {
  tenantId: string;
  nombre: string;
  ruc: string | null;
  rol: string;
  cuentaId: string | null;
  activo: boolean;
};

export async function listEmpresasForUser(usuarioId: string): Promise<EmpresaMembership[]> {
  try {
    const rows = await db.queryAll<{
      tenant_id: string;
      nombre: string;
      ruc: string | null;
      rol: string;
      cuenta_id: string | null;
      activo: boolean | number;
    }>(
      `SELECT tu.tenant_id, t.nombre, t.ruc, tu.rol, t.cuenta_id, tu.activo
       FROM tenant_usuarios tu
       INNER JOIN tenants t ON t.id = tu.tenant_id AND t.activo = true
       WHERE tu.usuario_id = $1 AND tu.activo = true
       ORDER BY t.nombre ASC`,
      [usuarioId]
    );
    if (rows.length > 0) {
      return rows.map((r) => ({
        tenantId: r.tenant_id,
        nombre: r.nombre,
        ruc: r.ruc,
        rol: r.rol,
        cuentaId: r.cuenta_id,
        activo: Boolean(r.activo),
      }));
    }
  } catch (err) {
    console.warn("[membership] listEmpresasForUser fallback:", err);
  }

  // Legacy: solo usuarios.tenant_id
  const user = await db.queryOne<{ tenant_id: string | null }>(
    `SELECT tenant_id FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  if (!user?.tenant_id) return [];
  const t = await db.queryOne<{ id: string; nombre: string; ruc: string | null; cuenta_id: string | null }>(
    `SELECT id, nombre, ruc, cuenta_id FROM tenants WHERE id = $1 AND activo = true`,
    [user.tenant_id]
  );
  if (!t) return [];
  return [
    {
      tenantId: t.id,
      nombre: t.nombre,
      ruc: t.ruc,
      rol: "ADMIN",
      cuentaId: t.cuenta_id,
      activo: true,
    },
  ];
}

export async function userHasTenantAccess(
  usuarioId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const row = await db.queryOne(
      `SELECT 1 FROM tenant_usuarios
       WHERE usuario_id = $1 AND tenant_id = $2 AND activo = true`,
      [usuarioId, tenantId]
    );
    if (row) return true;
  } catch {
    /* tabla ausente */
  }
  const user = await db.queryOne<{ tenant_id: string | null; rol: string }>(
    `SELECT tenant_id, rol FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  if (user?.rol === "SUPERADMIN") return true;
  return user?.tenant_id === tenantId;
}

/** Plan de la cuenta de billing del tenant activo. */
export async function getCuentaIdForTenant(tenantId: string): Promise<string | null> {
  const row = await db.queryOne<{ cuenta_id: string | null }>(
    `SELECT cuenta_id FROM tenants WHERE id = $1`,
    [tenantId]
  );
  return row?.cuenta_id || null;
}

export async function getPlanCodigoForTenant(tenantId: string): Promise<string> {
  try {
    const row = await db.queryOne<{ plan_codigo: string | null }>(
      `SELECT c.plan_codigo
       FROM tenants t
       LEFT JOIN cuentas c ON c.id = t.cuenta_id
       WHERE t.id = $1`,
      [tenantId]
    );
    if (row?.plan_codigo) return row.plan_codigo.trim();
  } catch {
    /* fallback */
  }
  const legacy = await db.queryOne<{ plan_codigo: string | null }>(
    `SELECT plan_codigo FROM tenants WHERE id = $1`,
    [tenantId]
  );
  return legacy?.plan_codigo?.trim() || DEFAULT_PLAN;
}

export async function countEmpresasInCuenta(cuentaId: string): Promise<number> {
  const row = await db.queryOne<{ c: string | number }>(
    `SELECT COUNT(*) AS c FROM tenants WHERE cuenta_id = $1 AND activo = true`,
    [cuentaId]
  );
  return Number(row?.c ?? 0);
}

/** Cupo del plan = nº de tenants (empresas) en la cuenta, no emisores. */
export async function assertCanAddEmpresa(cuentaId: string): Promise<void> {
  const cuenta = await db.queryOne<{ plan_codigo: string }>(
    `SELECT plan_codigo FROM cuentas WHERE id = $1`,
    [cuentaId]
  );
  const plan = await resolvePlan(cuenta?.plan_codigo || DEFAULT_PLAN);
  const count = await countEmpresasInCuenta(cuentaId);
  if (count >= plan.maxEmpresas) {
    throw new Error(
      `Tu plan ${plan.nombre} permite hasta ${plan.maxEmpresas} empresa${plan.maxEmpresas === 1 ? "" : "s"}. Actualiza el plan para añadir más.`
    );
  }
}

/**
 * Crea cuenta + primera empresa (registro wizard).
 * Por defecto queda en plan_estado=pendiente hasta que PayPhone apruebe.
 */
export async function createCuentaWithEmpresa(input: {
  nombre: string;
  usuarioId?: string | null;
  planCodigo?: string;
  periodo?: "mensual" | "anual";
  planEstado?: "pendiente" | "activo" | "gracia" | "vencido" | "cancelado";
  planOrigen?: string;
  ruc?: string | null;
  telefono?: string | null;
  ciudad?: string | null;
}): Promise<{ cuentaId: string; tenantId: string }> {
  const cuentaId = randomUUID();
  const tenantId = randomUUID();
  const planCodigo = input.planCodigo || DEFAULT_PLAN;
  const periodo = input.periodo || "mensual";
  const planEstado = input.planEstado || "pendiente";
  const planOrigen = input.planOrigen || "payphone";

  try {
    await db.insert("cuentas", {
      id: cuentaId,
      nombre: input.nombre,
      plan_codigo: planCodigo,
      plan_periodo: periodo,
      plan_estado: planEstado,
      plan_origen: planOrigen,
      owner_usuario_id: input.usuarioId || null,
      telefono: input.telefono || null,
      ciudad: input.ciudad || null,
      activo: true,
    });
  } catch (err) {
    // Reintento sin columnas nuevas (migración 011 / 010 ausente)
    console.warn("[membership] cuentas insert extendido falló, reintento básico:", err);
    try {
      await db.insert("cuentas", {
        id: cuentaId,
        nombre: input.nombre,
        plan_codigo: planCodigo,
        plan_periodo: periodo,
        plan_origen: planOrigen,
        owner_usuario_id: input.usuarioId || null,
        activo: true,
      });
    } catch (err2) {
      // Sin tabla cuentas aún
      console.warn("[membership] sin tabla cuentas:", err2);
      const tenant = await db.insert<{ id: string }>(
        "tenants",
        {
          id: tenantId,
          nombre: input.nombre,
          ruc: input.ruc || null,
          activo: true,
          plan_codigo: planCodigo,
        },
        "id"
      );
      return { cuentaId: tenant?.id || tenantId, tenantId: tenant?.id || tenantId };
    }
  }

  try {
    await db.insert("tenants", {
      id: tenantId,
      nombre: input.nombre,
      ruc: input.ruc || null,
      cuenta_id: cuentaId,
      activo: true,
      plan_codigo: planCodigo,
      plan_periodo: periodo,
      plan_estado: planEstado,
      plan_origen: planOrigen,
    });
  } catch (err) {
    console.warn("[membership] tenants insert extendido falló, reintento mínimo:", err);
    await db.insert("tenants", {
      id: tenantId,
      nombre: input.nombre,
      ruc: input.ruc || null,
      cuenta_id: cuentaId,
      activo: true,
      plan_codigo: planCodigo,
    });
  }

  return { cuentaId, tenantId };
}

export async function addTenantMembership(input: {
  tenantId: string;
  usuarioId: string;
  rol?: string;
}): Promise<void> {
  try {
    await db.insert("tenant_usuarios", {
      tenant_id: input.tenantId,
      usuario_id: input.usuarioId,
      rol: input.rol || "ADMIN",
      activo: true,
    });
  } catch (err) {
    // ON CONFLICT — update
    try {
      await db.query(
        `INSERT INTO tenant_usuarios (tenant_id, usuario_id, rol, activo, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())
         ON CONFLICT (tenant_id, usuario_id) DO UPDATE SET activo = true, rol = EXCLUDED.rol, updated_at = NOW()`,
        [input.tenantId, input.usuarioId, input.rol || "ADMIN"]
      );
    } catch (e) {
      console.warn("[membership] addTenantMembership:", e);
    }
  }
}

/**
 * Nueva empresa bajo la misma cuenta del tenant activo.
 */
export async function createEmpresaInCuenta(input: {
  usuarioId: string;
  activeTenantId: string;
  nombre: string;
  ruc?: string | null;
}): Promise<{ tenantId: string; cuentaId: string }> {
  const cuentaId = await getCuentaIdForTenant(input.activeTenantId);
  if (!cuentaId) {
    throw new Error(
      "Esta empresa no tiene cuenta de billing. Aplica la migración 009_multi_empresa_cuentas.sql"
    );
  }

  const ok = await userHasTenantAccess(input.usuarioId, input.activeTenantId);
  if (!ok) throw new Error("Acceso denegado a la cuenta");

  await assertCanAddEmpresa(cuentaId);

  const tenantId = randomUUID();
  const planCodigo = await getPlanCodigoForTenant(input.activeTenantId);

  try {
    await db.insert("tenants", {
      id: tenantId,
      nombre: input.nombre.trim(),
      ruc: input.ruc?.trim() || null,
      cuenta_id: cuentaId,
      activo: true,
      plan_codigo: planCodigo,
    });
  } catch (err) {
    console.warn("[membership] createEmpresaInCuenta plan_codigo fallback:", err);
    await db.insert("tenants", {
      id: tenantId,
      nombre: input.nombre.trim(),
      ruc: input.ruc?.trim() || null,
      cuenta_id: cuentaId,
      activo: true,
    });
  }

  await addTenantMembership({
    tenantId,
    usuarioId: input.usuarioId,
    rol: "ADMIN",
  });

  invalidatePlanCache(tenantId);
  return { tenantId, cuentaId };
}

export type AssignPlanInput = {
  cuentaId: string | null;
  planCodigo: string;
  planPeriodo?: "mensual" | "anual";
  planVigenteHasta?: Date | string | null;
  planEstado?: "pendiente" | "activo" | "gracia" | "vencido" | "cancelado";
  planOrigen?: string;
  /** Si se pasa un tenant sin cuenta, se actualiza solo ese tenant (legacy). */
  tenantIdFallback?: string | null;
};

/**
 * Asigna plan a la cuenta de billing y refleja en todos sus tenants.
 * Fuente de verdad: cuentas.plan_codigo.
 */
export async function assignPlanToCuenta(input: AssignPlanInput): Promise<{
  cuentaId: string | null;
  planCodigo: string;
  tenantsUpdated: number;
}> {
  const planCodigo = String(input.planCodigo || DEFAULT_PLAN).trim();
  const plan = await resolvePlan(planCodigo);
  if (!plan.activo && plan.codigo === planCodigo) {
    // resolvePlan puede devolver fallback; validar en DB si existe
  }

  const planRow = await db.queryOne<{ codigo: string; activo: boolean | number }>(
    `SELECT codigo, activo FROM planes_suscripcion WHERE codigo = $1`,
    [planCodigo]
  ).catch(() => null);

  if (planRow && !Boolean(planRow.activo)) {
    throw new Error("El plan seleccionado está inactivo");
  }
  if (!planRow && plan.codigo !== planCodigo && planCodigo !== DEFAULT_PLAN) {
    // Permitir códigos de fallback estático
  }

  const periodo = input.planPeriodo || "mensual";
  const planEstado = input.planEstado || "activo";
  const planOrigen = input.planOrigen || "manual";
  const vigenteHasta =
    input.planVigenteHasta === undefined
      ? undefined
      : input.planVigenteHasta
        ? new Date(input.planVigenteHasta)
        : null;

  let cuentaId = input.cuentaId || null;
  let tenantsUpdated = 0;

  if (cuentaId) {
    const fields = [
      "plan_codigo = $1",
      "plan_periodo = $2",
      "plan_estado = $3",
      "plan_origen = $4",
      "updated_at = NOW()",
    ];
    const values: unknown[] = [planCodigo, periodo, planEstado, planOrigen];
    if (vigenteHasta !== undefined) {
      values.push(vigenteHasta);
      fields.push(`plan_vigente_hasta = $${values.length}`);
    }
    values.push(cuentaId);
    try {
      await db.query(
        `UPDATE cuentas SET ${fields.join(", ")} WHERE id = $${values.length}`,
        values
      );
    } catch (err) {
      console.warn("[membership] assignPlanToCuenta cuentas:", err);
      await db.query(
        `UPDATE cuentas SET plan_codigo = $1, plan_periodo = $2, updated_at = NOW() WHERE id = $3`,
        [planCodigo, periodo, cuentaId]
      );
    }

    try {
      const tenantFields = [
        "plan_codigo = $1",
        "plan_periodo = $2",
        "plan_estado = $3",
        "plan_origen = $4",
        "updated_at = NOW()",
      ];
      const tenantValues: unknown[] = [planCodigo, periodo, planEstado, planOrigen];
      if (vigenteHasta !== undefined) {
        tenantValues.push(vigenteHasta);
        tenantFields.push(`plan_vigente_hasta = $${tenantValues.length}`);
      }
      tenantValues.push(cuentaId);
      const result = await db.query(
        `UPDATE tenants SET ${tenantFields.join(", ")} WHERE cuenta_id = $${tenantValues.length}`,
        tenantValues
      );
      tenantsUpdated = (result as { rowCount?: number })?.rowCount ?? 0;
    } catch {
      await db.query(
        `UPDATE tenants SET plan_codigo = $1, updated_at = NOW() WHERE cuenta_id = $2`,
        [planCodigo, cuentaId]
      );
    }

    const tenants = await db.queryAll<{ id: string }>(
      `SELECT id FROM tenants WHERE cuenta_id = $1`,
      [cuentaId]
    ).catch(() => []);
    for (const t of tenants) invalidatePlanCache(t.id);
  } else if (input.tenantIdFallback) {
    const tid = input.tenantIdFallback;
    try {
      const fields = ["plan_codigo = $1", "plan_periodo = $2", "updated_at = NOW()"];
      const values: unknown[] = [planCodigo, periodo];
      if (input.planEstado) {
        values.push(planEstado);
        fields.push(`plan_estado = $${values.length}`);
      }
      if (input.planOrigen) {
        values.push(planOrigen);
        fields.push(`plan_origen = $${values.length}`);
      }
      if (vigenteHasta !== undefined) {
        values.push(vigenteHasta);
        fields.push(`plan_vigente_hasta = $${values.length}`);
      }
      values.push(tid);
      await db.query(
        `UPDATE tenants SET ${fields.join(", ")} WHERE id = $${values.length}`,
        values
      );
    } catch {
      await db.query(
        `UPDATE tenants SET plan_codigo = $1, updated_at = NOW() WHERE id = $2`,
        [planCodigo, tid]
      );
    }
    tenantsUpdated = 1;
    invalidatePlanCache(tid);
  }

  return { cuentaId, planCodigo, tenantsUpdated };
}

/**
 * Resuelve cuenta_id del usuario vía su tenant activo (o membresía).
 */
export async function getCuentaIdForUsuario(usuarioId: string): Promise<{
  cuentaId: string | null;
  tenantId: string | null;
} | null> {
  const user = await db.queryOne<{ tenant_id: string | null }>(
    `SELECT tenant_id FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  if (!user) return null;

  let tenantId = user.tenant_id;
  if (!tenantId) {
    const memb = await db.queryOne<{ tenant_id: string }>(
      `SELECT tenant_id FROM tenant_usuarios WHERE usuario_id = $1 AND activo = true LIMIT 1`,
      [usuarioId]
    ).catch(() => null);
    tenantId = memb?.tenant_id || null;
  }
  if (!tenantId) return { cuentaId: null, tenantId: null };

  const cuentaId = await getCuentaIdForTenant(tenantId);
  return { cuentaId, tenantId };
}

export async function switchActiveTenant(input: {
  usuarioId: string;
  tenantId: string;
}): Promise<void> {
  const ok = await userHasTenantAccess(input.usuarioId, input.tenantId);
  if (!ok) {
    throw new Error("No tienes acceso a esa empresa");
  }
  await db.query(
    `UPDATE usuarios SET tenant_id = $1, updated_at = NOW() WHERE id = $2`,
    [input.tenantId, input.usuarioId]
  );
}
