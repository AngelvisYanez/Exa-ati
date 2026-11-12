/**
 * Cálculo y armado del payload de factura.
 * Réplica exacta de la lógica que ya usaba /emitir: el importe total
 * no suma la propina; la propina viaja en su propio campo.
 */

import {
  ID_CONSUMIDOR_FINAL,
  validarIdentificacion,
  type EstadoIdentificacion,
} from "@/components/comprobantes/identificacion";

export { ID_CONSUMIDOR_FINAL, NOMBRE_CONSUMIDOR_FINAL } from "@/components/comprobantes/identificacion";

export const TOPE_CONSUMIDOR_FINAL = 50;
export const UMBRAL_BANCARIZACION = 500;
export const PROPINA_PORCENTAJE = 0.1;

/** No hay borrador ni vista previa del RIDE en esta pantalla. */
export const BORRADOR_DISPONIBLE = false;
export const VISTA_PREVIA_RIDE_DISPONIBLE = false;

export const COD_IVA = [
  { value: "2", label: "IVA 15%", tarifa: 15 },
  { value: "3", label: "IVA 5%", tarifa: 5 },
  { value: "0", label: "0%", tarifa: 0 },
  { value: "6", label: "No objeto IVA", tarifa: 0 },
  { value: "7", label: "Exento IVA", tarifa: 0 },
] as const;

export const FORMA_PAGO = [
  { value: "01", label: "Sin utilización del sistema financiero" },
  { value: "15", label: "Compensación de deudas" },
  { value: "16", label: "Tarjeta de débito" },
  { value: "17", label: "Dinero electrónico" },
  { value: "18", label: "Tarjeta prepago" },
  { value: "19", label: "Tarjeta de crédito" },
  { value: "20", label: "Otros con utilización del sistema financiero" },
  { value: "21", label: "Endoso de títulos" },
] as const;

export const ORDEN_FORMA_PAGO = ["01", "20", "19", "16", "15", "17", "18", "21"] as const;

export const PAGO_PRESENTACION: Record<string, { titulo: string; descripcion: string }> = {
  "01": { titulo: "Efectivo", descripcion: "Sin utilización del sistema financiero" },
  "20": { titulo: "Transferencia / depósito", descripcion: "Otros con utilización del sistema financiero" },
  "19": { titulo: "Tarjeta de crédito", descripcion: "Visa, Mastercard, Diners" },
  "16": { titulo: "Tarjeta de débito", descripcion: "Pago con tarjeta de débito" },
  "15": { titulo: "Compensación de deudas", descripcion: "Compensación de deudas" },
  "17": { titulo: "Dinero electrónico", descripcion: "Dinero electrónico" },
  "18": { titulo: "Tarjeta prepago", descripcion: "Tarjeta prepago" },
  "21": { titulo: "Endoso de títulos", descripcion: "Endoso de títulos" },
};

export const PLAZOS = [0, 15, 30, 60] as const;

export interface DetalleItem {
  codigoPrincipal: string;
  descripcion: string;
  descripcionAdicional?: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  iva: string;
}

export const LINEA_VACIA: DetalleItem = {
  codigoPrincipal: "",
  descripcion: "",
  descripcionAdicional: "",
  cantidad: 1,
  precioUnitario: 0,
  descuento: 0,
  iva: "2",
};

const MAX_CAMPO_ADICIONAL = 300;

/** Campo `detallesAdicionales` del XML SRI; se omite si la línea no tiene nota. */
export function detallesAdicionalesDe(linea: DetalleItem) {
  const valor = linea.descripcionAdicional?.trim() ?? "";
  if (!valor) return undefined;
  return [{ nombre: "Adicional", valor: valor.slice(0, MAX_CAMPO_ADICIONAL) }];
}

/** `infoAdicional` del XML SRI; se omite si no hay observaciones. */
export function infoAdicionalDe(observaciones?: string) {
  const valor = observaciones?.trim() ?? "";
  if (!valor) return undefined;
  return [{ nombre: "Observaciones", valor: valor.slice(0, MAX_CAMPO_ADICIONAL) }];
}

export function lineaEnBlanco(d: DetalleItem): boolean {
  return !d.codigoPrincipal.trim() && !d.descripcion.trim();
}

