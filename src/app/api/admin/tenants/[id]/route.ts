import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";
import { assignPlanToCuenta } from "@/services/sri-api/membership";

function requireSuperadmin(user: { rol: string }) {
  if (user.rol !== "SUPERADMIN") {
    throw new Error("Acceso denegado: se requiere rol SUPERADMIN");
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    requireSuperadmin(user);
    const { id } = await params;

    const tenant = await db.queryOne<Record<string, unknown>>(
      `SELECT t.*,
              c.plan_codigo AS cuenta_plan_codigo,
              c.plan_periodo AS cuenta_plan_periodo,
              c.plan_estado AS cuenta_plan_estado,
              c.plan_vigente_hasta AS cuenta_plan_vigente_hasta,
              (SELECT COUNT(*) FROM usuarios WHERE tenant_id = t.id) as usuarios_count,
              (SELECT COUNT(*) FROM emisores WHERE tenant_id = t.id) as emisores_count,
              (SELECT COUNT(*) FROM comprobantes WHERE tenant_id = t.id) as comprobantes_count
       FROM tenants t
       LEFT JOIN cuentas c ON c.id = t.cuenta_id
       WHERE t.id = $1`,
      [id]
    );
    if (!tenant) {
      return NextResponse.json({ message: "Tenant no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: tenant.id,
        nombre: tenant.nombre,
        ruc: tenant.ruc,
        cuentaId: tenant.cuenta_id || null,
        planCodigo: tenant.cuenta_plan_codigo || tenant.plan_codigo || "emprendedor",
        planPeriodo: tenant.cuenta_plan_periodo || tenant.plan_periodo || "mensual",
        planEstado: tenant.cuenta_plan_estado || tenant.plan_estado || "activo",
        planVigenteHasta: tenant.cuenta_plan_vigente_hasta || tenant.plan_vigente_hasta || null,
        activo: Boolean(tenant.activo),
        usuariosCount: parseInt(String(tenant.usuarios_count || "0")),
        emisoresCount: parseInt(String(tenant.emisores_count || "0")),
        comprobantesCount: parseInt(String(tenant.comprobantes_count || "0")),
        createdAt: tenant.created_at,
        updatedAt: tenant.updated_at,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      { message },
      {
        status: message.startsWith("No autorizado")
          ? 401
          : message.includes("Acceso denegado")
            ? 403
            : 500,
      }
    );
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    requireSuperadmin(user);
    const { id } = await params;
    const body = await req.json();
    const { nombre, ruc, activo, planCodigo, planPeriodo, planEstado, planVigenteHasta } = body;

    const existing = await db.queryOne<{ id: string; cuenta_id: string | null }>(
      "SELECT id, cuenta_id FROM tenants WHERE id = $1",
      [id]
    );
    if (!existing) {
      return NextResponse.json({ message: "Tenant no encontrado" }, { status: 404 });
    }

    if (ruc) {
      const dup = await db.queryOne("SELECT id FROM tenants WHERE ruc = $1 AND id != $2", [
        ruc,
        id,
      ]);
      if (dup) {
        return NextResponse.json({ message: "Ya existe otro tenant con ese RUC" }, { status: 409 });
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (nombre !== undefined) {
      fields.push("nombre = $" + (fields.length + 1));
      values.push(nombre);
    }
    if (ruc !== undefined) {
      fields.push("ruc = $" + (fields.length + 1));
      values.push(ruc || null);
    }
    if (activo !== undefined) {
      fields.push("activo = $" + (fields.length + 1));
      values.push(activo);
    }

    if (fields.length > 0) {
      fields.push("updated_at = NOW()");
      await db.query(`UPDATE tenants SET ${fields.join(", ")} WHERE id = $${values.length + 1}`, [
        ...values,
        id,
      ]);
    }

    let assignedPlan: string | null = null;
    if (planCodigo !== undefined && planCodigo !== null) {
      const planResult = await assignPlanToCuenta({
        cuentaId: existing.cuenta_id,
        tenantIdFallback: id,
        planCodigo: String(planCodigo),
        planPeriodo: planPeriodo === "anual" ? "anual" : "mensual",
        planEstado: planEstado || "activo",
        planVigenteHasta: planVigenteHasta === undefined ? undefined : planVigenteHasta,
        planOrigen: "manual",
      });
      assignedPlan = planResult.planCodigo;
    }

    const result = await db.queryOne<Record<string, unknown>>(
      `SELECT t.*, c.plan_codigo AS cuenta_plan_codigo
       FROM tenants t
       LEFT JOIN cuentas c ON c.id = t.cuenta_id
       WHERE t.id = $1`,
      [id]
    );

    return NextResponse.json({
      data: {
        id: result?.id,
        nombre: result?.nombre,
        ruc: result?.ruc,
        planCodigo:
          assignedPlan || result?.cuenta_plan_codigo || result?.plan_codigo || "emprendedor",
        activo: Boolean(result?.activo),
        updatedAt: result?.updated_at,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      { message },
      {
        status: message.startsWith("No autorizado")
          ? 401
          : message.includes("Acceso denegado")
            ? 403
            : 500,
      }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    requireSuperadmin(user);
    const { id } = await params;

    const existing = await db.queryOne<{ id: string; nombre: string }>(
      "SELECT id, nombre FROM tenants WHERE id = $1",
      [id]
    );
    if (!existing) {
      return NextResponse.json({ message: "Tenant no encontrado" }, { status: 404 });
    }

    const userCount = await db.queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM usuarios WHERE tenant_id = $1",
      [id]
    );
    if (parseInt(userCount?.count || "0") > 0) {
      return NextResponse.json(
        {
          message: `No se puede eliminar "${existing.nombre}": tiene ${userCount?.count} usuarios asociados. Desactívalo en su lugar.`,
        },
        { status: 409 }
      );
    }

    await db.query("DELETE FROM tenants WHERE id = $1", [id]);

    return NextResponse.json({ message: "Tenant eliminado correctamente" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      { message },
      {
        status: message.startsWith("No autorizado")
          ? 401
          : message.includes("Acceso denegado")
            ? 403
            : 500,
      }
    );
  }
}
