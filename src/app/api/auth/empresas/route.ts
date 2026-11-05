import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { config } from "@/services/sri-api/config";
import { setAuthCookies, apiError } from "@/lib/auth-cookies";
import {
  createEmpresaInCuenta,
  listEmpresasForUser,
  switchActiveTenant,
} from "@/services/sri-api/membership";
import { getEffectiveModules } from "@/services/sri-api/rbac";
import { resolvePlan } from "@/services/sri-api/plans-service";
import { countEmpresasInCuenta, getCuentaIdForTenant } from "@/services/sri-api/membership";
import { z } from "zod";

/** Lista empresas (tenants) a las que el usuario tiene acceso. */
export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const empresas = await listEmpresasForUser(user.sub);
    const activeId = user.tenantId;
    let maxEmpresas = 1;
    let empresasCount = empresas.length;
    if (activeId) {
      const cuentaId = await getCuentaIdForTenant(activeId);
      if (cuentaId) {
        empresasCount = await countEmpresasInCuenta(cuentaId);
        const { planCodigo } = await getEffectiveModules(user.rol, activeId);
        const plan = await resolvePlan(planCodigo);
        maxEmpresas = plan.maxEmpresas;
      }
    }
    return NextResponse.json({
      data: {
        activeTenantId: activeId,
        empresas,
        empresasCount,
        maxEmpresas,
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

const switchSchema = z.object({
  tenantId: z.string().uuid(),
});

/** Cambia la empresa activa (JWT + usuarios.tenant_id). Datos quedan aislados por tenant. */
export async function PUT(req: Request) {
  try {
    const user = await verifyAuth(req);
    const parsed = switchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("tenantId inválido", 400);
    }

    await switchActiveTenant({
      usuarioId: user.sub,
      tenantId: parsed.data.tenantId,
    });

    const { modulos, planCodigo } = await getEffectiveModules(
      user.rol,
      parsed.data.tenantId
    );
    const plan = await resolvePlan(planCodigo);

    const payload = {
      sub: user.sub,
      email: user.email,
      rol: user.rol,
      tenantId: parsed.data.tenantId,
      type: "access",
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiration as jwt.SignOptions["expiresIn"],
    });
    const decoded = jwt.decode(accessToken) as { exp?: number } | null;
    const exp = decoded?.exp || Math.floor(Date.now() / 1000) + 28800;
    const expiresIn = Math.max(0, exp - Math.floor(Date.now() / 1000));

    const refreshToken = jwt.sign(
      { ...payload, type: "refresh" },
      config.jwt.secret,
      { expiresIn: "7d" }
    );

    const empresas = await listEmpresasForUser(user.sub);
    const active = empresas.find((e) => e.tenantId === parsed.data.tenantId);

    const response = NextResponse.json({
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn,
      user: {
        id: user.sub,
        email: user.email,
        rol: user.rol,
        tenantId: parsed.data.tenantId,
        planCodigo: plan.codigo,
        planNombre: plan.nombre,
        maxEmpresas: plan.maxEmpresas,
        precioMensual: plan.precioMensual,
        moneda: plan.moneda,
        modulos,
        empresaActiva: active
          ? { id: active.tenantId, nombre: active.nombre, ruc: active.ruc }
          : null,
        empresas: empresas.map((e) => ({
          id: e.tenantId,
          nombre: e.nombre,
          ruc: e.ruc,
        })),
      },
    });

    setAuthCookies(response, {
      accessToken,
      refreshToken,
      maxAgeSec: expiresIn > 0 ? expiresIn : 60 * 60 * 24,
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return apiError(message, message.startsWith("No autorizado") ? 401 : 403);
  }
}

const createSchema = z.object({
  nombre: z.string().trim().min(2).max(255),
  ruc: z.string().trim().max(13).optional().nullable(),
});

/** Crea una nueva empresa (tenant) bajo la misma cuenta, si el plan tiene cupo. */
export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    if (!user.tenantId) {
      return apiError("Usuario sin empresa activa", 403);
    }
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("Datos inválidos", 400);
    }

    const created = await createEmpresaInCuenta({
      usuarioId: user.sub,
      activeTenantId: user.tenantId,
      nombre: parsed.data.nombre,
      ruc: parsed.data.ruc,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          tenantId: created.tenantId,
          cuentaId: created.cuentaId,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return apiError(
      message,
      message.startsWith("No autorizado") ? 401 : message.includes("permite hasta") ? 403 : 400
    );
  }
}
