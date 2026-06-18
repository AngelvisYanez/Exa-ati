import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { xsdValidator } from '@/lib/sri-api/xsd-validator';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    const body = await req.json();
    const { xml, tipo } = body;

    if (!xml) {
      return NextResponse.json({ message: 'Campo requerido: xml' }, { status: 400 });
    }

    const result = await xsdValidator.validateXml(xml, tipo || undefined);

    return NextResponse.json({
      success: result.valid,
      tipo: result.tipo,
      erroresCount: result.errors.length,
      warningsCount: result.warnings.length,
      errors: result.errors,
      warnings: result.warnings,
    });
  } catch (error: any) {
    console.error('[XSD Validation Error]', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error al validar XML' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    tipos: xsdValidator.getSoportedTipos(),
  });
}
