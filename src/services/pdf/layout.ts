import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib'

/** Identidad de la empresa vinculada al RUC. El PDF usa este nombre, no la marca del software. */
export interface PdfCompany {
  ruc: string
  razonSocial: string
  nombreComercial?: string | null
  /** Si viene, reemplaza el color derivado del RUC. */
  accentHex?: string | null
}

export function companyDisplayName(company: PdfCompany): string {
  const comercial = (company.nombreComercial || '').trim()
  const razon = (company.razonSocial || '').trim()
  return comercial || razon || company.ruc || 'Empresa'
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return rgb(f(0), f(8), f(4))
}

/** Color estable por RUC, para que cada empresa tenga su propio acento. */
export function accentFromRuc(ruc: string): { solid: RGB; pale: RGB } {
  const digits = (ruc || '').replace(/\D/g, '')
  if (!digits) {
    return { solid: rgb(0.16, 0.18, 0.22), pale: rgb(0.94, 0.945, 0.95) }
  }
  let hash = 0
  for (let i = 0; i < digits.length; i++) hash = (hash * 33 + digits.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return { solid: hslToRgb(hue, 0.45, 0.28), pale: hslToRgb(hue, 0.28, 0.94) }
}

export function accentFromHex(hex: string): { solid: RGB; pale: RGB } | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!match) return null
  const n = Number.parseInt(match[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return {
    solid: rgb(r, g, b),
    pale: rgb(Math.min(1, 0.9 + r * 0.08), Math.min(1, 0.9 + g * 0.08), Math.min(1, 0.9 + b * 0.08)),
  }
}

const INK = rgb(0.12, 0.12, 0.14)
const MUTED = rgb(0.4, 0.4, 0.43)
const LINE = rgb(0.86, 0.84, 0.84)
const ZEBRA = rgb(0.98, 0.965, 0.965)
const WHITE = rgb(1, 1, 1)
const OK = rgb(0.12, 0.45, 0.28)
const WARN = rgb(0.72, 0.42, 0.08)

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 40
const FOOTER = 28

export interface PdfLine {
  label: string
  value: string
}

export interface PdfPanel {
  title: string
  lines: PdfLine[]
}

export interface PdfColumn {
  header: string
  width: number
  align?: 'left' | 'right'
}

export interface PdfAmountLine {
  label: string
  value: string
  strong?: boolean
}

function sanitize(text: string): string {
  return (text || '')
    .replace(/\r?\n/g, ' ')
    .replace(/[^\x20-\xff]/g, '')
    .trim()
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const clean = sanitize(text) || '—'
  const words = clean.split(/\s+/)
  const lines: string[] = []
  let current = ''

  const pushLongWord = (word: string) => {
    let chunk = ''
    for (const ch of word) {
      const next = chunk + ch
      if (font.widthOfTextAtSize(next, size) > maxWidth && chunk) {
        lines.push(chunk)
        chunk = ch
      } else {
        chunk = next
      }
    }
    current = chunk
  }

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial
      continue
    }
    if (current) lines.push(current)
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      pushLongWord(word)
    } else {
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['—']
}

export class BrandPdf {
  readonly doc: PDFDocument
  readonly font: PDFFont
  readonly fontBold: PDFFont
  readonly fontMono: PDFFont
  page: PDFPage
  y: number
  readonly company: PdfCompany
  private readonly accent: RGB
  private readonly accentPale: RGB

  private constructor(
    doc: PDFDocument,
    font: PDFFont,
    fontBold: PDFFont,
    fontMono: PDFFont,
    company: PdfCompany
  ) {
    this.doc = doc
    this.font = font
    this.fontBold = fontBold
    this.fontMono = fontMono
    this.company = company
    const custom = company.accentHex ? accentFromHex(company.accentHex) : null
    const accent = custom ?? accentFromRuc(company.ruc)
    this.accent = accent.solid
    this.accentPale = accent.pale
    this.page = doc.addPage([PAGE_W, PAGE_H])
    this.y = PAGE_H - MARGIN
  }

