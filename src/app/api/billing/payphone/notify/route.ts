import { NextResponse } from "next/server";
import { applyPayphoneLinkNotification } from "@/services/billing/subscription-checkout";

/**
 * Webhook PayPhone Payment Links (mismo contrato que exacontable /api/payphone/notify).
 * Configurar en PayPhone Developer como URL de notificación.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const clientTransactionId = String(
      body.clientTransactionId || body.clientTxId || ""
    ).trim();

    if (!clientTransactionId) {
      return NextResponse.json(
        { message: "clientTransactionId requerido" },
        { status: 400 }
      );
    }

    const result = await applyPayphoneLinkNotification({
      clientTransactionId,
      transactionId:
        (body.transactionId as string | number | undefined) ?? null,
      transactionStatus: (body.transactionStatus as string | undefined) ?? null,
      authorizationCode:
        (body.authorizationCode as string | undefined) ?? null,
      amount:
        typeof body.amount === "number"
          ? body.amount
          : body.amount != null
            ? Number(body.amount)
            : null,
      raw: body,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("[payphone/notify]", error);
    return NextResponse.json(
      { message },
      { status: message.includes("no encontrado") ? 404 : 400 }
    );
  }
}
