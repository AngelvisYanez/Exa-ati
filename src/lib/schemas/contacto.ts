import { z } from "zod";

export const tipoIdentificacionEnum = z.enum(["04", "05", "06", "07", "08"]);

export const contactoSchema = z.object({
  tipoIdentificacion: tipoIdentificacionEnum,
  identificacion: z
    .string()
    .trim()
    .min(1, "Identificación es obligatoria")
    .max(20, "Máximo 20 caracteres"),
  razonSocial: z
    .string()
    .trim()
    .min(1, "Razón social es obligatoria")
    .max(500),
  nombreComercial: z.string().trim().max(500).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Email no válido")
    .max(255)
    .optional()
    .or(z.literal("")),
  telefono: z.string().trim().max(50).optional().or(z.literal("")),
  direccion: z.string().trim().max(2000).optional().or(z.literal("")),
  esCliente: z.boolean(),
  esProveedor: z.boolean(),
});

export type ContactoInput = z.infer<typeof contactoSchema>;

export const contactoUpdateSchema = contactoSchema.partial().extend({
  activo: z.boolean().optional(),
});

export type ContactoUpdateInput = z.infer<typeof contactoUpdateSchema>;
