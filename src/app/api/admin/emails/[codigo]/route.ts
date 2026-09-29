import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { requireModule } from "@/services/sri-api/rbac";
import { getEmailPlantilla, previewPlantilla } from "@/services/email/templates";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ codigo: string }> }
) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, "admin.emails");
    const { codigo } = await ctx.params;
    const plantilla = await getEmailPlantilla(decodeURIComponent(codigo));
    if (!plantilla) {
      return NextResponse.json({ message: "Plantilla no encontrada" }, { status: 404 });
    }
    const preview = previewPlantilla(plantilla);
    return NextResponse.json({ success: true, data: { plantilla, preview } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    const status = message.startsWith("No autorizado")
      ? 401
      : message.includes("Acceso denegado") || message.includes("módulo")
        ? 403
        : 500;
    return NextResponse.json({ message }, { status });
  }
}
