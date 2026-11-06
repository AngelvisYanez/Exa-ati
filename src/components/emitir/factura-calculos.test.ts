import { describe, expect, it } from "vitest";
import {
  ID_CONSUMIDOR_FINAL,
  NOMBRE_CONSUMIDOR_FINAL,
  TOPE_CONSUMIDOR_FINAL,
  UMBRAL_BANCARIZACION,
  buildFacturaDatos,
  calcTotal,
  desgloseFactura,
  propinaDiezPorciento,
  revisarFactura,
  type DetalleItem,
} from "@/components/emitir/factura-calculos";

const base = {
  fechaEmision: "2026-11-06",
  secuencial: "",
  tipoId: "04",
  identificacion: "0704439892001",
  razonSocial: "Comercial Machala S.A.",
  direccion: "Av. Principal",
  email: "correo@empresa.com",
  formaPago: "20",
  plazo: 0,
  propina: 0,
};

const dosLineas: DetalleItem[] = [
  { codigoPrincipal: "SRV-01", descripcion: "Asesoría contable mensual", cantidad: 1, precioUnitario: 100, descuento: 10, iva: "2" },
  { codigoPrincipal: "SRV-02", descripcion: "Trámite sin IVA", cantidad: 2, precioUnitario: 25, descuento: 0, iva: "0" },
];

