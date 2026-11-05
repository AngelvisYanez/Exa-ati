import { db } from "@/services/sri-api/db";
import { invalidatePlanCache } from "@/services/sri-api/rbac";
import { resolvePlan } from "@/services/sri-api/plans-service";
import {
  addPeriodo,
  buildAmountBreakdown,
  confirmPayphonePayment,
  createClientTransactionId,
  createPayphonePaymentLink,
  getPayphoneConfig,
  isPayphoneApproved,
  isPayphoneLinkApproved,
  type PayphonePeriodo,
} from "@/services/billing/payphone";

export type { PayphonePeriodo };

async function resolveCuentaId(tenantId: string): Promise<string | null> {
  const row = await db.queryOne<{ cuenta_id: string | null }>(
    `SELECT cuenta_id FROM tenants WHERE id = $1`,
    [tenantId]
  );
  return row?.cuenta_id || null;
}

/** Extiende vigencia desde la fecha vigente actual si aún no venció. */
export function computeVigenteHasta(
  periodo: PayphonePeriodo,
  vigenteActual: Date | string | null | undefined,
  from: Date = new Date()
): Date {
  const base =
    vigenteActual && new Date(vigenteActual).getTime() > from.getTime()
      ? new Date(vigenteActual)
      : from;
  return addPeriodo(base, periodo);
}

type PagoRow = {
  id: string;
  tenant_id: string;
  cuenta_id: string | null;
  plan_codigo: string;
  periodo: string;
  estado: string;
  monto_centavos: number;
};

async function activateSubscriptionFromPago(
  pago: PagoRow,
  meta?: {
    transactionId?: number | string | null;
    authorizationCode?: string | null;
    rawConfirm?: unknown;
  }
): Promise<{
  estado: "aprobado";
  planCodigo: string;
  periodo: PayphonePeriodo;
  pagoId: string;
  message: string;
}> {
  if (pago.estado === "aprobado") {
    return {
      estado: "aprobado",
      planCodigo: pago.plan_codigo,
      periodo: (pago.periodo === "anual" ? "anual" : "mensual") as PayphonePeriodo,
      pagoId: pago.id,
      message: "Pago ya confirmado",
    };
  }

  const periodo = (pago.periodo === "anual" ? "anual" : "mensual") as PayphonePeriodo;

  let cuentaId = pago.cuenta_id;
  if (!cuentaId) {
    cuentaId = await resolveCuentaId(pago.tenant_id);
  }

  let vigenteActual: Date | null = null;
  if (cuentaId) {
    const c = await db.queryOne<{ plan_vigente_hasta: Date | string | null }>(
      `SELECT plan_vigente_hasta FROM cuentas WHERE id = $1`,
      [cuentaId]
    );
    vigenteActual = c?.plan_vigente_hasta
      ? new Date(c.plan_vigente_hasta)
      : null;
  }

  const vigenteHasta = computeVigenteHasta(periodo, vigenteActual);

  await db.query(
    `UPDATE pagos_suscripcion SET
       estado = 'aprobado',
       cuenta_id = COALESCE(cuenta_id, $2),
       payphone_tx_id = COALESCE($3, payphone_tx_id),
       authorization_code = COALESCE($4, authorization_code),
       raw_confirm = COALESCE($5::jsonb, raw_confirm),
       confirmed_at = COALESCE(confirmed_at, NOW()),
       updated_at = NOW()
     WHERE id = $1`,
    [
      pago.id,
      cuentaId,
      meta?.transactionId != null ? String(meta.transactionId) : null,
      meta?.authorizationCode ?? null,
      meta?.rawConfirm != null ? JSON.stringify(meta.rawConfirm) : null,
    ]
  );

  if (cuentaId) {
    try {
      await db.query(
        `UPDATE cuentas SET
           plan_codigo = $1,
           plan_periodo = $2,
           plan_vigente_hasta = $3,
           plan_estado = 'activo',
           plan_origen = 'payphone',
           ultimo_pago_id = $4,
           updated_at = NOW()
         WHERE id = $5`,
        [
          pago.plan_codigo,
          periodo,
          vigenteHasta.toISOString(),
          pago.id,
          cuentaId,
        ]
      );
    } catch (err) {
      console.warn("[payphone] update cuentas (con estado):", err);
      await db.query(
        `UPDATE cuentas SET
           plan_codigo = $1,
           plan_periodo = $2,
           plan_vigente_hasta = $3,
           plan_origen = 'payphone',
           updated_at = NOW()
         WHERE id = $4`,
        [pago.plan_codigo, periodo, vigenteHasta.toISOString(), cuentaId]
      );
    }
  }

  try {
    await db.query(
      `UPDATE tenants SET
         plan_codigo = $1,
         plan_periodo = $2,
         plan_vigente_hasta = $3,
         plan_estado = 'activo',
         plan_origen = 'payphone',
         updated_at = NOW()
       WHERE id = $4 OR cuenta_id = $5`,
      [
        pago.plan_codigo,
        periodo,
        vigenteHasta.toISOString(),
        pago.tenant_id,
        cuentaId || pago.tenant_id,
      ]
    );
  } catch {
    await db.query(
      `UPDATE tenants SET
         plan_codigo = $1,
         plan_periodo = $2,
         plan_vigente_hasta = $3,
         plan_origen = 'payphone',
         updated_at = NOW()
       WHERE id = $4 OR cuenta_id = $5`,
      [
        pago.plan_codigo,
        periodo,
        vigenteHasta.toISOString(),
        pago.tenant_id,
        cuentaId || pago.tenant_id,
      ]
    );
  }

  invalidatePlanCache();

  try {
    const { sendTemplatedEmail, appBaseUrl } = await import(
      "@/services/email/templates"
    );
    const { fromCentavos } = await import("@/services/billing/payphone");
    const user = await db.queryOne<{ email: string; nombre: string | null }>(
      `SELECT email, nombre FROM usuarios WHERE id = (
         SELECT usuario_id FROM pagos_suscripcion WHERE id = $1
       )`,
      [pago.id]
    );
    if (user?.email) {
      const planInfo = await resolvePlan(pago.plan_codigo);
      await sendTemplatedEmail({
        codigo: "pago_aprobado",
        to: user.email,
        vars: {
          nombre: user.nombre || user.email.split("@")[0],
          email: user.email,
          orden: pago.id,
          plan_nombre: planInfo.nombre,
          periodo,
          monto: `$${fromCentavos(Number(pago.monto_centavos)).toFixed(2)}`,
          link_panel: `${appBaseUrl()}/panel`,
        },
      });
    }
  } catch (err) {
    console.warn("[payphone] email pago_aprobado:", err);
  }

  return {
    estado: "aprobado",
    planCodigo: pago.plan_codigo,
    periodo,
    pagoId: pago.id,
    message: "Suscripción activada",
  };
}

