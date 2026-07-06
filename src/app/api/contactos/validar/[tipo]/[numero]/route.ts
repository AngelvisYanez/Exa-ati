import { NextResponse } from 'next/server';
import { db } from '@/lib/sri-api/db';

function validarRuc(numero: string): { valido: boolean; mensaje: string } {
  if (!/^\d{13}$/.test(numero)) {
    return { valido: false, mensaje: 'El RUC debe tener 13 dígitos numéricos.' };
  }
  if (numero.substring(10, 13) !== '001') {
    return { valido: false, mensaje: 'Los últimos 3 dígitos del RUC deben ser 001.' };
  }
  const tercerDigito = parseInt(numero[2], 10);
  if (tercerDigito <= 6) {
    return validarCedula(numero.substring(0, 10));
  }
  if (tercerDigito === 9) {
    const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 9; i++) suma += parseInt(numero[i], 10) * coeficientes[i];
    const residuo = suma % 11;
    const digitoVerificador = residuo === 0 ? 0 : 11 - residuo;
    if (parseInt(numero[9], 10) !== digitoVerificador) {
      return { valido: false, mensaje: 'Dígito verificador del RUC (Sociedad) no coincide.' };
    }
    return { valido: true, mensaje: '' };
  }
  if (tercerDigito === 8) {
    const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 8; i++) suma += parseInt(numero[i], 10) * coeficientes[i];
    const residuo = suma % 11;
    const digitoVerificador = residuo === 0 ? 0 : 11 - residuo;
    if (parseInt(numero[8], 10) !== digitoVerificador) {
      return { valido: false, mensaje: 'Dígito verificador del RUC (Extranjero) no coincide.' };
    }
    return { valido: true, mensaje: '' };
  }
  return { valido: false, mensaje: 'Tercer dígito del RUC inválido.' };
}

function validarCedula(numero: string): { valido: boolean; mensaje: string } {
  if (!/^\d{10}$/.test(numero)) {
    return { valido: false, mensaje: 'La cédula debe tener 10 dígitos numéricos.' };
  }
  const provincia = parseInt(numero.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) {
    return { valido: false, mensaje: 'Código de provincia inválido.' };
  }
  if (parseInt(numero[2], 10) > 6) {
    return { valido: false, mensaje: 'Tercer dígito inválido para cédula.' };
  }
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let valor = parseInt(numero[i], 10) * coeficientes[i];
    if (valor >= 10) valor -= 9;
    suma += valor;
  }
  const digitoVerificador = parseInt(numero[9], 10);
  const residuo = suma % 10;
  const calculado = residuo === 0 ? 0 : 10 - residuo;
  if (digitoVerificador !== calculado) {
    return { valido: false, mensaje: 'Dígito verificador de la cédula no coincide.' };
  }
  return { valido: true, mensaje: '' };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tipo: string; numero: string }> }
) {
  try {
    const { tipo, numero } = await params;

    if (!numero || !tipo) {
      return NextResponse.json(
        { message: 'Tipo y número de identificación son requeridos.' },
        { status: 400 }
      );
    }

    let resultado: { valido: boolean; mensaje: string };

    switch (tipo) {
      case '04':
        resultado = validarRuc(numero);
        break;
      case '05':
        resultado = validarCedula(numero);
        break;
      case '06':
        resultado = { valido: numero.length >= 6 && numero.length <= 20, mensaje: '' };
        break;
      case '07':
        resultado = { valido: numero === '9999999999999', mensaje: '' };
        break;
      default:
        return NextResponse.json(
          { message: `Tipo de identificación ${tipo} no reconocido.` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      valido: resultado.valido,
      mensaje: resultado.mensaje || (resultado.valido ? 'Identificación válida' : 'Identificación inválida'),
      tipo,
      numero,
    });
  } catch (error: any) {
    console.error('[Validar Identificacion Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
