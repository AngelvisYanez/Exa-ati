import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { requireModule, forbiddenResponse } from "@/services/sri-api/rbac";
import { db } from "@/services/sri-api/db";
import {
  assertValidModulos,
  countTenantsOnPlan,
  invalidatePlanDefinitionsCache,
  listPlansFromDb,
} from "@/services/sri-api/plans-service";
import { isPlanCode, slugifyPlanCodigo } from "@/lib/plans";

async function requirePlanesAdmin(req: Request) {
  const user = await verifyAuth(req);
  await requireModule(user, "admin.planes");
  return user;
}

export async function GET(req: Request) {
  try {
    await requirePlanesAdmin(req);
    const plans = await listPlansFromDb({ includeInactive: true });
    const data = await Promise.all(
      plans.map(async (p) => ({
        ...p,
        tenantsCount: await countTenantsOnPlan(p.codigo),
        modulosCount: p.modulos.length,
      }))
    );
    return NextResponse.json({ data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.startsWith("No autorizado")) {
      return NextResponse.json({ message }, { status: 401 });
    }
    if (message.startsWith("Acceso denegado")) {
      return forbiddenResponse(message);
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requirePlanesAdmin(req);
    const body = await req.json();
    const nombre = String(body.nombre || "").trim();
    if (!nombre) {
      return NextResponse.json({ message: "El nombre es obligatorio" }, { status: 400 });
    }

    let codigo = String(body.codigo || slugifyPlanCodigo(nombre)).trim().toLowerCase();
    codigo = slugifyPlanCodigo(codigo);
    if (!isPlanCode(codigo)) {
      return NextResponse.json(
        { message: "Código inválido (usa letras minúsculas, números, - o _)" },
        { status: 400 }
      );
    }

    const existing = await db.queryOne(`SELECT codigo FROM planes_suscripcion WHERE codigo = $1`, [
      codigo,
    ]);
    if (existing) {
      return NextResponse.json({ message: "Ya existe un plan con ese código" }, { status: 409 });
    }

    const maxEmpresas = Math.max(1, Math.min(50, Number(body.maxEmpresas) || 1));
    const precioMensual = Math.max(0, Number(body.precioMensual) || 0);
    const precioAnual =
      body.precioAnual === null || body.precioAnual === undefined || body.precioAnual === ""
        ? null
        : Math.max(0, Number(body.precioAnual));
    const moneda = String(body.moneda || "USD").slice(0, 3).toUpperCase();
    const orden = Number.isFinite(Number(body.orden)) ? Number(body.orden) : 100;
    const descripcion = body.descripcion ? String(body.descripcion).trim() : null;
    const modulos = assertValidModulos(body.modulos || []);

    await db.insert("planes_suscripcion", {
      codigo,
      nombre,
      descripcion,
      max_empresas: maxEmpresas,
      precio_mensual: precioMensual,
      precio_anual: precioAnual,
      moneda,
      orden,
      activo: true,
      es_sistema: false,
    });

    for (const m of modulos) {
      const exists = await db.queryOne(`SELECT codigo FROM modulos WHERE codigo = $1`, [m]);
      if (!exists) continue;
      await db.insert("plan_modulos", { plan_codigo: codigo, modulo_codigo: m });
    }

    invalidatePlanDefinitionsCache();
    return NextResponse.json({ data: { codigo } }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.startsWith("No autorizado")) {
      return NextResponse.json({ message }, { status: 401 });
    }
    if (message.startsWith("Acceso denegado")) {
      return forbiddenResponse(message);
    }
    console.error("[admin/planes POST]", error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