  static async create(company: PdfCompany | string = { ruc: '', razonSocial: 'Empresa' }): Promise<BrandPdf> {
    const identity = typeof company === 'string' ? { ruc: '', razonSocial: company } : company
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    const fontMono = await doc.embedFont(StandardFonts.Courier)
    return new BrandPdf(doc, font, fontBold, fontMono, identity)
  }

  get contentWidth(): number {
    return PAGE_W - MARGIN * 2
  }

  get pageWidth(): number {
    return PAGE_W
  }

  get margin(): number {
    return MARGIN
  }

  private bottom(): number {
    return MARGIN + FOOTER
  }

  addPage(): void {
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.page.drawRectangle({
      x: 0,
      y: PAGE_H - 22,
      width: PAGE_W,
      height: 22,
      color: this.accent,
    })
    const name = sanitize(companyDisplayName(this.company)).slice(0, 72)
    this.page.drawText(name, {
      x: MARGIN,
      y: PAGE_H - 15,
      size: 8,
      font: this.fontBold,
      color: WHITE,
    })
    this.y = PAGE_H - 22 - 16
  }

  ensure(height: number): void {
    if (this.y - height < this.bottom()) {
      this.addPage()
    }
  }

  drawHeader(opts: {
    documentTitle: string
    subtitle?: string
    badge?: string
    badgeTone?: 'neutral' | 'ok' | 'warn'
    logo?: PDFImage | null
  }): void {
    const logo = opts.logo ?? null
    const logoSize = 40
    const logoPad = logo ? logoSize + 12 : 0
    const name = companyDisplayName(this.company)
    const nameWidth = Math.min(this.contentWidth * 0.62, 340) - (logo ? 8 : 0)
    const nameLines = wrapText(name, this.fontBold, 13, Math.max(120, nameWidth)).slice(0, 2)
    const rucLine = this.company.ruc ? `RUC ${this.company.ruc}` : ''
    const razon = (this.company.razonSocial || '').trim()
    const showRazon = razon && razon.toLowerCase() !== name.toLowerCase()
    const band = Math.max(logo ? 64 : 0, 28 + nameLines.length * 15 + (rucLine ? 12 : 0) + (showRazon ? 11 : 0))

    this.page.drawRectangle({
      x: 0,
      y: PAGE_H - band,
      width: PAGE_W,
      height: band,
      color: this.accent,
    })

    const textX = MARGIN + logoPad
    if (logo) {
      const logoY = PAGE_H - (band + logoSize) / 2
      this.page.drawRectangle({
        x: MARGIN - 2,
        y: logoY - 2,
        width: logoSize + 4,
        height: logoSize + 4,
        color: WHITE,
      })
      this.page.drawImage(logo, {
        x: MARGIN,
        y: logoY,
        width: logoSize,
        height: logoSize,
      })
    }

    let textY = PAGE_H - 22
    for (const line of nameLines) {
      this.page.drawText(line, {
        x: textX,
        y: textY,
        size: 13,
        font: this.fontBold,
        color: WHITE,
      })
      textY -= 15
    }
    if (showRazon) {
      const razonLine = wrapText(razon, this.font, 8, Math.max(120, nameWidth))[0]
      this.page.drawText(razonLine, {
        x: textX,
        y: textY,
        size: 8,
        font: this.font,
        color: rgb(0.93, 0.93, 0.94),
      })
      textY -= 11
    }
    if (rucLine) {
      this.page.drawText(sanitize(rucLine), {
        x: textX,
        y: textY,
        size: 8,
        font: this.font,
        color: rgb(0.93, 0.93, 0.94),
      })
    }

    const docTitle = sanitize(opts.documentTitle)
    const titleSize = docTitle.length > 22 ? 8 : 10
    const titleW = this.fontBold.widthOfTextAtSize(docTitle, titleSize)
    this.page.drawText(docTitle, {
      x: PAGE_W - MARGIN - titleW,
      y: PAGE_H - 24,
      size: titleSize,
      font: this.fontBold,
      color: WHITE,
    })

    if (opts.badge) {
      const label = sanitize(opts.badge)
      const textW = this.fontBold.widthOfTextAtSize(label, 8)
      const padX = 8
      const w = textW + padX * 2
      const h = 14
      const x = PAGE_W - MARGIN - w
      const y = PAGE_H - 42
      const fill = opts.badgeTone === 'ok' ? OK : opts.badgeTone === 'warn' ? WARN : rgb(0.12, 0.12, 0.14)
      this.page.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor: WHITE, borderWidth: 0.5 })
      this.page.drawText(label, { x: x + padX, y: y + 3.5, size: 8, font: this.fontBold, color: WHITE })
    }

    this.y = PAGE_H - band - 14
    if (opts.subtitle) {
      this.drawMuted(opts.subtitle)
      this.y -= 4
    }
  }

  /** Encabezado de RIDE: emisor a la izquierda y caja de autorización a la derecha. */
  drawRideMasthead(opts: {
    logo?: PDFImage | null
    emisorLines: string[]
    documentTitle: string
    ruc: string
    numero: string
    numeroAutorizacion: string
    fechaAutorizacion: string
    ambiente: string
    emision: string
    claveAcceso: string
    qr?: PDFImage | null
  }): void {
    const topBar = 6
    this.page.drawRectangle({
      x: 0,
      y: PAGE_H - topBar,
      width: PAGE_W,
      height: topBar,
      color: this.accent,
    })

    const top = PAGE_H - topBar - 14
    const boxW = 228
    const gap = 10
    const leftW = this.contentWidth - boxW - gap
    const leftX = MARGIN
    const boxX = MARGIN + leftW + gap
    const logo = opts.logo ?? null
    const logoSize = logo ? 48 : 0
    const textX = leftX + (logo ? logoSize + 8 : 0)
    const textW = Math.max(80, leftW - (logo ? logoSize + 8 : 0))

    const emisorWrapped = opts.emisorLines.flatMap((line, index) => {
      const font = index === 0 ? this.fontBold : this.font
      const size = index === 0 ? 10 : 7.5
      return wrapText(line, font, size, textW).map((text) => ({ text, font, size, color: INK }))
    })
    const leftH = Math.max(
      logoSize,
      emisorWrapped.reduce((height, line) => height + line.size + 3, 4)
    )

    const inner = boxW - 16
    const auth = wrapText(opts.numeroAutorizacion || opts.claveAcceso || '—', this.fontMono, 6.5, inner)
    const clave = wrapText(opts.claveAcceso || '—', this.fontMono, 6.5, inner)
    const qrSize = opts.qr ? 52 : 0
    const rightInner =
      16 + 14 + 13 + 12 + 10 + 8 + auth.length * 8 + 12 + 11 + 11 + 11 + 11 + 9 + clave.length * 8 + (qrSize ? qrSize + 8 : 0) + 16
    const blockH = Math.max(leftH, rightInner) + 8

    if (logo) {
      this.page.drawRectangle({
        x: leftX,
        y: top - logoSize - 2,
        width: logoSize + 4,
        height: logoSize + 4,
        color: WHITE,
        borderColor: LINE,
        borderWidth: 0.6,
      })
      this.page.drawImage(logo, {
        x: leftX + 2,
        y: top - logoSize,
        width: logoSize,
        height: logoSize,
      })
    }

    let ly = top - 2
    for (const line of emisorWrapped) {
      this.page.drawText(line.text, {
        x: textX,
        y: ly - line.size,
        size: line.size,
        font: line.font,
        color: line.color,
      })
      ly -= line.size + 3
    }

    this.page.drawRectangle({
      x: boxX,
      y: top - blockH,
      width: boxW,
      height: blockH,
      borderColor: this.accent,
      borderWidth: 1.1,
      color: WHITE,
    })

    let ry = top - 14
    const write = (text: string, size: number, font: PDFFont, color: RGB) => {
      this.page.drawText(sanitize(text), { x: boxX + 8, y: ry, size, font, color })
    }
    write(`R.U.C.: ${opts.ruc || '—'}`, 9, this.fontBold, INK)
    ry -= 14
    write(opts.documentTitle, 11, this.fontBold, this.accent)
    ry -= 13
    write(`No. ${opts.numero || '—'}`, 8, this.fontBold, INK)
    ry -= 12
    this.page.drawLine({
      start: { x: boxX + 8, y: ry + 4 },
      end: { x: boxX + boxW - 8, y: ry + 4 },
      thickness: 0.4,
      color: LINE,
    })
    write('NÚMERO DE AUTORIZACIÓN', 6, this.font, MUTED)
    ry -= 9
    for (const line of auth) {
      this.page.drawText(line, { x: boxX + 8, y: ry, size: 6.5, font: this.fontMono, color: INK })
      ry -= 8
    }
    ry -= 2
    write('FECHA Y HORA DE AUTORIZACIÓN', 6, this.font, MUTED)
    ry -= 10
    write(opts.fechaAutorizacion || '—', 7.5, this.fontBold, INK)
    ry -= 11
    write(`AMBIENTE: ${opts.ambiente || '—'}`, 7.5, this.font, INK)
    ry -= 10
    write(`EMISIÓN: ${opts.emision || 'NORMAL'}`, 7.5, this.font, INK)
    ry -= 11
    write('CLAVE DE ACCESO', 6, this.font, MUTED)
    ry -= 9
    for (const line of clave) {
      this.page.drawText(line, { x: boxX + 8, y: ry, size: 6.5, font: this.fontMono, color: INK })
      ry -= 8
    }
    if (opts.qr && ry - qrSize > top - blockH + 4) {
      this.page.drawImage(opts.qr, { x: boxX + boxW - qrSize - 8, y: ry - qrSize, width: qrSize, height: qrSize })
    }

    this.y = top - blockH - 12
  }

  /** Filas de etiquetas (comprador, fechas, documento sustento). */
  drawLabeledRows(rows: { label: string; value: string }[][]): void {
    if (rows.length === 0) return
    const rowHeights = rows.map((cells) => {
      const colW = this.contentWidth / cells.length
      const lines = cells.map((cell) => wrapText(cell.value || '—', this.fontBold, 8, Math.max(24, colW - 12)).length)
      return 20 + Math.max(1, ...lines) * 10
    })
    const height = rowHeights.reduce((sum, row) => sum + row, 0)
    this.ensure(height + 4)
    let y = this.y
    rows.forEach((cells, rowIndex) => {
      const rowH = rowHeights[rowIndex]
      const colW = this.contentWidth / cells.length
      cells.forEach((cell, cellIndex) => {
        const x = MARGIN + cellIndex * colW
        this.page.drawRectangle({
          x,
          y: y - rowH,
          width: colW,
          height: rowH,
          borderColor: LINE,
          borderWidth: 0.6,
          color: WHITE,
        })
        this.page.drawText(sanitize(cell.label), {
          x: x + 6,
          y: y - 11,
          size: 6.5,
          font: this.font,
          color: MUTED,
        })
        const wrapped = wrapText(cell.value || '—', this.fontBold, 8, Math.max(24, colW - 12))
        wrapped.forEach((line, lineIndex) => {
          this.page.drawText(line, {
            x: x + 6,
            y: y - 22 - lineIndex * 10,
            size: 8,
            font: this.fontBold,
            color: INK,
          })
        })
      })
      y -= rowH
    })
    this.y = y - 10
  }

  /** Información adicional y formas de pago a la izquierda; totales a la derecha. */
  drawRideClosing(opts: {
    adicional: { label: string; value: string }[]
    pagos: { forma: string; detalle: string; valor: string }[]
    totales: { label: string; value: string; strong?: boolean }[]
  }): void {
    const boxW = 230
    const gap = 12
    const leftW = this.contentWidth - boxW - gap
    const leftBlocks: { text: string; size: number; font: PDFFont; color: RGB }[] = []
    const push = (text: string, size: number, font: PDFFont, color: RGB) => {
      for (const line of wrapText(text, font, size, leftW)) {
        leftBlocks.push({ text: line, size, font, color })
      }
    }
    if (opts.adicional.length > 0) {
      push('INFORMACIÓN ADICIONAL', 8, this.fontBold, this.accent)
      for (const campo of opts.adicional) {
        push(campo.label, 6.5, this.font, MUTED)
        push(campo.value || '—', 8, this.font, INK)
      }
    }
    if (opts.pagos.length > 0) {
      if (leftBlocks.length > 0) leftBlocks.push({ text: ' ', size: 6, font: this.font, color: WHITE })
      push('FORMA DE PAGO', 8, this.fontBold, this.accent)
      for (const pago of opts.pagos) {
        push(pago.forma, 8, this.font, INK)
        if (pago.detalle) push(pago.detalle, 7, this.font, MUTED)
        push(pago.valor, 8, this.fontBold, INK)
      }
    }

    const leftH = leftBlocks.reduce((sum, block) => sum + block.size + 3, 0)
    const rowH = 13
    const totalsH = opts.totales.length * rowH + 10
    const height = Math.max(leftH, totalsH, 20)
    this.ensure(height + 6)
    const top = this.y

    let ly = top - 2
    for (const block of leftBlocks) {
      if (block.text !== ' ') {
        this.page.drawText(block.text, { x: MARGIN, y: ly - block.size, size: block.size, font: block.font, color: block.color })
      }
      ly -= block.size + 3
    }

    const x = PAGE_W - MARGIN - boxW
    this.page.drawRectangle({
      x,
      y: top - totalsH,
      width: boxW,
      height: totalsH,
      borderColor: LINE,
      borderWidth: 0.8,
      color: WHITE,
    })
    let ty = top - 12
    for (const line of opts.totales) {
      const strong = Boolean(line.strong)
      if (strong) {
        this.page.drawRectangle({
          x: x + 1,
          y: ty - 4,
          width: boxW - 2,
          height: rowH,
          color: this.accentPale,
        })
      }
      const font = strong ? this.fontBold : this.font
      const size = strong ? 8 : 7
      this.page.drawText(sanitize(line.label), { x: x + 6, y: ty, size, font, color: strong ? this.accent : INK })
      const value = sanitize(line.value)
      const vw = font.widthOfTextAtSize(value, size)
      this.page.drawText(value, { x: x + boxW - 6 - vw, y: ty, size, font, color: INK })
      ty -= rowH
    }

    this.y = top - height - 12
  }

  private lineFont(label: string): PDFFont {
    return label.toLowerCase().includes('clave') ? this.fontMono : this.font
  }

  private panelBody(panel: PdfPanel, innerWidth: number): { height: number; blocks: { label: string; values: string[]; font: PDFFont }[] } {
    const blocks = panel.lines.map((line) => {
      const font = this.lineFont(line.label)
      const values = wrapText(line.value, font, 8, innerWidth)
      return { label: sanitize(line.label), values, font }
    })
    const height = 18 + blocks.reduce((sum, block) => sum + 10 + block.values.length * 10 + 4, 8)
    return { height, blocks }
  }

  drawPanels(left: PdfPanel, right: PdfPanel): void {
    const gap = 10
    const colW = (this.contentWidth - gap) / 2
    const inner = colW - 16
    const leftBody = this.panelBody(left, inner)
    const rightBody = this.panelBody(right, inner)
    const height = Math.max(leftBody.height, rightBody.height)
    this.ensure(height + 8)
    this.paintPanel(left.title, leftBody.blocks, MARGIN, this.y, colW, height)
    this.paintPanel(right.title, rightBody.blocks, MARGIN + colW + gap, this.y, colW, height)
    this.y -= height + 12
  }

  private paintPanel(
    title: string,
    blocks: { label: string; values: string[]; font: PDFFont }[],
    x: number,
    top: number,
    width: number,
    height: number
  ): void {
    this.page.drawRectangle({
      x,
      y: top - height,
      width,
      height,
      borderColor: LINE,
      borderWidth: 0.8,
      color: WHITE,
    })
    this.page.drawRectangle({
      x,
      y: top - 16,
      width,
      height: 16,
      color: this.accentPale,
    })
    this.page.drawText(sanitize(title), {
      x: x + 8,
      y: top - 12,
      size: 7.5,
      font: this.fontBold,
      color: this.accent,
    })
    let ly = top - 28
    for (const block of blocks) {
      this.page.drawText(block.label, { x: x + 8, y: ly, size: 7, font: this.font, color: MUTED })
      ly -= 10
      for (const value of block.values) {
        this.page.drawText(value, { x: x + 8, y: ly, size: 8, font: block.font, color: INK })
        ly -= 10
      }
      ly -= 4
    }
  }

  /** Bloque de pares etiqueta/valor a ancho completo, con salto de línea. */
  drawFields(lines: PdfLine[]): void {
    this.ensure(lines.length * 22 + 8)
    for (const line of lines) {
      this.page.drawText(sanitize(line.label), {
        x: MARGIN,
        y: this.y,
        size: 7,
        font: this.font,
        color: MUTED,
      })
      const wrapped = wrapText(line.value, this.font, 9, this.contentWidth)
      this.y -= 11
      for (const part of wrapped) {
        this.ensure(12)
        this.page.drawText(part, { x: MARGIN, y: this.y, size: 9, font: this.font, color: INK })
        this.y -= 11
      }
      this.y -= 4
    }
  }

  drawSectionTitle(title: string): void {
    this.ensure(22)
    this.page.drawText(sanitize(title), {
      x: MARGIN,
      y: this.y,
      size: 9,
      font: this.fontBold,
      color: this.accent,
    })
    this.y -= 6
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.6,
      color: this.accentPale,
    })
    this.y -= 12
  }

  drawTable(columns: PdfColumn[], rows: string[][]): void {
    const size = 7.5
    const lineH = 10
    const pad = 4
    const headerH = 16

    const paintHeader = () => {
      this.ensure(headerH + 8)
      this.page.drawRectangle({
        x: MARGIN,
        y: this.y - headerH + 4,
        width: this.contentWidth,
        height: headerH,
        color: this.accent,
      })
      let x = MARGIN
      for (const col of columns) {
        const header = sanitize(col.header)
        const w = this.fontBold.widthOfTextAtSize(header, 7.5)
        const tx = col.align === 'right' ? x + col.width - pad - w : x + pad
        this.page.drawText(header, {
          x: tx,
          y: this.y - 8,
          size: 7.5,
          font: this.fontBold,
          color: WHITE,
        })
        x += col.width
      }
      this.y -= headerH + 2
    }

    paintHeader()

    rows.forEach((row, index) => {
      const wrapped = columns.map((col, i) =>
        wrapText(row[i] ?? '', this.font, size, Math.max(12, col.width - pad * 2))
      )
      const lines = wrapped.reduce((max, cell) => Math.max(max, cell.length), 1)
      const rowH = lines * lineH + 6
      if (this.y - rowH < this.bottom()) {
        this.addPage()
        paintHeader()
      }
      if (index % 2 === 1) {
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - rowH + 4,
          width: this.contentWidth,
          height: rowH,
          color: ZEBRA,
        })
      }
      let x = MARGIN
      columns.forEach((col, i) => {
        wrapped[i].forEach((line, li) => {
          const w = this.font.widthOfTextAtSize(line, size)
          const tx = col.align === 'right' ? x + col.width - pad - w : x + pad
          this.page.drawText(line, {
            x: tx,
            y: this.y - 8 - li * lineH,
            size,
            font: this.font,
            color: INK,
          })
        })
        x += col.width
      })
      this.y -= rowH
    })
    this.y -= 8
  }

  drawAmountBox(lines: PdfAmountLine[]): void {
    const boxW = 230
    const rowH = 14
    const height = lines.length * rowH + 12
    this.ensure(height + 4)
    const x = PAGE_W - MARGIN - boxW
    this.page.drawRectangle({
      x,
      y: this.y - height,
      width: boxW,
      height,
      borderColor: LINE,
      borderWidth: 0.8,
      color: WHITE,
    })
    let ly = this.y - 14
    lines.forEach((line) => {
      const strong = Boolean(line.strong)
      if (strong) {
        this.page.drawRectangle({
          x: x + 1,
          y: ly - 4,
          width: boxW - 2,
          height: rowH,
          color: this.accentPale,
        })
      }
      const font = strong ? this.fontBold : this.font
      this.page.drawText(sanitize(line.label), { x: x + 8, y: ly, size: strong ? 9 : 8, font, color: strong ? this.accent : INK })
      const value = sanitize(line.value)
      const vw = font.widthOfTextAtSize(value, strong ? 9 : 8)
      this.page.drawText(value, { x: x + boxW - 8 - vw, y: ly, size: strong ? 9 : 8, font, color: INK })
      ly -= rowH
    })
    this.y -= height + 10
  }

  drawMuted(text: string): void {
    const lines = wrapText(text, this.font, 7, this.contentWidth)
    for (const line of lines) {
      this.ensure(11)
      this.page.drawText(line, { x: MARGIN, y: this.y, size: 7, font: this.font, color: MUTED })
      this.y -= 10
    }
  }

  drawSignatureRow(left: string, right: string): void {
    this.ensure(48)
    this.y -= 28
    const yLine = this.y
    this.page.drawLine({
      start: { x: MARGIN, y: yLine },
      end: { x: MARGIN + 180, y: yLine },
      thickness: 0.7,
      color: LINE,
    })
    this.page.drawLine({
      start: { x: PAGE_W - MARGIN - 180, y: yLine },
      end: { x: PAGE_W - MARGIN, y: yLine },
      thickness: 0.7,
      color: LINE,
    })
    this.page.drawText(sanitize(left), { x: MARGIN, y: yLine - 12, size: 7, font: this.font, color: MUTED })
    this.page.drawText(sanitize(right), { x: PAGE_W - MARGIN - 180, y: yLine - 12, size: 7, font: this.font, color: MUTED })
    this.y = yLine - 20
  }

  drawImage(image: PDFImage, width: number, height: number, align: 'left' | 'right' = 'right'): void {
    this.ensure(height + 8)
    const x = align === 'right' ? PAGE_W - MARGIN - width : MARGIN
    this.page.drawImage(image, { x, y: this.y - height, width, height })
    this.y -= height + 8
  }

  async toBuffer(): Promise<Buffer> {
    const pages = this.doc.getPages()
    const total = pages.length
    pages.forEach((page, index) => {
      const label = `${index + 1} / ${total}`
      const w = this.font.widthOfTextAtSize(label, 8)
      const name = companyDisplayName(this.company)
      const footer = this.company.ruc ? `${name} · RUC ${this.company.ruc}` : name
      const footerText = wrapText(footer, this.font, 8, PAGE_W - MARGIN * 2 - 70)[0]
      page.drawText(footerText, {
        x: MARGIN,
        y: 16,
        size: 8,
        font: this.font,
        color: MUTED,
      })
      page.drawText(label, {
        x: PAGE_W - MARGIN - w,
        y: 16,
        size: 8,
        font: this.font,
        color: MUTED,
      })
    })
    const bytes = await this.doc.save()
    return Buffer.from(bytes)
  }
}
