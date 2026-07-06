import { describe, it, expect } from 'vitest';
import { buildChatSystemPrompt } from '../src/lib/sri-api/chat-context';

describe('buildChatSystemPrompt', () => {
  const baseContext = {
    userRuc: '0999000000001',
    razonSocial: 'EMPRESA S.A.',
    regimen: 'RIMPE',
    ambiente: 'PRUEBAS',
    certDaysLeft: 180,
    certExpiry: '2026-12-31',
    whatsappEstado: 'conectado',
    whatsappNumero: '0999000000',
    comprobantes: [],
    alerts: [],
    recentJobs: [],
  };

  it('incluye razonSocial del contribuyente', () => {
    const prompt = buildChatSystemPrompt(baseContext);
    expect(prompt).toContain('EMPRESA S.A.');
  });

  it('incluye userRuc en datosCuenta', () => {
    const prompt = buildChatSystemPrompt(baseContext);
    expect(prompt).toContain('0999000000001');
  });

  it('incluye resumen tributario con total 0 si no hay comprobantes', () => {
    const prompt = buildChatSystemPrompt(baseContext);
    expect(prompt).toContain('"totalComprobantes": 0');
    expect(prompt).toContain('"facturasCompras": 0');
    expect(prompt).toContain('"facturasVentas": 0');
  });

  it('incluye certificado digital info', () => {
    const prompt = buildChatSystemPrompt(baseContext);
    expect(prompt).toContain('180');
    expect(prompt).toContain('2026-12-31');
  });

  it('incluye whatsapp estado', () => {
    const prompt = buildChatSystemPrompt(baseContext);
    expect(prompt).toContain('conectado');
    expect(prompt).toContain('0999000000');
  });

  it('incluye alertas de auditoría', () => {
    const ctx = {
      ...baseContext,
      alerts: [
        { title: 'Alerta 1', risk: 'Alto', description: 'Descripción 1', severity: 'alta' as any, category: 'test' as any, date: '2026-01-01' as any },
      ],
    };
    const prompt = buildChatSystemPrompt(ctx);
    expect(prompt).toContain('Alerta 1');
    expect(prompt).toContain('Alto');
  });

  it('incluye tareas de descarga recientes', () => {
    const ctx = {
      ...baseContext,
      recentJobs: [
        { id: 'job-1', fecha_desde: '2026-06-01', fecha_hasta: '2026-06-15', tipo_comprobante: '1', status: 'COMPLETED', progress_message: 'OK', created_at: '2026-06-01' },
      ],
    };
    const prompt = buildChatSystemPrompt(ctx);
    expect(prompt).toContain('job-1');
    expect(prompt).toContain('2026-06-01');
  });

  it('incluye comprobantes recientes (últimos 5)', () => {
    const comprobantes = Array.from({ length: 10 }, (_, i) => ({
      tipo: '01',
      secuencial: String(i + 1).padStart(9, '0'),
      emisor_razon_social: 'Emisor',
      importe_total: 100,
      estado: 'AUTORIZADO',
      fecha_emision: '2026-06-01',
    }));
    const ctx = { ...baseContext, comprobantes };
    const prompt = buildChatSystemPrompt(ctx);
    expect(prompt).toContain('secuencial');
  });

  it('incluye modo asistente en español', () => {
    const prompt = buildChatSystemPrompt(baseContext);
    expect(prompt).toContain('español ecuatoriano');
    expect(prompt).toContain('Asistente Tributario IA');
  });

  it('incluye regla de tool call extraer_documentos_sri', () => {
    const prompt = buildChatSystemPrompt(baseContext);
    expect(prompt).toContain('extraer_documentos_sri');
  });
});
