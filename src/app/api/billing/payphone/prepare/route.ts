import { NextResponse } from "next/server";
import { verifyAuth, requireTenantId } from "@/services/sri-api/auth-helper";
import { listPlansFromDb } from "@/services/sri-api/plans-service";
import { isPayphoneConfigured, fromCentavos } from "@/services/billing/payphone";
import { startSubscriptionCheckout } from "@/services/billing/subscription-checkout";
import { z } from "zod";

const bodySchema = z.object({
  planCodigo: z.string().min(2).max(30),
  periodo: z.enum(["mensual", "anual"]).default("mensual"),
});

/** Inicia cobro PayPhone y devuelve URLs de pago. */
export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);

    if (!isPayphoneConfigured()) {
      return NextResponse.json(
        {
          message:
            "PayPhone aún no está configurado en el servidor (PAYPHONE_TOKEN / PAYPHONE_STORE_ID).",
        },
        { status: 503 }
      );
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const checkout = await startSubscriptionCheckout({
      tenantId,
      userId: user.sub,
      userEmail: user.email,
      planCodigo: parsed.data.planCodigo,
      periodo: parsed.data.periodo,
    });

    return NextResponse.json({
      success: true,
      data: {
        pagoId: checkout.pagoId,
        clientTransactionId: checkout.clientTransactionId,
        paymentUrl: checkout.paymentUrl,
        payWithCard: checkout.payWithCard,
        payWithPayPhone: checkout.payWithPayPhone,
        amount: fromCentavos(checkout.amountCents),
        amountCents: checkout.amountCents,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    const status = message.startsWith("No autorizado")
      ? 401
      : message.includes("Acceso denegado")
        ? 403
        : 400;
    console.error("[payphone/prepare]", error);
    return NextResponse.json({ message }, { status });
  }
}

/** Estado de integración + planes cobrables (para UI). */
export async function GET() {
  const configured = isPayphoneConfigured();
  const all = await listPlansFromDb();
  const plans = all.filter((p) => p.activo && p.precioMensual > 0);
  return NextResponse.json({
    configured,
    plans: plans.map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      maxEmpresas: p.maxEmpresas,
      precioMensual: p.precioMensual,
      precioAnual: p.precioAnual,
      moneda: p.moneda,
      modulosCount: p.modulos.length,
    })),
  });
}
