import { NextResponse } from "next/server";
import { processSubscriptionLifecycle } from "@/services/billing/subscription-lifecycle";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";

/** Cron: vencimientos + recordatorios de suscripción. */
export async function GET(req: Request) {
  try {
    if (!CRON_SECRET) {
      return NextResponse.json(
        { error: "CRON_SECRET no configurado en el servidor" },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const secret = authHeader.replace("Bearer ", "").trim();
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const result = await processSubscriptionLifecycle();
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error("[CRON suscripciones]", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
