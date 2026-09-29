import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN,
  FALLBACK_PLANS,
  getPlan,
  intersectModules,
  planAllowsModule,
  slugifyPlanCodigo,
} from "@/lib/plans";

describe("plans", () => {
  it("default es emprendedor con 1 empresa", () => {
    expect(DEFAULT_PLAN).toBe("emprendedor");
    expect(getPlan(undefined).maxEmpresas).toBe(1);
    expect(getPlan("no-existe").codigo).toBe("emprendedor");
  });

  it("emprendedor no incluye declaraciones ni control tributario", () => {
    expect(planAllowsModule("emprendedor", "declaraciones")).toBe(false);
    expect(planAllowsModule("emprendedor", "control-tributario")).toBe(false);
    expect(planAllowsModule("emprendedor", "emitir")).toBe(true);
  });

  it("contador permite ATS/declaraciones y cap 3", () => {
    expect(FALLBACK_PLANS.contador.maxEmpresas).toBe(3);
    expect(planAllowsModule("contador", "declaraciones")).toBe(true);
    expect(planAllowsModule("contador", "nomina")).toBe(false);
  });

  it("despacho incluye nómina y admin.roles, cap 5", () => {
    expect(FALLBACK_PLANS.despacho.maxEmpresas).toBe(5);
    expect(planAllowsModule("despacho", "nomina")).toBe(true);
    expect(planAllowsModule("despacho", "admin.roles")).toBe(true);
    expect(planAllowsModule("despacho", "admin.empresas")).toBe(false);
  });

  it("intersectModules aplica rol ∩ plan", () => {
    const rol = ["dashboard", "emitir", "declaraciones", "nomina", "admin.empresas"];
    expect(intersectModules(rol, "emprendedor")).toEqual(["dashboard", "emitir"]);
    expect(intersectModules(rol, "contador")).toEqual([
      "dashboard",
      "emitir",
      "declaraciones",
    ]);
    expect(intersectModules(rol, "despacho")).toEqual([
      "dashboard",
      "emitir",
      "declaraciones",
      "nomina",
    ]);
  });

  it("slugifyPlanCodigo normaliza nombres", () => {
    expect(slugifyPlanCodigo("Plan Pro 2026")).toBe("plan-pro-2026");
  });

  it("fallback incluye precios", () => {
    expect(FALLBACK_PLANS.emprendedor.precioMensual).toBeGreaterThan(0);
    expect(FALLBACK_PLANS.contador.precioMensual).toBeGreaterThan(
      FALLBACK_PLANS.emprendedor.precioMensual
    );
  });
});
