import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";
import { forbiddenResponse, requireManageRoles } from "@/services/sri-api/rbac";

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireManageRoles(user);

    const modulos = await db.queryAll<{
      codigo: string;
      nombre: string;
      grupo: string;
      ruta: string;
      orden: number;
      activo: boolean;
    }>(
      `SELECT codigo, nombre, grupo, ruta, orden, activo
       FROM modulos
       WHERE activo = true
       ORDER BY orden ASC, nombre ASC`
    );

    return NextResponse.json({
      data: modulos.map((m) => ({
        codigo: m.codigo,
        nombre: m.nombre,
        grupo: m.grupo,
        ruta: m.ruta,
        orden: m.orden,
        activo: Boolean(m.activo),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.includes("Acceso denegado")) return forbiddenResponse(message);
    return NextResponse.json(
      { message },
      { status: message.startsWith("No autorizado") ? 401 : 500 }
    );
  }
}
