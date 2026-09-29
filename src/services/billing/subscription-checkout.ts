import { db } from "@/services/sri-api/db";
import { invalidatePlanCache } from "@/services/sri-api/rbac";
import { resolvePlan } from "@/services/sri-api/plans-service";
import {
  addPeriodo,
  buildAmountBreakdown,
  confirmPayphonePayment,
  createClientTransactionId,
  getPayphoneConfig,
  isPayphoneApproved,
  preparePayphonePayment,
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

export async function startSubscriptionCheckout(input: {
  tenantId: string;
  userId: string;
  userEmail: string;
  planCodigo: string;
  periodo: PayphonePeriodo;
}): Promise<{
  pagoId: string;
  clientTransactionId: string;
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
  if (!config.appUrl) {
    throw new Error(
      "Falta PAYPHONE_APP_URL / NEXT_PUBLIC_APP_URL (debe coincidir con el dominio en PayPhone Developer)."
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
  const clientTransactionId = createClientTransactionId("sub");
  const reference = `Suscripción ${plan.nombre} (${input.periodo})`;
  const cuentaId = await resolveCuentaId(input.tenantId);

  const responseUrl = `${config.appUrl}/api/billing/payphone/callback`;
  const cancellationUrl = `${config.appUrl}/registro/gracias?status=canceled`;

  const pago = await db.insert<{ id: string }>(
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

  if (!pago?.id) {
    throw new Error("No se pudo registrar el pago pendiente");
  }

  try {
    const prepared = await preparePayphonePayment({
      clientTransactionId,
      amountCents: breakdown.amount,
      amountWithoutTax: breakdown.amountWithoutTax,
      amountWithTax: breakdown.amountWithTax,
      tax: breakdown.tax,
      reference,
      responseUrl,
      cancellationUrl,
      email: input.userEmail,
      optionalParameter: `${input.tenantId}:${plan.codigo}:${input.periodo}`,
    });

    await db.query(
      `UPDATE pagos_suscripcion SET
         estado = 'preparado',
         payphone_payment_id = $1,
         pay_with_card_url = $2,
         pay_with_payphone_url = $3,
         raw_prepare = $4::jsonb,
         updated_at = NOW()
       WHERE id = $5`,
      [
        prepared.paymentId,
        prepared.payWithCard,
        prepared.payWithPayPhone,
        JSON.stringify(prepared.raw),
        pago.id,
      ]
    );

    return {
      pagoId: pago.id,
      clientTransactionId,
      payWithCard: prepared.payWithCard,
      payWithPayPhone: prepared.payWithPayPhone,
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
  const pago = await db.queryOne<{
    id: string;
    tenant_id: string;
    cuenta_id: string | null;
    plan_codigo: string;
    periodo: string;
    estado: string;
    monto_centavos: number;
  }>(
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
       updated_at = NOW()
     WHERE id = $1`,
    [pago.id, cuentaId]
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
      // Columna plan_estado / ultimo_pago_id puede no existir aún
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

  // Email de pago aprobado (no bloquea la confirmación)
  try {
    const { sendTemplatedEmail, appBaseUrl } = await import(
      "@/services/email/templates"
    );
    const { fromCentavos } = await import("@/services/billing/payphone");
    const { resolvePlan } = await import("@/services/sri-api/plans-service");
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
