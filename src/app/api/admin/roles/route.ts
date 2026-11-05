import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";
import {
  forbiddenResponse,
  requireManageRoles,
} from "@/services/sri-api/rbac";

function mapRol(row: {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  es_sistema: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
  modulos_count?: string;
  usuarios_count?: string;
}) {
  return {
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion,
    esSistema: Boolean(row.es_sistema),
    activo: Boolean(row.activo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    modulosCount: parseInt(row.modulos_count || "0", 10),
    usuariosCount: parseInt(row.usuarios_count || "0", 10),
  };
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireManageRoles(user);

    const roles = await db.queryAll<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      es_sistema: boolean;
      activo: boolean;
      created_at: string;
      updated_at: string;
      modulos_count: string;
      usuarios_count: string;
    }>(
      `SELECT r.codigo, r.nombre, r.descripcion, r.es_sistema, r.activo,
              r.created_at, r.updated_at,
              (SELECT COUNT(*)::text FROM rol_modulos rm WHERE rm.rol_codigo = r.codigo) as modulos_count,
              (SELECT COUNT(*)::text FROM usuarios u WHERE u.rol = r.codigo) as usuarios_count
       FROM roles r
       ORDER BY r.es_sistema DESC, r.nombre ASC`
    );

    return NextResponse.json({ data: roles.map(mapRol) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("[Admin Roles GET]", error);
    if (message.includes("Acceso denegado")) return forbiddenResponse(message);
    return NextResponse.json(
      { message },
      { status: message.startsWith("No autorizado") ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireManageRoles(user);

    const body = await req.json();
    const codigoRaw = String(body.codigo || "").trim().toUpperCase();
    const nombre = String(body.nombre || "").trim();
    const descripcion = body.descripcion ? String(body.descripcion).trim() : null;
    const activo = body.activo !== false;

    if (!codigoRaw || !nombre) {
      return NextResponse.json(
        { message: "Código y nombre son obligatorios" },
        { status: 400 }
      );
    }

    if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(codigoRaw)) {
      return NextResponse.json(
        { message: "Código inválido: use letras, números y _ (máx. 50)" },
        { status: 400 }
      );
    }

    if (["USER", "ADMIN", "SUPERADMIN"].includes(codigoRaw) && user.rol !== "SUPERADMIN") {
      return NextResponse.json(
        { message: "No puedes recrear roles de sistema" },
        { status: 403 }
      );
    }

    const existing = await db.queryOne(
      `SELECT codigo FROM roles WHERE codigo = $1`,
      [codigoRaw]
    );
    if (existing) {
      return NextResponse.json(
        { message: "Ya existe un rol con ese código" },
        { status: 409 }
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
      `INSERT INTO roles (codigo, nombre, descripcion, es_sistema, activo, created_at, updated_at)
       VALUES ($1, $2, $3, false, $4, NOW(), NOW())
       RETURNING *`,
      [codigoRaw, nombre, descripcion, activo]
    );

    return NextResponse.json(
      {
        data: mapRol({
          ...row!,
          modulos_count: "0",
          usuarios_count: "0",
        }),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("[Admin Roles POST]", error);
    if (message.includes("Acceso denegado")) return forbiddenResponse(message);
    return NextResponse.json(
      { message },
      { status: message.startsWith("No autorizado") ? 401 : 500 }
    );
  }
}
