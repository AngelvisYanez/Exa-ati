import { describe, it, expect } from 'vitest';

describe('coa-ecuador - getPlanCuentasEstandar', () => {
  it('retorna plan de cuentas estándar con todas las cuentas', async () => {
    const { getPlanCuentasEstandar } = await import('../src/lib/sri-api/coa-ecuador');
    const cuentas = getPlanCuentasEstandar();
    expect(cuentas.length).toBeGreaterThan(0);
    expect(cuentas[0].codigo).toBe('1');
    expect(cuentas[0].nombre).toBe('ACTIVO');
  });

  it('tiene cuentas de todos los tipos', async () => {
    const { getPlanCuentasEstandar } = await import('../src/lib/sri-api/coa-ecuador');
    const cuentas = getPlanCuentasEstandar();
    const tipos = new Set(cuentas.map(c => c.tipo));
    expect(tipos.has('ACTIVO')).toBe(true);
    expect(tipos.has('PASIVO')).toBe(true);
    expect(tipos.has('PATRIMONIO')).toBe(true);
    expect(tipos.has('INGRESOS')).toBe(true);
    expect(tipos.has('GASTOS')).toBe(true);
  });

  it('tiene niveles del 1 al 4', async () => {
    const { getPlanCuentasEstandar } = await import('../src/lib/sri-api/coa-ecuador');
    const cuentas = getPlanCuentasEstandar();
    const niveles = new Set(cuentas.map(c => c.nivel));
    expect(niveles.has(1)).toBe(true);
    expect(niveles.has(2)).toBe(true);
    expect(niveles.has(3)).toBe(true);
    expect(niveles.has(4)).toBe(true);
  });
});

describe('coa-ecuador-data - PLAN_CUENTAS_ESTANDAR', () => {
  it('exporta datos de plan de cuentas estándar', async () => {
    const { PLAN_CUENTAS_ESTANDAR } = await import('../src/lib/sri-api/coa-ecuador-data');
    expect(PLAN_CUENTAS_ESTANDAR.length).toBeGreaterThan(0);
  });

  it('tiene estructura correcta en cada cuenta', async () => {
    const { PLAN_CUENTAS_ESTANDAR } = await import('../src/lib/sri-api/coa-ecuador-data');
    for (const c of PLAN_CUENTAS_ESTANDAR) {
      expect(c).toHaveProperty('codigo');
      expect(c).toHaveProperty('nombre');
      expect(c).toHaveProperty('nivel');
      expect(c).toHaveProperty('tipo');
      expect(c).toHaveProperty('esAuxiliar');
      expect(c).toHaveProperty('permiteMovimiento');
    }
  });

  it('tiene 5 tipos de cuenta', async () => {
    const { PLAN_CUENTAS_ESTANDAR } = await import('../src/lib/sri-api/coa-ecuador-data');
    const tipos = new Set(PLAN_CUENTAS_ESTANDAR.map(c => c.tipo));
    expect(tipos.size).toBe(5);
  });
});
