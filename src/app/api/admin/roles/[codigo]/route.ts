import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";
import {
  canEditSystemRoles,
  forbiddenResponse,
  invalidateRolModulosCache,
  requireManageRoles,
} from "@/services/sri-api/rbac";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const user = await verifyAuth(req);
    await requireManageRoles(user);
    const { codigo } = await params;

    const rol = await db.queryOne<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      es_sistema: boolean;
      activo: boolean;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM roles WHERE codigo = $1`, [codigo]);

    if (!rol) {
      return NextResponse.json({ message: "Rol no encontrado" }, { status: 404 });
    }

    const modulos = await db.queryAll<{ modulo_codigo: string }>(
      `SELECT modulo_codigo FROM rol_modulos WHERE rol_codigo = $1`,
      [codigo]
    );

    const usuariosCount = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM usuarios WHERE rol = $1`,
      [codigo]
    );

    return NextResponse.json({
      data: {
        codigo: rol.codigo,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
        esSistema: Boolean(rol.es_sistema),
        activo: Boolean(rol.activo),
        createdAt: rol.created_at,
        updatedAt: rol.updated_at,
        modulos: modulos.map((m) => m.modulo_codigo),
        usuariosCount: parseInt(usuariosCount?.count || "0", 10),
      },
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

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const user = await verifyAuth(req);
    await requireManageRoles(user);
    const { codigo } = await params;
    const body = await req.json();

    const existing = await db.queryOne<{
      codigo: string;
      es_sistema: boolean;
    }>(`SELECT codigo, es_sistema FROM roles WHERE codigo = $1`, [codigo]);

    if (!existing) {
      return NextResponse.json({ message: "Rol no encontrado" }, { status: 404 });
    }

    if (Boolean(existing.es_sistema) && !canEditSystemRoles(user)) {
      // ADMIN puede editar nombre/descripcion/activo de roles sistema excepto SUPERADMIN
      if (codigo === "SUPERADMIN") {
        return NextResponse.json(
          { message: "No puedes modificar el rol SUPERADMIN" },
          { status: 403 }
        );
      }
    }

    const nombre = body.nombre !== undefined ? String(body.nombre).trim() : undefined;
    const descripcion =
      body.descripcion !== undefined
        ? body.descripcion === null
          ? null
          : String(body.descripcion).trim()
        : undefined;
    const activo = body.activo !== undefined ? Boolean(body.activo) : undefined;

    if (nombre !== undefined && !nombre) {
      return NextResponse.json({ message: "Nombre no puede estar vacío" }, { status: 400 });
    }

    if (activo === false && Boolean(existing.es_sistema)) {
      return NextResponse.json(
        { message: "No se puede desactivar un rol de sistema" },
        { status: 400 }
      );
    }

    const row = await db.queryOne<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      es_sistema: boolean;
      activo: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `UPDATE roles SET
         nombre = COALESCE($2, nombre),
         descripcion = CASE WHEN $3::boolean THEN $4 ELSE descripcion END,
         activo = COALESCE($5, activo),
         updated_at = NOW()
       WHERE codigo = $1
       RETURNING *`,
      [
        codigo,
        nombre ?? null,
        descripcion !== undefined,
        descripcion ?? null,
        activo ?? null,
      ]
    );

    return NextResponse.json({
      data: {
        codigo: row!.codigo,
        nombre: row!.nombre,
        descripcion: row!.descripcion,
        esSistema: Boolean(row!.es_sistema),
        activo: Boolean(row!.activo),
        createdAt: row!.created_at,
        updatedAt: row!.updated_at,
      },
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const user = await verifyAuth(req);
    await requireManageRoles(user);
    const { codigo } = await params;

    const existing = await db.queryOne<{
      codigo: string;
      es_sistema: boolean;
    }>(`SELECT codigo, es_sistema FROM roles WHERE codigo = $1`, [codigo]);

    if (!existing) {
      return NextResponse.json({ message: "Rol no encontrado" }, { status: 404 });
    }

    if (Boolean(existing.es_sistema)) {
      return NextResponse.json(
        { message: "No se puede eliminar un rol de sistema" },
        { status: 400 }
      );
    }

    const usuarios = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM usuarios WHERE rol = $1`,
      [codigo]
    );
    if (parseInt(usuarios?.count || "0", 10) > 0) {
      return NextResponse.json(
        { message: "No se puede eliminar: hay usuarios con este rol" },
        { status: 409 }
      );
    }

    await db.query(`DELETE FROM roles WHERE codigo = $1`, [codigo]);
    invalidateRolModulosCache(codigo);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.includes("Acceso denegado")) return forbiddenResponse(message);
    return NextResponse.json(
      { message },
      { status: message.startsWith("No autorizado") ? 401 : 500 }
    );
  }
}
