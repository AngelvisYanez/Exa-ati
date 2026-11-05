import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireTenantId } from "@/services/sri-api/auth-helper";
import { getSubscriptionPagoStatus } from "@/services/billing/subscription-checkout";

/** Polling del estado de un pago (Payment Links). */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const pagoId = req.nextUrl.searchParams.get("pagoId")?.trim();

    if (!pagoId) {
      return NextResponse.json(
        { message: "pagoId requerido" },
        { status: 400 }
      );
    }

    const data = await getSubscriptionPagoStatus({
      pagoId,
      expectedTenantId: tenantId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    const status = message.startsWith("No autorizado")
      ? 401
      : message.includes("Acceso denegado")
        ? 403
        : message.includes("no encontrado")
          ? 404
          : 400;
    return NextResponse.json({ message }, { status });
  }
}