export async function startSubscriptionCheckout(input: {
  tenantId: string;
  userId: string;
  userEmail: string;
  planCodigo: string;
  periodo: PayphonePeriodo;
}): Promise<{
  pagoId: string;
  clientTransactionId: string;
  /** URL única del Payment Link (tarjeta y saldo PayPhone). */
  paymentUrl: string;
  /** Alias UI legado — misma URL del link. */
  payWithCard: string;
  payWithPayPhone: string;
  amountCents: number;
}> {
  const config = getPayphoneConfig();
  if (!config) {
    throw new Error(
      "PayPhone no configurado. Un administrador debe definir PAYPHONE_TOKEN y PAYPHONE_STORE_ID."
    );
  }

  const plan = await resolvePlan(input.planCodigo);
  if (!plan.activo) {
    throw new Error("El plan seleccionado no está activo");
  }

  const precioUsd =
    input.periodo === "anual"
      ? Number(plan.precioAnual ?? plan.precioMensual * 10)
      : Number(plan.precioMensual);

  if (!Number.isFinite(precioUsd) || precioUsd <= 0) {
    throw new Error("El plan no tiene un precio válido para cobro");
  }

  const breakdown = buildAmountBreakdown(precioUsd, config.ivaPercent);
  const clientTransactionId = createClientTransactionId("sub", 15);
  const reference = `Suscripción ${plan.nombre} (${input.periodo})`;
  const cuentaId = await resolveCuentaId(input.tenantId);

  let pago: { id: string } | null = null;
  try {
    pago = await db.insert<{ id: string }>(
      "pagos_suscripcion",
      {
        tenant_id: input.tenantId,
        cuenta_id: cuentaId,
        usuario_id: input.userId,
        plan_codigo: plan.codigo,
        periodo: input.periodo,
        monto_centavos: breakdown.amount,
        moneda: plan.moneda || "USD",
        estado: "pendiente",
        metodo_pago_codigo: "PAYPHONE",
        client_transaction_id: clientTransactionId,
        reference,
      },
      "id"
    );
  } catch {
    pago = await db.insert<{ id: string }>(
      "pagos_suscripcion",
      {
        tenant_id: input.tenantId,
        cuenta_id: cuentaId,
        usuario_id: input.userId,
        plan_codigo: plan.codigo,
        periodo: input.periodo,
        monto_centavos: breakdown.amount,
        moneda: plan.moneda || "USD",
        estado: "pendiente",
        client_transaction_id: clientTransactionId,
        reference,
      },
      "id"
    );
  }

  if (!pago?.id) {
    throw new Error("No se pudo registrar el pago pendiente");
  }

  try {
    // Payment Links (exacontable): amountWithoutTax = base o total sin desglose
    const linkAmountWithoutTax =
      config.ivaPercent > 0 && breakdown.amountWithTax > 0
        ? breakdown.amountWithTax
        : breakdown.amount;

    const link = await createPayphonePaymentLink({
      clientTransactionId,
      amountCents: breakdown.amount,
      amountWithoutTax: linkAmountWithoutTax,
      reference,
      oneTime: true,
    });

    await db.query(
      `UPDATE pagos_suscripcion SET
         estado = 'preparado',
         pay_with_card_url = $1,
         pay_with_payphone_url = $1,
         raw_prepare = $2::jsonb,
         updated_at = NOW()
       WHERE id = $3`,
      [link.paymentUrl, JSON.stringify(link.raw), pago.id]
    );

    return {
      pagoId: pago.id,
      clientTransactionId: link.clientTransactionId,
      paymentUrl: link.paymentUrl,
      payWithCard: link.paymentUrl,
      payWithPayPhone: link.paymentUrl,
      amountCents: breakdown.amount,
    };
  } catch (err) {
    await db.query(
      `UPDATE pagos_suscripcion SET estado = 'fallido', updated_at = NOW() WHERE id = $1`,
      [pago.id]
    );
    throw err;
  }
}

