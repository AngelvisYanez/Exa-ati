export interface RetencionXML {
  tipoComprobante: string
  numeroComprobante: string
  fechaEmision: string
  rucContribuyente: string
  nombreContribuyente: string
  concepto: string
  baseImponible: number
  impuesto: string
  codigoImpuesto: string
  porcentajeRetencion: number
  valorRetenido: number
  ejercicioFiscal: number
  mes: number
}

const NS_REGEX = /xmlns[^=]*=\s*"[^"]*"/g

export function parseRetencionesXML(xmlContent: string): RetencionXML[] {
  const doc = xmlContent.replace(NS_REGEX, '')
  const resultados: RetencionXML[] = []

  const comprobantes = doc.match(/<comprobante[^>]*>[\s\S]*?<\/comprobante>/gi) || []

  for (const comprobante of comprobantes) {
    const tipo = extractTag(comprobante, 'tipoComprobante') || extractTag(comprobante, 'tipo')
    const numero = extractTag(comprobante, 'numeroComprobante') || extractTag(comprobante, 'numero')
    const fecha = extractTag(comprobante, 'fechaEmision')
    const ruc = extractTag(comprobante, 'rucContribuyente') || extractTag(comprobante, 'ruc')
    const nombre = extractTag(comprobante, 'nombreContribuyente') || extractTag(comprobante, 'nombre')
    const ejercicio = parseInt(extractTag(comprobante, 'ejercicioFiscal') || '0', 10)
    const mes = parseInt(extractTag(comprobante, 'mes') || '0', 10)

    const impuestosMatch = comprobante.match(/<impuesto[^>]*>[\s\S]*?<\/impuesto>/gi) || []

    for (const impuesto of impuestosMatch) {
      const codigoImp = extractTag(impuesto, 'codigo') || extractTag(impuesto, 'codigoImpuesto')
      const impuestoNombre = codigoImp === '1' ? 'IVA' : codigoImp === '2' ? 'IR' : codigoImp ?? ''
      const concepto = extractTag(impuesto, 'concepto') || extractTag(impuesto, 'descripcion')
      const base = parseFloat(extractTag(impuesto, 'baseImponible')?.replace(',', '.') ?? '0')
      const pct = parseFloat(extractTag(impuesto, 'porcentaje')?.replace(',', '.') ?? '0')
      const valor = parseFloat(extractTag(impuesto, 'valorRetenido')?.replace(',', '.') ?? '0')

      if (valor > 0) {
        resultados.push({
          tipoComprobante: tipo,
          numeroComprobante: numero,
          fechaEmision: fecha,
          rucContribuyente: ruc,
          nombreContribuyente: nombre,
          concepto,
          baseImponible: base,
          impuesto: impuestoNombre,
          codigoImpuesto: codigoImp,
          porcentajeRetencion: pct,
          valorRetenido: valor,
          ejercicioFiscal: ejercicio,
          mes,
        })
      }
    }
  }

  return resultados
}

function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>\\s*([^<]+)\\s*<\\/${tagName}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : ''
}
