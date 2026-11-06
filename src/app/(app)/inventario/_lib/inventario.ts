import type { EstadoStock, TipoProducto } from "@/lib/inventario/catalogo";

/**
 * Funciones del diseño sin respaldo en el backend. Se activan cuando exista
 * el endpoint o la columna correspondiente.
 */
export const INVENTARIO_FEATURES = {
  /** No existe importación de productos (exceljs solo se usa para exportar). */
  importarExcel: false,
  /** No hay tienda eCommerce que lea `visible_ecommerce` y la columna no existe. */
  publicarEcommerce: false,
} as const;

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  /** Base sin IVA. */
  precio: number;
  ivaPorcentaje: number;
  stock: number;
  activo: boolean;
  categoriaId: string | null;
  categoriaNombre: string | null;
  categoriaColor: number | null;
  tipo: TipoProducto;
  stockMinimo: number;
  unidad: string;
  codigoBarras: string;
  visiblePos: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  color: number;
  productos: number;
}

export interface Resumen {
  total: number;
  disponibles: number;
  bajo: number;
  agotado: number;
}

export type FiltroEstado = EstadoStock | "todos";
/** `null` = todas, `"sin"` = sin categoría. */
export type FiltroCategoria = string | null;

export function productoDesdeApi(row: Record<string, unknown>): Producto {
  const color = row.categoria_color;
  return {
    id: String(row.id),
    codigo: String(row.codigo ?? ""),
    nombre: String(row.nombre ?? ""),
    descripcion: String(row.descripcion ?? ""),
    precio: Number(row.precio_unitario) || 0,
    ivaPorcentaje: Number(row.iva_porcentaje ?? 15),
    stock: Number(row.stock) || 0,
    activo: row.activo === true || row.activo === 1,
    categoriaId: row.categoria_id ? String(row.categoria_id) : null,
    categoriaNombre: row.categoria_nombre ? String(row.categoria_nombre) : null,
    categoriaColor: color == null ? null : Number(color),
    tipo: row.tipo === "servicio" ? "servicio" : "producto",
    stockMinimo: Number(row.stock_minimo) || 0,
    unidad: String(row.unidad ?? "Unidad"),
    codigoBarras: String(row.codigo_barras ?? ""),
    visiblePos: row.visible_pos === undefined ? true : row.visible_pos === true || row.visible_pos === 1,
  };
}

export async function leerError(res: Response, porDefecto: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { message?: string } | null;
  return data?.message || porDefecto;
}
