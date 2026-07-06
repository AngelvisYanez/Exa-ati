import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { sendInvoiceEmail } from '@/lib/sri-api/ecommerce';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAuth(req);
    const { id } = await params;

    const success = await sendInvoiceEmail(id);

    if (!success) {
      return NextResponse.json(
        { success: false, message: 'No se pudo enviar el email. Verifica la configuración SMTP o Resend.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Email enviado correctamente' });
  } catch (error: any) {
    console.error('[Send Email Error]', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error al enviar email' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
