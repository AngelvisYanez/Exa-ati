/**
 * Categorías y datos de inventario de los productos (migración 017).
 *
 * Las tablas no se crean en tiempo de ejecución: si la migración no está
 * aplicada, el listado de productos sigue respondiendo con sus columnas de
 * siempre y estas funciones lanzan `CatalogoSinMigrar`.
 */
import { randomUUID } from 'crypto';
import { db } from './db';
import {
  ESTADOS_STOCK,
  NOMBRE_CATEGORIA_MAX,
  PALETA_CATEGORIAS,
  TIPOS_PRODUCTO,
  prefijoCategoria,
  siguienteCodigo,
  type EstadoStock,
  type TipoProducto,
} from '@/lib/inventario/catalogo';

const usesPostgres = Boolean(process.env.DATABASE_URL);
const REINTENTO_MS = 60_000;

export class CatalogoSinMigrar extends Error {
  constructor() {
    super('Falta aplicar la migración 017_catalogo_productos en esta base de datos.');
  }
}

export class CatalogoInvalido extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
  }
}

let disponible = false;
let revisadoEn = 0;

export async function catalogoDisponible(): Promise<boolean> {
  if (disponible) return true;
  if (Date.now() - revisadoEn < REINTENTO_MS) return false;
  const esquema = usesPostgres ? 'current_schema()' : 'DATABASE()';
  const fila = await db.queryOne<{ columnas: string | number; tablas: string | number }>(
    `SELECT
       (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = ${esquema} AND table_name = 'productos'
           AND column_name IN ('categoria_id', 'tipo', 'stock_minimo', 'unidad', 'codigo_barras', 'visible_pos')) AS columnas,
       (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema = ${esquema} AND table_name = 'categorias_producto') AS tablas`,
  );
  revisadoEn = Date.now();
  disponible = Number(fila?.columnas) === 6 && Number(fila?.tablas) === 1;
  return disponible;
}

export async function exigirCatalogo(): Promise<void> {
  if (!(await catalogoDisponible())) throw new CatalogoSinMigrar();
}

export interface CategoriaProducto {
  id: string;
  nombre: string;
  color: number;
  orden: number;
  activo: boolean;
  productos: number;
}

export interface ResumenCategorias {
  categorias: CategoriaProducto[];
  /** Productos activos del tenant. */
  total: number;
  sinCategoria: number;
}

