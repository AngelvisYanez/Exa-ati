import { z } from "zod";

export const ECUADOR_CITY_VALUES = [
  "Quito",
  "Guayaquil",
  "Cuenca",
  "Ambato",
  "Manta",
  "Santo Domingo",
  "Machala",
  "Loja",
  "Riobamba",
  "Ibarra",
  "Durán",
  "Portoviejo",
  "Otra",
] as const;

export const leadSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "Indica tu nombre")
    .max(120, "Máximo 120 caracteres"),
  email: z
    .string()
    .trim()
    .min(1, "Correo obligatorio")
    .email("Correo no válido")
    .max(255),
  telefono: z
    .string()
    .trim()
    .min(7, "Teléfono demasiado corto")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[0-9+\s()-]+$/, "Solo números y símbolos de teléfono"),
  ciudad: z.enum(ECUADOR_CITY_VALUES, {
    message: "Selecciona tu ciudad",
  }),
  perfil: z.enum(["emprendedor", "contador", "despacho"], {
    message: "Selecciona tu perfil",
  }),
  mensaje: z.string().trim().max(1000).optional().or(z.literal("")),
  fuente: z.string().trim().max(80).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
