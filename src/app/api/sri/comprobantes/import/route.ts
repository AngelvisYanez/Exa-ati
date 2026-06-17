import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { getUserRuc } from '@/lib/sri-api/user-resolver';
import { sincronizarConSri } from '@/lib/sri-api/sync-service';
import { xmlBuilder } from '@/lib/sri-api/xml-builder';

// Keyword-based automatic expense classifier
function classifyExpense(razonSocial: string): string {
  const r = razonSocial.toLowerCase();
  if (r.includes('favorita') || r.includes('rosado') || r.includes('supermaxi') || r.includes('megamaxi') || r.includes('tienda') || r.includes('comisariato') || r.includes('pronaca') || r.includes('aliment') || r.includes('supermercado')) {
    return 'Alimentación';
  }
  if (r.includes('farmacia') || r.includes('sana') || r.includes('fybeca') || r.includes('hospital') || r.includes('clinica') || r.includes('medico') || r.includes('salud') || r.includes('doctor') || r.includes('medicamento')) {
    return 'Salud';
  }
  if (r.includes('universidad') || r.includes('colegio') || r.includes('escuela') || r.includes('educa') || r.includes('papeleria') || r.includes('libros') || r.includes('instituto')) {
    return 'Educación';
  }
  if (r.includes('inmobiliaria') || r.includes('arriendo') || r.includes('alquiler') || r.includes('vivienda') || r.includes('constructo') || r.includes('cemento') || r.includes('hierro') || r.includes('edificio')) {
    return 'Vivienda';
  }
  if (r.includes('moda') || r.includes('textil') || r.includes('almacen') || r.includes('ropa') || r.includes('vestido') || r.includes('calzado') || r.includes('deati') || r.includes('deprati')) {
    return 'Vestimenta';
  }
  if (r.includes('telecom') || r.includes('conecel') || r.includes('claro') || r.includes('telefonica') || r.includes('movistar') || r.includes('cnt') || r.includes('internet') || r.includes('electric') || r.includes('agua') || r.includes('municip') || r.includes('servicios') || r.includes('computo') || r.includes('tecnologia')) {
    return 'Negocio/Servicios';
  }
  return 'Otros';
}

function getTipoDocDesc(cod: string): string {
  const mapping: Record<string, string> = {
    '01': 'Factura',
    '03': 'Liquidación de Compra',
    '04': 'Nota de Crédito',
    '05': 'Nota de Débito',
    '07': 'Comprobante de Retención',
  };
  return mapping[cod] || `Tipo ${cod}`;
}

