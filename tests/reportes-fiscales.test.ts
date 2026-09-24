import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  getAll,
  getById,
  generate103,
  generate104,
  updateEstado,
} from '../src/services/sri-api/reportes-fiscales'

const mockQueryAll = vi.mocked(db.queryAll)
const mockQueryOne = vi.mocked(db.queryOne)
const mockQuery = vi.mocked(db.query)
const mockUpdate = vi.mocked(db.update)

const emisor = { id: 'e1', ruc: '1790000001001', razon_social: 'Test', activo: true, tenant_id: 't1' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reportes-fiscales', () => {
  describe('getAll', () => {
    it('calls correct SQL with tenant_id only', async () => {
      mockQueryAll.mockResolvedValue([])
      await getAll('t1')
      const [sql, params] = mockQueryAll.mock.calls[0]
      expect(sql).toContain('tenant_id = $1')
      expect(sql).not.toContain('tipo')
      expect(params).toEqual(['t1'])
    })

    it('adds tipo filter when tipo option provided', async () => {
      mockQueryAll.mockResolvedValue([])
      await getAll('t1', { tipo: '103' })
      const [sql, params] = mockQueryAll.mock.calls[0]
      expect(sql).toContain('tipo = $2')
      expect(params).toEqual(['t1', '103'])
    })
  })

  describe('getById', () => {
    it('throws when not found', async () => {
      mockQueryOne.mockResolvedValue(null)
      await expect(getById(999)).rejects.toThrow('no encontrado')
    })

    it('returns the report when found', async () => {
      const reporte = { id: 1, tipo: '103', periodo: 202401 }
      mockQueryOne.mockResolvedValue(reporte)
      const result = await getById(1)
      expect(result).toEqual(reporte)
    })
  })

  describe('generate103', () => {
    it('throws when no emisor configured', async () => {
      mockQueryOne.mockResolvedValue(null)
      await expect(generate103('t1', 202401)).rejects.toThrow('No hay un emisor configurado')
    })

    it('correctly categorizes facturas emitidas vs recibidas', async () => {
      mockQueryOne.mockResolvedValue(emisor)
      mockQueryAll.mockResolvedValue([
        { tipo: '01', emisor_ruc: '1790000001001', subtotal_sin_impuesto: 100, total_iva: 12, categoria: null },
        { tipo: '01', emisor_ruc: '0990000000999', subtotal_sin_impuesto: 200, total_iva: 24, categoria: null },
      ])
      const result = await generate103('t1', 202401)
      expect(result.totalVentasNetas).toBe(100)
      expect(result.totalComprasNetas).toBe(200)
    })

    it('calculates IVA by rates (12%, 14%, 15%, 0%)', async () => {
      mockQueryOne.mockResolvedValue(emisor)
      mockQueryAll.mockResolvedValue([
        { tipo: '01', emisor_ruc: '1790000001001', subtotal_sin_impuesto: 1000, total_iva: 120, categoria: null },
      ])
      const result = await generate103('t1', 202401)
      expect(result.ivaVentas12).toBe(120)
    })

    it('calculates retenciones by category', async () => {
      mockQueryOne.mockResolvedValue(emisor)
      mockQueryAll.mockResolvedValue([
        { tipo: '07', emisor_ruc: '0990000000999', subtotal_sin_impuesto: 0, total_iva: 30, categoria: 'Bienes' },
        { tipo: '07', emisor_ruc: '0990000000999', subtotal_sin_impuesto: 0, total_iva: 20, categoria: 'Servicios' },
        { tipo: '07', emisor_ruc: '0990000000999', subtotal_sin_impuesto: 0, total_iva: 10, categoria: 'Profesionales' },
      ])
      const result = await generate103('t1', 202401)
      expect(result.retencionIvaBienes).toBe(30)
      expect(result.retencionIvaServicios).toBe(20)
      expect(result.retencionIvaServiciosProfesionales).toBe(10)
      expect(result.totalRetenciones).toBe(60)
    })

    it('computes saldoFavorIva correctly', async () => {
      mockQueryOne.mockResolvedValue(emisor)
      mockQueryAll.mockResolvedValue([
        { tipo: '01', emisor_ruc: '1790000001001', subtotal_sin_impuesto: 500, total_iva: 60, categoria: null },
        { tipo: '01', emisor_ruc: '0990000000999', subtotal_sin_impuesto: 1000, total_iva: 120, categoria: null },
        { tipo: '07', emisor_ruc: '0990000000999', subtotal_sin_impuesto: 0, total_iva: 10, categoria: 'Bienes' },
      ])
      const result = await generate103('t1', 202401)
      const ivaVentas = 500 * 0.12 + 500 * 0.14 + 500 * 0.15
      const ivaCompras = 1000 * 0.12 + 1000 * 0.14 + 1000 * 0.15
      expect(result.saldoFavorIva).toBe(Math.max(0, ivaCompras + 10 - ivaVentas))
    })
  })

  describe('generate104', () => {
    it('throws when no emisor configured', async () => {
      mockQueryOne.mockResolvedValue(null)
      await expect(generate104('t1', 202401)).rejects.toThrow('No hay un emisor configurado')
    })

    it('correctly separates ingresos', async () => {
      mockQueryOne.mockResolvedValue(emisor)
      mockQueryAll.mockResolvedValue([
        { tipo: '01', emisor_ruc: '1790000001001', importe_total: 1000, total_iva: 120, categoria: 'Venta' },
        { tipo: '01', emisor_ruc: '1790000001001', importe_total: 500, total_iva: 60, categoria: 'Servicio' },
        { tipo: '01', emisor_ruc: '1790000001001', importe_total: 300, total_iva: 36, categoria: 'Exportacion' },
      ])
      const result = await generate104('t1', 202401)
      expect(result.ingresosVentas).toBe(1500)
      expect(result.ingresosServicios).toBe(500)
      expect(result.ingresosExportaciones).toBe(300)
    })

    it('computes utilidadBruta and utilidadNeta', async () => {
      mockQueryOne.mockResolvedValue(emisor)
      mockQueryAll.mockResolvedValue([
        { tipo: '01', emisor_ruc: '1790000001001', importe_total: 1000, total_iva: 120, categoria: 'Venta' },
        { tipo: '01', emisor_ruc: '0990000000999', importe_total: 600, total_iva: 72, categoria: null },
      ])
      const result = await generate104('t1', 202401)
      expect(result.utilidadBruta).toBe(400)
      expect(result.utilidadNeta).toBe(400)
    })

    it('computes impuestoRentaCausado at 25%', async () => {
      mockQueryOne.mockResolvedValue(emisor)
      mockQueryAll.mockResolvedValue([
        { tipo: '01', emisor_ruc: '1790000001001', importe_total: 1000, total_iva: 0, categoria: 'Venta' },
      ])
      const result = await generate104('t1', 202401)
      expect(result.impuestoRentaCausado).toBe(250)
    })
  })

  describe('updateEstado', () => {
    it('adds fecha_presentacion only when PRESENTADO', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 1 })
      mockUpdate.mockResolvedValue([])
      mockQueryOne.mockResolvedValueOnce({ id: 1, estado: 'PRESENTADO' })
      await updateEstado(1, 'PRESENTADO')
      expect(mockUpdate).toHaveBeenCalledWith(
        'reportes_fiscales',
        expect.objectContaining({ estado: 'PRESENTADO', fecha_presentacion: expect.any(Date) }),
        'id = $1',
        [1]
      )
    })

    it('does not add fecha_presentacion when not PRESENTADO', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 1 })
      mockUpdate.mockResolvedValue([])
      mockQueryOne.mockResolvedValueOnce({ id: 1, estado: 'GENERADO' })
      await updateEstado(1, 'GENERADO')
      expect(mockUpdate).toHaveBeenCalledWith(
        'reportes_fiscales',
        { estado: 'GENERADO' },
        'id = $1',
        [1]
      )
    })

    it('throws when report not found', async () => {
      mockQueryOne.mockResolvedValue(null)
      await expect(updateEstado(999, 'PRESENTADO')).rejects.toThrow('no encontrado')
    })
  })
})
