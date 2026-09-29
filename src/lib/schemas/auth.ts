import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Correo o RUC es obligatorio")
    .max(255, "Máximo 255 caracteres"),
  password: z
    .string()
    .min(1, "Contraseña es obligatoria")
    .max(128, "Máximo 128 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Paso 2 del wizard de registro (cuenta + empresa). */
export const registerSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, "Nombre es obligatorio")
      .max(200, "Máximo 200 caracteres"),
    email: z
      .string()
      .trim()
      .min(1, "Correo es obligatorio")
      .email("Correo no válido")
      .max(255),
    password: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres")
      .max(128),
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
    razonSocial: z
      .string()
      .trim()
      .min(2, "Razón social / empresa es obligatoria")
      .max(255),
    ruc: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || /^\d{10}(\d{3})?$/.test(v),
        "RUC/cédula inválida (10 o 13 dígitos)"
      )
      .optional()
      .or(z.literal("")),
    telefono: z.string().trim().max(50, "Máximo 50 caracteres").optional().or(z.literal("")),
    ciudad: z.string().trim().max(80, "Máximo 80 caracteres").optional().or(z.literal("")),
    planCodigo: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_-]{1,29}$/, "Plan inválido"),
    periodo: z.enum(["mensual", "anual"]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/** Body accepted by POST /api/auth/register (sin confirmPassword).
 *  Registro público nunca acepta ADMIN — solo USER. */
export const registerApiSchema = z
  .object({
    email: z.string().trim().email("Correo no válido").max(255),
    password: z.string().min(6, "Mínimo 6 caracteres").max(128),
    nombre: z.string().trim().min(2).max(200).optional().nullable().or(z.literal("")),
    razonSocial: z.string().trim().min(2).max(255).optional().nullable().or(z.literal("")),
    ruc: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{10}(\d{3})?$/.test(v), "RUC/cédula inválida")
      .optional()
      .nullable()
      .or(z.literal("")),
    telefono: z.string().trim().max(50).optional().nullable().or(z.literal("")),
    ciudad: z.string().trim().max(80).optional().nullable().or(z.literal("")),
    planCodigo: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_-]{1,29}$/)
      .optional()
      .default("emprendedor"),
    periodo: z.enum(["mensual", "anual"]).optional().default("mensual"),
    rol: z.literal("USER").optional().default("USER"),
    tenantId: z.string().uuid().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.tenantId && !(data.razonSocial && String(data.razonSocial).trim())) {
      ctx.addIssue({
        code: "custom",
        message: "Razón social / empresa es obligatoria",
        path: ["razonSocial"],
      });
    }
  });

export type RegisterApiInput = z.infer<typeof registerApiSchema>;