function extractDocumentosRelacionados(compData: any, rootName: string): string | null {
  try {
    const list: string[] = [];
    if (rootName === 'notaCredito' && compData.infoNotaCredito) {
      const info = compData.infoNotaCredito;
      if (info.numDocModificado) {
        const type = getTipoDocDesc(info.codDocModificado);
        let str = `${type} ${info.numDocModificado}`;
        if (info.fechaEmisionDocSustento) {
          str += ` (${info.fechaEmisionDocSustento})`;
        }
        list.push(str);
      }
    } else if (rootName === 'notaDebito' && compData.infoNotaDebito) {
      const info = compData.infoNotaDebito;
      if (info.numDocModificado) {
        const type = getTipoDocDesc(info.codDocModificado);
        let str = `${type} ${info.numDocModificado}`;
        if (info.fechaEmisionDocSustento) {
          str += ` (${info.fechaEmisionDocSustento})`;
        }
        list.push(str);
      }
    } else if (rootName === 'comprobanteRetencion') {
      if (compData.docsSustento && compData.docsSustento.docSustento) {
        const docs = Array.isArray(compData.docsSustento.docSustento)
          ? compData.docsSustento.docSustento
          : [compData.docsSustento.docSustento];
        for (const doc of docs) {
          if (doc.numDocSustento) {
            const type = getTipoDocDesc(doc.codDocSustento);
            let str = `${type} ${doc.numDocSustento}`;
            if (doc.fechaEmisionDocSustento) {
              str += ` (${doc.fechaEmisionDocSustento})`;
            }
            if (!list.includes(str)) list.push(str);
          }
        }
      }
      if (compData.impuestos && compData.impuestos.impuesto) {
        const imps = Array.isArray(compData.impuestos.impuesto)
          ? compData.impuestos.impuesto
          : [compData.impuestos.impuesto];
        for (const imp of imps) {
          if (imp.numDocSustento) {
            const type = getTipoDocDesc(imp.codDocSustento || '01');
            let str = `${type} ${imp.numDocSustento}`;
            if (imp.fechaEmisionDocSustento) {
              str += ` (${imp.fechaEmisionDocSustento})`;
            }
            if (!list.includes(str)) list.push(str);
          }
        }
      }
    }
    return list.length > 0 ? list.join(', ') : null;
  } catch (e) {
    console.error('Error extracting related docs:', e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const userRuc = await getUserRuc(user);
    const { xmls } = await req.json();

    if (!xmls || !Array.isArray(xmls)) {
      return NextResponse.json(
        { message: 'Se requiere una lista de contenidos XML en la propiedad "xmls"' },
        { status: 400 }
      );
    }

    const imported = [];
    const errors = [];

    // Pre-buscar emisores vinculados a nuestro tenant
    const emisores = await db.queryAll(
      'SELECT id, ruc FROM emisores WHERE tenant_id = ? AND activo = 1',
      [user.tenantId]
    );
    const emisorMap = new Map(emisores.map((e: any) => [e.ruc, e.id]));

    const importedClaves: string[] = [];

    for (let index = 0; index < xmls.length; index++) {
      const xmlString = xmls[index];
      try {
        if (!xmlString || typeof xmlString !== 'string') {
          throw new Error('Contenido XML vacío o inválido');
        }

        // 1. Parser XML a Objeto
        let parsed: any = await xmlBuilder.parseXml(xmlString);

        // 2. Extraer cuerpo si viene envuelto en <autorizacion>
        if (parsed.autorizacion) {
          const auth = parsed.autorizacion;
          if (auth.comprobante) {
            // A veces comprobante es un string con CDATA (XML anidado), lo volvemos a parsear
            if (typeof auth.comprobante === 'string') {
              parsed = await xmlBuilder.parseXml(auth.comprobante);
            } else {
              parsed = auth.comprobante;
            }
          }
        }

        // 3. Determinar tipo de comprobante y extraer tags
        let tipo = '';
        let rootName = '';
        let infoTributaria: any = null;
        let infoDoc: any = null;

        if (parsed.factura) {
          tipo = '01';
          rootName = 'factura';
          infoTributaria = parsed.factura.infoTributaria;
          infoDoc = parsed.factura.infoFactura;
        } else if (parsed.comprobanteRetencion) {
          tipo = '07';
          rootName = 'comprobanteRetencion';
          infoTributaria = parsed.comprobanteRetencion.infoTributaria;
          infoDoc = parsed.comprobanteRetencion.infoCompRetencion;
        } else if (parsed.notaCredito) {
          tipo = '04';
          rootName = 'notaCredito';
          infoTributaria = parsed.notaCredito.infoTributaria;
          infoDoc = parsed.notaCredito.infoNotaCredito;
        } else if (parsed.notaDebito) {
          tipo = '05';
          rootName = 'notaDebito';
          infoTributaria = parsed.notaDebito.infoTributaria;
          infoDoc = parsed.notaDebito.infoNotaDebito;
        } else if (parsed.liquidacionCompra) {
          tipo = '03';
          rootName = 'liquidacionCompra';
          infoTributaria = parsed.liquidacionCompra.infoTributaria;
          infoDoc = parsed.liquidacionCompra.infoLiquidacionCompra;
        } else {
          throw new Error('Tipo de comprobante no soportado (Facturas 01, NC 04, Retenciones 07, ND 05, Liquidaciones 03)');
        }

        if (!infoTributaria || !infoDoc) {
          throw new Error('Estructura XML inválida: faltan etiquetas obligatorias');
        }

        const compData = parsed[rootName];
        const documentosRelacionados = extractDocumentosRelacionados(compData, rootName);

        const claveAcceso = infoTributaria.claveAcceso;
        const rucEmisor = infoTributaria.ruc;
        const razonSocialEmisor = infoTributaria.razonSocial;
        const secuencial = infoTributaria.secuencial;
        const serie = `${infoTributaria.estab}-${infoTributaria.ptoEmi}`;
        const ambiente = infoTributaria.ambiente || '1';

        // Determinar receptor
        let receptorIdentificacion = '';
        let receptorRazonSocial = '';
        let receptorEmail = '';

        if (tipo === '01') {
          receptorIdentificacion = infoDoc.identificacionComprador;
          receptorRazonSocial = infoDoc.razonSocialComprador;
          receptorEmail = infoDoc.correoElectronico || '';
        } else if (tipo === '07') {
          receptorIdentificacion = infoDoc.identificacionSujetoRetenido;
          receptorRazonSocial = infoDoc.razonSocialSujetoRetenido;
          receptorEmail = infoDoc.correoElectronico || '';
        } else if (tipo === '04') {
          receptorIdentificacion = infoDoc.identificacionComprador;
          receptorRazonSocial = infoDoc.razonSocialComprador;
        } else if (tipo === '05') {
          receptorIdentificacion = infoDoc.identificacionComprador;
          receptorRazonSocial = infoDoc.razonSocialComprador;
        } else if (tipo === '03') {
          receptorIdentificacion = infoDoc.identificacionProveedor;
          receptorRazonSocial = infoDoc.razonSocialProveedor;
        }

        // Validar que el comprobante pertenezca al usuario (ya sea emisor o receptor)
        if (rucEmisor !== userRuc && receptorIdentificacion !== userRuc) {
          throw new Error(`El RUC del emisor (${rucEmisor}) o receptor (${receptorIdentificacion}) no coincide con el RUC de tu cuenta (${userRuc})`);
        }

        // Totales e Importes
        const totalSinImpuestos = parseFloat(infoDoc.totalSinImpuestos) || 0;
        const totalDescuento = parseFloat(infoDoc.totalDescuento) || 0;
        const totalIva = parseFloat(infoDoc.totalIva) || (tipo === '01' ? (parseFloat(infoDoc.importeTotal) || 0) - totalSinImpuestos : 0);
        const importeTotal = parseFloat(infoDoc.importeTotal) || parseFloat(infoDoc.valorTotal) || 0;

        // Parsear fecha
        let fechaEmision = new Date();
        if (infoDoc.fechaEmision) {
          const parts = infoDoc.fechaEmision.split('/');
          if (parts.length === 3) {
            fechaEmision = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          } else {
            fechaEmision = new Date(infoDoc.fechaEmision);
          }
        }

        // Clasificar gasto
        const categoria = classifyExpense(razonSocialEmisor);

        // Determinar emisor_id local si aplica
        const localEmisorId = emisorMap.get(rucEmisor) || null;

        // Validar claveAcceso duplicada en base de datos
        const existing = await db.queryOne(
          'SELECT id FROM comprobantes WHERE clave_acceso = ?',
          [claveAcceso]
        );

        if (existing) {
          throw new Error(`Comprobante ya importado previamente (Clave: ...${claveAcceso.slice(-8)})`);
        }

        // Insertar comprobante
        await db.query(
          `INSERT INTO comprobantes (
            emisor_id, tipo, serie, secuencial, ambiente, tipo_emision,
            clave_acceso, fecha_emision, estado, estado_sri, fecha_autorizacion, numero_autorizacion,
            total_sin_impuesto, subtotal_sin_impuesto, total_iva, total_descuento, importe_total, propina, moneda,
            receptor_tipo_id, receptor_identificacion, receptor_razon_social,
            receptor_email, emisor_ruc, emisor_razon_social,
            categoria, documentos_relacionados, tenant_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            localEmisorId,
            tipo,
            serie,
            secuencial,
            ambiente,
            '1',
            claveAcceso,
            fechaEmision.toISOString().split('T')[0],
            'AUTORIZADO',
            'AUTORIZADO',
            new Date(),
            claveAcceso,
            totalSinImpuestos,
            totalSinImpuestos,
            totalIva,
            totalDescuento,
            importeTotal,
            0,
            'USD',
            '05',
            receptorIdentificacion,
            receptorRazonSocial,
            receptorEmail,
            rucEmisor,
            razonSocialEmisor,
            categoria,
            documentosRelacionados,
            user.tenantId,
          ]
        );

        imported.push({
          claveAcceso,
          secuencial,
          emisor: razonSocialEmisor,
          importeTotal,
          categoria
        });
        importedClaves.push(claveAcceso);
      } catch (err: any) {
        errors.push({
          index,
          message: err.message || 'Error desconocido al parsear/importar'
        });
      }
    }

    let syncResult = null;
    if (importedClaves.length > 0 && user.tenantId) {
      try {
        syncResult = await sincronizarConSri(user.tenantId, userRuc, {
          clavesAcceso: importedClaves,
          limite: importedClaves.length,
        });
      } catch (syncErr: any) {
        console.warn('[Import] Sync post-import falló:', syncErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      importedCount: imported.length,
      errorsCount: errors.length,
      imported,
      errors,
      sync: syncResult,
    });
  } catch (error: any) {
    console.error('[Import Comprobantes Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor al importar comprobantes' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
