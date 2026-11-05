/**
 * Flujos de checkout / confirmación PayPhone con DB y PayPhone mockeados.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/sri-api/db", () => ({
  db: {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    queryOne: vi.fn(async () => null),
    queryAll: vi.fn(async () => []),
    insert: vi.fn(async () => ({ id: "pago-1" })),
  },
}));

vi.mock("@/services/sri-api/rbac", () => ({
  invalidatePlanCache: vi.fn(),
}));

vi.mock("@/services/sri-api/plans-service", () => ({
  resolvePlan: vi.fn(async () => ({
    codigo: "contador",
    nombre: "Contador",
    descripcion: "",
    maxEmpresas: 3,
    precioMensual: 49,
    precioAnual: 490,
    moneda: "USD",
    orden: 20,
    activo: true,
    esSistema: true,
    modulos: ["emitir"],
  })),
}));

vi.mock("@/services/billing/payphone", async () => {
  const actual = await vi.importActual<typeof import("@/services/billing/payphone")>(
    "@/services/billing/payphone"
  );
  return {
    ...actual,
    getPayphoneConfig: vi.fn(),
    preparePayphonePayment: vi.fn(),
    createPayphonePaymentLink: vi.fn(),
    confirmPayphonePayment: vi.fn(),
  };
});

import { db } from "@/services/sri-api/db";
import {
  getPayphoneConfig,
  createPayphonePaymentLink,
  confirmPayphonePayment,
} from "@/services/billing/payphone";
import {
  startSubscriptionCheckout,
  confirmSubscriptionPayment,
  applyPayphoneLinkNotification,
} from "@/services/billing/subscription-checkout";

describe("subscription-checkout flows", () => {
  beforeEach(() => {
    vi.mocked(db.query).mockReset();
    vi.mocked(db.queryOne).mockReset();
    vi.mocked(db.insert).mockReset();
    vi.mocked(getPayphoneConfig).mockReset();
    vi.mocked(createPayphonePaymentLink).mockReset();
    vi.mocked(confirmPayphonePayment).mockReset();
    vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);
    vi.mocked(db.queryOne).mockResolvedValue(null);
    vi.mocked(db.insert).mockResolvedValue({ id: "pago-1" } as never);
  });

  it("startSubscriptionCheckout falla si PayPhone no está configurado", async () => {
    vi.mocked(getPayphoneConfig).mockReturnValue(null);
    await expect(
      startSubscriptionCheckout({
        tenantId: "t1",
        userId: "u1",
        userEmail: "a@b.com",
        planCodigo: "contador",
        periodo: "mensual",
      })
    ).rejects.toThrow(/PayPhone no configurado/i);
  });

  it("startSubscriptionCheckout crea Payment Link y retorna URL", async () => {
    vi.mocked(getPayphoneConfig).mockReturnValue({
      token: "tok",
      storeId: "store",
      apiBase: "https://pay.example",
      appUrl: "https://app.example",
      ivaPercent: 0,
    });
    vi.mocked(db.queryOne).mockResolvedValue({ cuenta_id: "c1" } as never);
    vi.mocked(createPayphonePaymentLink).mockResolvedValue({
      paymentUrl: "https://pay.example/link/abc",
      clientTransactionId: "subabc123",
      raw: "https://pay.example/link/abc",
    });

    const result = await startSubscriptionCheckout({
      tenantId: "t1",
      userId: "u1",
      userEmail: "a@b.com",
      planCodigo: "contador",
      periodo: "mensual",
    });

    expect(result.pagoId).toBe("pago-1");
    expect(result.amountCents).toBe(4900);
    expect(result.paymentUrl).toContain("link");
    expect(result.payWithCard).toBe(result.paymentUrl);
    expect(vi.mocked(db.insert).mock.calls[0][0]).toBe("pagos_suscripcion");
    expect(vi.mocked(createPayphonePaymentLink)).toHaveBeenCalled();
  });

  it("applyPayphoneLinkNotification activa con Succeeded", async () => {
    vi.mocked(db.queryOne).mockImplementation(async (sql: string) => {
      const s = String(sql);
      if (s.includes("FROM pagos_suscripcion")) {
        return {
          id: "pago-1",
          tenant_id: "t1",
          cuenta_id: "c1",
          plan_codigo: "contador",
          periodo: "mensual",
          estado: "preparado",
          monto_centavos: 4900,
        } as never;
      }
      if (s.includes("plan_vigente_hasta")) {
        return { plan_vigente_hasta: null } as never;
      }
      return null;
    });

    const result = await applyPayphoneLinkNotification({
      clientTransactionId: "subabc123",
      transactionStatus: "Succeeded",
      transactionId: 99,
      amount: 4900,
    });

    expect(result.estado).toBe("aprobado");
    expect(result.planCodigo).toBe("contador");
  });

  it("confirmSubscriptionPayment idempotente si ya aprobado", async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({
      id: "pago-1",
      tenant_id: "t1",
      cuenta_id: "c1",
      plan_codigo: "contador",
      periodo: "mensual",
      estado: "aprobado",
      monto_centavos: 4900,
    } as never);

    const result = await confirmSubscriptionPayment({
      payphoneId: 1,
      clientTransactionId: "sub-abc",
      expectedTenantId: "t1",
    });

    expect(result.estado).toBe("aprobado");
    expect(result.message).toMatch(/ya confirmado/i);
    expect(vi.mocked(confirmPayphonePayment)).not.toHaveBeenCalled();
  });

  it("confirmSubscriptionPayment rechaza pago de otro tenant", async () => {
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce({
        id: "pago-1",
        tenant_id: "t-otro",
        cuenta_id: "c-otro",
        plan_codigo: "contador",
        periodo: "mensual",
        estado: "preparado",
        monto_centavos: 4900,
      } as never)
      .mockResolvedValueOnce({ cuenta_id: "c1" } as never);

    await expect(
      confirmSubscriptionPayment({
        payphoneId: 1,
        clientTransactionId: "sub-abc",
        expectedTenantId: "t1",
      })
    ).rejects.toThrow(/no pertenece a tu empresa/i);
  });

  it("confirmSubscriptionPayment activa suscripción al aprobar", async () => {
    vi.mocked(db.queryOne).mockImplementation(async (sql: string) => {
      const s = String(sql);
      if (s.includes("FROM pagos_suscripcion")) {
        return {
          id: "pago-1",
          tenant_id: "t1",
          cuenta_id: "c1",
          plan_codigo: "contador",
          periodo: "mensual",
          estado: "preparado",
          monto_centavos: 4900,
        } as never;
      }
      if (s.includes("plan_vigente_hasta")) {
        return { plan_vigente_hasta: null } as never;
      }
      return null;
    });
    vi.mocked(confirmPayphonePayment).mockResolvedValue({
      statusCode: 3,
      transactionStatus: "Approved",
      clientTransactionId: "sub-abc",
      transactionId: 55,
      authorizationCode: "AUTH",
      amount: 4900,
      message: null,
      raw: {},
    });

    const result = await confirmSubscriptionPayment({
      payphoneId: 55,
      clientTransactionId: "sub-abc",
    });

    expect(result.estado).toBe("aprobado");
    expect(result.planCodigo).toBe("contador");
    expect(result.message).toMatch(/activada/i);
    const updates = vi.mocked(db.query).mock.calls.map((c) => String(c[0]));
    expect(updates.some((s) => s.includes("UPDATE cuentas"))).toBe(true);
  });

  it("confirmSubscriptionPayment marca cancelado si PayPhone no aprueba", async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({
      id: "pago-1",
      tenant_id: "t1",
      cuenta_id: "c1",
      plan_codigo: "contador",
      periodo: "mensual",
      estado: "preparado",
      monto_centavos: 4900,
    } as never);
    vi.mocked(confirmPayphonePayment).mockResolvedValue({
      statusCode: 2,
      transactionStatus: "Canceled",
      clientTransactionId: "sub-abc",
      message: "Usuario canceló",
      raw: {},
    });

    const result = await confirmSubscriptionPayment({
      payphoneId: 1,
      clientTransactionId: "sub-abc",
    });

    expect(result.estado).toBe("cancelado");
    expect(result.message).toMatch(/cancel/i);
  });
});