/** Copia literal del armado anterior, para comparar el contrato. */
function legacyBuild(detalles: DetalleItem[], extra: Partial<typeof base> = {}) {
  const input = { ...base, ...extra, detalles };
  const COD_IVA = [
    { value: "2", tarifa: 15 },
    { value: "3", tarifa: 5 },
    { value: "0", tarifa: 0 },
    { value: "6", tarifa: 0 },
    { value: "7", tarifa: 0 },
  ];
  let sinImp = 0;
  let desc = 0;
  let total = 0;
  for (const d of detalles) {
    const bruto = d.cantidad * d.precioUnitario;
    sinImp += bruto - d.descuento;
    desc += d.descuento;
    const iva = COD_IVA.find((i) => i.value === d.iva)?.tarifa || 0;
    total += (bruto - d.descuento) * (1 + iva / 100);
  }
  const totales = {
    sinImp: Number(sinImp.toFixed(2)),
    desc: Number(desc.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
  const impuestoMap = new Map<string, { codigo: string; codigoPorcentaje: string; baseImponible: number; tarifa: number; valor: number }>();
  for (const d of detalles) {
    const baseI = d.cantidad * d.precioUnitario - d.descuento;
    const iva = COD_IVA.find((i) => i.value === d.iva);
    if (!impuestoMap.has(d.iva)) {
      impuestoMap.set(d.iva, { codigo: "2", codigoPorcentaje: d.iva, baseImponible: 0, tarifa: iva?.tarifa || 0, valor: 0 });
    }
    const entry = impuestoMap.get(d.iva)!;
    entry.baseImponible += baseI;
    entry.valor += (baseI * (iva?.tarifa || 0)) / 100;
  }
  const totalConImpuestos = Array.from(impuestoMap.values()).map((entry) => ({
    ...entry,
    baseImponible: Number(entry.baseImponible.toFixed(2)),
    valor: Number(entry.valor.toFixed(2)),
  }));
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
    pagos: [{ formaPago: input.formaPago, total: totales.total, ...(input.plazo > 0 ? { plazo: input.plazo, unidadTiempo: "dias" } : {}) }],
    detalles: detalles.map((d) => ({
      codigoPrincipal: d.codigoPrincipal,
      descripcion: d.descripcion,
      cantidad: d.cantidad,
      precioUnitario: d.precioUnitario,
      descuento: d.descuento,
      precioTotalSinImpuesto: d.cantidad * d.precioUnitario - d.descuento,
      impuestos: [{
        codigo: "2",
        codigoPorcentaje: d.iva,
        tarifa: COD_IVA.find((i) => i.value === d.iva)?.tarifa || 0,
        baseImponible: d.cantidad * d.precioUnitario - d.descuento,
        valor: ((d.cantidad * d.precioUnitario - d.descuento) * (COD_IVA.find((i) => i.value === d.iva)?.tarifa || 0)) / 100,
      }],
    })),
  };
}

describe("payload de factura", () => {
  it("coincide al centavo con el armado anterior: IVA 15% y 0%, con descuento", () => {
    const actual = buildFacturaDatos({ ...base, detalles: dosLineas });
    const anterior = legacyBuild(dosLineas);
    expect(JSON.parse(JSON.stringify(actual))).toEqual(JSON.parse(JSON.stringify(anterior)));
    expect(actual.importeTotal).toBe(153.5);
    expect(actual.totalSinImpuestos).toBe(140);
    expect(actual.totalDescuento).toBe(10);
    expect(actual.totalConImpuestos).toEqual([
      { codigo: "2", codigoPorcentaje: "2", baseImponible: 90, tarifa: 15, valor: 13.5 },
      { codigo: "2", codigoPorcentaje: "0", baseImponible: 50, tarifa: 0, valor: 0 },
    ]);
    expect(actual.pagos).toEqual([{ formaPago: "20", total: 153.5 }]);
    expect(actual.secuencial).toBeUndefined();
    expect(actual.propina).toBeUndefined();
  });

  it("la propina viaja aparte y no altera el importe ni el pago", () => {
    const propina = propinaDiezPorciento(calcTotal(dosLineas).sinImp);
    expect(propina).toBe(14);
    const actual = buildFacturaDatos({ ...base, detalles: dosLineas, propina });
    const anterior = legacyBuild(dosLineas, { propina });
    expect(JSON.parse(JSON.stringify(actual))).toEqual(JSON.parse(JSON.stringify(anterior)));
    expect(actual.importeTotal).toBe(153.5);
    expect(actual.propina).toBe(14);
    expect(actual.pagos[0].total).toBe(153.5);
    const vista = desgloseFactura(dosLineas, propina);
    expect(vista.total).toBe(actual.importeTotal);
    expect(vista.iva15).toBe(13.5);
    expect(vista.subtotal0).toBe(50);
    expect(vista.propina).toBe(14);
  });

  it("el plazo a crédito se agrega al pago con los mismos campos", () => {
    const actual = buildFacturaDatos({ ...base, detalles: dosLineas, plazo: 30 });
    const anterior = legacyBuild(dosLineas, { plazo: 30 });
    expect(JSON.parse(JSON.stringify(actual))).toEqual(JSON.parse(JSON.stringify(anterior)));
    expect(actual.pagos[0]).toEqual({ formaPago: "20", total: 153.5, plazo: 30, unidadTiempo: "dias" });
  });
});

describe("reglas de la pantalla", () => {
  const listo = {
    emisorRuc: "0704439892001",
    fechaEmision: "2026-11-06",
    ambiente: "1",
    tipoId: "04",
    identificacion: "0704439892001",
    razonSocial: "Comercial Machala S.A.",
    formaPago: "01",
  };

  it("bloquea consumidor final por encima del tope y deja pasar el tope exacto", () => {
    const dentro: DetalleItem[] = [
      { codigoPrincipal: "A", descripcion: "Servicio", cantidad: 1, precioUnitario: TOPE_CONSUMIDOR_FINAL, descuento: 0, iva: "0" },
    ];
    const fuera: DetalleItem[] = [
      { codigoPrincipal: "A", descripcion: "Servicio", cantidad: 1, precioUnitario: TOPE_CONSUMIDOR_FINAL + 0.01, descuento: 0, iva: "0" },
    ];
    const ok = revisarFactura({
      ...listo,
      tipoId: "07",
      identificacion: ID_CONSUMIDOR_FINAL,
      razonSocial: NOMBRE_CONSUMIDOR_FINAL,
      detalles: dentro,
    });
    const bloqueado = revisarFactura({
      ...listo,
      tipoId: "07",
      identificacion: ID_CONSUMIDOR_FINAL,
      razonSocial: NOMBRE_CONSUMIDOR_FINAL,
      detalles: fuera,
    });
    expect(ok.puedeEmitir).toBe(true);
    expect(ok.consumidorFinalExcedido).toBe(false);
    expect(bloqueado.puedeEmitir).toBe(false);
    expect(bloqueado.consumidorFinalExcedido).toBe(true);
    expect(calcTotal(fuera).total).toBe(50.01);
  });

  it("advierte bancarización desde el umbral en efectivo y no bloquea", () => {
    const lineas: DetalleItem[] = [
      { codigoPrincipal: "A", descripcion: "Servicio", cantidad: 1, precioUnitario: UMBRAL_BANCARIZACION, descuento: 0, iva: "0" },
    ];
    const revision = revisarFactura({ ...listo, formaPago: "01", detalles: lineas });
    expect(revision.advertenciaBancarizacion).toBe(true);
    expect(revision.puedeEmitir).toBe(true);
    const transferencia = revisarFactura({ ...listo, formaPago: "20", detalles: lineas });
    expect(transferencia.advertenciaBancarizacion).toBe(false);
  });

  it("agregar y quitar líneas cambia el desglose y exige producto de inventario", () => {
    const una = dosLineas.slice(0, 1);
    expect(desgloseFactura(una, 0).total).toBe(103.5);
    expect(desgloseFactura(dosLineas, 0).total).toBe(153.5);
    const sinCodigo = revisarFactura({
      ...listo,
      formaPago: "20",
      detalles: [{ ...dosLineas[0], codigoPrincipal: "" }],
    });
    expect(sinCodigo.productos).toBe(false);
    expect(sinCodigo.puedeEmitir).toBe(false);
  });
});
