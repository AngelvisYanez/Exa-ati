import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateChatResponse } from '../src/lib/sri-api/llm-client';

vi.mock('../src/lib/sri-api/tenant-llm-config', () => ({
  getTenantLlmConfig: vi.fn().mockResolvedValue({
    provider: 'gemini',
    geminiKey: 'mock-gemini-key',
    model: 'gemini-3.5-flash',
  }),
}));

describe('Chat SRI Tool Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GEMINI_API_KEY', 'mock-gemini-key');
  });

  it('generateChatResponse handles fetch response with tool call', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: 'extraer_documentos_sri',
                  args: {
                    fechaDesde: '2026-06-01',
                    fechaHasta: '2026-06-15',
                    tipoComprobante: '1',
                  },
                },
              },
            ],
          },
        },
      ],
    };

    const globalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const res = await generateChatResponse({
      systemPrompt: 'prompt',
      history: [],
      userMessage: 'Sincroniza mis facturas de junio',
      tenantId: 'mock-tenant-id',
      provider: 'gemini',
    });

    expect(globalFetch).toHaveBeenCalled();
    expect(res.toolCall).toBeDefined();
    expect(res.toolCall?.name).toBe('extraer_documentos_sri');
    expect(res.toolCall?.args.fechaDesde).toBe('2026-06-01');
    expect(res.toolCall?.args.tipoComprobante).toBe('1');
  });
});
