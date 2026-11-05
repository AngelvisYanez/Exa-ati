import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { requireModule, forbiddenResponse } from "@/services/sri-api/rbac";
import { db } from "@/services/sri-api/db";

const schema = z.object({
  banco: z.string().trim().min(2).max(100), titular: z.string().trim().min(2).max(150),
  identificacion: z.string().trim().min(5).max(30), tipoCuenta: z.enum(["AHORROS", "CORRIENTE"]),
  numeroCuenta: z.string().trim().min(4).max(50), activo: z.boolean(), orden: z.number().int().min(0).max(9999),
});
type Context = { params: Promise<{ id: string }> };
async function authorize(req: Request) { const user = await verifyAuth(req); await requireModule(user, "admin.metodos-pago"); }
function failure(error: unknown) { const message = error instanceof Error ? error.message : "Error interno"; if (message.startsWith("Acceso denegado")) return forbiddenResponse(message); return NextResponse.json({ message }, { status: message.startsWith("No autorizado") ? 401 : 500 }); }
async function idFrom(ctx: Context) { const id = Number((await ctx.params).id); return Number.isSafeInteger(id) && id > 0 ? id : null; }

export async function PUT(req: Request, ctx: Context) {
  try {
    await authorize(req); const id = await idFrom(ctx);
    if (!id) return NextResponse.json({ message: "ID inválido" }, { status: 400 });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: "Datos de cuenta inválidos", issues: parsed.error.flatten() }, { status: 400 });
    const v = parsed.data;
    const row = await db.queryOne(`UPDATE cuentas_bancarias_suscripcion SET banco=$1,titular=$2,identificacion=$3,tipo_cuenta=$4,numero_cuenta=$5,activo=$6,orden=$7,updated_at=NOW() WHERE id=$8 RETURNING id`, [v.banco,v.titular,v.identificacion,v.tipoCuenta,v.numeroCuenta,v.activo,v.orden,id]);
    return row ? NextResponse.json({ success: true }) : NextResponse.json({ message: "Cuenta no encontrada" }, { status: 404 });
  } catch (error) { return failure(error); }
}

export async function DELETE(req: Request, ctx: Context) {
  try {
    await authorize(req); const id = await idFrom(ctx);
    if (!id) return NextResponse.json({ message: "ID inválido" }, { status: 400 });
    const row = await db.queryOne(`DELETE FROM cuentas_bancarias_suscripcion WHERE id=$1 RETURNING id`, [id]);
    return row ? NextResponse.json({ success: true }) : NextResponse.json({ message: "Cuenta no encontrada" }, { status: 404 });
  } catch (error) { return failure(error); }
}
