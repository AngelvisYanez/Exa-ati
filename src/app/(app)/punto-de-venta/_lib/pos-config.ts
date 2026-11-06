import { Banknote, CreditCard, ArrowLeftRight, type LucideIcon } from "lucide-react";

/** Monto máximo (USD, importe total) que el SRI acepta para "Consumidor final". */
export const LIMITE_CONSUMIDOR_FINAL = Number(
  process.env.NEXT_PUBLIC_POS_LIMITE_CONSUMIDOR_FINAL ?? 50,
);

export const IDENTIFICACION_CONSUMIDOR_FINAL = "9999999999999";
export const TIPO_ID_CONSUMIDOR_FINAL = "07";
export const TIPO_ID_CEDULA = "05";
export const TIPO_ID_RUC = "04";

/** Denominaciones ofrecidas como "recibido" rápido en efectivo. */
export const BILLETES_RAPIDOS = [5, 10, 20, 50, 100] as const;
export const MAX_BOTONES_EFECTIVO = 4;

export type FormaPagoCodigo = "01" | "19" | "20";

/** Códigos SRI de forma de pago, los mismos que enviaba la pantalla anterior. */
export const FORMAS_PAGO_POS: { value: FormaPagoCodigo; label: string; icon: LucideIcon }[] = [
  { value: "01", label: "Efectivo", icon: Banknote },
  { value: "19", label: "Tarjeta", icon: CreditCard },
  { value: "20", label: "Transferencia", icon: ArrowLeftRight },
];

/**
 * Funciones del diseño sin respaldo en el backend. Se activan cuando exista
 * el endpoint o la columna correspondiente.
 */
export const POS_FEATURES = {
  /** No existe modelo de caja/turno. */
  turnoCaja: false,
  /** Existe /punto-de-venta/ventas. */
  ventasDelDia: true,
  /** No existe venta sin factura. */
  soloTicket: false,
  /** No hay alta rápida de producto desde el POS. */
  crearProductoRapido: false,
  /** `productos` no tiene columna de imagen. */
  imagenesProducto: false,
  /** El payload de /api/sri/pos no tiene campo para la referencia del voucher. */
  referenciaPago: false,
} as const;
