import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth, requireTenantId } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";
import { AutorizacionInvalida, guardarAutorizaciones, leerAutorizaciones } from "@/services/sri-api/series-store";
import { TIPOS_COMPROBANTE_SERIE } from "@/lib/series-comprobante";

const guardarSchema = z.object({
  ruc: z.string().trim().min(10).max(13),
  establecimientos: z.array(z.object({
    codigo: z.string().trim().min(1).max(3),
    codigoAnterior: z.string().trim().max(3).optional(),
    direccion: z.string().max(300).optional(),
    ciudad: z.string().max(120).optional(),
    telefonos: z.string().max(120).optional(),
    ambiente: z.enum(["1", "2"]),
    tipos: z.array(z.object({
      tipo: z.string(),
      puntos: z.array(z.object({
        puntoEmision: z.string().trim().min(1).max(3),
        ultimo: z.number().int().min(0).max(999_999_999),
      })).max(20),
    })).max(TIPOS_COMPROBANTE_SERIE.length),
  })).min(1).max(50),
});

async function emisorDelTenant(ruc: string, tenantId: string) {
  return db.queryOne<{
    id: string;
    ruc: string;
    establecimiento: string | null;
    punto_emision: string | null;
    ambiente: string | null;
  }>(
    `SELECT id, ruc, establecimiento, punto_emision, ambiente
     FROM emisores
     WHERE ruc = $1 AND tenant_id = $2 AND activo = true`,
    [ruc, tenantId],
  );
}

function esErrorDeAcceso(message: string): boolean {
  return message.startsWith("No autorizado") || message.startsWith("Acceso denegado");
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const ruc = new URL(req.url).searchParams.get("ruc")?.trim();
    if (!ruc) {
      return NextResponse.json({ message: "Indica el RUC del emisor." }, { status: 400 });
    }
    const emisor = await emisorDelTenant(ruc, tenantId);
    if (!emisor) {
      return NextResponse.json({ message: "Emisor no encontrado para este RUC." }, { status: 404 });
    }
    const autorizaciones = await leerAutorizaciones(
      emisor.id,
      emisor.ruc,
      emisor.establecimiento || "001",
      emisor.punto_emision || "001",
      emisor.ambiente,
    );
    return NextResponse.json({ success: true, autorizaciones });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al leer las autorizaciones";
    return NextResponse.json({ message }, { status: esErrorDeAcceso(message) ? 401 : 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const parsed = guardarSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Revisa los establecimientos, sus datos y los puntos de emisión." },
        { status: 400 },
      );
    }
    const emisor = await emisorDelTenant(parsed.data.ruc, tenantId);
    if (!emisor) {
      return NextResponse.json({ message: "Emisor no encontrado para este RUC." }, { status: 404 });
    }
    try {
      await guardarAutorizaciones(emisor.id, tenantId, parsed.data.establecimientos);
    } catch (error: unknown) {
      if (error instanceof AutorizacionInvalida) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
    const principal = parsed.data.establecimientos[0];
    const autorizaciones = await leerAutorizaciones(
      emisor.id,
      emisor.ruc,
      principal.codigo,
      emisor.punto_emision || "001",
      principal.ambiente,
    );
    return NextResponse.json({ success: true, autorizaciones });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al guardar las autorizaciones";
    return NextResponse.json({ message }, { status: esErrorDeAcceso(message) ? 401 : 500 });
  }
}
