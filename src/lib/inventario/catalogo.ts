import { calcTotal } from "@/components/emitir/factura-calculos";

export type TipoProducto = "producto" | "servicio";
export type EstadoStock = "disponible" | "bajo" | "agotado";

export const TIPOS_PRODUCTO: readonly TipoProducto[] = ["producto", "servicio"];
export const ESTADOS_STOCK: readonly EstadoStock[] = ["disponible", "bajo", "agotado"];

export const UNIDADES = [
  "Unidad",
  "Caja",
  "Paquete",
  "Docena",
  "Kilogramo",
  "Gramo",
  "Litro",
  "Mililitro",
  "Metro",
  "Galón",
] as const;

/**
 * Tarifas que se pueden elegir al registrar. No objeto y Exento se guardarían
 * como 0 % y se emitirían con código 0, así que no se ofrecen.
 */
export const TARIFAS_IVA = [15, 5, 0] as const;

export const NOMBRE_CATEGORIA_MAX = 80;
export const CODIGO_MAX = 50;

export interface ColorCategoria {
  punto: string;
  fondo: string;
  texto: string;
}

export const PALETA_CATEGORIAS: readonly ColorCategoria[] = [
  { punto: "#2563EB", fondo: "#EFF6FF", texto: "#1E40AF" },
  { punto: "#D97706", fondo: "#FFF7ED", texto: "#9A3412" },
  { punto: "#7C3AED", fondo: "#F5F3FF", texto: "#5B21B6" },
  { punto: "#0D9488", fondo: "#F0FDFA", texto: "#115E59" },
  { punto: "#DB2777", fondo: "#FDF2F8", texto: "#9D174D" },
  { punto: "#65A30D", fondo: "#F7FEE7", texto: "#3F6212" },
];

export const COLOR_SIN_CATEGORIA: ColorCategoria = { punto: "#A8A29E", fondo: "#F5F5F4", texto: "#57534E" };

export function colorCategoria(indice: number | null | undefined): ColorCategoria {
  if (indice == null || !Number.isFinite(indice)) return COLOR_SIN_CATEGORIA;
  const n = PALETA_CATEGORIAS.length;
  return PALETA_CATEGORIAS[((Math.trunc(indice) % n) + n) % n];
}

export function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Tres letras de la categoría, sin tildes: "Bebidas" → "BEB". */
export function prefijoCategoria(nombre: string | null | undefined): string {
  const letras = sinTildes(nombre ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!letras) return "PRD";
  return letras.slice(0, 3).padEnd(3, "X");
}

export function formatearCodigo(prefijo: string, correlativo: number): string {
  return `${prefijo}-${String(correlativo).padStart(3, "0")}`;
}

/** Siguiente correlativo libre para el prefijo, a partir de los códigos existentes. */
export function siguienteCodigo(prefijo: string, existentes: readonly string[]): string {
  const patron = new RegExp(`^${prefijo}-(\\d+)$`, "i");
  let mayor = 0;
  for (const codigo of existentes) {
    const m = patron.exec(codigo.trim());
    if (m) mayor = Math.max(mayor, Number(m[1]));
  }
  return formatearCodigo(prefijo, mayor + 1);
}

/** Iniciales para el cuadro del producto: "Arroz 2 kg" → "A2". */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

export function estadoStock(p: { tipo?: string | null; stock: number; stockMinimo: number }): EstadoStock | "servicio" {
  if (p.tipo === "servicio") return "servicio";
  if (p.stock <= 0) return "agotado";
  if (p.stock <= p.stockMinimo) return "bajo";
  return "disponible";
}

function redondear(valor: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * f) / f;
}

function codigoIva(tarifa: number): string {
  if (tarifa === 15) return "2";
  if (tarifa === 5) return "3";
  return "0";
}

export interface PrecioCalculado {
  /** Precio unitario sin IVA que se guarda (6 decimales, como el XML del SRI). */
  base: number;
  /** Subtotal sin IVA de una unidad, redondeado como en la factura. */
  subtotal: number;
  iva: number;
  /** Precio al público de una unidad, redondeado como en la factura. */
  pvp: number;
}

/**
 * Convierte el precio digitado en la base sin IVA y calcula una unidad con
 * el mismo redondeo que la emisión de facturas (`calcTotal`).
 */
export function calcularPrecio(precio: number, tarifa: number, incluyeIva: boolean): PrecioCalculado {
  const valor = Number.isFinite(precio) && precio > 0 ? precio : 0;
  const base = redondear(incluyeIva ? valor / (1 + tarifa / 100) : valor, 6);
  const totales = calcTotal([
    { codigoPrincipal: "", descripcion: "", cantidad: 1, precioUnitario: base, descuento: 0, iva: codigoIva(tarifa) },
  ]);
  return { base, subtotal: totales.sinImp, iva: totales.conIVA, pvp: totales.total };
}

/** Precio al público de una base guardada (lo que verá el cliente en caja). */
export function precioPublico(base: number, tarifa: number): number {
  return calcularPrecio(base, tarifa, false).pvp;
}

export function etiquetaStock(stock: number, unidad: string): string {
  const n = Number.isInteger(stock) ? String(stock) : stock.toFixed(2);
  if (!unidad || unidad === "Unidad") return `${n} u.`;
  return `${n} ${unidad.toLowerCase()}`;
}
