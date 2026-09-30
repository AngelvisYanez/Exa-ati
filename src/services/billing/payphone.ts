/**
 * Cliente PayPhone — Payment Links (flujo activo, portado de exacontable)
 * + Botón de Pago Prepare/Confirm (legado / fallback).
 *
 * Links: https://docs.payphone.app (POST /api/Links)
 * Botón: https://docs.payphone.app/boton-de-pago
 *
 * Montos en centavos enteros.
 */

import https from "node:https";

export type PayphonePeriodo = "mensual" | "anual";

export interface PayphoneConfig {
  token: string;
  storeId: string;
  apiBase: string;
  appUrl: string;
  /** Si > 0, cobra IVA sobre el precio (amountWithTax + tax). Default 0 = sin IVA. */
  ivaPercent: number;
}

/** Agent HTTP/1.1 — PayPhone a veces falla con HTTP/2 en Node (exacontable). */
const payphoneH1Agent = new https.Agent({
  ALPNProtocols: ["http/1.1"],
  servername: "pay.payphonetodoesposible.com",
});

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

/**
 * ID único para PayPhone.
 * Payment Links en exacontable usa ≤ 15 chars; Botón acepta ~30.
 */
export function createClientTransactionId(
  prefix = "sub",
  maxLen = 15
): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}${t}${r}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, maxLen);
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

/** POST JSON a PayPhone forzando HTTP/1.1 (mismo workaround que exacontable). */
function payphoneHttpsPost(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: "POST",
        headers,
        agent: payphoneH1Agent,
        servername: u.hostname,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () =>
          resolve({ status: res.statusCode || 500, text: data })
        );
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function payphoneFetch(
  config: PayphoneConfig,
  path: string,
  body: unknown
): Promise<unknown> {
  const payload = JSON.stringify(body);
  const { status, text } = await payphoneHttpsPost(
    `${config.apiBase}${path}`,
    {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(payload)),
    },
    payload
  );
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (status < 200 || status >= 300) {
    const msg =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : typeof data === "string"
          ? data
          : `PayPhone HTTP ${status}`;
    throw new Error(msg);
  }
  return data;
}

export interface CreatePaymentLinkInput {
  clientTransactionId: string;
  amountCents: number;
  /** Si se omite, se usa amountCents (sin IVA desglosado, como exacontable). */
  amountWithoutTax?: number;
  reference: string;
  oneTime?: boolean;
}

export interface CreatePaymentLinkResult {
  paymentUrl: string;
  clientTransactionId: string;
  raw: unknown;
}

/**
 * Crea un Payment Link (API /api/Links) — flujo activo de exacontable.
 * La respuesta suele ser un string URL (a veces JSON-encoded).
 */
export async function createPayphonePaymentLink(
  input: CreatePaymentLinkInput
): Promise<CreatePaymentLinkResult> {
  const config = getPayphoneConfig();
  if (!config) {
    throw new Error(
      "PayPhone no está configurado. Define PAYPHONE_TOKEN y PAYPHONE_STORE_ID."
    );
  }

  const clientTransactionId = input.clientTransactionId.slice(0, 15);
  const amountWithoutTax = input.amountWithoutTax ?? input.amountCents;
  const payload = {
    amount: input.amountCents,
    amountWithoutTax,
    clientTransactionId,
    currency: "USD",
    storeId: config.storeId,
    reference: input.reference.slice(0, 200),
    oneTime: input.oneTime !== false,
  };

  const raw = await payphoneFetch(config, "/api/Links", payload);

  let paymentUrl: string;
  if (typeof raw === "string") {
    paymentUrl = raw.replace(/^"|"$/g, "").trim();
  } else if (raw && typeof raw === "object" && "paymentUrl" in raw) {
    paymentUrl = String((raw as { paymentUrl: unknown }).paymentUrl);
  } else {
    paymentUrl = String(raw ?? "").replace(/^"|"$/g, "").trim();
  }

  if (!paymentUrl || !/^https?:\/\//i.test(paymentUrl)) {
    throw new Error(
      "PayPhone Links no devolvió una URL de pago válida. Revisa StoreId y Token."
    );
  }

  return { paymentUrl, clientTransactionId, raw };
}

/** Estados de webhook Links / notify (exacontable). */
export function isPayphoneLinkApproved(status: string | null | undefined): boolean {
  const s = String(status || "").trim().toLowerCase();
  return (
    s === "succeeded" ||
    s === "aprobado" ||
    s === "approved" ||
    s === "paid" ||
    s === "3"
  );
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
