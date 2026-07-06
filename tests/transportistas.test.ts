import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  query: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../src/lib/sri-api/db', () => ({
  db: mockDb,
}));

describe('transportistas', () => {
  const TENANT = 'tenant-1';
  const TRANSPORTISTA = {
    id: 'uuid-1',
    tenant_id: TENANT,
    ruc: '1790012344001',
    razon_social: 'Transportes XYZ S.A.',
    placa: 'PBI-1234',
    tipo_identificacion: '04',
    direccion: 'Quito',
    telefono: '0999000000',
    email: 'trans@test.com',
    activo: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getByTenant filtra por tenant', async () => {
    mockDb.queryAll.mockResolvedValue([TRANSPORTISTA]);
    const { getByTenant } = await import('../src/lib/sri-api/transportistas');
    const result = await getByTenant(TENANT);
    expect(result).toHaveLength(1);
    expect(mockDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $1'),
      [TENANT]
    );
  });

  it('getByTenant filtra por activo si se pasa', async () => {
    mockDb.queryAll.mockResolvedValue([TRANSPORTISTA]);
    const { getByTenant } = await import('../src/lib/sri-api/transportistas');
    await getByTenant(TENANT, true);
    expect(mockDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $1 AND activo = $2'),
      [TENANT, true]
    );
  });

  it('getById retorna transportista', async () => {
    mockDb.queryOne.mockResolvedValue(TRANSPORTISTA);
    const { getById } = await import('../src/lib/sri-api/transportistas');
    const result = await getById('uuid-1');
    expect(result.razon_social).toBe('Transportes XYZ S.A.');
  });

  it('getById lanza error si no existe', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { getById } = await import('../src/lib/sri-api/transportistas');
    await expect(getById('nonexistent')).rejects.toThrow('no encontrado');
  });

  it('create valida RUC de 13 dígitos terminado en 001', async () => {
    const { create } = await import('../src/lib/sri-api/transportistas');
    await expect(create({ tenantId: TENANT, ruc: '123', razonSocial: 'Test', placa: 'PBI-1234' }))
      .rejects.toThrow('RUC del transportista debe tener 13 dígitos');
  });

  it('create valida placa mínima 6 caracteres', async () => {
    const { create } = await import('../src/lib/sri-api/transportistas');
    await expect(create({ tenantId: TENANT, ruc: '1790012344001', razonSocial: 'Test', placa: 'AB' }))
      .rejects.toThrow('placa');
  });

  it('create rechaza duplicado', async () => {
    mockDb.queryOne.mockResolvedValue({ id: 1 });
    const { create } = await import('../src/lib/sri-api/transportistas');
    await expect(create({ tenantId: TENANT, ruc: '1790012344001', razonSocial: 'Test', placa: 'PBI-1234' }))
      .rejects.toThrow('Ya existe un transportista');
  });

  it('create inserta transportista válido', async () => {
    mockDb.queryOne.mockResolvedValue(null);
    const { create } = await import('../src/lib/sri-api/transportistas');
    await create({ tenantId: TENANT, ruc: '1790012344001', razonSocial: 'Transportes XYZ S.A.', placa: 'PBI-1234' });
    expect(mockDb.insert).toHaveBeenCalledWith('transportistas', expect.objectContaining({
      ruc: '1790012344001',
      placa: 'PBI-1234',
    }));
  });

  it('update modifica campos', async () => {
    mockDb.queryOne.mockResolvedValue(TRANSPORTISTA);
    const { update } = await import('../src/lib/sri-api/transportistas');
    await update('uuid-1', { razonSocial: 'Nuevo Nombre', activo: false });
    expect(mockDb.update).toHaveBeenCalledWith(
      'transportistas',
      expect.objectContaining({ razon_social: 'Nuevo Nombre', activo: false }),
      'id = $1',
      ['uuid-1']
    );
  });

  it('remove desactiva transportista', async () => {
    mockDb.queryOne.mockResolvedValue(TRANSPORTISTA);
    const { remove } = await import('../src/lib/sri-api/transportistas');
    await remove('uuid-1');
    expect(mockDb.update).toHaveBeenCalledWith('transportistas', { activo: false }, 'id = $1', ['uuid-1']);
  });

  it('hardDelete elimina físicamente', async () => {
    mockDb.queryOne.mockResolvedValue(TRANSPORTISTA);
    const { hardDelete } = await import('../src/lib/sri-api/transportistas');
    await hardDelete('uuid-1');
    expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM transportistas WHERE id = $1', ['uuid-1']);
  });
});
