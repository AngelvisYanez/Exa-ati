import { describe, expect, it } from "vitest";
import { calcTotal } from "@/components/emitir/factura-calculos";
import {
  calcularPrecio,
  colorCategoria,
  estadoStock,
  etiquetaStock,
  iniciales,
  prefijoCategoria,
  siguienteCodigo,
} from "../catalogo";

describe("prefijoCategoria", () => {
  it("toma tres letras sin tildes ni símbolos", () => {
    expect(prefijoCategoria("Bebidas")).toBe("BEB");
    expect(prefijoCategoria("Lácteos")).toBe("LAC");
    expect(prefijoCategoria("Útiles escolares")).toBe("UTI");
    expect(prefijoCategoria("Ñoquis")).toBe("NOQ");
  });

  it("completa con X y usa PRD si no hay letras", () => {
    expect(prefijoCategoria("Té")).toBe("TEX");
    expect(prefijoCategoria("123")).toBe("PRD");
    expect(prefijoCategoria("")).toBe("PRD");
  });
});

describe("siguienteCodigo", () => {
  it("sigue al mayor correlativo del mismo prefijo", () => {
    expect(siguienteCodigo("BEB", ["BEB-001", "BEB-007", "ABA-009", "BEB-010X"])).toBe("BEB-008");
    expect(siguienteCodigo("BEB", [])).toBe("BEB-001");
    expect(siguienteCodigo("BEB", ["beb-099"])).toBe("BEB-100");
  });
});

describe("calcularPrecio", () => {
  it("guarda la base con 6 decimales cuando el precio incluye IVA", () => {
    expect(calcularPrecio(0.5, 15, true)).toEqual({ base: 0.434783, subtotal: 0.43, iva: 0.07, pvp: 0.5 });
    expect(calcularPrecio(172.5, 15, true)).toEqual({ base: 150, subtotal: 150, iva: 22.5, pvp: 172.5 });
    expect(calcularPrecio(2.4, 0, true)).toEqual({ base: 2.4, subtotal: 2.4, iva: 0, pvp: 2.4 });
  });

  it("sin IVA, la base es el precio digitado", () => {
    expect(calcularPrecio(0.43, 15, false)).toEqual({ base: 0.43, subtotal: 0.43, iva: 0.06, pvp: 0.49 });
  });

  it("reproduce al centavo cualquier precio con IVA incluido, con el redondeo de la factura", () => {
    for (const tarifa of [15, 5]) {
      const codigo = tarifa === 15 ? "2" : "3";
      for (let centavos = 1; centavos <= 10000; centavos++) {
        const pvp = centavos / 100;
        const { base } = calcularPrecio(pvp, tarifa, true);
        const factura = calcTotal([{ codigoPrincipal: "X", descripcion: "X", cantidad: 1, precioUnitario: base, descuento: 0, iva: codigo }]);
        expect(factura.total, `${pvp} al ${tarifa}%`).toBe(pvp);
      }
    }
  });

  it("trata valores inválidos como 0", () => {
    expect(calcularPrecio(Number.NaN, 15, true).pvp).toBe(0);
    expect(calcularPrecio(-3, 15, false).base).toBe(0);
  });
});

describe("estadoStock", () => {
  it("los servicios nunca están bajos ni agotados", () => {
    expect(estadoStock({ tipo: "servicio", stock: 0, stockMinimo: 5 })).toBe("servicio");
  });

  it("clasifica agotado, bajo y disponible", () => {
    expect(estadoStock({ tipo: "producto", stock: 0, stockMinimo: 5 })).toBe("agotado");
    expect(estadoStock({ tipo: "producto", stock: -1, stockMinimo: 0 })).toBe("agotado");
    expect(estadoStock({ tipo: "producto", stock: 5, stockMinimo: 5 })).toBe("bajo");
    expect(estadoStock({ tipo: "producto", stock: 6, stockMinimo: 5 })).toBe("disponible");
    expect(estadoStock({ tipo: "producto", stock: 1, stockMinimo: 0 })).toBe("disponible");
  });
});

describe("presentación", () => {
  it("iniciales y etiquetas de stock", () => {
    expect(iniciales("Arroz 2 kg")).toBe("A2");
    expect(iniciales("Huevos x 12")).toBe("HX");
    expect(iniciales("Detergente")).toBe("DE");
    expect(etiquetaStock(48, "Unidad")).toBe("48 u.");
    expect(etiquetaStock(25, "Paquete")).toBe("25 paquete");
  });

  it("rota la paleta de 6 colores", () => {
    expect(colorCategoria(0)).toEqual(colorCategoria(6));
    expect(colorCategoria(null).punto).toBe("#A8A29E");
  });
});
