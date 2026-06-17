import { randomInt } from 'crypto';

export enum Ambiente {
  PRUEBAS = '1',
  PRODUCCION = '2',
}

export enum TipoEmision {
  NORMAL = '1',
  CONTINGENCIA = '2',
}

export interface ClaveAccesoData {
  fechaEmision: Date;
  tipoComprobante: string;
  ruc: string;
  ambiente?: Ambiente;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  codigoNumerico?: string;
  tipoEmision?: TipoEmision;
}

function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return day + month + year;
}

function validateRuc(ruc: string): string {
  const cleanRuc = ruc.replace(/\D/g, '');
  if (cleanRuc.length !== 13) {
    throw new Error(`RUC inválido: debe tener 13 dígitos`);
  }
  return cleanRuc;
}

function generateCodigoNumerico(): string {
  return randomInt(10000000, 100000000).toString();
}

function calculateModulo11(claveBase: string): string {
  const factores = [2, 3, 4, 5, 6, 7];
  let suma = 0;

  for (let i = claveBase.length - 1, j = 0; i >= 0; i--, j++) {
    const digit = parseInt(claveBase.charAt(i), 10);
    const factor = factores[j % factores.length];
    suma += digit * factor;
  }

  const modulo = suma % 11;
  let digitoVerificador = 11 - modulo;

  if (digitoVerificador === 11) {
    digitoVerificador = 0;
  } else if (digitoVerificador === 10) {
    digitoVerificador = 1;
  }

  return digitoVerificador.toString();
}

export const claveAccesoService = {
  generate(data: ClaveAccesoData): string {
    const fecha = formatDate(data.fechaEmision);
    const tipoComprobante = data.tipoComprobante.padStart(2, '0');
    const ruc = validateRuc(data.ruc);
    const ambiente = data.ambiente || Ambiente.PRUEBAS;
    const establecimiento = data.establecimiento.padStart(3, '0');
    const puntoEmision = data.puntoEmision.padStart(3, '0');
    const secuencial = data.secuencial.padStart(9, '0');
    const codigoNumerico = data.codigoNumerico || generateCodigoNumerico();
    const tipoEmision = data.tipoEmision || TipoEmision.NORMAL;

    const claveBase =
      fecha +
      tipoComprobante +
      ruc +
      ambiente +
      establecimiento +
      puntoEmision +
      secuencial +
      codigoNumerico +
      tipoEmision;

    const digitoVerificador = calculateModulo11(claveBase);
    return claveBase + digitoVerificador;
  },

  validate(claveAcceso: string): boolean {
    if (claveAcceso.length !== 49 || !/^\d{49}$/.test(claveAcceso)) {
      return false;
    }

    const claveBase = claveAcceso.substring(0, 48);
    const digitoVerificador = claveAcceso.charAt(48);
    const digitoCalculado = calculateModulo11(claveBase);

    return digitoVerificador === digitoCalculado;
  },

  parse(claveAcceso: string): ClaveAccesoData | null {
    if (!this.validate(claveAcceso)) {
      return null;
    }

    const fechaStr = claveAcceso.substring(0, 8);
    const fecha = new Date(
      parseInt(fechaStr.substring(4, 8)),
      parseInt(fechaStr.substring(2, 4)) - 1,
      parseInt(fechaStr.substring(0, 2))
    );

    return {
      fechaEmision: fecha,
      tipoComprobante: claveAcceso.substring(8, 10),
      ruc: claveAcceso.substring(10, 23),
      ambiente: claveAcceso.charAt(23) as Ambiente,
      establecimiento: claveAcceso.substring(24, 27),
      puntoEmision: claveAcceso.substring(27, 30),
      secuencial: claveAcceso.substring(30, 39),
      codigoNumerico: claveAcceso.substring(39, 47),
      tipoEmision: claveAcceso.charAt(47) as TipoEmision,
    };
  }
};
