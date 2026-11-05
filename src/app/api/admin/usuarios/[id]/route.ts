import { NextResponse } from "next/server";
import { verifyAuth, requireTenantId } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";
import bcrypt from "bcryptjs";
import { forbiddenResponse, isValidActiveRol, requireModule } from "@/services/sri-api/rbac";
import {
  assignPlanToCuenta,
  getCuentaIdForUsuario,
} from "@/services/sri-api/membership";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, "admin");
    const { id } = await params;

    const usuario = await db.queryOne<Record<string, unknown>>(
      `SELECT u.*, t.nombre as tenant_nombre, t.cuenta_id,
              c.plan_codigo AS cuenta_plan_codigo,
              c.plan_periodo AS cuenta_plan_periodo,
              c.plan_estado AS cuenta_plan_estado,
              c.plan_vigente_hasta AS cuenta_plan_vigente_hasta,
              c.nombre AS cuenta_nombre
       FROM usuarios u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN cuentas c ON c.id = t.cuenta_id
       WHERE u.id = $1`,
      [id]
    );
    if (!usuario) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.rol === "ADMIN") {
      const tenantId = requireTenantId(user);
      if (usuario.tenant_id !== tenantId) {
        return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
      }
    }

    return NextResponse.json({
      data: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        tenantId: usuario.tenant_id,
        tenantNombre: usuario.tenant_nombre,
        cuentaId: usuario.cuenta_id || null,
        cuentaNombre: usuario.cuenta_nombre || null,
        planCodigo: usuario.cuenta_plan_codigo || null,
        planPeriodo: usuario.cuenta_plan_periodo || "mensual",
        planEstado: usuario.cuenta_plan_estado || null,
        planVigenteHasta: usuario.cuenta_plan_vigente_hasta || null,
        ruc: usuario.ruc,
        activo: Boolean(usuario.activo),
        createdAt: usuario.created_at,
        updatedAt: usuario.updated_at,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      { message },
      {
        status: message.startsWith("No autorizado")
          ? 401
          : message.includes("Acceso denegado")
            ? 403
            : 500,
      }
    );
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, "admin");
    const { id } = await params;
    const body = await req.json();
    const {
      email,
      nombre,
      password,
      rol,
      tenantId,
      ruc,
      activo,
      planCodigo,
      planPeriodo,
      planEstado,
      planVigenteHasta,
    } = body;

    const existing = await db.queryOne<Record<string, unknown>>(
      "SELECT * FROM usuarios WHERE id = $1",
      [id]
    );
    if (!existing) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.rol === "ADMIN") {
      const myTenantId = requireTenantId(user);
      if (existing.tenant_id !== myTenantId) {
        return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
      }
      if (existing.rol === "SUPERADMIN" || rol === "SUPERADMIN") {
        return NextResponse.json(
          { message: "No puedes modificar usuarios SUPERADMIN" },
          { status: 403 }
        );
      }
    }

    if (email && email !== existing.email) {
      const dup = await db.queryOne("SELECT id FROM usuarios WHERE email = $1 AND id != $2", [
        email,
        id,
      ]);
      if (dup) {
        return NextResponse.json(
          { message: "Ya existe otro usuario con ese email" },
          { status: 409 }
        );
      }
    }

    let resolvedRol = rol;
    if (rol !== undefined) {
      const requested = String(rol).trim().toUpperCase();
      if (!(await isValidActiveRol(requested))) {
        return NextResponse.json({ message: "Rol inválido o inactivo" }, { status: 400 });
      }
      resolvedRol = requested;
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (email !== undefined) {
      fields.push("email = $" + (fields.length + 1));
      values.push(email);
    }
    if (nombre !== undefined) {
      fields.push("nombre = $" + (fields.length + 1));
      values.push(nombre);
    }
    if (resolvedRol !== undefined) {
      fields.push("rol = $" + (fields.length + 1));
      values.push(resolvedRol);
    }
    if (tenantId !== undefined) {
      fields.push("tenant_id = $" + (fields.length + 1));
      values.push(tenantId || null);
    }
    if (ruc !== undefined) {
      fields.push("ruc = $" + (fields.length + 1));
      values.push(ruc || null);
    }
    if (activo !== undefined) {
      fields.push("activo = $" + (fields.length + 1));
      values.push(activo);
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      fields.push("password_hash = $" + (fields.length + 1));
      values.push(passwordHash);
    }

    if (fields.length > 0) {
      fields.push("updated_at = NOW()");
      await db.query(
        `UPDATE usuarios SET ${fields.join(", ")} WHERE id = $${values.length + 1}`,
        [...values, id]
      );
    }

    // Asignación de plan (SUPERADMIN / admin.planes)
    let planAssigned: string | null = null;
    if (planCodigo !== undefined && planCodigo !== null && user.rol === "SUPERADMIN") {
      const resolved = await getCuentaIdForUsuario(id);
      if (!resolved?.cuentaId && !resolved?.tenantId) {
        return NextResponse.json(
          {
            message:
              "El usuario no tiene empresa/cuenta de billing. Asigna una empresa antes de cambiar el plan.",
          },
          { status: 400 }
        );
      }
      const result = await assignPlanToCuenta({
        cuentaId: resolved.cuentaId,
        tenantIdFallback: resolved.tenantId,
        planCodigo: String(planCodigo),
        planPeriodo: planPeriodo === "anual" ? "anual" : "mensual",
        planEstado: planEstado || "activo",
        planVigenteHasta: planVigenteHasta === undefined ? undefined : planVigenteHasta,
        planOrigen: planCodigo === "cortesia" ? "manual" : "manual",
      });
      planAssigned = result.planCodigo;
    }

    const result = await db.queryOne<Record<string, unknown>>(
      `SELECT u.*, c.plan_codigo AS cuenta_plan_codigo
       FROM usuarios u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN cuentas c ON c.id = t.cuenta_id
       WHERE u.id = $1`,
      [id]
    );

    if (!result && fields.length === 0 && !planAssigned) {
      return NextResponse.json({ message: "No hay campos para actualizar" }, { status: 400 });
    }

    return NextResponse.json({
      data: {
        id: result?.id,
        email: result?.email,
        nombre: result?.nombre,
        rol: result?.rol,
        tenantId: result?.tenant_id,
        ruc: result?.ruc,
        activo: Boolean(result?.activo),
        planCodigo: planAssigned || result?.cuenta_plan_codigo || null,
        updatedAt: result?.updated_at,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.includes("Acceso denegado") && !message.startsWith("No autorizado")) {
      return forbiddenResponse(message);
    }
    return NextResponse.json(
      { message },
      {
        status: message.startsWith("No autorizado")
          ? 401
          : message.includes("Acceso denegado")
            ? 403
            : 500,
      }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, "admin");
    const { id } = await params;

    const existing = await db.queryOne<Record<string, unknown>>(
      "SELECT * FROM usuarios WHERE id = $1",
      [id]
    );
    if (!existing) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
    }

    if (existing.id === user.sub) {
      return NextResponse.json({ message: "No puedes eliminarte a ti mismo" }, { status: 400 });
    }

    if (user.rol === "ADMIN") {
      const myTenantId = requireTenantId(user);
      if (existing.tenant_id !== myTenantId) {
        return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
      }
      if (existing.rol === "SUPERADMIN" || existing.rol === "ADMIN") {
        return NextResponse.json(
          { message: "No puedes eliminar otros administradores" },
          { status: 403 }
        );
      }
    }

    await db.query("DELETE FROM usuarios WHERE id = $1", [id]);

    return NextResponse.json({ message: "Usuario eliminado correctamente" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      { message },
      {
        status: message.startsWith("No autorizado")
          ? 401
          : message.includes("Acceso denegado")
            ? 403
            : 500,
      }
    );
  }
}
