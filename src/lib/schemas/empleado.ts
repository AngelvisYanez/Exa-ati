import { z } from "zod";

export const empleadoSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "La cédula debe tener 10 dígitos"),
  nombres: z.string().trim().min(1, "Nombres son obligatorios").max(200),
  apellidos: z.string().trim().min(1, "Apellidos son obligatorios").max(200),
  email: z
    .string()
    .trim()
    .email("Email no válido")
    .max(255)
    .optional()
    .or(z.literal("")),
  telefono: z.string().trim().max(50).optional().or(z.literal("")),
  cargo: z.string().trim().max(200).optional().or(z.literal("")),
  fechaIngreso: z.string().trim().optional().or(z.literal("")),
  sueldo: z.coerce.number().nonnegative("Sueldo no puede ser negativo"),
  activo: z.boolean(),
});

export type EmpleadoInput = z.infer<typeof empleadoSchema>;

export const empleadoUpdateSchema = empleadoSchema.partial();

export type EmpleadoUpdateInput = z.infer<typeof empleadoUpdateSchema>;
