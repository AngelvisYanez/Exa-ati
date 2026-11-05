import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { encryption } from '@/services/sri-api/encryption';
import { calculateTaxSummary } from '@/services/sri-api/tax-calculator';
import { fetchTenantComprobantes } from '@/services/sri-api/audit-engine';
import { getUserRuc } from '@/services/sri-api/user-resolver';
import { submitDeclaration } from '@/services/scraping/sri-declaration-submitter';
import { SriPlaywrightScraper } from '@/services/scraping/sri-playwright-scraper';

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const fechaDesde = searchParams.get('fechaDesde') || undefined;
    const fechaHasta = searchParams.get('fechaHasta') || undefined;

    const tenantId = requireTenantId(user);

    const conditions = ["tenant_id = ?", "accion = 'PRESENTAR_DECLARACION'", 'exitoso = true'];
    const params: string[] = [tenantId];

    const rows = await db.queryAll<any>(
      `SELECT id, descripcion, datos_nuevos, created_at
       FROM auditoria
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 100`,
      params
    );

    let declaraciones = rows.map((row) => {
      const data = typeof row.datos_nuevos === 'string'
        ? JSON.parse(row.datos_nuevos)
        : row.datos_nuevos;

      return {
        id: row.id,
        periodo: data?.periodo || null,
        tipo: data?.formulario || null,
        tramite: data?.numeroTramite || null,
        fecha: data?.fechaDesde && data?.fechaHasta
          ? `${data.fechaDesde} – ${data.fechaHasta}`
          : new Date(row.created_at).toLocaleDateString('es-EC', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
        fechaDesde: data?.fechaDesde || null,
        fechaHasta: data?.fechaHasta || null,
        estado: data?.estado || null,
        iva: parseFloat(data?.ivaAPagar || 0),
        createdAt: row.created_at,
        _raw: data,
      };
    });

    if (fechaDesde) {
      declaraciones = declaraciones.filter(
        (d) => d._raw?.fechaHasta && d._raw.fechaHasta >= fechaDesde
      );
    }
    if (fechaHasta) {
      declaraciones = declaraciones.filter(
        (d) => d._raw?.fechaDesde && d._raw.fechaDesde <= fechaHasta
      );
    }

    // _raw is kept for filter but returned as-is; type requires it

    return NextResponse.json({ success: true, data: declaraciones });
  } catch (error: any) {
    console.error('[Declaraciones GET Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al listar declaraciones' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  let scraper: SriPlaywrightScraper | null = null;
  try {
    const user = await verifyAuth(req);
    const body = await req.json();
    const userRuc = await getUserRuc(user, req);
    const tenantId = requireTenantId(user);

    const modo = body.modo === 'OTP' ? 'OTP' : 'ASISTIDO';
    const otpVerificado = !!body.otpVerificado;
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

    const range = {
      fechaDesde: body.fechaDesde || undefined,
      fechaHasta: body.fechaHasta || undefined,
    };

    const comprobantes = await fetchTenantComprobantes(tenantId, userRuc, range);
    const summary = calculateTaxSummary(comprobantes, userRuc);

    const emisor = await db.queryOne<any>(
      `SELECT razon_social, clave_sri_encrypted FROM emisores WHERE ruc = $1 AND activo = true`,
      [userRuc]
    );

    if (!emisor) {
      return NextResponse.json(
        { message: `No se encontró un emisor activo para el RUC ${userRuc}. Vincula tu RUC desde Configuración.` },
        { status: 400 }
      );
    }

    const periodo =
      body.periodo ||
      new Date().toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });

    const casilleros = {
      '401': parseFloat(summary.totalVentasSub.toFixed(2)),
      '411': parseFloat(summary.totalVentasIva.toFixed(2)),
      '500': parseFloat(summary.totalComprasSub.toFixed(2)),
      '553': parseFloat(summary.totalComprasIva.toFixed(2)),
      '604': parseFloat(summary.totalRetencionesImporte.toFixed(2)),
      '699': parseFloat(summary.ivaAPagarNeto.toFixed(2)),
    };

    const basePayload = {
      formulario: '104A',
      periodo,
      ruc: userRuc,
      razonSocial: emisor?.razon_social || userRuc,
      ivaAPagar: summary.ivaAPagarNeto,
      casilleros,
      documentosProcesados: comprobantes.length,
      fechaDesde: range.fechaDesde,
      fechaHasta: range.fechaHasta,
      modo,
    };

    if (modo === 'ASISTIDO' || !otpVerificado) {
      const numeroTramite = `ASISTIDO-${Date.now()}`;
      const payload = {
        ...basePayload,
        otpVerificado: false,
        estado: 'BORRADOR',
        numeroTramite,
        asistido: true,
      };

      await db.insert<any>('auditoria', {
        usuario_email: userRuc,
        tenant_id: tenantId,
        accion: 'PRESENTAR_DECLARACION',
        recurso: 'declaraciones',
        descripcion: `Declaración IVA ${periodo} preparada (modo asistido). Ref: ${numeroTramite}. IVA: $${payload.ivaAPagar.toFixed(2)}`,
        datos_nuevos: JSON.stringify(payload),
        exitoso: true,
      });

      return NextResponse.json({
        success: true,
        message:
          'Declaración preparada en modo asistido. Debes ingresar manualmente al portal SRI En Línea con los casilleros generados y presentar el Formulario 104.',
        declaracion: payload,
      });
    }

    if (!emisor.clave_sri_encrypted) {
      return NextResponse.json(
        { message: 'El emisor no tiene credenciales del portal SRI configuradas. Vincula tu RUC desde Configuración.' },
        { status: 400 }
      );
    }

    if (otp.length < 6) {
      return NextResponse.json(
        { message: 'Ingresa un código OTP válido de al menos 6 dígitos del portal SRI.' },
        { status: 400 }
      );
    }

    let claveSri: string;
    try {
      claveSri = await encryption.decrypt(emisor.clave_sri_encrypted);
    } catch {
      claveSri = emisor.clave_sri_encrypted;
    }

    scraper = new SriPlaywrightScraper();
    await scraper.init();
    const loggedIn = await scraper.login(userRuc, claveSri);
    if (!loggedIn) {
      return NextResponse.json(
        { message: 'No se pudo iniciar sesión en el portal SRI con las credenciales del emisor.' },
        { status: 500 }
      );
    }

    const page = scraper.getPage();
    if (!page) {
      return NextResponse.json({ message: 'Sesión Playwright sin página activa' }, { status: 500 });
    }

    const sriResult = await submitDeclaration(
      page,
      {
        ruc: userRuc,
        claveSri,
        periodo,
        fechaDesde: range.fechaDesde || '',
        fechaHasta: range.fechaHasta || '',
        casilleros,
        ivaAPagar: summary.ivaAPagarNeto,
        otp,
      },
      { alreadyLoggedIn: true }
    );

    await scraper.close();
    scraper = null;

    const payload = {
      ...basePayload,
      otpVerificado: true,
      estado: sriResult.success ? (sriResult.estado || 'PRESENTADA') : 'ERROR',
      numeroTramite: sriResult.numeroTramite || null,
      sriResponse: sriResult,
    };

    await db.insert<any>('auditoria', {
      usuario_email: userRuc,
      tenant_id: tenantId,
      accion: 'PRESENTAR_DECLARACION',
      recurso: 'declaraciones',
      descripcion: sriResult.success
        ? `Declaración IVA ${periodo} presentada al SRI. Trámite: ${sriResult.numeroTramite || 'N/A'}. IVA: $${payload.ivaAPagar.toFixed(2)}`
        : `Declaración IVA ${periodo} falló: ${sriResult.error || 'Error desconocido'}`,
      datos_nuevos: JSON.stringify(payload),
      exitoso: sriResult.success,
    });

    if (!sriResult.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            sriResult.error ||
            'No se pudo completar la presentación en el portal SRI. Verifica credenciales, OTP y disponibilidad del portal.',
          declaracion: payload,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: sriResult.mensaje || 'Declaración presentada correctamente',
      declaracion: payload,
    });
  } catch (error: any) {
    if (scraper) {
      await scraper.close().catch(() => {});
    }
    console.error('[Declaraciones POST Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error al presentar declaración' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
