import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/sri-api/db", () => ({ db: {} }));
vi.mock("@/services/sri-api/xml-builder", () => ({ xmlBuilder: {} }));
vi.mock("@/services/sri-api/xml-signer", () => ({ xmlSigner: {} }));
vi.mock("@/services/sri-api/xml-storage", () => ({ xmlStorage: {} }));
vi.mock("@/services/sri-api/sri-soap-client", () => ({ sriSoapClient: {} }));
vi.mock("@/services/sri-api/clave-acceso", () => ({ claveAccesoService: {} }));
vi.mock("@/services/sri-api/comprobante-importer", () => ({ saveAutorizadoXml: vi.fn() }));

import { calcularPosTotals } from "@/services/sri-api/pos";
import {
  agregarProducto,
  calcularTotalesTicket,
  camposFaltantes,
  construirPayloadPos,
  montosRapidos,
  numeroFacturaDesdeClave,
  tipoIdentificacionDe,
  validarIdentificacion,
  type LineaTicket,
  type ProductoPos,
} from "../pos-calc";

/** Copia literal del cuerpo que armaba `handleEmitir` antes del rediseño. */
function payloadAnterior(s: {
  emisorId: string;
  items: LineaTicket[];
  formaPago: string;
  propina: number;
  observaciones: string;
  tipoId: string;
  identificacion: string;
  razonSocial: string;
  clienteEmail: string;
  clienteDireccion: string;
}) {
  const { emisorId, items, formaPago, propina, observaciones, tipoId, identificacion, razonSocial, clienteEmail, clienteDireccion } = s;
  return JSON.stringify({
    emisorId,
    items: items.map(i => ({
      codigo: i.codigo,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      ivaPorcentaje: i.ivaPorcentaje,
      descuento: i.descuento,
    })),
    formaPago,
    propina: propina > 0 ? propina : undefined,
    observaciones: observaciones || undefined,
    cliente: tipoId === '07' && identificacion === '9999999999999'
      ? undefined
      : { tipoIdentificacion: tipoId, identificacion, razonSocial, email: clienteEmail || undefined, direccion: clienteDireccion || undefined },
  });
}

const linea = (o: Partial<LineaTicket>): LineaTicket => ({
  id: o.codigo ?? "x",
  codigo: "P1",
  descripcion: "Producto",
  cantidad: 1,
  precioUnitario: 1,
  ivaPorcentaje: 15,
  descuento: 0,
  ...o,
});

const LINEAS: LineaTicket[] = [
  linea({ codigo: "7861", descripcion: "Gaseosa cola 1.35 L", cantidad: 1, precioUnitario: 1.5 }),
  linea({ codigo: "7862", descripcion: "Arroz 2 kg", cantidad: 2, precioUnitario: 2.4, ivaPorcentaje: 0 }),
  linea({ codigo: "7863", descripcion: "Papas fritas 45 g", cantidad: 3, precioUnitario: 0.6, descuento: 0.1 }),
];

describe("payload POS idéntico al anterior", () => {
  it("consumidor final, efectivo, sin propina ni observaciones", () => {
    const antes = payloadAnterior({
      emisorId: "em-1", items: LINEAS, formaPago: "01", propina: 0, observaciones: "",
      tipoId: "07", identificacion: "9999999999999", razonSocial: "CONSUMIDOR FINAL", clienteEmail: "", clienteDireccion: "",
    });
    const despues = JSON.stringify(construirPayloadPos({
      emisorId: "em-1", lineas: LINEAS, formaPago: "01", propina: 0, observaciones: "", cliente: null,
    }));
    expect(despues).toBe(antes);
  });

  it("cliente con cédula, tarjeta, propina y observaciones", () => {
    const antes = payloadAnterior({
      emisorId: "em-1", items: LINEAS, formaPago: "19", propina: 0.5, observaciones: "Mesa 4",
      tipoId: "05", identificacion: "0704439892", razonSocial: "FRANCISCO TORRES",
      clienteEmail: "f@x.com", clienteDireccion: "Machala",
    });
    const despues = JSON.stringify(construirPayloadPos({
      emisorId: "em-1", lineas: LINEAS, formaPago: "19", propina: 0.5, observaciones: "Mesa 4",
      cliente: { identificacion: "0704439892", razonSocial: "FRANCISCO TORRES", email: "f@x.com", direccion: "Machala", telefono: "0999" },
    }));
    expect(despues).toBe(antes);
  });

  it("cliente con RUC y transferencia", () => {
    const antes = payloadAnterior({
      emisorId: "em-2", items: LINEAS.slice(0, 1), formaPago: "20", propina: 0, observaciones: "",
      tipoId: "04", identificacion: "0704439892001", razonSocial: "EMPRESA SA",
      clienteEmail: "e@x.com", clienteDireccion: "Quito",
    });
    const despues = JSON.stringify(construirPayloadPos({
      emisorId: "em-2", lineas: LINEAS.slice(0, 1), formaPago: "20", propina: 0, observaciones: "",
      cliente: { identificacion: "0704439892001", razonSocial: "EMPRESA SA", email: "e@x.com", direccion: "Quito", telefono: "" },
    }));
    expect(despues).toBe(antes);
  });
});

