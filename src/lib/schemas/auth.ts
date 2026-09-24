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

export const registerSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .max(200, "Máximo 200 caracteres")
      .optional()
      .or(z.literal("")),
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
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/** Body accepted by POST /api/auth/register (sin confirmPassword).
 *  Registro público nunca acepta ADMIN — solo USER. */
export const registerApiSchema = z.object({
  email: z.string().trim().email("Correo no válido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(128),
  nombre: z.string().trim().max(200).optional().nullable(),
  rol: z.literal("USER").optional().default("USER"),
  tenantId: z.string().uuid().optional().nullable(),
});

export type RegisterApiInput = z.infer<typeof registerApiSchema>;