/** Polling UI: estado del pago de suscripción. */
export async function getSubscriptionPagoStatus(input: {
  pagoId: string;
  expectedTenantId?: string;
}): Promise<{
  pagoId: string;
  estado: string;
  planCodigo: string;
  periodo: string;
  clientTransactionId: string | null;
  paymentUrl: string | null;
}> {
  const pago = await db.queryOne<{
    id: string;
    tenant_id: string;
    cuenta_id: string | null;
    plan_codigo: string;
    periodo: string;
    estado: string;
    client_transaction_id: string | null;
    pay_with_card_url: string | null;
    pay_with_payphone_url: string | null;
  }>(
    `SELECT id, tenant_id, cuenta_id, plan_codigo, periodo, estado,
            client_transaction_id, pay_with_card_url, pay_with_payphone_url
     FROM pagos_suscripcion WHERE id = $1`,
    [input.pagoId]
  );

  if (!pago) throw new Error("Pago no encontrado");

  if (input.expectedTenantId) {
    const cuentaId = await resolveCuentaId(input.expectedTenantId);
    const sameTenant = pago.tenant_id === input.expectedTenantId;
    const sameCuenta =
      cuentaId && pago.cuenta_id && pago.cuenta_id === cuentaId;
    if (!sameTenant && !sameCuenta) {
      throw new Error("Este pago no pertenece a tu empresa");
    }
  }

  return {
    pagoId: pago.id,
    estado: pago.estado,
    planCodigo: pago.plan_codigo,
    periodo: pago.periodo,
    clientTransactionId: pago.client_transaction_id,
    paymentUrl: pago.pay_with_card_url || pago.pay_with_payphone_url,
  };
}

/**
 * Webhook / notify de Payment Links (mismo contrato que exacontable /api/payphone/notify).
 */
