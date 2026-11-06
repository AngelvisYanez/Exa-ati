export interface EmisorOpcion {
  ruc: string;
  razonSocial: string;
  ambiente?: string;
  establecimiento?: string;
  estab?: string;
  puntoEmision?: string;
  punto_emision?: string;
  ptoEmi?: string;
}

export interface ContactoResumen {
  id: string;
  tipoIdentificacion: string;
  identificacion: string;
  razonSocial: string;
  email?: string | null;
}

export interface ProductoInventario {
  id: string;
  codigo: string;
  nombre: string;
  precio_unitario: string;
  iva_porcentaje: number;
  stock: string;
}

export interface ResultadoEmision {
  estado?: string;
  numeroAutorizacion?: string;
  claveAcceso?: string;
  requierePolling?: boolean;
  error?: { mensaje?: string };
  mensajes?: { mensaje?: string }[];
}

export interface SerieCorta {
  estab: string;
  pto: string;
}
