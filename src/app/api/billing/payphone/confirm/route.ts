import { NextResponse } from "next/server";
import { verifyAuth, requireTenantId } from "@/services/sri-api/auth-helper";
import { confirmSubscriptionPayment } from "@/services/billing/subscription-checkout";
import { z } from "zod";

const bodySchema = z.object({
  id: z.coerce.number().int().positive(),
  clientTransactionId: z.string().min(3).max(64),
});

/** Confirmación manual (si el callback GET falló o se usa desde la UI). */
export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    requireTenantId(user);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "Datos inválidos" }, { status: 400 });
    }

    const result = await confirmSubscriptionPayment({
      payphoneId: parsed.data.id,
      clientTransactionId: parsed.data.clientTransactionId,
      expectedTenantId: user.tenantId || undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      { message },
      { status: message.startsWith("No autorizado") ? 401 : 400 }
    );
  }
}
