import fs from 'node:fs/promises';
import path from 'node:path';
import { verifyAuth } from '@/services/sri-api/auth-helper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    if (!user.tenantId || user.type === 'integration') {
      return Response.json({ error: 'No autorizado' }, { status: 403 });
    }
  } catch {
    return Response.json({ error: 'Inicie sesión para descargar el conector' }, { status: 401 });
  }

  try {
    const file = await fs.readFile(path.join(process.cwd(), 'assets', 'connector', 'Conector-SRI.exe'));
    return new Response(file, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="Conector-SRI.exe"',
        'Content-Length': String(file.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json({ error: 'El paquete del conector no está disponible' }, { status: 503 });
  }
}
