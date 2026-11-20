import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/sri-api/auth-helper', () => ({ verifyAuth: vi.fn() }));

import { verifyAuth } from '@/services/sri-api/auth-helper';
import { GET } from '../src/app/api/sri/local-connector/download/route';

const auth = vi.mocked(verifyAuth);

beforeEach(() => auth.mockReset());

describe('descarga del conector SRI', () => {
  it('exige un usuario con tenant', async () => {
    auth.mockResolvedValue({ sub: 'user', email: 'user@example.com', rol: 'USER', tenantId: null });
    const response = await GET(new Request('https://ati.exacontable.com/api/sri/local-connector/download'));
    expect(response.status).toBe(403);
  });

  it('entrega un ejecutable privado a un usuario con tenant', async () => {
    auth.mockResolvedValue({ sub: 'user', email: 'user@example.com', rol: 'USER', tenantId: 'tenant' });
    const response = await GET(new Request('https://ati.exacontable.com/api/sri/local-connector/download'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x4d, 0x5a]);
  });
});
