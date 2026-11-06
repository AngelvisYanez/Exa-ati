import {
  BILLETES_RAPIDOS,
  IDENTIFICACION_CONSUMIDOR_FINAL,
  MAX_BOTONES_EFECTIVO,
  TIPO_ID_CEDULA,
  TIPO_ID_CONSUMIDOR_FINAL,
  TIPO_ID_RUC,
  type FormaPagoCodigo,
} from "./pos-config";

export interface ProductoPos {
  id: string;
  codigo: string;
  nombre: string;
  precioUnitario: number;
  ivaPorcentaje: number;
  stock: number;
  categoriaId: string | null;
  categoriaNombre: string | null;
  categoriaColor: number | null;
}

export interface LineaTicket {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaPorcentaje: number;
  descuento: number;
}

export interface ClienteDatos {
  identificacion: string;
  razonSocial: string;
  email: string;
  direccion: string;
  telefono: string;
}

export const CLIENTE_VACIO: ClienteDatos = {
  identificacion: "",
  razonSocial: "",
  email: "",
  direccion: "",
  telefono: "",
};

export function productoDesdeApi(row: Record<string, unknown>): ProductoPos {
  const color = row.categoria_color;
  return {
    id: String(row.id),
    codigo: String(row.codigo ?? ""),
    nombre: String(row.nombre ?? ""),
    precioUnitario: Number(row.precio_unitario) || 0,
    ivaPorcentaje: Number(row.iva_porcentaje ?? 15),
    stock: Number(row.stock) || 0,
    categoriaId: row.categoria_id ? String(row.categoria_id) : null,
    categoriaNombre: row.categoria_nombre ? String(row.categoria_nombre) : null,
    categoriaColor: color == null ? null : Number(color),
  };
}

export function lineaDesdeProducto(p: ProductoPos): LineaTicket {
  return {
    id: p.id,
    codigo: p.codigo,
    descripcion: p.nombre,
    cantidad: 1,
    precioUnitario: p.precioUnitario,
    ivaPorcentaje: p.ivaPorcentaje,
    descuento: 0,
  };
}

/** Suma 1 si el producto ya está en el ticket; si no, lo agrega al final. */
export function agregarProducto(lineas: LineaTicket[], p: ProductoPos): LineaTicket[] {
  if (lineas.some((l) => l.id === p.id)) {
    return lineas.map((l) => (l.id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l));
  }
  return [...lineas, lineaDesdeProducto(p)];
}

export function totalLinea(l: LineaTicket): number {
  return l.cantidad * l.precioUnitario - (l.descuento || 0);
}

/**
 * Réplica de `calcularPosTotals` (src/services/sri-api/pos.ts) sin descuento
 * global, que el POS no usa. Debe coincidir al centavo con el XML; el test de
 * paridad lo verifica.
 */
export function calcularTotalesTicket(items: LineaTicket[], propina = 0) {
  let subtotalSinImpuesto = 0;
  let totalDescuento = 0;
  const ivaMap = new Map<number, { tarifa: number; baseImponible: number; valor: number }>();

  for (const item of items) {
    const base = item.cantidad * item.precioUnitario;
    const desc = item.descuento || 0;
    const baseConDesc = base - desc;
    subtotalSinImpuesto += baseConDesc;
    totalDescuento += desc;

    if (item.ivaPorcentaje > 0) {
      const existing = ivaMap.get(item.ivaPorcentaje);
      const valorIva = (baseConDesc * item.ivaPorcentaje) / 100;
      if (existing) {
        existing.baseImponible += baseConDesc;
        existing.valor += valorIva;
      } else {
        ivaMap.set(item.ivaPorcentaje, { tarifa: item.ivaPorcentaje, baseImponible: baseConDesc, valor: valorIva });
      }
    } else {
      const existing = ivaMap.get(0);
      if (existing) existing.baseImponible += baseConDesc;
      else ivaMap.set(0, { tarifa: 0, baseImponible: baseConDesc, valor: 0 });
    }
  }

  const ivaDesglosado = Array.from(ivaMap.values()).map((v) => ({
    tarifa: v.tarifa,
    baseImponible: Number(v.baseImponible.toFixed(2)),
    valor: Number(v.valor.toFixed(2)),
  }));

  const totalIVA = ivaDesglosado.reduce((s, v) => s + v.valor, 0);
  const total = Number((subtotalSinImpuesto + totalIVA + propina).toFixed(2));

  return {
    subtotalSinImpuesto: Number(subtotalSinImpuesto.toFixed(2)),
    totalDescuento: Number(totalDescuento.toFixed(2)),
    totalIVA: Number(totalIVA.toFixed(2)),
    total,
    ivaDesglosado,
  };
}

export type TotalesTicket = ReturnType<typeof calcularTotalesTicket>;

/** Filas a mostrar: siempre 15% y 0%, más cualquier otra tarifa presente. */
export function filasTarifas(totales: TotalesTicket) {
  const porTarifa = new Map(totales.ivaDesglosado.map((d) => [d.tarifa, d]));
  const tarifas = new Set([15, 0, ...porTarifa.keys()]);
  return [...tarifas]
    .sort((a, b) => b - a)
    .map((tarifa) => ({
      tarifa,
      baseImponible: porTarifa.get(tarifa)?.baseImponible ?? 0,
      valor: porTarifa.get(tarifa)?.valor ?? 0,
    }));
}