export async function applyPayphoneLinkNotification(input: {
  clientTransactionId: string;
  transactionId?: string | number | null;
  transactionStatus?: string | null;
  authorizationCode?: string | null;
  amount?: number | null;
  raw?: unknown;
}): Promise<{
  estado: "aprobado" | "cancelado" | "fallido";
  planCodigo?: string;
  periodo?: string;
  message?: string;
  pagoId?: string;
}> {
  const pago = await db.queryOne<PagoRow>(
    `SELECT id, tenant_id, cuenta_id, plan_codigo, periodo, estado, monto_centavos
     FROM pagos_suscripcion WHERE client_transaction_id = $1`,
    [input.clientTransactionId]
  );

  if (!pago) {
    throw new Error("Pago no encontrado para este clientTransactionId");
  }

  if (pago.estado === "aprobado") {
    return {
      estado: "aprobado",
      planCodigo: pago.plan_codigo,
      periodo: pago.periodo,
      pagoId: pago.id,
      message: "Pago ya confirmado",
    };
  }

  if (!isPayphoneLinkApproved(input.transactionStatus)) {
    await db.query(
      `UPDATE pagos_suscripcion SET
         estado = 'cancelado',
         raw_confirm = $2::jsonb,
         payphone_tx_id = COALESCE($3, payphone_tx_id),
         updated_at = NOW()
       WHERE id = $1`,
      [
        pago.id,
        JSON.stringify(input.raw ?? input),
        input.transactionId != null ? String(input.transactionId) : null,
      ]
    );
    return {
      estado: "cancelado",
      planCodigo: pago.plan_codigo,
      periodo: pago.periodo,
      pagoId: pago.id,
      message: input.transactionStatus || "Pago cancelado",
    };
  }

  if (
    typeof input.amount === "number" &&
    input.amount > 0 &&
    input.amount !== Number(pago.monto_centavos)
  ) {
    await db.query(
      `UPDATE pagos_suscripcion SET estado = 'fallido', updated_at = NOW() WHERE id = $1`,
      [pago.id]
    );
    return {
      estado: "fallido",
      pagoId: pago.id,
      message: "El monto notificado no coincide con el cobro esperado",
    };
  }

  return activateSubscriptionFromPago(pago, {
    transactionId: input.transactionId,
    authorizationCode: input.authorizationCode,
    rawConfirm: input.raw ?? input,
  });
}

export async function confirmSubscriptionPayment(input: {
  payphoneId: number;
  clientTransactionId: string;
  /** Si se pasa, exige que el pago pertenezca a este tenant o su cuenta. */
  expectedTenantId?: string;
}): Promise<{
  estado: "aprobado" | "cancelado" | "fallido";
  planCodigo?: string;
  periodo?: string;
  message?: string;
  pagoId?: string;
}> {
  const pago = await db.queryOne<PagoRow>(
    `SELECT id, tenant_id, cuenta_id, plan_codigo, periodo, estado, monto_centavos
     FROM pagos_suscripcion WHERE client_transaction_id = $1`,
    [input.clientTransactionId]
  );

  if (!pago) {
    throw new Error("Pago no encontrado para este clientTransactionId");
  }

  if (input.expectedTenantId) {
    const cuentaId = await resolveCuentaId(input.expectedTenantId);
    const sameTenant = pago.tenant_id === input.expectedTenantId;
    const sameCuenta =
      cuentaId && pago.cuenta_id && pago.cuenta_id === cuentaId;
    if (!sameTenant && !sameCuenta) {
      throw new Error("Este pago no pertenece a tu empresa");
    }
  }

  if (pago.estado === "aprobado") {
    return {
      estado: "aprobado",
      planCodigo: pago.plan_codigo,
      periodo: pago.periodo,
      pagoId: pago.id,
      message: "Pago ya confirmado",
    };
  }

  const confirm = await confirmPayphonePayment({
    id: input.payphoneId,
    clientTxId: input.clientTransactionId,
  });

  await db.query(
    `UPDATE pagos_suscripcion SET
       raw_confirm = $1::jsonb,
       payphone_tx_id = $2,
       authorization_code = $3,
       confirmed_at = NOW(),
       updated_at = NOW()
     WHERE id = $4`,
    [
      JSON.stringify(confirm.raw),
      confirm.transactionId ?? null,
      confirm.authorizationCode ?? null,
      pago.id,
    ]
  );

  if (!isPayphoneApproved(confirm)) {
    await db.query(
      `UPDATE pagos_suscripcion SET estado = 'cancelado', updated_at = NOW() WHERE id = $1`,
      [pago.id]
    );
    return {
      estado: "cancelado",
      planCodigo: pago.plan_codigo,
      periodo: pago.periodo,
      pagoId: pago.id,
      message: confirm.message || confirm.transactionStatus || "Pago cancelado",
    };
  }

  if (
    typeof confirm.amount === "number" &&
    confirm.amount > 0 &&
    confirm.amount !== Number(pago.monto_centavos)
  ) {
    await db.query(
      `UPDATE pagos_suscripcion SET estado = 'fallido', updated_at = NOW() WHERE id = $1`,
      [pago.id]
    );
    return {
      estado: "fallido",
      pagoId: pago.id,
      message: "El monto confirmado no coincide con el cobro esperado",
    };
  }

  return activateSubscriptionFromPago(pago, {
    transactionId: confirm.transactionId,
    authorizationCode: confirm.authorizationCode,
    rawConfirm: confirm.raw,
  });
}
