import { describe, expect, it } from "vitest";
import {
  isPathAllowedWhenVencido,
  VENCIDO_ALLOWED_PREFIXES,
} from "@/lib/subscription-access";

describe("subscription-access (UI gate)", () => {
  it("incluye rutas de renovación y auth", () => {
    expect(VENCIDO_ALLOWED_PREFIXES).toContain("/suscripcion");
    expect(VENCIDO_ALLOWED_PREFIXES).toContain("/facturacion");
    expect(VENCIDO_ALLOWED_PREFIXES).toContain("/configuracion");
    expect(VENCIDO_ALLOWED_PREFIXES).toContain("/iniciar-sesion");
  });

  it("permite panel de suscripción y subrutas", () => {
    expect(isPathAllowedWhenVencido("/suscripcion")).toBe(true);
    expect(isPathAllowedWhenVencido("/suscripcion/pagar")).toBe(true);
    expect(isPathAllowedWhenVencido("/facturacion")).toBe(true);
    expect(isPathAllowedWhenVencido("/configuracion/certificado")).toBe(true);
  });

  it("bloquea módulos operativos con plan vencido", () => {
    expect(isPathAllowedWhenVencido("/panel")).toBe(false);
    expect(isPathAllowedWhenVencido("/emitir")).toBe(false);
    expect(isPathAllowedWhenVencido("/documentos")).toBe(false);
    expect(isPathAllowedWhenVencido("/punto-de-venta")).toBe(false);
    expect(isPathAllowedWhenVencido("/asistente")).toBe(false);
  });

  it("no confunde prefijos parciales", () => {
    expect(isPathAllowedWhenVencido("/suscripcionx")).toBe(false);
    expect(isPathAllowedWhenVencido("/config")).toBe(false);
  });
});