export function contarArticulos(lineas: LineaTicket[]): number {
  return lineas.reduce((s, l) => s + l.cantidad, 0);
}

/* ---------- Cliente ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function tipoIdentificacionDe(identificacion: string): string | null {
  if (/^\d{10}$/.test(identificacion)) return TIPO_ID_CEDULA;
  if (/^\d{10}001$/.test(identificacion)) return TIPO_ID_RUC;
  return null;
}

export function validarIdentificacion(v: string): string | null {
  const s = v.trim();
  if (!s) return "Ingresa la cédula o el RUC";
  if (!/^\d+$/.test(s)) return "Solo números";
  if (s.length === 10) return null;
  if (s.length === 13) return s.endsWith("001") ? null : "El RUC debe terminar en 001";
  return "Cédula de 10 dígitos o RUC de 13";
}

export function validarEmail(v: string): string | null {
  const s = v.trim();
  if (!s) return "Ingresa el email";
  return EMAIL_RE.test(s) ? null : "Email no válido";
}

export type CampoCliente = "identificacion" | "razonSocial" | "email" | "direccion";

export const ETIQUETA_CAMPO: Record<CampoCliente, string> = {
  identificacion: "cédula/RUC",
  razonSocial: "nombre",
  email: "email",
  direccion: "dirección",
};

export function camposFaltantes(c: ClienteDatos): CampoCliente[] {
  const faltan: CampoCliente[] = [];
  if (validarIdentificacion(c.identificacion)) faltan.push("identificacion");
  if (!c.razonSocial.trim()) faltan.push("razonSocial");
  if (validarEmail(c.email)) faltan.push("email");
  if (!c.direccion.trim()) faltan.push("direccion");
  return faltan;
}

export function normalizarCliente(c: ClienteDatos): ClienteDatos {
  return {
    identificacion: c.identificacion.trim(),
    razonSocial: c.razonSocial.trim(),
    email: c.email.trim(),
    direccion: c.direccion.trim(),
    telefono: c.telefono.trim(),
  };
}

export function iniciales(texto: string): string {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  const a = palabras[0][0] ?? "";
  const b = palabras[1]?.[0] ?? palabras[0][1] ?? "";
  return (a + b).toUpperCase();
}

/* ---------- Payload ---------- */

export interface EstadoVenta {
  emisorId: string;
  lineas: LineaTicket[];
  formaPago: FormaPagoCodigo;
  propina: number;
  observaciones: string;
  /** `null` = consumidor final. */
  cliente: ClienteDatos | null;
}

/** Mismo contrato que la pantalla anterior enviaba a POST /api/sri/pos. */
export function construirPayloadPos(v: EstadoVenta) {
  const tipoId = v.cliente
    ? (tipoIdentificacionDe(v.cliente.identificacion) ?? "")
    : TIPO_ID_CONSUMIDOR_FINAL;
  const identificacion = v.cliente ? v.cliente.identificacion : IDENTIFICACION_CONSUMIDOR_FINAL;

  return {
    emisorId: v.emisorId,
    items: v.lineas.map((i) => ({
      codigo: i.codigo,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      ivaPorcentaje: i.ivaPorcentaje,
      descuento: i.descuento,
    })),
    formaPago: v.formaPago,
    propina: v.propina > 0 ? v.propina : undefined,
    observaciones: v.observaciones || undefined,
    cliente:
      tipoId === TIPO_ID_CONSUMIDOR_FINAL && identificacion === IDENTIFICACION_CONSUMIDOR_FINAL
        ? undefined
        : {
            tipoIdentificacion: tipoId,
            identificacion,
            razonSocial: v.cliente?.razonSocial ?? "",
            email: v.cliente?.email || undefined,
            direccion: v.cliente?.direccion || undefined,
          },
  };
}

/* ---------- Cobro ---------- */

/** "Exacto" + billetes mayores al total, hasta MAX_BOTONES_EFECTIVO en total. */
export function montosRapidos(total: number): { label: string; monto: number }[] {
  const billetes = BILLETES_RAPIDOS.filter((b) => b > total)
    .slice(0, MAX_BOTONES_EFECTIVO - 1)
    .map((b) => ({ label: `$${b}`, monto: b }));
  return [{ label: "Exacto", monto: total }, ...billetes];
}

export function parseMonto(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Clave de acceso SRI (49 dígitos) → número de factura 001-001-000000123. */
export function numeroFacturaDesdeClave(clave: string): string | null {
  if (!/^\d{49}$/.test(clave)) return null;
  return `${clave.slice(24, 27)}-${clave.slice(27, 30)}-${clave.slice(30, 39)}`;
}

/** Enter en un campo del formulario ejecuta la acción principal; en un botón, activa ese botón. */
export function enterEnCampo(e: React.KeyboardEvent<HTMLFormElement>, accion: () => void) {
  if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
    e.preventDefault();
    accion();
  }
}

export function formatoUSD(n: number): string {
  return `$${n.toFixed(2)}`;
}
