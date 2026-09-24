import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/services/sri-api/auth-helper';
import { encryption } from '@/services/sri-api/encryption';
import { conciliarPeriodo } from '@/services/sri-api/reconciler';
import { buildXmlFactura, FacturaData } from '@/services/sri-api/xml-builder';
import { generarClaveAcceso } from '@/services/sri-api/clave-acceso';
import { db } from '@/services/sri-api/db';
import { sriSoapClient } from '@/services/sri-api/sri-soap-client';

export async function POST(req: NextRequest) {
  let authUser;
  try {
    authUser = await verifyAuth(req);
    if (authUser.rol !== 'ADMIN' && authUser.rol !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acceso denegado: se requieren permisos de administrador' }, { status: 403 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  // Módulos: COMPROBANTES | ENCRYPTION | RECONCILIACION | SOAP_PING | SOAP_AUTORIZAR | PROXY_POOL | ALL
  // SOAP_* es diagnóstico WS offline — no toca Playwright / descarga masiva del portal.
  const targetModule = body.module || 'ALL';
  const claveAccesoRaw = typeof body.claveAcceso === 'string' ? body.claveAcceso.trim() : '';

  const results: Record<string, any> = {};
  const tenantId = authUser.tenantId || '00000000-0000-0000-0000-000000000000';
  const startOverall = Date.now();

  try {
    // 1. Módulo ENCRYPTION (AES-256-GCM)
    if (targetModule === 'ALL' || targetModule === 'ENCRYPTION') {
      const t0 = Date.now();
      const testSecret = 'TEST_ADMIN_SECRET_' + Date.now();
      const encrypted = await encryption.encrypt(testSecret);
      const decrypted = await encryption.decrypt(encrypted);
      const isOk = decrypted === testSecret && encrypted.startsWith('gcm:');

      results.encryption = {
        status: isOk ? 'PASSED' : 'FAILED',
        latencyMs: Date.now() - t0,
        details: {
          algorithm: 'AES-256-GCM',
          sampleEncryptedPrefix: encrypted.substring(0, 20) + '...',
          decryptionMatch: isOk
        }
      };
    }

    // 2. Módulo COMPROBANTES (Generación XML & Clave de Acceso)
    if (targetModule === 'ALL' || targetModule === 'COMPROBANTES') {
      const t0 = Date.now();
      const fecha = new Date();
      const rucPrueba = '0999000000001';
      const claveAcceso = generarClaveAcceso({
        fechaEmision: fecha,
        tipoComprobante: '01',
        ruc: rucPrueba,
        ambiente: '1',
        serie: '001001',
        secuencial: '000000001',
        codigoNumerico: '12345678',
        tipoEmision: '1'
      });

      const facturaSample: FacturaData = {
        ambiente: '1',
        tipoEmision: '1',
        razonSocial: 'EMPRESA PRUEBA S.A.',
        nombreComercial: 'EMPRESA PRUEBA',
        ruc: rucPrueba,
        claveAcceso,
        codDoc: '01',
        estab: '001',
        ptoEmi: '001',
        secuencial: '000000001',
        dirMatriz: 'Guayaquil, Ecuador',
        fechaEmision: '31/07/2026',
        dirEstablecimiento: 'Guayaquil, Ecuador',
        tipoIdentificacionReceptor: '04',
        razonSocialReceptor: 'CLIENTE PRUEBA S.A.',
        identificacionReceptor: '0999000000002',
        totalSinImpuestos: 100.00,
        totalDescuento: 0.00,
        totalConImpuestos: [{
          codigo: '2',
          codigoPorcentaje: '4', // 15%
          baseImponible: 100.00,
          valor: 15.00
        }],
        propina: 0.00,
        importeTotal: 115.00,
        moneda: 'USD',
        detalles: [{
          codigoPrincipal: 'PROD-001',
          descripcion: 'Item de prueba de diagnóstico',
          cantidad: 1,
          precioUnitario: 100.00,
          descuento: 0.00,
          precioTotalSinImpuesto: 100.00,
          impuestos: [{
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: 15,
            baseImponible: 100.00,
            valor: 15.00
          }]
        }]
      };

      const xml = buildXmlFactura(facturaSample);
      const isClaveOk = claveAcceso.length === 49;
      const isXmlOk = xml.includes('<factura') && xml.includes(claveAcceso);

      results.comprobantes = {
        status: isClaveOk && isXmlOk ? 'PASSED' : 'FAILED',
        latencyMs: Date.now() - t0,
        details: {
          claveAccesoLen: claveAcceso.length,
          xmlSizeBytes: Buffer.byteLength(xml, 'utf8'),
          sampleClave: claveAcceso
        }
      };
    }

    // 3. Módulo RECONCILIACION (Conciliación Tributaria)
    if (targetModule === 'ALL' || targetModule === 'RECONCILIACION') {
      const t0 = Date.now();
      const currentPeriodo = 202607;
      const report = await conciliarPeriodo(tenantId, currentPeriodo);

      results.reconciliacion = {
        status: 'PASSED',
        latencyMs: Date.now() - t0,
        details: {
          periodo: report.periodo,
          saludTributariaPct: report.saludTributariaPct,
          totalComprobantes: report.totalComprobantesSri,
          discrepanciasCount: report.discrepancias.length
        }
      };
    }

    // 4. Módulo PROXY_POOL (Base de Datos de Proxies)
    if (targetModule === 'ALL' || targetModule === 'PROXY_POOL') {
      const t0 = Date.now();
      const countRes = await db.queryOne<{ total: number }>('SELECT COUNT(*) as total FROM proxy_pool');
      const activeRes = await db.queryOne<{ active: number }>('SELECT COUNT(*) as active FROM proxy_pool WHERE activo = true');
      const count = Number(countRes?.total || 0);
      const activeCount = Number(activeRes?.active || 0);

      results.proxyPool = {
        status: 'PASSED',
        latencyMs: Date.now() - t0,
        details: {
          totalProxies: count,
          proxiesActivos: activeCount
        }
      };
    }

    // 5. Módulo SOAP_PING — carga real de WSDL recepción + autorización (pruebas y prod)
    if (targetModule === 'ALL' || targetModule === 'SOAP_PING') {
      const t0 = Date.now();
      const [pruebas, produccion] = await Promise.all([
        sriSoapClient.testConnection('1'),
        sriSoapClient.testConnection('2'),
      ]);
      const ok = pruebas.success && produccion.success;
      results.soapPing = {
        status: ok ? 'PASSED' : pruebas.success || produccion.success ? 'WARNING' : 'FAILED',
        latencyMs: Date.now() - t0,
        details: {
          nota: 'Solo WS offline SRI (sin portal / sin Playwright / sin proxies)',
          ambientePruebas: pruebas,
          ambienteProduccion: produccion,
        },
      };
    }

    // 6. Módulo SOAP_AUTORIZAR — consulta por clave 49 (no listado masivo)
    if (targetModule === 'SOAP_AUTORIZAR') {
      const t0 = Date.now();
      if (!/^\d{49}$/.test(claveAccesoRaw)) {
        results.soapAutorizar = {
          status: 'FAILED',
          latencyMs: Date.now() - t0,
          details: {
            error: 'claveAcceso inválida: se requieren exactamente 49 dígitos',
            nota: 'Este módulo consulta AutorizacionComprobantesOffline por clave. No reemplaza la descarga masiva del portal.',
          },
        };
      } else {
        try {
          const resp = await sriSoapClient.autorizarComprobanteRapido(claveAccesoRaw);
          const authRaw = resp?.autorizaciones?.autorizacion;
          const auth = Array.isArray(authRaw) ? authRaw[0] : authRaw;
          const estado = String(auth?.estado || 'SIN_RESPUESTA');
          const hasXml = typeof auth?.comprobante === 'string' && auth.comprobante.length > 50;
          const passed = estado.toUpperCase().includes('AUTORIZADO') || hasXml;
          results.soapAutorizar = {
            status: passed ? 'PASSED' : estado === 'SIN_RESPUESTA' ? 'FAILED' : 'WARNING',
            latencyMs: Date.now() - t0,
            details: {
              claveAcceso: claveAccesoRaw,
              ambiente: claveAccesoRaw.substring(23, 24) === '2' ? 'produccion' : 'pruebas',
              estado,
              numeroAutorizacion: auth?.numeroAutorizacion || null,
              fechaAutorizacion: auth?.fechaAutorizacion || null,
              xmlAutorizadoBytes: hasXml ? Buffer.byteLength(auth.comprobante, 'utf8') : 0,
              mensajes: auth?.mensajes?.mensaje
                ? (Array.isArray(auth.mensajes.mensaje) ? auth.mensajes.mensaje : [auth.mensajes.mensaje]).map(
                    (m: any) => ({
                      identificador: m?.identificador,
                      mensaje: m?.mensaje,
                      tipo: m?.tipo,
                    })
                  )
                : [],
              nota: 'SOAP por clave conocida. El portal Playwright sigue siendo necesario para listados masivos sin claves previas.',
            },
          };
        } catch (soapErr: any) {
          results.soapAutorizar = {
            status: 'FAILED',
            latencyMs: Date.now() - t0,
            details: {
              claveAcceso: claveAccesoRaw,
              error: soapErr?.message || String(soapErr),
            },
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      executedBy: authUser.email,
      totalExecutionTimeMs: Date.now() - startOverall,
      results
    });

  } catch (error: any) {
    console.error('Error en Test Payload Admin:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error ejecutando prueba de diagnóstico',
      results
    }, { status: 500 });
  }
}
