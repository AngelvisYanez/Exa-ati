/**
 * Tests de membership multi-empresa con DB mockeada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({
  db: {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    queryOne: vi.fn(async () => null),
    queryAll: vi.fn(async () => []),
    insert: vi.fn(async () => ({ id: "nuevo-id" })),
    update: vi.fn(async () => []),
  },
}));

vi.mock("../plans-service", () => ({
  resolvePlan: vi.fn(async (codigo?: string | null) => {
    const map: Record<string, { codigo: string; nombre: string; maxEmpresas: number }> = {
      emprendedor: { codigo: "emprendedor", nombre: "Emprendedor", maxEmpresas: 1 },
      contador: { codigo: "contador", nombre: "Contador", maxEmpresas: 3 },
      despacho: { codigo: "despacho", nombre: "Despacho", maxEmpresas: 5 },
    };
    return map[codigo || "emprendedor"] || map.emprendedor;
  }),
}));

vi.mock("../rbac", () => ({
  invalidatePlanCache: vi.fn(),
}));

import { db } from "../db";
import {
  assertCanAddEmpresa,
  listEmpresasForUser,
  switchActiveTenant,
  userHasTenantAccess,
  createEmpresaInCuenta,
  getPlanCodigoForTenant,
} from "../membership";

describe("membership flows", () => {
  beforeEach(() => {
    vi.mocked(db.query).mockReset();
    vi.mocked(db.queryOne).mockReset();
    vi.mocked(db.queryAll).mockReset();
    vi.mocked(db.insert).mockReset();
    vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);
    vi.mocked(db.queryOne).mockResolvedValue(null);
    vi.mocked(db.queryAll).mockResolvedValue([]);
    vi.mocked(db.insert).mockResolvedValue({ id: "nuevo-id" } as never);
  });

  it("listEmpresasForUser usa tenant_usuarios cuando hay filas", async () => {
    vi.mocked(db.queryAll).mockResolvedValueOnce([
      {
        tenant_id: "t1",
        nombre: "Empresa A",
        ruc: "1790000000001",
        rol: "ADMIN",
        cuenta_id: "c1",
        activo: true,
      },
    ] as never);

    const list = await listEmpresasForUser("u1");
    expect(list).toEqual([
      {
        tenantId: "t1",
        nombre: "Empresa A",
        ruc: "1790000000001",
        rol: "ADMIN",
        cuentaId: "c1",
        activo: true,
      },
    ]);
  });

  it("listEmpresasForUser hace fallback a usuarios.tenant_id", async () => {
    vi.mocked(db.queryAll).mockRejectedValueOnce(new Error("no table"));
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce({ tenant_id: "legacy-t" } as never)
      .mockResolvedValueOnce({
        id: "legacy-t",
        nombre: "Legacy Co",
        ruc: null,
        cuenta_id: null,
      } as never);

    const list = await listEmpresasForUser("u1");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      tenantId: "legacy-t",
      nombre: "Legacy Co",
      rol: "ADMIN",
    });
  });

  it("userHasTenantAccess true por membership", async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ "?column?": 1 } as never);
    expect(await userHasTenantAccess("u1", "t1")).toBe(true);
  });

  it("userHasTenantAccess SUPERADMIN siempre true", async () => {
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce(null) // sin membership
      .mockResolvedValueOnce({ tenant_id: "otro", rol: "SUPERADMIN" } as never);
    expect(await userHasTenantAccess("u1", "t1")).toBe(true);
  });

  it("userHasTenantAccess niega tenant ajeno", async () => {
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ tenant_id: "otro", rol: "USER" } as never);
    expect(await userHasTenantAccess("u1", "t1")).toBe(false);
  });

  it("assertCanAddEmpresa bloquea cuando alcanza el cupo del plan", async () => {
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce({ plan_codigo: "emprendedor" } as never)
      .mockResolvedValueOnce({ c: 1 } as never);

    await expect(assertCanAddEmpresa("cuenta-1")).rejects.toThrow(/permite hasta 1 empresa/i);
  });

  it("assertCanAddEmpresa permite si hay cupo", async () => {
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce({ plan_codigo: "contador" } as never)
      .mockResolvedValueOnce({ c: 1 } as never);

    await expect(assertCanAddEmpresa("cuenta-1")).resolves.toBeUndefined();
  });

  it("createEmpresaInCuenta exige cuenta de billing", async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ cuenta_id: null } as never);
    await expect(
      createEmpresaInCuenta({
        usuarioId: "u1",
        activeTenantId: "t1",
        nombre: "Nueva",
      })
    ).rejects.toThrow(/cuenta de billing/i);
  });

  it("createEmpresaInCuenta niega sin acceso al tenant activo", async () => {
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce({ cuenta_id: "c1" } as never) // getCuentaIdForTenant
      .mockResolvedValueOnce(null) // membership
      .mockResolvedValueOnce({ tenant_id: "otro", rol: "USER" } as never);

    await expect(
      createEmpresaInCuenta({
        usuarioId: "u1",
        activeTenantId: "t1",
        nombre: "Nueva",
      })
    ).rejects.toThrow(/Acceso denegado/i);
  });

  it("createEmpresaInCuenta crea tenant + membership con cupo", async () => {
    vi.mocked(db.queryOne).mockImplementation(async (sql: string) => {
      const s = String(sql);
      if (s.includes("SELECT cuenta_id FROM tenants")) {
        return { cuenta_id: "c1" } as never;
      }
      if (s.includes("FROM tenant_usuarios")) {
        return { ok: 1 } as never;
      }
      if (s.includes("FROM cuentas WHERE id")) {
        return { plan_codigo: "contador" } as never;
      }
      if (s.includes("COUNT(*)")) {
        return { c: 1 } as never;
      }
      if (s.includes("c.plan_codigo") || s.includes("plan_codigo FROM tenants")) {
        return { plan_codigo: "contador" } as never;
      }
      return null;
    });
    vi.mocked(db.insert).mockResolvedValue({ id: "ok" } as never);

    const result = await createEmpresaInCuenta({
      usuarioId: "u1",
      activeTenantId: "t1",
      nombre: " Sucursal Norte ",
      ruc: "1790000000001",
    });

    expect(result.cuentaId).toBe("c1");
    expect(result.tenantId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(vi.mocked(db.insert).mock.calls.some((c) => c[0] === "tenants")).toBe(
      true
    );
  });

  it("switchActiveTenant actualiza usuarios.tenant_id", async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ ok: 1 } as never);
    await switchActiveTenant({ usuarioId: "u1", tenantId: "t2" });
    expect(vi.mocked(db.query)).toHaveBeenCalled();
    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(String(sql)).toMatch(/UPDATE usuarios SET tenant_id/i);
    expect(params).toEqual(["t2", "u1"]);
  });

  it("switchActiveTenant rechaza tenant sin acceso", async () => {
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ tenant_id: "otro", rol: "USER" } as never);
    await expect(
      switchActiveTenant({ usuarioId: "u1", tenantId: "t2" })
    ).rejects.toThrow(/No tienes acceso/i);
  });

  it("getPlanCodigoForTenant usa plan de la cuenta", async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({
      plan_codigo: "despacho",
    } as never);
    expect(await getPlanCodigoForTenant("t1")).toBe("despacho");
  });
});
