import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { requireModule, forbiddenResponse, invalidatePlanCache } from "@/services/sri-api/rbac";
import { db } from "@/services/sri-api/db";
import {
  assertValidModulos,
  invalidatePlanDefinitionsCache,
} from "@/services/sri-api/plans-service";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, "admin.planes");
    const { codigo: raw } = await params;
    const codigo = decodeURIComponent(raw);
    const body = await req.json();
    const modulos = assertValidModulos(body.modulos);

    const existing = await db.queryOne(`SELECT codigo FROM planes_suscripcion WHERE codigo = $1`, [
      codigo,
    ]);
    if (!existing) {
      return NextResponse.json({ message: "Plan no encontrado" }, { status: 404 });
    }

    // Validar que los módulos existan
    if (modulos.length > 0) {
      const placeholders = modulos.map((_, i) => `$${i + 1}`).join(", ");
      const found = await db.queryAll<{ codigo: string }>(
        `SELECT codigo FROM modulos WHERE codigo IN (${placeholders}) AND activo = true`,
        modulos
      );
      if (found.length !== modulos.length) {
        const ok = new Set(found.map((f) => f.codigo));
        const missing = modulos.filter((m) => !ok.has(m));
        return NextResponse.json(
          { message: `Módulos inválidos: ${missing.join(", ")}` },
          { status: 400 }
        );
      }
    }

    await db.query(`DELETE FROM plan_modulos WHERE plan_codigo = $1`, [codigo]);
    for (const m of modulos) {
      await db.insert("plan_modulos", { plan_codigo: codigo, modulo_codigo: m });
    }

    invalidatePlanDefinitionsCache(codigo);
    invalidatePlanCache(); // tenants pueden tener módulos efectivos distintos

    return NextResponse.json({
      success: true,
      modulosCount: modulos.length,
    });
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