/** Deja siempre una línea vacía al final para seguir cargando sin pulsar «Agregar». */
export function conFilaSiguiente(lineas: DetalleItem[]): DetalleItem[] {
  if (lineas.some(lineaEnBlanco)) return lineas;
  return [...lineas, { ...LINEA_VACIA }];
}

export interface FacturaDatosInput {
  fechaEmision: string;
  secuencial: string;
  tipoId: string;
  identificacion: string;
  razonSocial: string;
  direccion: string;
  email: string;
  detalles: DetalleItem[];
  propina: number;
  formaPago: string;
  plazo: number;
  observaciones?: string;
}

export function tarifaIva(codigo: string): number {
  return COD_IVA.find((item) => item.value === codigo)?.tarifa || 0;
}

export function calcTotal(detalles: DetalleItem[]): { sinImp: number; desc: number; conIVA: number; total: number } {
  let sinImp = 0;
  let desc = 0;
  let total = 0;
  for (const d of detalles) {
    const base = d.cantidad * d.precioUnitario;
    sinImp += base - d.descuento;
    desc += d.descuento;
    const iva = tarifaIva(d.iva);
    total += (base - d.descuento) * (1 + iva / 100);
  }
  return {
    sinImp: Number(sinImp.toFixed(2)),
    desc: Number(desc.toFixed(2)),
    conIVA: Number((total - sinImp).toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

export function totalConImpuestosDe(detalles: DetalleItem[]) {
  const impuestoMap = new Map<string, { codigo: string; codigoPorcentaje: string; baseImponible: number; tarifa: number; valor: number }>();
  for (const d of detalles) {
    const key = d.iva;
    const baseI = d.cantidad * d.precioUnitario - d.descuento;
    const tarifa = tarifaIva(d.iva);
    if (!impuestoMap.has(key)) {
      impuestoMap.set(key, { codigo: "2", codigoPorcentaje: key, baseImponible: 0, tarifa, valor: 0 });
    }
    const entry = impuestoMap.get(key)!;
    entry.baseImponible += baseI;
    entry.valor += (baseI * tarifa) / 100;
  }
  return Array.from(impuestoMap.values()).map((entry) => ({
    ...entry,
    baseImponible: Number(entry.baseImponible.toFixed(2)),
    valor: Number(entry.valor.toFixed(2)),
  }));
}

/** Mismo objeto `datos` que armaba la pantalla antes del rediseño. */
export function buildFacturaDatos(input: FacturaDatosInput) {
  const detalles = input.detalles.filter((linea) => !lineaEnBlanco(linea));
  const totales = calcTotal(detalles);
  const totalConImpuestos = totalConImpuestosDe(detalles);
  const infoAdicional = infoAdicionalDe(input.observaciones);
  return {
    fechaEmision: input.fechaEmision,
    secuencial: input.secuencial || undefined,
    tipoIdentificacionComprador: input.tipoId,
    identificacionComprador: input.identificacion,
    razonSocialComprador: input.razonSocial,
    direccionComprador: input.direccion || undefined,
    emailComprador: input.email || undefined,
    totalSinImpuestos: totales.sinImp,
    totalDescuento: totales.desc,
    importeTotal: totales.total,
    propina: input.propina || undefined,
    totalConImpuestos,
    pagos: [
      {
        formaPago: input.formaPago,
        total: totales.total,
        ...(input.plazo > 0 ? { plazo: input.plazo, unidadTiempo: "dias" as const } : {}),
      },
    ],
    detalles: detalles.map((d) => {
      const adicionales = detallesAdicionalesDe(d);
      return {
        codigoPrincipal: d.codigoPrincipal,
        descripcion: d.descripcion,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        descuento: d.descuento,
        precioTotalSinImpuesto: d.cantidad * d.precioUnitario - d.descuento,
        impuestos: [
          {
            codigo: "2",
            codigoPorcentaje: d.iva,
            tarifa: tarifaIva(d.iva),
            baseImponible: d.cantidad * d.precioUnitario - d.descuento,
            valor: ((d.cantidad * d.precioUnitario - d.descuento) * tarifaIva(d.iva)) / 100,
          },
        ],
        ...(adicionales ? { detallesAdicionales: adicionales } : {}),
      };
    }),
    ...(infoAdicional ? { infoAdicional } : {}),
  };
}

export function subtotalLinea(d: DetalleItem): number {
  return d.cantidad * d.precioUnitario - d.descuento;
}

export function propinaDiezPorciento(sinImpuestos: number): number {
  return Number((sinImpuestos * PROPINA_PORCENTAJE).toFixed(2));
}

export interface DesgloseFactura {
  subtotal15: number;
  subtotal5: number;
  subtotal0: number;
  noObjeto: number;
  exento: number;
  descuento: number;
  iva15: number;
  iva5: number;
  propina: number;
  total: number;
}

export function desgloseFactura(detalles: DetalleItem[], propina: number): DesgloseFactura {
  const totales = calcTotal(detalles);
  const impuestos = totalConImpuestosDe(detalles);
  const base = (codigo: string) => impuestos.find((item) => item.codigoPorcentaje === codigo)?.baseImponible ?? 0;
  const valor = (codigo: string) => impuestos.find((item) => item.codigoPorcentaje === codigo)?.valor ?? 0;
  return {
    subtotal15: base("2"),
    subtotal5: base("3"),
    subtotal0: base("0"),
    noObjeto: base("6"),
    exento: base("7"),
    descuento: totales.desc,
    iva15: valor("2"),
    iva5: valor("3"),
    propina,
    total: totales.total,
  };
}

export function validarIdentificacionFactura(tipo: string, numero: string): EstadoIdentificacion {
  if (tipo === "07") {
    return {
      valido: numero === ID_CONSUMIDOR_FINAL,
      ayuda: `Tope de $${TOPE_CONSUMIDOR_FINAL.toFixed(2)} por factura.`,
      contador: null,
    };
  }
  return validarIdentificacion(tipo, numero);
}

export function lineaLista(d: DetalleItem): boolean {
  const bruto = d.cantidad * d.precioUnitario;
  return Boolean(d.codigoPrincipal.trim())
    && Boolean(d.descripcion.trim())
    && d.cantidad > 0
    && d.precioUnitario > 0
    && d.descuento >= 0
    && d.descuento <= bruto;
}

export interface RevisionFactura {
  comprobante: boolean;
  identificacion: boolean;
  razonSocial: boolean;
  cliente: boolean;
  productos: boolean;
  pago: boolean;
  emitir: boolean;
  puedeEmitir: boolean;
  consumidorFinalExcedido: boolean;
  advertenciaBancarizacion: boolean;
  completados: number;
}

export function revisarFactura(input: {
  emisorRuc: string;
  fechaEmision: string;
  ambiente: string;
  tipoId: string;
  identificacion: string;
  razonSocial: string;
  detalles: DetalleItem[];
  formaPago: string;
}): RevisionFactura {
  const total = calcTotal(input.detalles).total;
  const id = validarIdentificacionFactura(input.tipoId, input.identificacion);
  const consumidorFinalExcedido = input.tipoId === "07" && total > TOPE_CONSUMIDOR_FINAL;
  const comprobante = Boolean(input.emisorRuc && input.fechaEmision && (input.ambiente === "1" || input.ambiente === "2"));
  const identificacion = id.valido && !consumidorFinalExcedido;
  const razonSocial = Boolean(input.razonSocial.trim());
  const activas = input.detalles.filter((linea) => !lineaEnBlanco(linea));
  const productos = activas.length > 0 && activas.every(lineaLista);
  const pago = FORMA_PAGO.some((item) => item.value === input.formaPago) && !consumidorFinalExcedido;
  const flags = [comprobante, identificacion, razonSocial, productos, pago];
  const emitir = flags.every(Boolean);
  return {
    comprobante,
    identificacion,
    razonSocial,
    cliente: identificacion && razonSocial,
    productos,
    pago,
    emitir,
    puedeEmitir: emitir,
    consumidorFinalExcedido,
    advertenciaBancarizacion: total >= UMBRAL_BANCARIZACION && input.formaPago === "01",
    completados: flags.filter(Boolean).length,
  };
}
