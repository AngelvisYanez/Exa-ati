import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { requireModule, forbiddenResponse } from "@/services/sri-api/rbac";
import { db } from "@/services/sri-api/db";

async function requireMetodosAdmin(req: Request) {
  const user = await verifyAuth(req);
  await requireModule(user, "admin.metodos-pago");
  return user;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    await requireMetodosAdmin(req);
    const { codigo: raw } = await params;
    const codigo = decodeURIComponent(raw).toUpperCase();

    const row = await db.queryOne<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      orden: number | string;
      activo: boolean | number;
      es_sistema: boolean | number;
      uso_operativo: boolean | number;
      uso_suscripcion: boolean | number;
    }>(
      `SELECT codigo, nombre, descripcion, orden, activo, es_sistema, uso_operativo, uso_suscripcion
       FROM metodos_pago WHERE codigo = $1`,
      [codigo]
    );

    if (!row) {
      return NextResponse.json({ message: "Método no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        codigo: row.codigo,
        nombre: row.nombre,
        descripcion: row.descripcion,
        orden: Number(row.orden),
        activo: Boolean(row.activo),
        esSistema: Boolean(row.es_sistema),
        usoOperativo: Boolean(row.uso_operativo),
        usoSuscripcion: Boolean(row.uso_suscripcion),
      },
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

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    await requireMetodosAdmin(req);
    const { codigo: raw } = await params;
    const codigo = decodeURIComponent(raw).toUpperCase();
    const body = await req.json();

    const existing = await db.queryOne<{ codigo: string; es_sistema: boolean | number }>(
      `SELECT codigo, es_sistema FROM metodos_pago WHERE codigo = $1`,
      [codigo]
    );
    if (!existing) {
      return NextResponse.json({ message: "Método no encontrado" }, { status: 404 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    const push = (col: string, val: unknown) => {
      values.push(val);
      fields.push(`${col} = $${values.length}`);
    };

    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim();
      if (!nombre) {
        return NextResponse.json({ message: "El nombre es obligatorio" }, { status: 400 });
      }
      push("nombre", nombre);
    }
    if (body.descripcion !== undefined) {
      push("descripcion", body.descripcion ? String(body.descripcion).trim() : null);
    }
    if (body.orden !== undefined) {
      push("orden", Number(body.orden) || 0);
    }
    if (body.activo !== undefined) {
      push("activo", Boolean(body.activo));
    }
    if (body.usoOperativo !== undefined) {
      push("uso_operativo", Boolean(body.usoOperativo));
    }
    if (body.usoSuscripcion !== undefined) {
      push("uso_suscripcion", Boolean(body.usoSuscripcion));
    }

    if (fields.length === 0) {
      return NextResponse.json({ message: "No hay campos para actualizar" }, { status: 400 });
    }

    fields.push("updated_at = NOW()");
    values.push(codigo);
    await db.query(
      `UPDATE metodos_pago SET ${fields.join(", ")} WHERE codigo = $${values.length}`,
      values
    );

    return NextResponse.json({ success: true });
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    await requireMetodosAdmin(req);
    const { codigo: raw } = await params;
    const codigo = decodeURIComponent(raw).toUpperCase();

    const existing = await db.queryOne<{
      codigo: string;
      es_sistema: boolean | number;
      nombre: string;
    }>(`SELECT codigo, es_sistema, nombre FROM metodos_pago WHERE codigo = $1`, [codigo]);

    if (!existing) {
      return NextResponse.json({ message: "Método no encontrado" }, { status: 404 });
    }
    if (Boolean(existing.es_sistema)) {
      return NextResponse.json(
        { message: "No se pueden eliminar métodos de sistema. Desactívalos." },
        { status: 409 }
      );
    }

    const used = await db
      .queryOne<{ c: string | number }>(
        `SELECT COUNT(*) AS c FROM pagos_suscripcion WHERE metodo_pago_codigo = $1`,
        [codigo]
      )
      .catch(() => ({ c: 0 }));

    if (Number(used?.c ?? 0) > 0) {
      return NextResponse.json(
        {
          message: `No se puede eliminar "${existing.nombre}": tiene pagos de suscripción asociados. Desactívalo.`,
        },
        { status: 409 }
      );
    }

    await db.query(`DELETE FROM metodos_pago WHERE codigo = $1`, [codigo]);
    return NextResponse.json({ message: "Método eliminado" });
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
