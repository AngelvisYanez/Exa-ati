import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Valida el body JSON de un Request con Zod (safeParse).
 * Devuelve data tipada o una NextResponse 400 con todos los errores.
 */
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      error: NextResponse.json(
        { message: "Body JSON inválido", errors: { _form: ["JSON mal formado"] } },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const flattened = result.error.flatten();
    return {
      error: NextResponse.json(
        {
          message: "Datos inválidos",
          errors: flattened.fieldErrors,
          formErrors: flattened.formErrors,
        },
        { status: 400 }
      ),
    };
  }

  return { data: result.data };
}
