import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { requireModule, forbiddenResponse } from "@/services/sri-api/rbac";
import { db } from "@/services/sri-api/db";
import {
  isMetodoCodigo,
  listMetodosPago,
  slugifyMetodoCodigo,
} from "@/services/sri-api/metodos-pago-service";

async function requireMetodosAdmin(req: Request) {
  const user = await verifyAuth(req);
  await requireModule(user, "admin.metodos-pago");
  return user;
}

export async function GET(req: Request) {
  try {
    await requireMetodosAdmin(req);
    const data = await listMetodosPago({ includeInactive: true, uso: "all" });
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
    await requireMetodosAdmin(req);
    const body = await req.json();
    const nombre = String(body.nombre || "").trim();
    if (!nombre) {
      return NextResponse.json({ message: "El nombre es obligatorio" }, { status: 400 });
    }

    let codigo = String(body.codigo || slugifyMetodoCodigo(nombre)).trim().toUpperCase();
    codigo = slugifyMetodoCodigo(codigo);
    if (!isMetodoCodigo(codigo)) {
      return NextResponse.json(
        { message: "Código inválido (usa A-Z, 0-9 y _ , 2–30 caracteres)" },
        { status: 400 }
      );
    }

    const existing = await db.queryOne(`SELECT codigo FROM metodos_pago WHERE codigo = $1`, [
      codigo,
    ]);
    if (existing) {
      return NextResponse.json({ message: "Ya existe un método con ese código" }, { status: 409 });
    }

    await db.insert("metodos_pago", {
      codigo,
      nombre,
      descripcion: body.descripcion ? String(body.descripcion).trim() : null,
      orden: Number.isFinite(Number(body.orden)) ? Number(body.orden) : 50,
      activo: body.activo !== false,
      es_sistema: false,
      uso_operativo: body.usoOperativo !== false,
      uso_suscripcion: Boolean(body.usoSuscripcion),
    });

    return NextResponse.json({ data: { codigo } }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.startsWith("No autorizado")) {
      return NextResponse.json({ message }, { status: 401 });
    }
    if (message.startsWith("Acceso denegado")) {
      return forbiddenResponse(message);
    }
    console.error("[admin/metodos-pago POST]", error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
