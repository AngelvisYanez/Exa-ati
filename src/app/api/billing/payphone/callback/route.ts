import { NextRequest, NextResponse } from "next/server";
import { confirmSubscriptionPayment } from "@/services/billing/subscription-checkout";

/**
 * URL de respuesta PayPhone (GET ?id=&clientTransactionId=).
 * Confirma en servidor (< 5 min) y redirige a /facturacion/resultado.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const idRaw = searchParams.get("id");
  const clientTransactionId =
    searchParams.get("clientTransactionId") ||
    searchParams.get("clientTxId") ||
    "";

  const appUrl = (
    process.env.PAYPHONE_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    req.nextUrl.origin
  ).replace(/\/$/, "");

  const redirect = (status: string, extra: Record<string, string> = {}) => {
    const u = new URL(`${appUrl}/registro/gracias`);
    u.searchParams.set("status", status);
    for (const [k, v] of Object.entries(extra)) {
      if (v) u.searchParams.set(k, v);
    }
    return NextResponse.redirect(u.toString());
  };

  if (!idRaw || !clientTransactionId) {
    return redirect("canceled", { message: "Faltan parámetros de PayPhone" });
  }

  const payphoneId = Number(idRaw);
  if (!Number.isFinite(payphoneId) || payphoneId <= 0) {
    return redirect("fallido", { message: "id de transacción inválido" });
  }

  try {
    const result = await confirmSubscriptionPayment({
      payphoneId,
      clientTransactionId,
    });

    return redirect(result.estado, {
      plan: result.planCodigo || "",
      periodo: result.periodo || "",
      orden: result.pagoId || "",
      pagoId: result.pagoId || "",
      message: result.message || "",
    });
  } catch (error: unknown) {
    console.error("[payphone/callback]", error);
    const message = error instanceof Error ? error.message : "Error al confirmar";
    return redirect("fallido", { message });
  }
}
