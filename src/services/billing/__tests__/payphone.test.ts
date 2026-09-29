import { describe, expect, it } from "vitest";
import {
  addPeriodo,
  buildAmountBreakdown,
  createClientTransactionId,
  fromCentavos,
  isPayphoneApproved,
  toCentavos,
} from "@/services/billing/payphone";
import { computeVigenteHasta } from "@/services/billing/subscription-checkout";

describe("payphone amounts", () => {
  it("convierte USD a centavos", () => {
    expect(toCentavos(19)).toBe(1900);
    expect(toCentavos(19.99)).toBe(1999);
    expect(fromCentavos(1900)).toBe(19);
  });

  it("sin IVA usa amountWithoutTax", () => {
    const b = buildAmountBreakdown(49, 0);
    expect(b).toEqual({
      amount: 4900,
      amountWithoutTax: 4900,
      amountWithTax: 0,
      tax: 0,
    });
  });

  it("con IVA 15% desglosa total incluido", () => {
    const b = buildAmountBreakdown(11.5, 15);
    expect(b.amount).toBe(1150);
    expect(b.amountWithTax + b.tax).toBe(1150);
    expect(b.amountWithoutTax).toBe(0);
  });

  it("clientTransactionId es corto y único", () => {
    const a = createClientTransactionId();
    const b = createClientTransactionId();
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(30);
  });

  it("addPeriodo mensual y anual", () => {
    const base = new Date("2026-01-15T12:00:00Z");
    expect(addPeriodo(base, "mensual").getUTCMonth()).toBe(1);
    expect(addPeriodo(base, "anual").getUTCFullYear()).toBe(2027);
  });
});

describe("computeVigenteHasta", () => {
  it("acumula sobre vigencia futura", () => {
    const from = new Date("2026-03-01T12:00:00Z");
    const vigente = new Date("2026-04-15T12:00:00Z");
    const next = computeVigenteHasta("mensual", vigente, from);
    expect(next.toISOString().slice(0, 10)).toBe("2026-05-15");
  });

  it("parte de now si ya venció", () => {
    const from = new Date("2026-03-01T12:00:00Z");
    const vencida = new Date("2026-02-01T12:00:00Z");
    const next = computeVigenteHasta("mensual", vencida, from);
    expect(next.toISOString().slice(0, 10)).toBe("2026-04-01");
  });
});

describe("payphone aprobación", () => {
  it("isPayphoneApproved acepta statusCode 3 o Approved", () => {
    expect(
      isPayphoneApproved({
        statusCode: 3,
        transactionStatus: "Pending",
        clientTransactionId: "x",
        message: null,
        raw: {},
      })
    ).toBe(true);
    expect(
      isPayphoneApproved({
        statusCode: 1,
        transactionStatus: "Approved",
        clientTransactionId: "x",
        message: null,
        raw: {},
      })
    ).toBe(true);
    expect(
      isPayphoneApproved({
        statusCode: 1,
        transactionStatus: "Canceled",
        clientTransactionId: "x",
        message: null,
        raw: {},
      })
    ).toBe(false);
  });
});
