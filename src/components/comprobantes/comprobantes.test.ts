import { describe, expect, it } from "vitest";
import {
  documentoSustentoCompleto,
  filtrarCandidatos,
  formatearNumeroDocumento,
  type ComprobanteListado,
} from "./documento-sustento";
import { TIPOS_SIN_CONSUMIDOR_FINAL, validarIdentificacion } from "./identificacion";
import { numeroComprobante, numeroDocumento } from "./numeracion";
import { useChecklist, useStepper } from "./useChecklist";

describe("useStepper", () => {
  it("el paso actual es el primero sin completar y los anteriores quedan completos", () => {
    const { actual, steps } = useStepper([
      { label: "Comprobante", done: true },
      { label: "Cliente", done: false },
      { label: "Productos", done: true },
    ]);
    expect(actual).toBe(2);
    expect(steps.map((paso) => paso.estado)).toEqual(["completo", "actual", "pendiente"]);
  });

  it("con todo completo el actual es el último", () => {
    const { actual, ready, steps } = useStepper([
      { label: "A", done: true },
      { label: "B", done: true },
    ]);
    expect(actual).toBe(2);
    expect(ready).toBe(true);
    expect(steps[1].estado).toBe("actual");
  });
});

describe("useChecklist", () => {
  it("cuenta completados, progreso y listo", () => {
    const parcial = useChecklist([
      { label: "a", ok: true },
      { label: "b", ok: false },
      { label: "c", ok: true },
      { label: "d", ok: false },
      { label: "e", ok: true },
    ]);
    expect(parcial.completados).toBe(3);
    expect(parcial.total).toBe(5);
    expect(parcial.progreso).toBe((3 / 5) * 100);
    expect(parcial.ready).toBe(false);
    expect(useChecklist([{ label: "a", ok: true }]).ready).toBe(true);
    expect(useChecklist([]).ready).toBe(false);
  });
});

describe("identificación", () => {
  it("valida RUC, cédula y pasaporte", () => {
    expect(validarIdentificacion("04", "0705874378001").valido).toBe(true);
    expect(validarIdentificacion("04", "0705874378000").valido).toBe(false);
    expect(validarIdentificacion("05", "0705874378").contador).toBe("10/10");
    expect(validarIdentificacion("06", " ").valido).toBe(false);
  });

  it("advierte sin bloquear cuando el dígito verificador no cuadra", () => {
    const dudoso = validarIdentificacion("04", "1234567890001");
    expect(dudoso.valido).toBe(true);
    expect(dudoso.advertencia).toMatch(/verificador/i);
    expect(validarIdentificacion("04", "0705874378001").advertencia).toBeUndefined();
    expect(validarIdentificacion("04", "0704439892001").advertencia).toBeUndefined();
    expect(validarIdentificacion("05", "0705874379").advertencia).toMatch(/verificador/i);
    expect(validarIdentificacion("04", "07058743780").advertencia).toBeUndefined();
  });

  it("liquidación y retención no ofrecen consumidor final", () => {
    expect(TIPOS_SIN_CONSUMIDOR_FINAL.map((tipo) => tipo.value)).toEqual(["04", "05", "06", "08"]);
  });
});

describe("numeración", () => {
  it("arma el número visible del comprobante", () => {
    expect(numeroComprobante("", { estab: "001", pto: "002" }, "000000123")).toBe("001-002-000000123");
    expect(numeroComprobante("45", { estab: "001", pto: "002" })).toBe("001-002-000000045");
    expect(numeroComprobante("", null)).toBe("Secuencial automático");
  });

  it("normaliza serie con o sin guion", () => {
    expect(numeroDocumento("001-001", "123")).toBe("001-001-000000123");
    expect(numeroDocumento("002003", "000000004")).toBe("002-003-000000004");
  });
});

describe("documento sustento", () => {
  const ruc = "0704439892001";
  const filas: ComprobanteListado[] = [
    {
      claveAcceso: "A".repeat(49), tipoComprobante: "01", serie: "001-001", secuencial: "000000123",
      fechaEmision: "2026-10-01T00:00:00.000Z", importeTotal: 115, receptorIdentificacion: "0705874378001",
      receptorRazonSocial: "TAMIA RAMIREZ", numeroAutorizacion: "1".repeat(49), emisor: { ruc },
    },
    {
      claveAcceso: "B".repeat(49), tipoComprobante: "01", serie: "002-001", secuencial: "000000900",
      fechaEmision: "2026-10-05", importeTotal: 50, receptorIdentificacion: ruc,
      numeroAutorizacion: null, emisor: { ruc: "0990000000001", razonSocial: "PROVEEDOR S.A." },
    },
    {
      claveAcceso: "C".repeat(49), tipoComprobante: "04", serie: "001-001", secuencial: "000000124",
      fechaEmision: "2026-10-06", importeTotal: 10, emisor: { ruc },
    },
  ];

  it("separa emitidos de recibidos y filtra por tipo", () => {
    const emitidos = filtrarCandidatos(filas, { ruc, origen: "emitidos", codDoc: "01", consulta: "" });
    expect(emitidos).toEqual([{
      clave: "A".repeat(49), numero: "001-001-000000123", fecha: "2026-10-01",
      autorizacion: "1".repeat(49), contraparte: "TAMIA RAMIREZ", total: 115,
    }]);
    const recibidos = filtrarCandidatos(filas, { ruc, origen: "recibidos", codDoc: "01", consulta: "" });
    expect(recibidos.map((item) => [item.numero, item.contraparte, item.autorizacion])).toEqual([
      ["002-001-000000900", "PROVEEDOR S.A.", "B".repeat(49)],
    ]);
  });

  it("busca por número con o sin guiones", () => {
    expect(filtrarCandidatos(filas, { ruc, origen: "emitidos", codDoc: "01", consulta: "001-001-000000123" })).toHaveLength(1);
    expect(filtrarCandidatos(filas, { ruc, origen: "emitidos", codDoc: "01", consulta: "123" })).toHaveLength(1);
    expect(filtrarCandidatos(filas, { ruc, origen: "emitidos", codDoc: "01", consulta: "999" })).toHaveLength(0);
  });

  it("formatea mientras se escribe y exige los cuatro datos", () => {
    expect(formatearNumeroDocumento("001001000000123")).toBe("001-001-000000123");
    expect(formatearNumeroDocumento("0010")).toBe("001-0");
    expect(documentoSustentoCompleto({ codDoc: "01", numero: "001-001-000000123", fecha: "2026-10-01", autorizacion: "1".repeat(49) })).toBe(true);
    expect(documentoSustentoCompleto({ codDoc: "01", numero: "001-001-123", fecha: "2026-10-01", autorizacion: "1".repeat(49) })).toBe(false);
    expect(documentoSustentoCompleto({ codDoc: "01", numero: "001-001-000000123", fecha: "", autorizacion: "1".repeat(49) })).toBe(false);
  });
});