export async function listarCategorias(tenantId: string, incluirInactivas = false): Promise<ResumenCategorias> {
  await exigirCatalogo();
  const filas = await db.queryAll<{ id: string; nombre: string; color: number; orden: number; activo: boolean | number; productos: string | number }>(
    `SELECT c.id, c.nombre, c.color, c.orden, c.activo,
            (SELECT COUNT(*) FROM productos p
              WHERE p.tenant_id = c.tenant_id AND p.categoria_id = c.id AND p.activo = true) AS productos
       FROM categorias_producto c
      WHERE c.tenant_id = $1 ${incluirInactivas ? '' : 'AND c.activo = true'}
      ORDER BY c.orden ASC, c.nombre ASC`,
    [tenantId],
  );
  const conteo = await db.queryOne<{ total: string | number; sin_categoria: string | number }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN categoria_id IS NULL THEN 1 ELSE 0 END), 0) AS sin_categoria
       FROM productos WHERE tenant_id = $1 AND activo = true`,
    [tenantId],
  );
  return {
    categorias: filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      color: Number(f.color) || 0,
      orden: Number(f.orden) || 0,
      activo: Boolean(f.activo),
      productos: Number(f.productos) || 0,
    })),
    total: Number(conteo?.total) || 0,
    sinCategoria: Number(conteo?.sin_categoria) || 0,
  };
}

export async function categoriaDelTenant(tenantId: string, id: string): Promise<{ id: string; nombre: string } | null> {
  return db.queryOne<{ id: string; nombre: string }>(
    'SELECT id, nombre FROM categorias_producto WHERE id = $1 AND tenant_id = $2',
    [id, tenantId],
  );
}

function limpiarNombre(nombre: unknown): string {
  const texto = typeof nombre === 'string' ? nombre.replace(/\s+/g, ' ').trim() : '';
  if (!texto) throw new CatalogoInvalido('Escribe el nombre de la categoría.');
  if (texto.length > NOMBRE_CATEGORIA_MAX) {
    throw new CatalogoInvalido(`El nombre admite hasta ${NOMBRE_CATEGORIA_MAX} caracteres.`);
  }
  return texto;
}

async function nombreOcupado(tenantId: string, nombre: string, exceptoId?: string): Promise<boolean> {
  const fila = await db.queryOne(
    `SELECT id FROM categorias_producto
      WHERE tenant_id = $1 AND LOWER(nombre) = LOWER($2) ${exceptoId ? 'AND id <> $3' : ''}`,
    exceptoId ? [tenantId, nombre, exceptoId] : [tenantId, nombre],
  );
  return Boolean(fila);
}

export async function crearCategoria(tenantId: string, nombreEntrada: unknown): Promise<CategoriaProducto> {
  await exigirCatalogo();
  const nombre = limpiarNombre(nombreEntrada);
  if (await nombreOcupado(tenantId, nombre)) {
    throw new CatalogoInvalido(`Ya existe la categoría «${nombre}».`, 409);
  }
  const stats = await db.queryOne<{ cantidad: string | number; orden: string | number | null }>(
    'SELECT COUNT(*) AS cantidad, MAX(orden) AS orden FROM categorias_producto WHERE tenant_id = $1',
    [tenantId],
  );
  const color = (Number(stats?.cantidad) || 0) % PALETA_CATEGORIAS.length;
  const orden = stats?.orden == null ? 0 : Number(stats.orden) + 1;
  const id = randomUUID();
  try {
    await db.query(
      `INSERT INTO categorias_producto (id, tenant_id, nombre, color, orden, activo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
      [id, tenantId, nombre, color, orden],
    );
  } catch (error) {
    if (/duplicate|unique/i.test(error instanceof Error ? error.message : String(error))) {
      throw new CatalogoInvalido(`Ya existe la categoría «${nombre}».`, 409);
    }
    throw error;
  }
  return { id, nombre, color, orden, activo: true, productos: 0 };
}

export async function actualizarCategoria(
  tenantId: string,
  id: string,
  cambios: { nombre?: unknown; activo?: unknown },
): Promise<void> {
  await exigirCatalogo();
  if (!(await categoriaDelTenant(tenantId, id))) throw new CatalogoInvalido('Categoría no encontrada.', 404);

  if (cambios.nombre !== undefined) {
    const nombre = limpiarNombre(cambios.nombre);
    if (await nombreOcupado(tenantId, nombre, id)) {
      throw new CatalogoInvalido(`Ya existe la categoría «${nombre}».`, 409);
    }
    await db.query(
      'UPDATE categorias_producto SET nombre = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
      [nombre, id, tenantId],
    );
  }
  if (cambios.activo !== undefined) {
    if (typeof cambios.activo !== 'boolean') throw new CatalogoInvalido('El estado debe ser verdadero o falso.');
    await db.query(
      'UPDATE categorias_producto SET activo = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
      [cambios.activo, id, tenantId],
    );
  }
}

