import { describe, expect, it } from "vitest";
import {
  isPathAllowedWhenVencido,
  VENCIDO_ALLOWED_PREFIXES,
} from "@/services/billing/subscription-lifecycle";
import { VENCIDO_ALLOWED_PREFIXES as UI_PREFIXES } from "@/lib/subscription-access";

describe("subscription-lifecycle path gate (server)", () => {
  it("extiende prefijos UI con APIs de renovación/auth", () => {
    for (const p of UI_PREFIXES) {
      expect(VENCIDO_ALLOWED_PREFIXES).toContain(p);
    }
    expect(VENCIDO_ALLOWED_PREFIXES).toContain("/api/billing");
    expect(VENCIDO_ALLOWED_PREFIXES).toContain("/api/auth");
    expect(VENCIDO_ALLOWED_PREFIXES).toContain("/api/notificaciones");
  });

  it("permite APIs necesarias para renovar estando vencido", () => {
    expect(isPathAllowedWhenVencido("/api/billing/checkout")).toBe(true);
    expect(isPathAllowedWhenVencido("/api/auth/me")).toBe(true);
    expect(isPathAllowedWhenVencido("/api/notificaciones")).toBe(true);
  });

  it("bloquea APIs operativas con plan vencido", () => {
    expect(isPathAllowedWhenVencido("/api/sri/emitir")).toBe(false);
    expect(isPathAllowedWhenVencido("/api/ecommerce/invoices")).toBe(false);
    expect(isPathAllowedWhenVencido("/api/pos/ventas")).toBe(false);
  });
});
