import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { requireModule, forbiddenResponse } from "@/services/sri-api/rbac";
import { db } from "@/services/sri-api/db";
import {
  countTenantsOnPlan,
  invalidatePlanDefinitionsCache,
  resolvePlan,
} from "@/services/sri-api/plans-service";

async function requirePlanesAdmin(req: Request) {
  const user = await verifyAuth(req);
  await requireModule(user, "admin.planes");
  return user;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    await requirePlanesAdmin(req);
    const { codigo: raw } = await params;
    const codigo = decodeURIComponent(raw);

    const row = await db.queryOne<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      max_empresas: number | string;
      precio_mensual: number | string;
      precio_anual: number | string | null;
      moneda: string;
      orden: number;
      activo: boolean | number;
      es_sistema: boolean | number;
    }>(
      `SELECT codigo, nombre, descripcion, max_empresas, precio_mensual, precio_anual,
              moneda, orden, activo, es_sistema
       FROM planes_suscripcion WHERE codigo = $1`,
      [codigo]
    );

    if (!row) {
      // Fallback estático solo lectura
      const fallback = await resolvePlan(codigo);
      if (fallback.codigo !== codigo && codigo !== "emprendedor") {
        return NextResponse.json({ message: "Plan no encontrado" }, { status: 404 });
      }
      return NextResponse.json({
        data: {
          ...fallback,
          tenantsCount: 0,
          modulos: [...fallback.modulos],
        },
      });
    }

    const modulos = await db.queryAll<{ modulo_codigo: string }>(
      `SELECT modulo_codigo FROM plan_modulos WHERE plan_codigo = $1`,
      [codigo]
    );

    return NextResponse.json({
      data: {
        codigo: row.codigo,
        nombre: row.nombre,
        descripcion: row.descripcion,
        maxEmpresas: Number(row.max_empresas),
        precioMensual: Number(row.precio_mensual),
        precioAnual:
          row.precio_anual === null || row.precio_anual === undefined
            ? null
            : Number(row.precio_anual),
        moneda: row.moneda,
        orden: Number(row.orden),
        activo: Boolean(row.activo),
        esSistema: Boolean(row.es_sistema),
        modulos: modulos.map((m) => m.modulo_codigo),
        tenantsCount: await countTenantsOnPlan(codigo),
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
    await requirePlanesAdmin(req);
    const { codigo: raw } = await params;
    const codigo = decodeURIComponent(raw);
    const body = await req.json();

    const existing = await db.queryOne<{ codigo: string; es_sistema: boolean | number }>(
      `SELECT codigo, es_sistema FROM planes_suscripcion WHERE codigo = $1`,
      [codigo]
    );
    if (!existing) {
      return NextResponse.json({ message: "Plan no encontrado" }, { status: 404 });
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
    if (body.maxEmpresas !== undefined) {
      push("max_empresas", Math.max(1, Math.min(50, Number(body.maxEmpresas) || 1)));
    }
    if (body.precioMensual !== undefined) {
      push("precio_mensual", Math.max(0, Number(body.precioMensual) || 0));
    }
    if (body.precioAnual !== undefined) {
      push(
        "precio_anual",
        body.precioAnual === null || body.precioAnual === ""
          ? null
          : Math.max(0, Number(body.precioAnual))
      );
    }
    if (body.moneda !== undefined) {
      push("moneda", String(body.moneda || "USD").slice(0, 3).toUpperCase());
    }
    if (body.orden !== undefined) {
      push("orden", Number(body.orden) || 0);
    }
    if (body.activo !== undefined && !Boolean(existing.es_sistema)) {
      push("activo", Boolean(body.activo));
    } else if (body.activo !== undefined && Boolean(existing.es_sistema)) {
      // planes sistema siempre activos
      push("activo", true);
    }

    if (fields.length === 0) {
      return NextResponse.json({ message: "No hay campos para actualizar" }, { status: 400 });
    }

    fields.push("updated_at = NOW()");
    values.push(codigo);
    await db.query(
      `UPDATE planes_suscripcion SET ${fields.join(", ")} WHERE codigo = $${values.length}`,
      values
    );

    invalidatePlanDefinitionsCache(codigo);
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
    await requirePlanesAdmin(req);
    const { codigo: raw } = await params;
    const codigo = decodeURIComponent(raw);

    const existing = await db.queryOne<{ codigo: string; es_sistema: boolean | number; nombre: string }>(
      `SELECT codigo, es_sistema, nombre FROM planes_suscripcion WHERE codigo = $1`,
      [codigo]
    );
    if (!existing) {
      return NextResponse.json({ message: "Plan no encontrado" }, { status: 404 });
    }
    if (Boolean(existing.es_sistema)) {
      return NextResponse.json(
        { message: "No se pueden eliminar planes de sistema. Desactívalos o edítalos." },
        { status: 409 }
      );
    }

    const tenants = await countTenantsOnPlan(codigo);
    if (tenants > 0) {
      return NextResponse.json(
        {
          message: `No se puede eliminar "${existing.nombre}": tiene ${tenants} empresa(s) asignada(s). Cámbiales el plan primero.`,
        },
        { status: 409 }
      );
    }

    await db.query(`DELETE FROM planes_suscripcion WHERE codigo = $1`, [codigo]);
    invalidatePlanDefinitionsCache(codigo);
    return NextResponse.json({ message: "Plan eliminado" });
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