describe("totales del ticket = calcularPosTotals del backend (XML)", () => {
  const casos: [string, LineaTicket[], number][] = [
    ["mixto 15% / 0% con descuento", LINEAS, 0],
    ["con propina", LINEAS, 0.75],
    ["redondeo por tarifa 15% + 5%", [
      linea({ precioUnitario: 0.33, cantidad: 7 }),
      linea({ precioUnitario: 1.17, cantidad: 3, ivaPorcentaje: 5 }),
      linea({ precioUnitario: 0.07, cantidad: 13 }),
    ], 0],
    ["cantidades decimales", [linea({ precioUnitario: 2.85, cantidad: 1.5 }), linea({ precioUnitario: 3.4, cantidad: 0.333 })], 0],
  ];

  it.each(casos)("%s", (_n, items, propina) => {
    const xml = calcularPosTotals(items, 0, propina);
    const ui = calcularTotalesTicket(items, propina);
    expect(ui.total).toBe(xml.total);
    expect(ui.totalIVA).toBe(xml.totalIVA);
    expect(ui.subtotalSinImpuesto).toBe(xml.subtotalSinImpuesto);
    expect(ui.totalDescuento).toBe(xml.totalDescuento);
    expect(ui.ivaDesglosado).toEqual(xml.ivaDesglosado);
  });

  it("ejemplo del diseño: $8.59", () => {
    const t = calcularTotalesTicket(LINEAS.map(l => ({ ...l, descuento: 0 })));
    expect(t.total).toBe(8.59);
  });
});

describe("ticket y cliente", () => {
  const p: ProductoPos = { id: "a", codigo: "7861", nombre: "Gaseosa", precioUnitario: 1.5, ivaPorcentaje: 15, stock: 3, categoriaId: null, categoriaNombre: null, categoriaColor: null };

  it("el mismo código dos veces suma cantidad 2", () => {
    const l = agregarProducto(agregarProducto([], p), p);
    expect(l).toHaveLength(1);
    expect(l[0].cantidad).toBe(2);
  });

  it("deduce el tipo de identificación", () => {
    expect(tipoIdentificacionDe("0704439892")).toBe("05");
    expect(tipoIdentificacionDe("0704439892001")).toBe("04");
    expect(tipoIdentificacionDe("0704439892002")).toBeNull();
    expect(validarIdentificacion("0704439892002")).toMatch(/001/);
  });

  it("lista los campos faltantes", () => {
    expect(camposFaltantes({ identificacion: "0704439892", razonSocial: "X", email: "", direccion: "", telefono: "" }))
      .toEqual(["email", "direccion"]);
  });

  it("montos rápidos: Exacto + billetes mayores, máx. 4", () => {
    expect(montosRapidos(8.59).map(m => m.label)).toEqual(["Exacto", "$10", "$20", "$50"]);
    expect(montosRapidos(60).map(m => m.label)).toEqual(["Exacto", "$100"]);
  });

  it("número de factura desde la clave de acceso", () => {
    const clave = "0611202601070443989200120010020000001231234567811";
    expect(numeroFacturaDesdeClave(clave)).toBe("001-002-000000123");
  });
});
