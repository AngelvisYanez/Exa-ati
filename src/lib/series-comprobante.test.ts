import { describe, expect, it } from "vitest";
import {
  esTipoComprobanteSerie,
  normalizarCodigoSerie,
  normalizarUltimo,
  numeroSerie,
  separarSerie,
  siguienteDe,
} from "@/lib/series-comprobante";

describe("serie de comprobantes", () => {
  it("normaliza establecimiento y punto de emisión a 3 dígitos", () => {
    expect(normalizarCodigoSerie("1")).toBe("001");
    expect(normalizarCodigoSerie("12")).toBe("012");
    expect(normalizarCodigoSerie("001")).toBe("001");
    expect(normalizarCodigoSerie("000")).toBeNull();
    expect(normalizarCodigoSerie("1234")).toBeNull();
    expect(normalizarCodigoSerie("")).toBeNull();
  });

  it("acepta el último número emitido entre 0 y 9 dígitos", () => {
    expect(normalizarUltimo(0)).toBe(0);
    expect(normalizarUltimo("124")).toBe(124);
    expect(normalizarUltimo(999_999_999)).toBe(999_999_999);
    expect(normalizarUltimo(-1)).toBeNull();
    expect(normalizarUltimo(1.5)).toBeNull();
    expect(normalizarUltimo("12a")).toBeNull();
  });

  it("el siguiente comprobante es el último más uno, con 9 dígitos", () => {
    expect(siguienteDe(0)).toBe("000000001");
    expect(siguienteDe(124)).toBe("000000125");
    expect(numeroSerie("001", "002", "000000125")).toBe("001-002-000000125");
  });

  it("separa la serie en establecimiento y punto de emisión", () => {
    expect(separarSerie("002-001")).toEqual({ establecimiento: "002", puntoEmision: "001" });
    expect(separarSerie("2-1")).toEqual({ establecimiento: "002", puntoEmision: "001" });
    expect(separarSerie("000-001")).toBeNull();
    expect(separarSerie("001")).toBeNull();
  });

  it("conoce los tipos que se emiten desde esta pantalla", () => {
    expect(esTipoComprobanteSerie("01")).toBe(true);
    expect(esTipoComprobanteSerie("07")).toBe(true);
    expect(esTipoComprobanteSerie("99")).toBe(false);
  });
});
