import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { requireModule } from "@/services/sri-api/rbac";
import {
  listEmailPlantillas,
  getEmailPlantilla,
  updateEmailPlantilla,
  previewPlantilla,
} from "@/services/email/templates";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, "admin.emails");
    const plantillas = await listEmailPlantillas();
    return NextResponse.json({ success: true, data: plantillas });
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

const updateSchema = z.object({
  codigo: z.string().min(2).max(50),
  nombre: z.string().min(2).max(120).optional(),
  descripcion: z.string().max(2000).optional().nullable(),
  asunto: z.string().min(1).max(255).optional(),
  cuerpoHtml: z.string().min(1).optional(),
  cuerpoTexto: z.string().optional().nullable(),
  activo: z.boolean().optional(),
});

export async function PUT(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, "admin.emails");
    const json = await req.json();
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const existing = await getEmailPlantilla(parsed.data.codigo);
    if (!existing) {
      return NextResponse.json({ message: "Plantilla no encontrada" }, { status: 404 });
    }
    const updated = await updateEmailPlantilla({
      ...parsed.data,
      updatedBy: user.sub,
    });
    return NextResponse.json({ success: true, data: updated });
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

const previewSchema = z.object({
  codigo: z.string().min(2).max(50).optional(),
  asunto: z.string().optional(),
  cuerpoHtml: z.string().optional(),
  cuerpoTexto: z.string().optional().nullable(),
  vars: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, "admin.emails");
    const json = await req.json();
    const parsed = previewSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ message: "Datos inválidos" }, { status: 400 });
    }

    let plantilla = parsed.data.codigo
      ? await getEmailPlantilla(parsed.data.codigo)
      : null;

    if (!plantilla && !parsed.data.asunto && !parsed.data.cuerpoHtml) {
      return NextResponse.json({ message: "Plantilla no encontrada" }, { status: 404 });
    }

    const base = plantilla || {
      codigo: "preview",
      nombre: "Preview",
      descripcion: null,
      asunto: "",
      cuerpoHtml: "",
      cuerpoTexto: null,
      variables: [],
      activo: true,
      updatedAt: null,
    };

    const preview = previewPlantilla(
      {
        ...base,
        asunto: parsed.data.asunto ?? base.asunto,
        cuerpoHtml: parsed.data.cuerpoHtml ?? base.cuerpoHtml,
        cuerpoTexto:
          parsed.data.cuerpoTexto !== undefined
            ? parsed.data.cuerpoTexto
            : base.cuerpoTexto,
      },
      parsed.data.vars
    );

    return NextResponse.json({ success: true, data: preview });
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
