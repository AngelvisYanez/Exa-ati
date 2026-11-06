import { NextResponse } from 'next/server';
import { forbiddenResponse } from '@/services/sri-api/rbac';
import { CatalogoInvalido, CatalogoSinMigrar } from '@/services/sri-api/catalogo-productos';

export function respuestaCatalogo(error: unknown, contexto: string) {
  if (error instanceof CatalogoInvalido) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof CatalogoSinMigrar) {
    return NextResponse.json({ message: error.message, code: 'CATALOGO_SIN_MIGRAR' }, { status: 503 });
  }
  const message = error instanceof Error ? error.message : 'Error interno del servidor';
  if (message.includes('Acceso denegado')) return forbiddenResponse(message);
  if (message.startsWith('No autorizado')) return NextResponse.json({ message }, { status: 401 });
  console.error(`[${contexto}]`, error);
  return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
}
