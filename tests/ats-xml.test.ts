import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parser } from './helpers/xml-parse'

vi.mock('../src/services/sri-api/db', () => ({
  db: {
    queryAll: vi.fn(),
    queryOne: vi.fn(),
    query: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from '../src/services/sri-api/db'
import {
  buildAtsXml,
  exportAtsXml,
  getAtsData,
  toAtsTpId,
  type AtsData,
} from '../src/services/sri-api/ats'

const mockQueryAll = vi.mocked(db.queryAll)
const mockQueryOne = vi.mocked(db.queryOne)
const mockQuery = vi.mocked(db.query)

function validAtsData(overrides?: Partial<AtsData>): AtsData {
  return {
    periodo: 202406,
    razonSocial: 'EMPRESA TEST & HIJOS S.A.',
    ruc: '0999999999999',
    establecimientos: [{ codigo: '001', direccion: 'Av. Test' }],
    ventas: [
      {
        tpIdCliente: '01',
        idCliente: '1799999999001',
        razonSocial: 'CLIENTE TEST',
        tipoComprobante: 'FACTURA',
        tipoComprobanteCodigo: '01',
        numeroComprobantes: 2,
        baseImponible: 1000,
        baseNoGraIva: 0,
        baseImpExe: 0,
        montoIva: 150,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      },
      {
        tpIdCliente: '02',
        idCliente: '1710034065',
        razonSocial: 'CLIENTE CEDULA',
        tipoComprobante: 'NOTA_CREDITO',
        tipoComprobanteCodigo: '04',
        numeroComprobantes: 1,
        baseImponible: -100,
        baseNoGraIva: 0,
        montoIva: -15,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      },
    ],
    compras: [
      {
        tpIdProveedor: '01',
        idProveedor: '1798888888001',
        razonSocial: 'PROVEEDOR TEST',
        tipoComprobante: 'FACTURA',
        tipoComprobanteCodigo: '01',
        numeroComprobantes: 1,
        baseImponible: 500,
        baseNoGraIva: 0,
        montoIva: 75,
        valorRetenidoIva: 10,
        valorRetenidoRenta: 0,
      },
      {
        tpIdProveedor: '01',
        idProveedor: '0990000000999',
        razonSocial: 'PROVEEDOR SIN IVA',
        tipoComprobante: 'FACTURA',
        tipoComprobanteCodigo: '01',
        numeroComprobantes: 1,
        baseImponible: 200,
        baseNoGraIva: 200,
        montoIva: 0,
        valorRetenidoIva: 0,
        valorRetenidoRenta: 0,
      },
    ],
    retenciones: [
      {
        tipoComprobante: 'COMPROBANTE_RETENCION',
        tipoComprobanteCodigo: '07',
        numeroComprobantes: 1,
        baseImponible: 500,
        valorRetenidoIva: 10,
        valorRetenidoRenta: 0,
      },
    ],
    anulados: [],
    totalVentas: 1100,
    totalCompras: 700,
    totalRetenciones: 10,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

function asArray(v: any): any[] {
  return Array.isArray(v) ? v : [v]
}

describe('buildAtsXml (estructura oficial ATS del SRI)', () => {
  it('genera XML parseable con raÃ­z ivaRecaudado', async () => {
    const xml = buildAtsXml(validAtsData())
    const parsed = await parser(xml)
    expect(parsed.ivaRecaudado).toBeDefined()
  })

  it('incluye cabecera con Ruc, RazonSocial escapada, Mes con cero a la izquierda y Anio', async () => {
    const xml = buildAtsXml(validAtsData())
    expect(xml).toContain('<RazonSocial>EMPRESA TEST &amp; HIJOS S.A.</RazonSocial>')
    const { ivaRecaudado } = await parser(xml)
    expect(ivaRecaudado.cabecera.Ruc).toBe('0999999999999')
    expect(ivaRecaudado.cabecera.RazonSocial).toBe('EMPRESA TEST & HIJOS S.A.')
    expect(ivaRecaudado.cabecera.Mes).toBe('06')
    expect(ivaRecaudado.cabecera.Anio).toBe('2024')
  })

  it('CabeceraTotales suma ventas y retenciones correctamente', async () => {
    const xml = buildAtsXml(validAtsData())
    const { ivaRecaudado } = await parser(xml)
    const tot = ivaRecaudado.cabecera.CabeceraTotales
    expect(tot.Establecimiento).toBe('001')
    // 1000 - 100 (NC) = 900
    expect(tot.TotBaseImponible).toBe('900.00')
    expect(tot.TotBaseNoGraIva).toBe('0.00')
    // 150 - 15 = 135
    expect(tot.TotMontoIva).toBe('135.00')
    expect(tot.TotValorRetenidoIva).toBe('10.00')
    expect(tot.TotValorRetenidoRenta).toBe('0.00')
  })

  it('detalleVentas usa cÃ³digos de comprobante numÃ©ricos y montos con 2 decimales', async () => {
    const xml = buildAtsXml(validAtsData())
    const { ivaRecaudado } = await parser(xml)
    const detalles = asArray(ivaRecaudado.ventas.detalleVentas)
    expect(detalles).toHaveLength(2)

    expect(detalles[0].tpIdCliente).toBe('01')
    expect(detalles[0].idCliente).toBe('1799999999001')
    expect(detalles[0].tipoComprobante).toBe('01')
    expect(detalles[0].baseImponible).toBe('1000.00')
    expect(detalles[0].montoIva).toBe('150.00')

    // Nota de crÃ©dito: cÃ³digo 04 y valores negativos
    expect(detalles[1].tipoComprobante).toBe('04')
    expect(detalles[1].baseImponible).toBe('-100.00')
    expect(detalles[1].montoIva).toBe('-15.00')
  })

  it('detalleCompras incluye codSustento, tpIdProv y porcentajeIva calculado', async () => {
    const xml = buildAtsXml(validAtsData())
    const { ivaRecaudado } = await parser(xml)
    const detalles = asArray(ivaRecaudado.compras.detalleCompras)
    expect(detalles).toHaveLength(2)

    expect(detalles[0].codSustento).toBe('01')
    expect(detalles[0].tpIdProv).toBe('01')
    expect(detalles[0].idProv).toBe('1798888888001')
    expect(detalles[0].tipoComprobante).toBe('01')
    expect(detalles[0].porcentajeIva).toBe('15.00')
    expect(detalles[0].valorRetenidoRenta).toBe('0.00')

    // Compra sin IVA: sustento 05 y porcentaje 0
    expect(detalles[1].codSustento).toBe('05')
    expect(detalles[1].porcentajeIva).toBe('0.00')
    expect(detalles[1].baseNoGraIva).toBe('200.00')
  })

  it('no genera secciones CDATA ni etiquetas sin cerrar', () => {
    const xml = buildAtsXml(validAtsData())
    expect(xml).not.toContain('<![CDATA[')
    expect(xml).not.toContain('</ivaRecaudado>\n</ivaRecaudado>')
  })

  it('incluye anulados cuando existen', async () => {
    const data = validAtsData({
      anulados: [
        {
          tipoComprobante: 'FACTURA',
          establecimiento: '001',
          puntoEmision: '001',
          secuencialInicial: '000000100',
          secuencialFinal: '000000105',
          numeroAnulados: 6,
        },
      ],
    })
    const xml = buildAtsXml(data)
    const { ivaRecaudado } = await parser(xml)
    expect(ivaRecaudado.anulados.anulado.secuencialInicial).toBe('000000100')
    expect(ivaRecaudado.anulados.anulado.numeroAnulados).toBe('6')
  })
})

describe('toAtsTpId (catÃ¡logo ATS de identificaciÃ³n)', () => {
  it('mapea cÃ³digos de comprobante electrÃ³nico a cÃ³digos ATS', () => {
    expect(toAtsTpId('04', null)).toBe('01') // RUC
    expect(toAtsTpId('05', null)).toBe('02') // cÃ©dula
    expect(toAtsTpId('06', null)).toBe('03') // pasaporte
    expect(toAtsTpId('07', null)).toBe('04') // consumidor final
  })

  it('infiere por longitud cuando no hay tipo registrado', () => {
    expect(toAtsTpId(null, '0990000000001')).toBe('01')
    expect(toAtsTpId(undefined, '1710034065')).toBe('02')
    expect(toAtsTpId(null, 'X')).toBe('04')
  })
})

describe('getAtsData (agregaciÃ³n desde comprobantes)', () => {
  const emisor = {
    ruc: '0990000000001',
    razon_social: 'Test S.A.',
    establecimiento: '001',
    direccion_matriz: 'Guayaquil',
    activo: true,
  }

  it('agrupa facturas emitidas/recibidas, netea notas de crÃ©dito y mapea identificaciÃ³n ATS', async () => {
    mockQueryOne.mockResolvedValueOnce(emisor)
    mockQueryAll.mockResolvedValueOnce([
      {
        tipo: '01',
        estado: 'AUTORIZADO',
        emisor_ruc: '0990000000001',
        receptor_tipo_id: '05',
        receptor_identificacion: '1710034065',
        receptor_razon_social: 'Juan Perez',
        subtotal_sin_impuesto: 100,
        total_descuento: 0,
        total_iva: 15,
      },
      {
        tipo: '01',
        estado: 'AUTORIZADO',
        emisor_ruc: '0990000000001',
        receptor_tipo_id: '05',
        receptor_identificacion: '1710034065',
        receptor_razon_social: 'Juan Perez',
        subtotal_sin_impuesto: 50,
        total_descuento: 0,
        total_iva: 7.5,
      },
      {
        tipo: '04',
        estado: 'AUTORIZADO',
        emisor_ruc: '0990000000001',
        receptor_tipo_id: '05',
        receptor_identificacion: '1710034065',
        receptor_razon_social: 'Juan Perez',
        subtotal_sin_impuesto: 20,
        total_descuento: 0,
        total_iva: 3,
      },
      {
        tipo: '01',
        estado: 'AUTORIZADO',
        emisor_ruc: '1790012345001',
        receptor_razon_social: 'Proveedor S.A.',
        subtotal_sin_impuesto: 200,
        total_descuento: 0,
        total_iva: 30,
      },
      {
        tipo: '07',
        estado: 'AUTORIZADO',
        emisor_ruc: '1790012345001',
        subtotal_sin_impuesto: 100,
        total_iva: 15,
      },
      {
        // No autorizado: debe excluirse
        tipo: '01',
        estado: 'PENDIENTE',
        emisor_ruc: '0990000000001',
        receptor_identificacion: '9999999999999',
        subtotal_sin_impuesto: 999,
        total_iva: 0,
      },
    ])

    const data = await getAtsData('tenant-1', 202601)

    // Facturas agrupadas + nota de crÃ©dito como fila separada (cÃ³digo 04, valores negativos)
    expect(data.ventas).toHaveLength(2)
    const facturas = data.ventas.find((v) => v.tipoComprobanteCodigo === '01')!
    const ncs = data.ventas.find((v) => v.tipoComprobanteCodigo === '04')!
    expect(facturas.numeroComprobantes).toBe(2)
    expect(facturas.baseImponible).toBeCloseTo(150, 2)
    expect(facturas.montoIva).toBeCloseTo(22.5, 2)
    expect(facturas.tpIdCliente).toBe('02') // cÃ©dula segÃºn catÃ¡logo ATS
    expect(ncs.numeroComprobantes).toBe(1)
    expect(ncs.baseImponible).toBeCloseTo(-20, 2)
    expect(ncs.montoIva).toBeCloseTo(-3, 2)

    expect(data.compras).toHaveLength(1)
    expect(data.compras[0].tpIdProveedor).toBe('01') // RUC
    expect(data.compras[0].baseImponible).toBe(200)

    expect(data.retenciones).toHaveLength(1)
    expect(data.retenciones[0].tipoComprobanteCodigo).toBe('07')
    expect(data.retenciones[0].valorRetenidoIva).toBe(15)

    expect(data.totalVentas).toBeCloseTo(130, 2)
    expect(data.totalCompras).toBe(200)
    expect(data.totalRetenciones).toBe(15)
  })
})

describe('exportAtsXml', () => {
  it('valida, persiste y retorna XML parseable conforme al SRI', async () => {
    const emisor = {
      ruc: '0990000000001',
      razon_social: 'Test S.A.',
      establecimiento: '001',
      direccion_matriz: 'Quito',
      activo: true,
    }
    mockQueryOne.mockResolvedValueOnce(emisor)
    mockQueryAll.mockResolvedValueOnce([
      {
        tipo: '01',
        estado: 'AUTORIZADO',
        emisor_ruc: '0990000000001',
        receptor_tipo_id: '04',
        receptor_identificacion: '1799999999001',
        receptor_razon_social: 'Cliente RUC',
        subtotal_sin_impuesto: 1000,
        total_descuento: 0,
        total_iva: 150,
      },
    ])
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 })

    const xml = await exportAtsXml('tenant-1', 202601)

    expect(mockQuery).toHaveBeenCalledTimes(1)
    const parsed = await parser(xml)
    expect(parsed.ivaRecaudado.cabecera.Ruc).toBe('0990000000001')
    expect(parsed.ivaRecaudado.ventas.detalleVentas.tipoComprobante).toBe('01')
  })

  it('lanza error con datos invÃ¡lidos en lugar de generar XML corrupto', async () => {
    mockQueryOne.mockResolvedValueOnce({ ruc: '123', activo: true })
    mockQueryAll.mockResolvedValueOnce([])
    await expect(exportAtsXml('tenant-1', 202601)).rejects.toThrow('Datos ATS incompletos')
  })
})
