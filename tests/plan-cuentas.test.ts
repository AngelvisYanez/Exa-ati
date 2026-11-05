import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/sri-api/db', () => ({
  db: {
    queryAll: vi.fn(),
    queryOne: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from '../src/services/sri-api/db'
import {
  getAll,
  getById,
  getByCodigo,
  create,
  update,
  remove,
  getArbol,
} from '../src/services/sri-api/plan-cuentas'

const mockQueryAll = vi.mocked(db.queryAll)
const mockQueryOne = vi.mocked(db.queryOne)
const mockInsert = vi.mocked(db.insert)
const mockUpdate = vi.mocked(db.update)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('plan-cuentas', () => {
  describe('getAll', () => {
    it('calls correct SQL with tenant_id only', async () => {
      mockQueryAll.mockResolvedValue([])
      await getAll('t1')
      expect(mockQueryAll).toHaveBeenCalledOnce()
      const [sql, params] = mockQueryAll.mock.calls[0]
      expect(sql).toContain('WHERE tenant_id = $1')
      expect(sql).not.toContain('tipo')
      expect(params).toEqual(['t1'])
    })

    it('adds tipo filter when tipo option provided', async () => {
      mockQueryAll.mockResolvedValue([])
      await getAll('t1', { tipo: 'A' })
      const [sql, params] = mockQueryAll.mock.calls[0]
      expect(sql).toContain('tipo = $2')
      expect(params).toEqual(['t1', 'A'])
    })

    it('adds nivel filter when nivel option provided', async () => {
      mockQueryAll.mockResolvedValue([])
      await getAll('t1', { nivel: 2 })
      const [sql, params] = mockQueryAll.mock.calls[0]
      expect(sql).toContain('nivel = $2')
      expect(params).toEqual(['t1', 2])
    })

    it('adds activo filter when activo option provided', async () => {
      mockQueryAll.mockResolvedValue([])
      await getAll('t1', { activo: true })
      const [sql, params] = mockQueryAll.mock.calls[0]
      expect(sql).toContain('activo = $2')
      expect(params).toEqual(['t1', true])
    })
  })

  describe('getById', () => {
    it('throws when not found', async () => {
      mockQueryOne.mockResolvedValue(null)
      await expect(getById(999)).rejects.toThrow('no encontrado')
    })

    it('returns the account when found', async () => {
      const account = { id: 1, codigo: '1', nombre: 'Activo' }
      mockQueryOne.mockResolvedValue(account)
      const result = await getById(1)
      expect(result).toEqual(account)
    })
  })

  describe('getByCodigo', () => {
    it('throws when not found', async () => {
      mockQueryOne.mockResolvedValue(null)
      await expect(getByCodigo('t1', '9.9.9')).rejects.toThrow('no encontrado')
    })

    it('returns the account when found', async () => {
      const account = { id: 1, codigo: '1', nombre: 'Activo' }
      mockQueryOne.mockResolvedValue(account)
      const result = await getByCodigo('t1', '1')
      expect(result).toEqual(account)
    })
  })

  describe('create', () => {
    it('throws on duplicate code', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 1 })
      await expect(
        create({ tenantId: 't1', codigo: '1', nombre: 'Activo', nivel: 1, tipo: 'A' })
      ).rejects.toThrow('Ya existe una cuenta con el código')
    })

    it('throws when cuentaPadreId provided but not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null)
      mockQueryOne.mockResolvedValueOnce(null)
      await expect(
        create({ tenantId: 't1', codigo: '1.1', nombre: 'Circulante', nivel: 2, tipo: 'A', cuentaPadreId: 999 })
      ).rejects.toThrow('Cuenta padre ID 999 no encontrada')
    })

    it('throws when nivel does not match parent nivel + 1', async () => {
      mockQueryOne.mockResolvedValueOnce(null)
      mockQueryOne.mockResolvedValueOnce({ id: 1, nivel: 1 })
      await expect(
        create({ tenantId: 't1', codigo: '1.1', nombre: 'Circulante', nivel: 3, tipo: 'A', cuentaPadreId: 1 })
      ).rejects.toThrow('El nivel debe ser 2')
    })

    it('throws when no padre and nivel !== 1', async () => {
      mockQueryOne.mockResolvedValueOnce(null)
      await expect(
        create({ tenantId: 't1', codigo: '1.1', nombre: 'Circulante', nivel: 2, tipo: 'A' })
      ).rejects.toThrow('Una cuenta sin padre debe tener nivel 1')
    })

    it('inserts correct fields', async () => {
      mockQueryOne.mockResolvedValueOnce(null)
      mockInsert.mockResolvedValue({ id: 10 })
      await create({ tenantId: 't1', codigo: '1', nombre: 'Activo', nivel: 1, tipo: 'A' })
      expect(mockInsert).toHaveBeenCalledWith('plan_cuentas', {
        tenant_id: 't1',
        codigo: '1',
        nombre: 'Activo',
        nivel: 1,
        tipo: 'A',
        es_auxiliar: false,
        permite_movimiento: true,
        cuenta_padre_id: null,
      })
    })
  })

  describe('update', () => {
    it('throws when not found', async () => {
      mockQueryOne.mockResolvedValue(null)
      await expect(update(999, { nombre: 'X' })).rejects.toThrow('no encontrado')
    })

    it('throws on duplicate code', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 1, codigo: '1', tenant_id: 't1' })
      mockQueryOne.mockResolvedValueOnce({ id: 2 })
      await expect(update(1, { codigo: '2' })).rejects.toThrow('Ya existe una cuenta con el código')
    })

    it('calls db.update and returns updated record', async () => {
      const existing = { id: 1, codigo: '1', tenant_id: 't1' }
      const updated = { id: 1, codigo: '1', nombre: 'Nuevo Nombre', tenant_id: 't1' }
      mockQueryOne.mockResolvedValueOnce(existing)
      mockQueryOne.mockResolvedValueOnce(updated)
      mockUpdate.mockResolvedValue([])
      const result = await update(1, { nombre: 'Nuevo Nombre' })
      expect(mockUpdate).toHaveBeenCalledWith(
        'plan_cuentas',
        expect.objectContaining({ nombre: 'Nuevo Nombre' }),
        'id = $1',
        [1]
      )
      expect(result).toEqual(updated)
    })
  })

  describe('remove', () => {
    it('throws when not found', async () => {
      mockQueryOne.mockResolvedValue(null)
      await expect(remove(999)).rejects.toThrow('no encontrado')
    })

    it('sets activo=false', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 1 })
      mockQueryOne.mockResolvedValueOnce({ id: 1, activo: false })
      mockUpdate.mockResolvedValue([])
      await remove(1)
      expect(mockUpdate).toHaveBeenCalledWith(
        'plan_cuentas',
        { activo: false },
        'id = $1',
        [1]
      )
    })
  })

  describe('getArbol', () => {
    it('builds a tree from flat records', async () => {
      mockQueryAll.mockResolvedValue([
        { id: 1, codigo: '1', nombre: 'Activo', nivel: 1, cuenta_padre_id: null, tenant_id: 't1', activo: true, tipo: 'A' },
        { id: 2, codigo: '1.1', nombre: 'Circulante', nivel: 2, cuenta_padre_id: 1, tenant_id: 't1', activo: true, tipo: 'A' },
        { id: 3, codigo: '1.1.1', nombre: 'Caja', nivel: 3, cuenta_padre_id: 2, tenant_id: 't1', activo: true, tipo: 'A' },
      ])

      const result = await getArbol('t1')

      expect(result).toHaveLength(1)
      expect(result[0].codigo).toBe('1')
      expect(result[0].subcuentas).toHaveLength(1)
      expect(result[0].subcuentas[0].codigo).toBe('1.1')
      expect(result[0].subcuentas[0].subcuentas).toHaveLength(1)
      expect(result[0].subcuentas[0].subcuentas[0].codigo).toBe('1.1.1')
      expect(result[0].subcuentas[0].subcuentas[0].subcuentas).toHaveLength(0)
    })

    it('returns empty array when no accounts', async () => {
      mockQueryAll.mockResolvedValue([])
      const result = await getArbol('t1')
      expect(result).toEqual([])
    })

    it('handles multiple root nodes', async () => {
      mockQueryAll.mockResolvedValue([
        { id: 1, codigo: '1', nombre: 'Activo', nivel: 1, cuenta_padre_id: null, tenant_id: 't1', activo: true, tipo: 'A' },
        { id: 5, codigo: '2', nombre: 'Pasivo', nivel: 1, cuenta_padre_id: null, tenant_id: 't1', activo: true, tipo: 'P' },
      ])

      const result = await getArbol('t1')
      expect(result).toHaveLength(2)
      expect(result[0].codigo).toBe('1')
      expect(result[1].codigo).toBe('2')
    })

    it('queries with activo=true filter', async () => {
      mockQueryAll.mockResolvedValue([])
      await getArbol('t1')
      const [sql, params] = mockQueryAll.mock.calls[0]
      expect(sql).toContain('activo = true')
      expect(params).toEqual(['t1'])
    })
  })
})
