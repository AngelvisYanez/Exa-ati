import { z } from "zod";

/** Vincular contribuyente SRI (RUC + clave portal). */
export const vincularSriSchema = z.object({
  ruc: z
    .string()
    .trim()
    .regex(/^\d{13}$/, "El RUC debe tener 13 dígitos"),
  password: z
    .string()
    .min(1, "Clave del SRI es obligatoria")
    .max(128),
});

export type VincularSriInput = z.infer<typeof vincularSriSchema>;

export const emisorPerfilSchema = z.object({
  razonSocial: z.string().trim().max(500).optional().or(z.literal("")),
  nombreComercial: z.string().trim().max(500).optional().or(z.literal("")),
  ambiente: z.enum(["1", "2"]).default("1"),
  establecimiento: z
    .string()
    .trim()
    .regex(/^\d{3}$/, "Establecimiento debe ser 3 dígitos")
    .optional()
    .or(z.literal("")),
  puntoEmision: z
    .string()
    .trim()
    .regex(/^\d{3}$/, "Punto de emisión debe ser 3 dígitos")
    .optional()
    .or(z.literal("")),
  dirMatriz: z.string().trim().max(500).optional().or(z.literal("")),
  obligadoContabilidad: z.enum(["SI", "NO"]).optional(),
});

export type EmisorPerfilInput = z.infer<typeof emisorPerfilSchema>;
