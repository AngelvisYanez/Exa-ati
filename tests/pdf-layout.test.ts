import { describe, it, expect } from 'vitest'
import { BrandPdf, wrapText } from '../src/services/pdf/layout'
import { StandardFonts, PDFDocument } from 'pdf-lib'

describe('wrapText', () => {
  it('parte una descripción larga en varias líneas', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const lines = wrapText('Servicio de consultoría contable y tributaria para el periodo fiscal', font, 8, 80)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toContain('consultoría')
  })
})

describe('BrandPdf', () => {
  it('empieza por %PDF y pagina cuando la tabla no cabe', async () => {
    const pdf = await BrandPdf.create({
      ruc: '1790000000001',
      razonSocial: 'EMPRESA DEMO S.A.',
      nombreComercial: 'DEMO',
    })
    pdf.drawHeader({ documentTitle: 'Reporte de prueba', subtitle: 'Paginación' })
    const rows = Array.from({ length: 80 }, (_, i) => [`Fila ${i + 1}`, 'Detalle que ocupa la columna'])
    pdf.drawTable(
      [
        { header: 'Item', width: 120 },
        { header: 'Detalle', width: pdf.contentWidth - 120 },
      ],
      rows
    )
    expect(pdf.doc.getPageCount()).toBeGreaterThan(1)
    const buffer = await pdf.toBuffer()
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('incluye el logo en el encabezado', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    const pdf = await BrandPdf.create({
      ruc: '1790000000001',
      razonSocial: 'EMPRESA DEMO S.A.',
      nombreComercial: 'DEMO',
    })
    const sinLogo = await pdf.toBuffer()
    const image = await pdf.doc.embedPng(png)
    pdf.drawHeader({ documentTitle: 'FACTURA', logo: image })
    const conLogo = await pdf.toBuffer()
    expect(conLogo.length).toBeGreaterThan(sinLogo.length)
    expect(conLogo.subarray(0, 4).toString()).toBe('%PDF')
  })
})
