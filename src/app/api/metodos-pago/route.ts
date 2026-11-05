import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { listMetodosPago } from "@/services/sri-api/metodos-pago-service";

/** Catálogo ligero para selects (CxC/CxP y billing). */
export async function GET(req: Request) {
  try {
    await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const usoParam = searchParams.get("uso");
    const uso =
      usoParam === "operativo" || usoParam === "suscripcion" ? usoParam : "all";

    const data = await listMetodosPago({ includeInactive: false, uso });
    return NextResponse.json({
      data: data.map((m) => ({
        codigo: m.codigo,
        nombre: m.nombre,
        usoOperativo: m.usoOperativo,
        usoSuscripcion: m.usoSuscripcion,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      { message },
      { status: message.startsWith("No autorizado") ? 401 : 500 }
    );
  }
}