/** Solo se borra si no tiene productos; si los tiene, se desactiva. */
export async function eliminarCategoria(tenantId: string, id: string): Promise<void> {
  await exigirCatalogo();
  if (!(await categoriaDelTenant(tenantId, id))) throw new CatalogoInvalido('Categoría no encontrada.', 404);
  const uso = await db.queryOne<{ n: string | number }>(
    'SELECT COUNT(*) AS n FROM productos WHERE tenant_id = $1 AND categoria_id = $2',
    [tenantId, id],
  );
  if (Number(uso?.n) > 0) {
    throw new CatalogoInvalido('La categoría tiene productos: desactívala en lugar de eliminarla.', 409);
  }
  await db.query('DELETE FROM categorias_producto WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
}

/** Columnas de la migración 017 en el listado de productos. */
export const COLUMNAS_CATALOGO = `p.categoria_id, c.nombre AS categoria_nombre, c.color AS categoria_color,
  p.tipo, p.stock_minimo, p.unidad, p.codigo_barras, p.visible_pos`;
export const JOIN_CATEGORIA = 'LEFT JOIN categorias_producto c ON c.id = p.categoria_id AND c.tenant_id = p.tenant_id';

/** Servicios cuentan como disponibles y nunca como bajo o agotado. */
export const CONDICION_ESTADO: Record<EstadoStock, string> = {
  disponible: "(p.tipo = 'servicio' OR p.stock > p.stock_minimo)",
  bajo: "(p.tipo <> 'servicio' AND p.stock > 0 AND p.stock <= p.stock_minimo)",
  agotado: "(p.tipo <> 'servicio' AND p.stock <= 0)",
};

export function esEstadoStock(valor: string | null): valor is EstadoStock {
  return valor !== null && (ESTADOS_STOCK as readonly string[]).includes(valor);
}

export interface CamposCatalogo {
  categoria_id?: string | null;
  tipo?: TipoProducto;
  stock_minimo?: number;
  unidad?: string;
  codigo_barras?: string | null;
  visible_pos?: boolean;
}

const CLAVES_CATALOGO = ['categoriaId', 'tipo', 'stockMinimo', 'unidad', 'codigoBarras', 'visiblePos'] as const;

/** Lee y valida los campos opcionales de catálogo del cuerpo de un producto. */
export async function leerCamposCatalogo(tenantId: string, body: Record<string, unknown>): Promise<CamposCatalogo> {
  const presentes = CLAVES_CATALOGO.filter((k) => body[k] !== undefined);
  if (presentes.length === 0) return {};
  await exigirCatalogo();

  const campos: CamposCatalogo = {};
  if (body.categoriaId !== undefined) {
    if (body.categoriaId === null || body.categoriaId === '') {
      campos.categoria_id = null;
    } else {
      const categoria = typeof body.categoriaId === 'string'
        ? await categoriaDelTenant(tenantId, body.categoriaId)
        : null;
      if (!categoria) throw new CatalogoInvalido('La categoría no existe en esta empresa.');
      campos.categoria_id = categoria.id;
    }
  }
  if (body.tipo !== undefined) {
    if (!(TIPOS_PRODUCTO as readonly unknown[]).includes(body.tipo)) {
      throw new CatalogoInvalido('El tipo debe ser «producto» o «servicio».');
    }
    campos.tipo = body.tipo as TipoProducto;
  }
  if (body.stockMinimo !== undefined) {
    const n = Number(body.stockMinimo);
    if (!Number.isFinite(n) || n < 0) throw new CatalogoInvalido('El stock mínimo debe ser 0 o mayor.');
    campos.stock_minimo = n;
  }
  if (body.unidad !== undefined) {
    const unidad = typeof body.unidad === 'string' ? body.unidad.trim() : '';
    if (!unidad || unidad.length > 20) throw new CatalogoInvalido('La unidad debe tener entre 1 y 20 caracteres.');
    campos.unidad = unidad;
  }
  if (body.codigoBarras !== undefined) {
    const codigo = typeof body.codigoBarras === 'string' ? body.codigoBarras.trim() : '';
    if (codigo.length > 50) throw new CatalogoInvalido('El código de barras admite hasta 50 caracteres.');
    campos.codigo_barras = codigo || null;
  }
  if (body.visiblePos !== undefined) {
    if (typeof body.visiblePos !== 'boolean') throw new CatalogoInvalido('«Mostrar en Punto de venta» debe ser verdadero o falso.');
    campos.visible_pos = body.visiblePos;
  }
  if (campos.tipo === 'servicio') campos.stock_minimo = 0;
  return campos;
}

/** Código sugerido (BEB-001) único dentro del tenant. */
export async function codigoSugerido(tenantId: string, categoriaId: string | null, tipo: string | null): Promise<string> {
  let nombre: string | null = null;
  if (categoriaId) {
    await exigirCatalogo();
    const categoria = await categoriaDelTenant(tenantId, categoriaId);
    if (!categoria) throw new CatalogoInvalido('Categoría no encontrada.', 404);
    nombre = categoria.nombre;
  }
  const prefijo = nombre ? prefijoCategoria(nombre) : tipo === 'servicio' ? 'SER' : 'PRD';
  const filas = await db.queryAll<{ codigo: string }>(
    'SELECT codigo FROM productos WHERE tenant_id = $1 AND UPPER(codigo) LIKE $2',
    [tenantId, `${prefijo}-%`],
  );
  return siguienteCodigo(prefijo, filas.map((f) => f.codigo));
}
