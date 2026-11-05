import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";

export async function GET(req: Request) {
  try {
    await verifyAuth(req);
    const data = await db.queryAll(`SELECT banco, titular, identificacion, tipo_cuenta AS "tipoCuenta", numero_cuenta AS "numeroCuenta" FROM cuentas_bancarias_suscripcion WHERE activo = true ORDER BY orden, id`);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ message }, { status: message.startsWith("No autorizado") ? 401 : 500 });
  }
}
