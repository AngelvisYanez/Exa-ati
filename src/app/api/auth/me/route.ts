import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";
import { getModulosForRol } from "@/services/sri-api/rbac";

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

    const modulos = await getModulosForRol(usuario.rol);

    return NextResponse.json({
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        tenantId: usuario.tenant_id,
        ruc: usuario.ruc,
        activo: Boolean(usuario.activo),
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
