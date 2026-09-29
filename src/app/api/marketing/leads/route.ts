import { NextResponse } from "next/server";
import { db } from "@/services/sri-api/db";
import { leadSchema } from "@/lib/schemas/leads";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limited = rateLimit(clientKey(req, "leads"), {
    limit: 8,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { message: "Demasiados intentos. Espera un momento." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return NextResponse.json(
        {
          message: "Revisa los datos del formulario",
          fields: flat.fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const row = await db.insert<{ id: string }>(
      "leads_marketing",
      {
        nombre: data.nombre,
        email: data.email.toLowerCase(),
        telefono: data.telefono,
        ciudad: data.ciudad,
        perfil: data.perfil,
        mensaje: data.mensaje || null,
        fuente: data.fuente || "homepage",
      },
      "id"
    );

    if (!row?.id) {
      // Tabla puede no existir aún: no romper UX
      console.warn("[leads] insert sin id — ¿migración 011 aplicada?");
      return NextResponse.json({
        success: true,
        message:
          "Recibimos tu solicitud. Te contactaremos pronto por correo o WhatsApp.",
      });
    }

    return NextResponse.json({
      success: true,
      message:
        "¡Gracias! Un asesor te contactará para ayudarte a elegir el plan ideal en Ecuador.",
      id: row.id,
    });
  } catch (err) {
    console.error("[leads]", err);
    return NextResponse.json(
      {
        message:
          "No pudimos guardar tu solicitud ahora. Escríbenos o crea una cuenta en Registro.",
      },
      { status: 500 }
    );
  }
}
