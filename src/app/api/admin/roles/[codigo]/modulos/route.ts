import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";
import { isModuleCode } from "@/lib/modules-catalog";
import {
  canEditSystemRoles,
  forbiddenResponse,
  invalidateRolModulosCache,
  requireManageRoles,
} from "@/services/sri-api/rbac";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const user = await verifyAuth(req);
    await requireManageRoles(user);
    const { codigo } = await params;
    const body = await req.json();
    const modulosRaw = Array.isArray(body.modulos) ? body.modulos : null;

    if (!modulosRaw) {
      return NextResponse.json(
        { message: "modulos debe ser un arreglo de códigos" },
        { status: 400 }
      );
    }

    const existing = await db.queryOne<{
      codigo: string;
      es_sistema: boolean;
    }>(`SELECT codigo, es_sistema FROM roles WHERE codigo = $1`, [codigo]);

    if (!existing) {
      return NextResponse.json({ message: "Rol no encontrado" }, { status: 404 });
    }

    if (codigo === "SUPERADMIN" && !canEditSystemRoles(user)) {
      return NextResponse.json(
        { message: "No puedes modificar módulos de SUPERADMIN" },
        { status: 403 }
      );
    }

    if (Boolean(existing.es_sistema) && codigo === "SUPERADMIN" && user.rol !== "SUPERADMIN") {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
    }

    const modulos = [
      ...new Set(
        modulosRaw
          .map((m: unknown) => String(m).trim())
          .filter((m: string) => m && isModuleCode(m))
      ),
    ] as string[];

    // SUPERADMIN siempre mantiene todos los módulos activos
    let finalModulos = modulos;
    if (codigo === "SUPERADMIN") {
      const all = await db.queryAll<{ codigo: string }>(
        `SELECT codigo FROM modulos WHERE activo = true`
      );
      finalModulos = all.map((m) => m.codigo);
    }

    await db.query(`DELETE FROM rol_modulos WHERE rol_codigo = $1`, [codigo]);

    for (const moduloCodigo of finalModulos) {
      await db.query(
        `INSERT INTO rol_modulos (rol_codigo, modulo_codigo) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [codigo, moduloCodigo]
      );
    }

    invalidateRolModulosCache(codigo);

    return NextResponse.json({
      data: { codigo, modulos: finalModulos },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("[Admin Roles Modulos PUT]", error);
    if (message.includes("Acceso denegado")) return forbiddenResponse(message);
    return NextResponse.json(
      { message },
      { status: message.startsWith("No autorizado") ? 401 : 500 }
    );
  }
}
