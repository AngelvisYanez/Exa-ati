import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { requireModule, forbiddenResponse } from "@/services/sri-api/rbac";
import { db } from "@/services/sri-api/db";

const schema = z.object({
  banco: z.string().trim().min(2).max(100),
  titular: z.string().trim().min(2).max(150),
  identificacion: z.string().trim().min(5).max(30),
  tipoCuenta: z.enum(["AHORROS", "CORRIENTE"]),
  numeroCuenta: z.string().trim().min(4).max(50),
  activo: z.boolean().default(true),
  orden: z.number().int().min(0).max(9999).default(0),
});

async function admin(req: Request) {
  const user = await verifyAuth(req);
  await requireModule(user, "admin.metodos-pago");
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Error interno";
  if (message.startsWith("Acceso denegado")) return forbiddenResponse(message);
  return NextResponse.json({ message }, { status: message.startsWith("No autorizado") ? 401 : 500 });
}

export async function GET(req: Request) {
  try {
    await admin(req);
    const data = await db.queryAll(`SELECT id, banco, titular, identificacion, tipo_cuenta AS "tipoCuenta", numero_cuenta AS "numeroCuenta", activo, orden FROM cuentas_bancarias_suscripcion ORDER BY orden, id`);
    return NextResponse.json({ data });
  } catch (error) { return failure(error); }
}

export async function POST(req: Request) {
  try {
    await admin(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: "Datos de cuenta inválidos", issues: parsed.error.flatten() }, { status: 400 });
    const v = parsed.data;
    const data = await db.queryOne(`INSERT INTO cuentas_bancarias_suscripcion (banco, titular, identificacion, tipo_cuenta, numero_cuenta, activo, orden) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [v.banco,v.titular,v.identificacion,v.tipoCuenta,v.numeroCuenta,v.activo,v.orden]);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return failure(error); }
}
