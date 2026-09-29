import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";
import { getEffectiveModules } from "@/services/sri-api/rbac";
import { resolvePlan } from "@/services/sri-api/plans-service";
import { listEmpresasForUser } from "@/services/sri-api/membership";
import { getBillingStatusForTenant } from "@/services/billing/subscription-lifecycle";

export async function GET(req: Request) {
  try {
    const payload = await verifyAuth(req);

    const usuario = await db.queryOne<{
      id: string;
      email: string;
      nombre: string | null;
      rol: string;
      tenant_id: string | null;
      ruc: string | null;
      activo: boolean;
    }>(
      `SELECT id, email, nombre, rol, tenant_id, ruc, activo
       FROM usuarios WHERE id = $1`,
      [payload.sub]
    );

    if (!usuario) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
    }

    const { modulos, planCodigo } = await getEffectiveModules(
      usuario.rol,
      usuario.tenant_id
    );
    const plan = await resolvePlan(planCodigo);
    const empresas = await listEmpresasForUser(usuario.id);
    const activa = empresas.find((e) => e.tenantId === usuario.tenant_id);
    const billing = usuario.tenant_id
      ? await getBillingStatusForTenant(usuario.tenant_id)
      : null;

    return NextResponse.json({
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        tenantId: usuario.tenant_id,
        ruc: usuario.ruc,
        activo: Boolean(usuario.activo),
        planCodigo: plan.codigo,
        planNombre: plan.nombre,
        planPeriodo: billing?.planPeriodo || "mensual",
        planEstado: billing?.planEstado || "activo",
        planOrigen: billing?.planOrigen ?? null,
        planVigenteHasta: billing?.planVigenteHasta
          ? billing.planVigenteHasta.toISOString()
          : null,
        daysRemaining: billing?.daysRemaining ?? null,
        maxEmpresas: plan.maxEmpresas,
        precioMensual: plan.precioMensual,
        moneda: plan.moneda,
        empresaActiva: activa
          ? { id: activa.tenantId, nombre: activa.nombre, ruc: activa.ruc }
          : null,
        empresas: empresas.map((e) => ({
          id: e.tenantId,
          nombre: e.nombre,
          ruc: e.ruc,
        })),
        modulos,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      { message },
      { status: message.startsWith("No autorizado") ? 401 : 500 }
    );
  }
}
