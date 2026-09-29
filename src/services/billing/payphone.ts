/**
 * Cliente PayPhone — Botón de Pago (Prepare + Confirm).
 * Docs: https://docs.payphone.app/boton-de-pago
 *
 * Montos en centavos enteros. Confirm obligatorio en < 5 min o PayPhone revierte.
 */

export type PayphonePeriodo = "mensual" | "anual";

export interface PayphoneConfig {
  token: string;
  storeId: string;
  apiBase: string;
  appUrl: string;
  /** Si > 0, cobra IVA sobre el precio (amountWithTax + tax). Default 0 = sin IVA. */
  ivaPercent: number;
}

export function getPayphoneConfig(): PayphoneConfig | null {
  const token = process.env.PAYPHONE_TOKEN?.trim();
  const storeId = process.env.PAYPHONE_STORE_ID?.trim();
  if (!token || !storeId) return null;

  const appUrl = (
    process.env.PAYPHONE_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  return {
    token,
    storeId,
    apiBase: (
      process.env.PAYPHONE_API_BASE ||
      "https://pay.payphonetodoesposible.com"
    ).replace(/\/$/, ""),
    appUrl,
    ivaPercent: Math.max(0, Number(process.env.PAYPHONE_IVA_PERCENT || "0") || 0),
  };
}

export function isPayphoneConfigured(): boolean {
  return getPayphoneConfig() !== null;
}

/** USD → centavos enteros (PayPhone). */
export function toCentavos(usd: number): number {
  return Math.round(Number(usd) * 100);
}

export function fromCentavos(centavos: number): number {
  return Number((centavos / 100).toFixed(2));
}

export function buildAmountBreakdown(
  precioUsd: number,
  ivaPercent: number
): {
  amount: number;
  amountWithoutTax: number;
  amountWithTax: number;
  tax: number;
} {
  const totalCents = toCentavos(precioUsd);
  if (ivaPercent <= 0) {
    return {
      amount: totalCents,
      amountWithoutTax: totalCents,
      amountWithTax: 0,
      tax: 0,
    };
  }
  // Precio publicado se interpreta como total con IVA incluido
  const amountWithTax = Math.round(totalCents / (1 + ivaPercent / 100));
  const tax = totalCents - amountWithTax;
  return {
    amount: totalCents,
    amountWithoutTax: 0,
    amountWithTax,
    tax,
  };
}

/** ID único ≤ 30 chars (límite práctico PayPhone). */
export function createClientTransactionId(prefix = "sub"): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${t}-${r}`.slice(0, 30);
}

export interface PreparePaymentInput {
  clientTransactionId: string;
  amountCents: number;
  amountWithoutTax: number;
  amountWithTax: number;
  tax: number;
  reference: string;
  responseUrl: string;
  cancellationUrl: string;
  email?: string | null;
  optionalParameter?: string;
}

export interface PreparePaymentResult {
  paymentId: number;
  payWithCard: string;
  payWithPayPhone: string;
  raw: unknown;
}

export interface ConfirmPaymentResult {
  statusCode: number;
  transactionStatus: string;
  clientTransactionId: string;
  transactionId?: number;
  authorizationCode?: string;
  amount?: number;
  message?: string | null;
  raw: unknown;
}

async function payphoneFetch(
  config: PayphoneConfig,
  path: string,
  body: unknown
): Promise<unknown> {
  const res = await fetch(`${config.apiBase}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : `PayPhone HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function preparePayphonePayment(
  input: PreparePaymentInput
): Promise<PreparePaymentResult> {
  const config = getPayphoneConfig();
  if (!config) {
    throw new Error(
      "PayPhone no está configurado. Define PAYPHONE_TOKEN y PAYPHONE_STORE_ID."
    );
  }
  if (!config.appUrl && !input.responseUrl.startsWith("http")) {
    throw new Error(
      "Define PAYPHONE_APP_URL o NEXT_PUBLIC_APP_URL (dominio registrado en PayPhone)."
    );
  }

  const payload = {
    amount: input.amountCents,
    amountWithoutTax: input.amountWithoutTax,
    amountWithTax: input.amountWithTax,
    tax: input.tax,
    service: 0,
    tip: 0,
    clientTransactionId: input.clientTransactionId,
    reference: input.reference.slice(0, 200),
    storeId: config.storeId,
    currency: "USD",
    responseUrl: input.responseUrl,
    cancellationUrl: input.cancellationUrl,
    timeZone: -5,
    email: input.email || null,
    optionalParameter: input.optionalParameter || null,
  };

  const raw = await payphoneFetch(config, "/api/button/Prepare", payload);
  const obj = raw as {
    paymentId?: number;
    payWithCard?: string;
    payWithPayPhone?: string;
    message?: string;
  };

  if (!obj?.paymentId || !obj.payWithCard) {
    throw new Error(
      obj?.message ||
        "PayPhone no devolvió paymentId / payWithCard. Revisa StoreId, Token y dominio."
    );
  }

  return {
    paymentId: obj.paymentId,
    payWithCard: obj.payWithCard,
    payWithPayPhone: obj.payWithPayPhone || obj.payWithCard,
    raw,
  };
}

export async function confirmPayphonePayment(input: {
  id: number;
  clientTxId: string;
}): Promise<ConfirmPaymentResult> {
  const config = getPayphoneConfig();
  if (!config) {
    throw new Error("PayPhone no está configurado");
  }

  const raw = await payphoneFetch(config, "/api/button/V2/Confirm", {
    id: input.id,
    clientTxId: input.clientTxId,
  });

  const obj = raw as {
    statusCode?: number;
    transactionStatus?: string;
    clientTransactionId?: string;
    transactionId?: number;
    authorizationCode?: string;
    amount?: number;
    message?: string | null;
  };

  return {
    statusCode: Number(obj.statusCode ?? 0),
    transactionStatus: String(obj.transactionStatus || ""),
    clientTransactionId: String(obj.clientTransactionId || input.clientTxId),
    transactionId: obj.transactionId,
    authorizationCode: obj.authorizationCode,
    amount: obj.amount,
    message: obj.message ?? null,
    raw,
  };
}

export function isPayphoneApproved(confirm: ConfirmPaymentResult): boolean {
  return confirm.statusCode === 3 || confirm.transactionStatus === "Approved";
}

export function addPeriodo(from: Date, periodo: PayphonePeriodo): Date {
  const d = new Date(from);
  if (periodo === "anual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}
