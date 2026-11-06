/**
 * Tokens visuales de los formularios de emisión.
 * Los colores salen de la paleta de `globals.css` (brand-*, success-*) y, para
 * los avisos, de la paleta de Tailwind; ningún componente debe repetir estas clases.
 */

export const control =
  "h-11 w-full rounded-[10px] border border-brand-gray-200 bg-white px-3 text-sm text-brand-gray-900 shadow-none placeholder:text-brand-gray-400 focus-visible:border-brand-red focus-visible:ring-3 focus-visible:ring-brand-red/15";

export const alturaControl = "h-11";
export const radioControl = "rounded-[10px]";
export const foco = "focus-visible:outline-2 focus-visible:outline-brand-red";

export const tarjeta = "rounded-2xl border border-brand-gray-200 bg-white shadow-sm";

export const tono = {
  exito: "border-success/20 bg-success-pale text-success",
  aviso: "border-orange-200 bg-orange-50 text-orange-900",
  avisoFuerte: "border-orange-200 bg-orange-50 text-orange-950",
  info: "border-blue-200 bg-blue-50 text-blue-900",
} as const;

/** Texto y borde de un campo válido pero con advertencia (no bloquea). */
export const advertenciaCampo = { texto: "text-orange-700", borde: "border-orange-300 focus-visible:border-orange-400" } as const;

export const ambienteTono = {
  punto: { produccion: "bg-success", pruebas: "bg-amber-500" },
  pill: { produccion: "bg-success text-white", pruebas: "bg-amber-400 text-orange-950" },
} as const;

export const chip = {
  base: "h-11 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-red",
  activo: "border-brand-red bg-brand-red text-white",
  inactivo: "border-brand-gray-200 bg-white text-brand-gray-700",
} as const;

export const boton = {
  primario: "h-11 w-full rounded-[10px] bg-brand-red text-white hover:brightness-90",
  secundario: "h-11 rounded-[10px] border-brand-gray-200 bg-white",
} as const;

export function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function esProduccion(ambiente: string): boolean {
  return ambiente === "2";
}

export function nombreAmbiente(ambiente: string): string {
  return esProduccion(ambiente) ? "Producción" : "Pruebas";
}
