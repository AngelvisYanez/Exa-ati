/**
 * ai-tools.ts — Herramientas accionables para el Chat IA
 *
 * Permite a la IA ejecutar acciones reales: emitir facturas electrónicas,
 * crear productos con stock/precio, crear contactos, registrar pagos y
 * consultar cuentas por cobrar/pagar.
 */

import { db } from './db';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  listarCuentasPorCobrar,
  listarCuentasPorPagar,
  obtenerResumenCuentas,
  registrarPagoCobrar,
  registrarPagoPagar,
  marcarVencidas,
  resumenAging,
  type AgingBucket,
} from './cuentas';
import { getConfig, queryRag } from './embeddings';
import { buildFiscalProjection, formatFiscalProjectionHtml } from './tax-calculator';
import { fetchTenantComprobantes } from './audit-engine';

export interface AiToolContext {
  tenantId: string;
  userRuc: string;
  token: string;
  baseUrl: string;
}

export const CrearProductoSchema = z.object({
  codigo: z.string().min(1, "El código del producto es obligatorio"),
  nombre: z.string().min(1, "El nombre del producto es obligatorio"),
  precio: z.number().positive("El precio debe ser mayor a 0"),
  iva: z.number().optional().default(15),
  stock: z.number().optional().default(0),
  descripcion: z.string().optional(),
});

export const RegistrarPagoSchema = z.object({
  tipoCuenta: z.enum(["COBRAR", "PAGAR"]).default("COBRAR"),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  numeroDocumento: z.string().optional(),
  identificacion: z.string().optional(),
  cuentaId: z.string().optional(),
  fecha: z.string().optional(),
  metodoPago: z.string().optional().default("TRANSFERENCIA"),
  referencia: z.string().optional(),
});

const num = (v: any): number => Number(v ?? 0);
const str = (v: any): string => (v == null ? '' : String(v));

function fmtMonto(v: any): string {
  return '$' + num(v).toFixed(2);
}

function codigoPorcentajeIva(tarifa: number): string {
  if (tarifa <= 0) return '0';
  if (tarifa === 5) return '3';
  return '2';
}

function tarifaNormalizada(tarifa: number): number {
  if (tarifa === 5) return 5;
  if (tarifa > 5) return 15;
  return 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function listToHtml(items: string[]): string {
  return items.map((i) => `<br/>• ${i}`).join('');
}

/** Normaliza fechas a YYYY-MM-DD. Acepta ISO, DD/MM/YYYY y "YYYY-MM" (expande al último día del mes). */
export function normalizeIsoDate(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }

  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const lastDay = new Date(y, mo, 0).getDate();
    return `${m[1]}-${m[2].padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function descripcionTipoComprobante(tipo: string): string {
  const map: Record<string, string> = {
    '1': 'Facturas',
    '2': 'Liquidaciones de compra',
    '3': 'Notas de Crédito',
    '4': 'Notas de Débito',
    '6': 'Comprobantes de Retención',
    todos: 'Comprobantes',
  };
  return map[tipo] || 'Comprobantes';
}

export function formatoFechaEspanol(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// CREAR PRODUCTO
// ─────────────────────────────────────────────────────────────────────────────
async function crearProducto(tenantId: string, args: any): Promise<{ html: string; text: string }> {
  const codigo = str(args.codigo || args.codigoPrincipal).trim();
  const nombre = str(args.nombre).trim();
  const precio = num(args.precio ?? args.precioUnitario ?? args.precio);
  const iva = Math.round(num(args.iva ?? args.ivaPorcentaje ?? 15));
  const stock = num(args.stock ?? 0);
  const descripcion = str(args.descripcion);

  if (!codigo || !nombre || precio <= 0) {
    return {
      html: '<strong>Faltan datos del producto.</strong><br/>Necesito: <strong>código</strong>, <strong>nombre</strong> y <strong>precio</strong> (mayor a 0). Opcionales: IVA (%), stock, descripción.',
      text: 'Faltan datos del producto. Necesito código, nombre y precio.',
    };
  }

  const existente = await db.queryOne<any>(
    'SELECT id FROM productos WHERE tenant_id = $1 AND codigo = $2',
    [tenantId, codigo]
  );
  if (existente) {
    return {
      html: `<strong>El producto "${escapeHtml(codigo)}" ya existe.</strong><br/>Si quieres actualizar su precio o stock, dime los nuevos valores.`,
      text: `El producto ${codigo} ya existe.`,
    };
  }

  const ahora = new Date();
  const producto = await db.insert(
    'productos',
    {
      id: randomUUID(),
      tenant_id: tenantId,
      codigo,
      nombre,
      descripcion: descripcion || null,
      precio_unitario: precio,
      iva_porcentaje: iva,
      stock,
      activo: true,
      created_at: ahora,
      updated_at: ahora,
    },
    'id'
  );

  return {
    html: `<strong>Producto creado.</strong><br/>• Código: <strong>${escapeHtml(codigo)}</strong><br/>• Nombre: <strong>${escapeHtml(nombre)}</strong><br/>• Precio: ${fmtMonto(precio)} (IVA ${iva}%)<br/>• Stock: <strong>${stock}</strong>${producto ? '' : '<br/>Nota: no se pudo confirmar el registro en la base.'}`,
    text: `Producto ${codigo} creado a ${fmtMonto(precio)} con stock ${stock}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR PRODUCTOS
// ─────────────────────────────────────────────────────────────────────────────
async function listarProductos(tenantId: string, args: any): Promise<{ html: string; text: string }> {
  const termino = str(args.termino ?? args.busqueda ?? '').trim();
  const conditions = ['tenant_id = $1', 'activo = true'];
  const params: any[] = [tenantId];
  if (termino) {
    conditions.push('(LOWER(codigo) LIKE LOWER($2) OR LOWER(nombre) LIKE LOWER($2))');
    params.push(`%${termino}%`);
  }
  const rows = await db.queryAll<any>(
    `SELECT codigo, nombre, precio_unitario, iva_porcentaje, stock, descripcion
     FROM productos WHERE ${conditions.join(' AND ')}
     ORDER BY nombre ASC LIMIT 20`,
    params
  );

  if (rows.length === 0) {
    return {
      html: '<strong>No hay productos</strong> en tu inventario' + (termino ? ` que coincidan con "<strong>${escapeHtml(termino)}</strong>"` : '') + '.<br/>Puedes pedirme que cree uno: "agrega el producto X con precio Y y stock Z".',
      text: `No hay productos${termino ? ` que coincidan con "${termino}"` : ''}.`,
    };
  }

  const lineas = rows.map((p) =>
    `• <strong>${escapeHtml(str(p.nombre))}</strong> (${escapeHtml(str(p.codigo))}) — ${fmtMonto(p.precio_unitario)} + IVA ${num(p.iva_porcentaje)}% · stock <strong>${num(p.stock)}</strong>`
  );
  const html = `<strong>${rows.length} producto(s):</strong>${listToHtml(lineas)}`;
  const text = `${rows.length} producto(s) en inventario.`;
  return { html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREAR CONTACTO (cliente/proveedor)
// ─────────────────────────────────────────────────────────────────────────────
async function crearContacto(tenantId: string, args: any): Promise<{ html: string; text: string }> {
  const tipoIdentificacion = str(args.tipoIdentificacion ?? args.tipoId ?? (str(args.identificacion).length === 13 ? '04' : '05'));
  const identificacion = str(args.identificacion).trim();
  const razonSocial = str(args.razonSocial ?? args.nombre).trim();
  const email = str(args.email);
  const telefono = str(args.telefono);
  const direccion = str(args.direccion);
  const esCliente = args.esCliente === false ? false : true;
  const esProveedor = args.esProveedor === true;

  if (!identificacion || !razonSocial) {
    return {
      html: '<strong>Faltan datos del contacto.</strong><br/>Necesito: <strong>identificación</strong> (RUC o cédula) y <strong>razón social / nombre</strong>. Opcionales: email, teléfono, dirección.',
      text: 'Faltan datos del contacto. Necesito identificación y razón social.',
    };
  }

  const existente = await db.queryOne<any>(
    'SELECT id, razon_social FROM contactos WHERE tenant_id = $1 AND identificacion = $2',
    [tenantId, identificacion]
  );
  if (existente) {
    return {
      html: `<strong>El contacto ${escapeHtml(identificacion)} ya existe:</strong> ${escapeHtml(str(existente.razon_social))}.<br/>Puedo usarlo para facturar a crédito si lo mencionas.`,
      text: `El contacto ${identificacion} ya existe.`,
    };
  }

  const ahora = new Date();
  await db.insert(
    'contactos',
    {
      id: randomUUID(),
      tenant_id: tenantId,
      tipo_identificacion: tipoIdentificacion,
      identificacion,
      razon_social: razonSocial,
      email: email || null,
      telefono: telefono || null,
      direccion: direccion || null,
      es_cliente: esCliente,
      es_proveedor: esProveedor,
      activo: true,
      created_at: ahora,
      updated_at: ahora,
    },
    'id'
  );

  return {
    html: `<strong>Contacto creado:</strong> ${escapeHtml(razonSocial)} (${escapeHtml(identificacion)}) — ${esCliente ? 'cliente' : ''}${esProveedor ? ' / proveedor' : ''}.<br/>Ya puedo usarlo al emitir facturas.`,
    text: `Contacto ${razonSocial} (${identificacion}) creado.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EMITIR FACTURA ELECTRÓNICA
// ─────────────────────────────────────────────────────────────────────────────

/** Genera el siguiente secuencial de factura (tabla secuenciales), igual que POS/Ecommerce. */
async function generarSiguienteSecuencial(emisor: { id: string; establecimiento: string; punto_emision: string }): Promise<string | null> {
  if (!emisor?.id) return null;
  const estab = String(emisor.establecimiento).padStart(3, '0');
  const ptoEmi = String(emisor.punto_emision).padStart(3, '0');

  return db.transaction<string>(async (client) => {
    const usesPostgres = Boolean(process.env.DATABASE_URL);
    if (usesPostgres) {
      await client.query(
        `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial)
         VALUES ($1, '01', $2, 1)
         ON CONFLICT (emisor_id, tipo_comprobante, serie)
         DO UPDATE SET ultimo_secuencial = secuenciales.ultimo_secuencial + 1, updated_at = NOW()`,
        [emisor.id, `${estab}-${ptoEmi}`]
      );
      const res = await client.query(
        `SELECT ultimo_secuencial FROM secuenciales
         WHERE emisor_id = $1 AND tipo_comprobante = '01' AND serie = $2`,
        [emisor.id, `${estab}-${ptoEmi}`]
      );
      return String(res.rows[0].ultimo_secuencial).padStart(9, '0');
    }
    await client.query(
      `INSERT INTO secuenciales (emisor_id, tipo_comprobante, serie, ultimo_secuencial)
       VALUES (?, '01', ?, 1)
       ON DUPLICATE KEY UPDATE ultimo_secuencial = ultimo_secuencial + 1, updated_at = NOW()`,
      [emisor.id, `${estab}-${ptoEmi}`]
    );
    const [rows] = await client.query(
      `SELECT ultimo_secuencial FROM secuenciales
       WHERE emisor_id = ? AND tipo_comprobante = '01' AND serie = ?`,
      [emisor.id, `${estab}-${ptoEmi}`]
    );
    return String((rows as any[])[0].ultimo_secuencial).padStart(9, '0');
  });
}

interface ClienteResuelto {
  tipoIdentificacion: string;
  identificacion: string;
  razonSocial: string;
  email: string;
}

/** Resuelve el comprador: completa desde contactos si solo dan la identificación. */
async function resolverClienteFactura(
  tenantId: string,
  clienteRaw: any
): Promise<{ cliente?: ClienteResuelto; error?: { html: string; text: string } }> {
  let cliente = clienteRaw || {};
  const cliIdentificacion = str(cliente.identificacion || cliente.identificacionComprador).trim();
  const cliRazon = str(cliente.razonSocial || cliente.razonSocialComprador || cliente.nombre).trim();

  if (cliIdentificacion && !cliRazon) {
    const contacto = await db.queryOne<any>(
      `SELECT tipo_identificacion, identificacion, razon_social, email, direccion
       FROM contactos
       WHERE tenant_id = $1 AND identificacion = $2 AND activo = true`,
      [tenantId, cliIdentificacion]
    );
    if (contacto) {
      cliente = {
        tipoIdentificacion: cliente.tipoIdentificacion || contacto.tipo_identificacion,
        identificacion: contacto.identificacion,
        razonSocial: cliente.razonSocial || contacto.razon_social,
        email: cliente.email || contacto.email || undefined,
        direccion: cliente.direccion || contacto.direccion || undefined,
      };
    }
  }

  const tipoIdentificacion = str(cliente.tipoIdentificacion || '05');
  const identificacion = cliIdentificacion || str(cliente.identificacion).trim();
  const razonSocial = cliRazon || str(cliente.razonSocial).trim();
  const email = str(cliente.email);

  if (!identificacion || !razonSocial) {
    return {
      error: {
        html: '<strong>Faltan datos del comprador.</strong><br/>Dame la <strong>identificación</strong> (RUC o cédula) y la <strong>razón social</strong> del cliente, o indica que ya está registrado como contacto.',
        text: 'Faltan datos del comprador: identificación y razón social.',
      },
    };
  }
  return { cliente: { tipoIdentificacion, identificacion, razonSocial, email } };
}

/** Resuelve ítems de un comprobante: busca en inventario por código o nombre si falta precio/descripción. */
async function resolverItemsFactura(
  tenantId: string,
  args: any
): Promise<{ items?: any[]; error?: { html: string; text: string } }> {
  const itemsRaw: any[] = Array.isArray(args.items) ? args.items : args.detalles || [];
  if (itemsRaw.length === 0 && str(args.producto).length > 0) {
    itemsRaw.push({ producto: args.producto, cantidad: args.cantidad || 1, precio: args.precio });
  }
  if (itemsRaw.length === 0) {
    return {
      error: {
        html: '<strong>No hay productos en el comprobante.</strong><br/>Indícame qué productos incluir (puedes usar los códigos de tu inventario o describirlos con precio y cantidad).',
        text: 'No hay productos en el comprobante.',
      },
    };
  }

  const items: any[] = [];
  for (const raw of itemsRaw) {
    const codigo = str(raw.codigo || raw.codigoPrincipal || '').trim();
    const descripcion = str(raw.descripcion || raw.nombre || '').trim();
    let cantidad = num(raw.cantidad);
    const precio = num(raw.precio ?? raw.precioUnitario);
    const iva = num(raw.iva ?? raw.ivaPorcentaje ?? 15);

    // Buscar en inventario por código o nombre
    if (!precio || !descripcion) {
      let qProducto: string;
      let pProducto: any[];
      if (codigo) {
        qProducto = `SELECT codigo, nombre, precio_unitario, iva_porcentaje, stock
                     FROM productos
                     WHERE tenant_id = $1 AND activo = true
                       AND (codigo = $2 OR LOWER(nombre) LIKE LOWER($3))
                     LIMIT 1`;
        pProducto = [tenantId, codigo, `%${descripcion || codigo}%`];
      } else {
        qProducto = `SELECT codigo, nombre, precio_unitario, iva_porcentaje, stock
                     FROM productos
                     WHERE tenant_id = $1 AND activo = true
                       AND LOWER(nombre) LIKE LOWER($2)
                     LIMIT 1`;
        pProducto = [tenantId, `%${descripcion || codigo}%`];
      }
      const producto = await db.queryOne<any>(qProducto, pProducto);
      if (producto) {
        items.push({
          codigo: producto.codigo,
          descripcion: producto.nombre,
          cantidad: cantidad || 1,
          precioUnitario: num(producto.precio_unitario),
          ivaPorcentaje: num(producto.iva_porcentaje),
          stock: num(producto.stock),
        });
        continue;
      }
    }

    if (cantidad <= 0) cantidad = 1;
    if (precio <= 0 || !descripcion) {
      return {
        error: {
          html: `<strong>No encontré el producto "${escapeHtml(descripcion || codigo)}".</strong><br/>Indícame su precio y descripción, o usa el código de inventario.`,
          text: `No encontré el producto ${descripcion || codigo}.`,
        },
      };
    }
    items.push({ codigo: codigo || 'SINCOD', descripcion, cantidad, precioUnitario: precio, ivaPorcentaje: iva });
  }
  return { items };
}

/** Calcula subtotal, IVA por tarifa e importe total a partir de los ítems resueltos. */
function calcularTotalesItems(items: any[]) {
  let subtotal = 0;
  const ivaMap = new Map<number, { base: number; valor: number }>();
  const detalles = items.map((it) => {
    const base = num(it.cantidad) * num(it.precioUnitario);
    const desc = 0;
    const valorIva = base * num(it.ivaPorcentaje) / 100;
    subtotal += base;
    const e = ivaMap.get(num(it.ivaPorcentaje)) || { base: 0, valor: 0 };
    e.base += base;
    e.valor += valorIva;
    ivaMap.set(num(it.ivaPorcentaje), e);
    return {
      codigoPrincipal: it.codigo,
      descripcion: it.descripcion,
      cantidad: num(it.cantidad),
      precioUnitario: num(it.precioUnitario),
      descuento: desc,
      precioTotalSinImpuesto: Number(base.toFixed(2)),
      impuestos: [
        {
          codigo: '2',
          codigoPorcentaje: codigoPorcentajeIva(num(it.ivaPorcentaje)),
          tarifa: tarifaNormalizada(num(it.ivaPorcentaje)),
          baseImponible: Number(base.toFixed(2)),
          valor: Number(valorIva.toFixed(2)),
        },
      ],
    };
  });

  const totalConImpuestos = Array.from(ivaMap.entries()).map(([tarifa, v]) => ({
    codigo: '2',
    codigoPorcentaje: codigoPorcentajeIva(tarifa),
    tarifa: tarifaNormalizada(tarifa),
    baseImponible: Number(v.base.toFixed(2)),
    valor: Number(v.valor.toFixed(2)),
  }));
  const totalIVA = totalConImpuestos.reduce((s, t) => s + num(t.valor), 0);
  const importeTotal = Number((subtotal + totalIVA).toFixed(2));

  return { detalles, totalConImpuestos, totalIVA, importeTotal, subtotal: Number(subtotal.toFixed(2)) };
}

async function emitirFactura(ctx: AiToolContext, args: any): Promise<{ html: string; text: string }> {
  const emisorRuc = str(args.emisorRuc).trim() || ctx.userRuc;

  // Resolver emisor para secuencial y obligadoContabilidad
  const emisor = await db.queryOne<any>(
    `SELECT id, establecimiento, punto_emision, obligado_contabilidad
     FROM emisores WHERE ruc = $1 AND tenant_id = $2 AND activo = true`,
    [ctx.tenantId, emisorRuc]
  );
  const secuencial = emisor ? await generarSiguienteSecuencial(emisor) : null;
  const serie = emisor
    ? `${String(emisor.establecimiento).padStart(3, '0')}-${String(emisor.punto_emision).padStart(3, '0')}`
    : '';

  const clienteRes = await resolverClienteFactura(ctx.tenantId, args.cliente || args.comprador);
  if (clienteRes.error) return clienteRes.error;
  const { tipoIdentificacion, identificacion, razonSocial, email } = clienteRes.cliente!;

  const itemsRes = await resolverItemsFactura(ctx.tenantId, args);
  if (itemsRes.error) return itemsRes.error;
  const items = itemsRes.items!;

  const totales = calcularTotalesItems(items);
  const plazo = num(args.plazo ?? 0);
  const fechaEmision = str(args.fechaEmision) || new Date().toISOString().split('T')[0];
  const formaPago = str(args.formaPago || (plazo > 0 ? '15' : '01'));

  const datos = {
    fechaEmision,
    secuencial: secuencial || undefined,
    obligadoContabilidad: emisor?.obligado_contabilidad || 'NO',
    tipoIdentificacionComprador: tipoIdentificacion,
    identificacionComprador: identificacion,
    razonSocialComprador: razonSocial,
    emailComprador: email || undefined,
    totalSinImpuestos: totales.subtotal,
    totalDescuento: 0,
    importeTotal: totales.importeTotal,
    totalConImpuestos: totales.totalConImpuestos,
    pagos: [{ formaPago, total: totales.importeTotal, ...(plazo > 0 ? { plazo, unidadTiempo: 'dias' } : {}) }],
    detalles: totales.detalles,
  };

  // Enviar al endpoint de emisión (reutiliza firma, SRI y auto-CxC)
  const res = await fetch(`${ctx.baseUrl}/api/sri/emitir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.token}`,
    },
    body: JSON.stringify({ tipo: '01', emisorRuc, datos }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const msg = str(data.message || data.error?.mensaje || 'No se pudo emitir la factura');
    return {
      html: `<strong>No se pudo emitir la factura.</strong><br/>${escapeHtml(msg)}`,
      text: `No se pudo emitir la factura: ${msg}`,
    };
  }

  const estado = str(data.estado);
  const autorizada = data.numeroAutorizacion || estado === 'AUTORIZADO' || estado === 'EN_PROCESO';

  let lineas = `<br/>• Cliente: <strong>${escapeHtml(razonSocial)}</strong> (${escapeHtml(identificacion)})`;
  if (secuencial) lineas += `<br/>• Documento: <code>${escapeHtml(serie)}-${escapeHtml(secuencial)}</code>`;
  lineas += `<br/>• ${items.length} producto(s) · Total: <strong>${fmtMonto(totales.importeTotal)}</strong> (IVA ${fmtMonto(totales.totalIVA)})`;
  lineas += `<br/>• Clave de acceso: <code>${escapeHtml(str(data.claveAcceso))}</code>`;
  if (data.numeroAutorizacion) lineas += `<br/>• N° Autorización: <code>${escapeHtml(str(data.numeroAutorizacion))}</code>`;
  if (plazo > 0) lineas += `<br/>• Crédito a <strong>${plazo}</strong> días — cuenta por cobrar generada automáticamente.`;
  if (estado) lineas += `<br/>• Estado SRI: <strong>${escapeHtml(estado)}</strong>`;

  return {
    html: `<strong>${autorizada ? '¡Factura emitida!' : 'Factura procesada.'}</strong>${lineas}`,
    text: `Factura emitida por ${fmtMonto(totales.importeTotal)} (${estado}). Clave ${data.claveAcceso}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EMITIR NOTA DE CRÉDITO
// ─────────────────────────────────────────────────────────────────────────────
async function emitirNotaCredito(ctx: AiToolContext, args: any): Promise<{ html: string; text: string }> {
  const emisorRuc = str(args.emisorRuc).trim() || ctx.userRuc;

  const clienteRes = await resolverClienteFactura(ctx.tenantId, args.cliente || args.comprador);
  if (clienteRes.error) return clienteRes.error;
  const cliente = clienteRes.cliente!;

  const itemsRes = await resolverItemsFactura(ctx.tenantId, args);
  if (itemsRes.error) return itemsRes.error;
  const totales = calcularTotalesItems(itemsRes.items!);

  // Documento modificado (obligatorio en toda NC)
  const docMod = args.docModificado || args.documentoModificado || {};
  const numDocMod = str(docMod?.numero ?? docMod?.numeroDocumento ?? args.numeroDocumento).trim();
  const fechaDocModRaw = str(docMod?.fecha ?? docMod?.fechaEmision ?? args.fechaDocumento).trim();
  if (!numDocMod || !fechaDocModRaw) {
    return {
      html: '<strong>Falta el documento a modificar.</strong><br/>Toda nota de crédito necesita el <strong>número</strong> de la factura (ej. 001-001-000000001) y su <strong>fecha de emisión</strong>. Ej.: "nota de crédito de la factura 001-001-000000012 emitida el 2026-08-10 por devolución del producto X".',
      text: 'Falta el número o fecha del documento modificado.',
    };
  }
  const motivo = str(args.motivo).trim();
  if (!motivo) {
    return {
      html: '<strong>Falta el motivo de la nota de crédito.</strong><br/>Indícame por qué se emite (ej. devolución de productos, error en el precio, descuento posterior).',
      text: 'Falta el motivo de la nota de crédito.',
    };
  }

  const fechaDocMod = normalizeIsoDate(fechaDocModRaw) || fechaDocModRaw;

  const dto = {
    emisor: { ruc: emisorRuc },
    fechaEmision: new Date().toISOString().split('T')[0],
    comprador: {
      tipoIdentificacion: cliente.tipoIdentificacion,
      razonSocial: cliente.razonSocial,
      identificacion: cliente.identificacion,
      email: cliente.email || undefined,
    },
    docModificado: { tipo: str(docMod?.tipo) || '01', numero: numDocMod, fecha: fechaDocMod },
    motivo,
    detalles: totales.detalles,
  };

  const res = await fetch(`${ctx.baseUrl}/api/sri/emitir/nota-credito`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.token}`,
    },
    body: JSON.stringify(dto),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const msg = str(data.message || data.error?.mensaje || 'No se pudo emitir la nota de crédito');
    return {
      html: `<strong>No se pudo emitir la nota de crédito.</strong><br/>${escapeHtml(msg)}`,
      text: `No se pudo emitir la nota de crédito: ${msg}`,
    };
  }

  const estado = str(data.estado);
  const autorizada = data.numeroAutorizacion || estado === 'AUTORIZADO';

  let lineas = `<br/>• Cliente: <strong>${escapeHtml(cliente.razonSocial)}</strong> (${escapeHtml(cliente.identificacion)})`;
  lineas += `<br/>• Modifica: <code>${escapeHtml(numDocMod)}</code> (${escapeHtml(fechaDocMod)})`;
  lineas += `<br/>• Motivo: ${escapeHtml(motivo)}`;
  lineas += `<br/>• ${itemsRes.items!.length} producto(s) · Valor modificación: <strong>${fmtMonto(totales.importeTotal)}</strong> (IVA ${fmtMonto(totales.totalIVA)})`;
  lineas += `<br/>• Clave de acceso: <code>${escapeHtml(str(data.claveAcceso))}</code>`;
  if (data.numeroAutorizacion) lineas += `<br/>• N° Autorización: <code>${escapeHtml(str(data.numeroAutorizacion))}</code>`;
  if (estado) lineas += `<br/>• Estado SRI: <strong>${escapeHtml(estado)}</strong>`;

  return {
    html: `<strong>${autorizada ? '¡Nota de crédito emitida!' : 'Nota de crédito procesada.'}</strong>${lineas}`,
    text: `Nota de crédito por ${fmtMonto(totales.importeTotal)} (${estado}). Clave ${data.claveAcceso}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSCAR CONTACTOS (clientes/proveedores)
// ─────────────────────────────────────────────────────────────────────────────
async function buscarContactos(tenantId: string, args: any): Promise<{ html: string; text: string }> {
  const termino = str(args.termino ?? args.busqueda ?? args.nombre ?? args.identificacion).trim();
  const tipo = str(args.tipo).toUpperCase();

  const conditions = ['tenant_id = $1', 'activo = true'];
  const params: any[] = [tenantId];
  if (termino) {
    params.push(`%${termino}%`);
    conditions.push(`(LOWER(razon_social) LIKE LOWER($${params.length}) OR identificacion LIKE $${params.length})`);
  }
  if (tipo === 'CLIENTE' || tipo === 'CLIENTES') conditions.push('es_cliente = true');
  if (tipo === 'PROVEEDOR' || tipo === 'PROVEEDORES') conditions.push('es_proveedor = true');

  const rows = await db.queryAll<any>(
    `SELECT tipo_identificacion, identificacion, razon_social, email, telefono, es_cliente, es_proveedor
     FROM contactos WHERE ${conditions.join(' AND ')}
     ORDER BY razon_social ASC LIMIT 15`,
    params
  );

  if (rows.length === 0) {
    return {
      html: `<strong>No encontré contactos</strong>${termino ? ` que coincidan con "<strong>${escapeHtml(termino)}</strong>"` : ''}.<br/>Puedo registrar uno nuevo: "registra el cliente X con RUC Y".`,
      text: `No hay contactos${termino ? ` que coincidan con "${termino}"` : ''}.`,
    };
  }

  const lineas = rows.map((c) => {
    const roles = [c.es_cliente ? 'cliente' : '', c.es_proveedor ? 'proveedor' : ''].filter(Boolean).join('/');
    return `• <strong>${escapeHtml(str(c.razon_social))}</strong> — ${escapeHtml(str(c.identificacion))} (${roles})${c.email ? ` · ${escapeHtml(str(c.email))}` : ''}${c.telefono ? ` · ${escapeHtml(str(c.telefono))}` : ''}`;
  });
  return {
    html: `<strong>${rows.length} contacto(s):</strong>${listToHtml(lineas)}`,
    text: `${rows.length} contacto(s) encontrados.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAR VENCIMIENTOS (aging de CxC/CxP)
// ─────────────────────────────────────────────────────────────────────────────
const AGING_LABELS: Record<AgingBucket, string> = {
  '0-30': '0–30 días',
  '31-60': '31–60 días',
  '61-90': '61–90 días',
  '90+': 'más de 90 días',
};

async function consultarVencimientos(tenantId: string, args: any): Promise<{ html: string; text: string }> {
  await marcarVencidas(tenantId);
  const tipo = ['COBRAR', 'PAGAR'].includes(str(args.tipo).toUpperCase()) ? str(args.tipo).toUpperCase() : 'TODAS';
  const tipos: ('COBRAR' | 'PAGAR')[] = tipo === 'TODAS' ? ['COBRAR', 'PAGAR'] : [tipo as 'COBRAR' | 'PAGAR'];

  let html = '';
  let totalGeneral = 0;
  const textParts: string[] = [];

  for (const t of tipos) {
    const aging = await resumenAging(tenantId, t);
    const buckets = (Object.keys(aging) as AgingBucket[]).filter((b) => aging[b].count > 0);
    const totalTipo = buckets.reduce((s, b) => s + aging[b].monto, 0);
    totalGeneral += totalTipo;
    const etiqueta = t === 'COBRAR' ? 'por cobrar' : 'por pagar';

    if (!buckets.length) {
      html += `<br/><br/><strong>Cuentas ${etiqueta}:</strong> sin saldos pendientes. 🎉`;
      continue;
    }

    html += `<br/><br/><strong>Cuentas ${etiqueta}:</strong> ${fmtMonto(totalTipo)} pendiente`;
    for (const b of buckets) {
      html += `<br/>• ${AGING_LABELS[b]}: <strong>${fmtMonto(aging[b].monto)}</strong> (${aging[b].count} cuenta(s))`;
    }
    textParts.push(`${fmtMonto(totalTipo)} ${etiqueta}`);
  }

  // Top cuentas vencidas
  const vencidas = await db.queryAll<any>(
    `(SELECT numero_documento, cliente_nombre AS nombre, saldo_pendiente, fecha_vencimiento, 'COBRAR' AS tipo
      FROM cuentas_por_cobrar WHERE tenant_id = $1 AND estado = 'VENCIDO' AND saldo_pendiente > 0)
     UNION ALL
     (SELECT numero_documento, proveedor_nombre AS nombre, saldo_pendiente, fecha_vencimiento, 'PAGAR' AS tipo
      FROM cuentas_por_pagar WHERE tenant_id = $1 AND estado = 'VENCIDO' AND saldo_pendiente > 0)
     ORDER BY fecha_vencimiento ASC LIMIT 5`,
    [tenantId]
  );
  if (vencidas.length > 0) {
    html += `<br/><br/><strong>Vencidas (las más antiguas):</strong>`;
    for (const v of vencidas) {
      const dias = v.fecha_vencimiento
        ? Math.max(0, Math.floor((Date.now() - new Date(v.fecha_vencimiento).getTime()) / 86400000))
        : 0;
      html += `<br/>• <code>${escapeHtml(str(v.numero_documento))}</code> ${escapeHtml(str(v.nombre))} — <strong>${fmtMonto(v.saldo_pendiente)}</strong> (${dias} días, ${v.tipo === 'COBRAR' ? 'cobrar' : 'pagar'})`;
    }
  }

  const link = tipo === 'PAGAR' ? '/cuentas-por-pagar' : '/cuentas-por-cobrar';
  html += `<br/><br/>Ver detalle en <a href="${link}" class="underline font-semibold">${tipo === 'PAGAR' ? 'Cuentas por pagar' : 'Cuentas por cobrar'}</a>.`;

  return {
    html: `<strong>Antigüedad de saldos:</strong>${html}`,
    text: `Vencimientos: ${textParts.join(' · ') || 'sin saldos'}. Total ${fmtMonto(totalGeneral)}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAR ESTADO DE DESCARGA SRI
// ─────────────────────────────────────────────────────────────────────────────
const ESTADO_DESCARGA_LABELS: Record<string, string> = {
  PENDING: 'En cola',
  PROCESSING: 'En proceso',
  COMPLETED: 'Completada',
  ERROR: 'Error',
  CANCELLED: 'Cancelada',
};

async function consultarEstadoDescarga(tenantId: string, args: any): Promise<{ html: string; text: string }> {
  const jobId = parseInt(str(args.jobId), 10);

  if (!isNaN(jobId)) {
    const job = await db.queryOne<any>(
      `SELECT id, status, ruc, fecha_desde, fecha_hasta, tipo_comprobante, created_at, updated_at
       FROM scraping_jobs WHERE id = $1 AND tenant_id = $2`,
      [jobId, tenantId]
    );
    if (!job) {
      return {
        html: `<strong>No encontré la tarea de descarga #${jobId}.</strong><br/>Verifica el número o consulta las descargas recientes.`,
        text: `Tarea ${jobId} no encontrada.`,
      };
    }
    let logsHtml = '';
    try {
      const logs = await db.queryAll<any>(
        `SELECT level, message FROM scraping_job_logs WHERE job_id = $1 ORDER BY id DESC LIMIT 5`,
        [jobId]
      );
      if (logs.length > 0) {
        logsHtml = '<br/><br/><strong>Últimos pasos:</strong>';
        for (const l of [...logs].reverse()) {
          logsHtml += `<br/>• ${escapeHtml(str(l.message).slice(0, 140))}`;
        }
      }
    } catch {
      // tabla de logs puede no existir aún
    }
    const estadoLabel = ESTADO_DESCARGA_LABELS[str(job.status)] || str(job.status);
    return {
      html: `<strong>Descarga #${job.id} — ${escapeHtml(estadoLabel)}</strong><br/>• Período: ${formatoFechaEspanol(str(job.fecha_desde))} al ${formatoFechaEspanol(str(job.fecha_hasta))}<br/>• Tipo: ${escapeHtml(descripcionTipoComprobante(str(job.tipo_comprobante)))}${logsHtml}<br/><br/>Ver en el <a href="/documentos?descargas=1" class="underline font-semibold">Historial de descargas</a>.`,
      text: `Descarga #${job.id}: ${estadoLabel}.`,
    };
  }

  const jobs = await db.queryAll<any>(
    `SELECT id, status, fecha_desde, fecha_hasta, tipo_comprobante, created_at
     FROM scraping_jobs WHERE tenant_id = $1
     ORDER BY created_at DESC LIMIT 5`,
    [tenantId]
  );

  if (jobs.length === 0) {
    return {
      html: '<strong>No tienes descargas del SRI registradas.</strong><br/>Puedes pedirme: "descarga mis facturas de agosto 2026".',
      text: 'No hay descargas registradas.',
    };
  }

  const lineas = jobs.map((j) => {
    const estadoLabel = ESTADO_DESCARGA_LABELS[str(j.status)] || str(j.status);
    return `• <strong>#${j.id}</strong> — ${escapeHtml(estadoLabel)} · ${formatoFechaEspanol(str(j.fecha_desde))} al ${formatoFechaEspanol(str(j.fecha_hasta))} · ${escapeHtml(descripcionTipoComprobante(str(j.tipo_comprobante)))}`;
  });
  const activa = jobs.find((j) => ['PENDING', 'PROCESSING'].includes(str(j.status)));

  return {
    html: `<strong>Últimas descargas del SRI:</strong>${listToHtml(lineas)}<br/><br/>Ver en el <a href="/documentos?descargas=1" class="underline font-semibold">Historial de descargas</a>.`,
    text: activa
      ? `La descarga #${activa.id} está ${ESTADO_DESCARGA_LABELS[str(activa.status)]?.toLowerCase()}.`
      : `${jobs.length} descarga(s) recientes.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRAR PAGO EN CUENTA (CxC/CxP)
// ─────────────────────────────────────────────────────────────────────────────
async function registrarPago(ctx: AiToolContext, args: any): Promise<{ html: string; text: string }> {
  const tipoCuenta = (str(args.tipoCuenta || args.tipo).toUpperCase() === 'PAGAR' || str(args.tipo).toUpperCase() === 'CXP')
    ? 'PAGAR' : 'COBRAR';
  const monto = num(args.monto ?? args.valor);
  const fecha = str(args.fecha) || new Date().toISOString().split('T')[0];
  const metodoPago = str(args.metodoPago || args.metodo) || 'EFECTIVO';
  const referencia = str(args.referencia);
  const notas = str(args.notas);

  if (monto <= 0) {
    return { html: '<strong>Indícame el monto del pago.</strong>', text: 'Falta el monto del pago.' };
  }

  const numDoc = str(args.numeroDocumento || args.documento || '').trim();
  const identificacion = str(args.identificacion || args.clienteIdentificacion || args.proveedorIdentificacion || '').trim();
  const cuentaId = str(args.cuentaId || args.id || '').trim();

  // 1. Buscar por ID
  let cuenta = null;
  if (cuentaId) {
    cuenta = tipoCuenta === 'COBRAR'
      ? await db.queryOne<any>(`SELECT * FROM cuentas_por_cobrar WHERE tenant_id = $1 AND id = $2`, [ctx.tenantId, cuentaId])
      : await db.queryOne<any>(`SELECT * FROM cuentas_por_pagar WHERE tenant_id = $1 AND id = $2`, [ctx.tenantId, cuentaId]);
  }

  // 2. Buscar por número de documento
  if (!cuenta && numDoc) {
    cuenta = tipoCuenta === 'COBRAR'
      ? await db.queryOne<any>(`SELECT * FROM cuentas_por_cobrar WHERE tenant_id = $1 AND numero_documento = $2 AND estado NOT IN ('PAGADO','ANULADO') ORDER BY fecha_emision DESC LIMIT 1`, [ctx.tenantId, numDoc])
      : await db.queryOne<any>(`SELECT * FROM cuentas_por_pagar WHERE tenant_id = $1 AND numero_documento = $2 AND estado NOT IN ('PAGADO','ANULADO') ORDER BY fecha_emision DESC LIMIT 1`, [ctx.tenantId, numDoc]);
  }

  // 3. Buscar por identificación del cliente/proveedor
  if (!cuenta && identificacion) {
    const col = tipoCuenta === 'COBRAR' ? 'cliente_identificacion' : 'proveedor_identificacion';
    cuenta = tipoCuenta === 'COBRAR'
      ? await db.queryOne<any>(`SELECT * FROM cuentas_por_cobrar WHERE tenant_id = $1 AND cliente_identificacion = $2 AND estado NOT IN ('PAGADO','ANULADO') ORDER BY fecha_emision DESC LIMIT 1`, [ctx.tenantId, identificacion])
      : await db.queryOne<any>(`SELECT * FROM cuentas_por_pagar WHERE tenant_id = $1 AND proveedor_identificacion = $2 AND estado NOT IN ('PAGADO','ANULADO') ORDER BY fecha_emision DESC LIMIT 1`, [ctx.tenantId, identificacion]);
  }

  if (!cuenta) {
    return {
      html: `<strong>No encontré una cuenta por ${tipoCuenta === 'COBRAR' ? 'cobrar' : 'pagar'} pendiente</strong> con los datos indicados.<br/>Dame el número de documento (ej. 001-001-000000001) o la identificación del ${tipoCuenta === 'COBRAR' ? 'cliente' : 'proveedor'}, o el ID de la cuenta.`,
      text: 'No encontré la cuenta indicada.',
    };
  }

  if (num(cuenta.saldo_pendiente) <= 0) {
    return { html: '<strong>Esa cuenta ya está pagada.</strong>', text: 'La cuenta ya está pagada.' };
  }

  const resultado = tipoCuenta === 'COBRAR'
    ? await registrarPagoCobrar(ctx.tenantId, cuenta.id, { fecha, monto, metodoPago, referencia, notas })
    : await registrarPagoPagar(ctx.tenantId, cuenta.id, { fecha, monto, metodoPago, referencia, notas });

  const nombre = tipoCuenta === 'COBRAR' ? cuenta.cliente_nombre : cuenta.proveedor_nombre;
  const aplicado = num(resultado.montoAplicado);
  const saldo = num(resultado.saldoPendiente);

  return {
    html: `<strong>Pago registrado.</strong><br/>• Cuenta por ${tipoCuenta === 'COBRAR' ? 'cobrar' : 'pagar'}: <strong>${escapeHtml(str(cuenta.numero_documento || '—'))}</strong> — ${escapeHtml(str(nombre))}<br/>• Monto aplicado: <strong>${fmtMonto(aplicado)}</strong> (${escapeHtml(metodoPago)})<br/>• Saldo pendiente: <strong>${fmtMonto(saldo)}</strong><br/>• Estado: <strong>${escapeHtml(str(resultado.estado))}</strong>`,
    text: `Pago de ${fmtMonto(aplicado)} registrado. Saldo ${fmtMonto(saldo)}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAR CUENTAS (CxC/CxP)
// ─────────────────────────────────────────────────────────────────────────────
async function consultarCuentas(tenantId: string, args: any): Promise<{ html: string; text: string }> {
  await marcarVencidas(tenantId).catch(() => {});
  const resumen = await obtenerResumenCuentas(tenantId);

  const tipo = str(args.tipo || args.consulta || '').toUpperCase();
  const tipoCxc = tipo === '' || tipo === 'COBRAR' || tipo === 'CXC';
  const tipoCxp = tipo === '' || tipo === 'PAGAR' || tipo === 'CXP';
  const limite = Math.min(num(args.limite ?? 5), 10);

  const lineas: string[] = [];

  if (tipoCxc) {
    const cxc = resumen.porCobrar;
    const vencidas = await listarCuentasPorCobrar(tenantId, { estado: 'VENCIDO', limite });
    lineas.push(`<strong>Cuentas por Cobrar:</strong> saldo ${fmtMonto(cxc.saldoPorCobrar)} · vencido ${fmtMonto(cxc.saldoVencido)} · ${cxc.pendientes} pendiente(s) de ${cxc.totalCuentas}`);
    if (vencidas.rows.length > 0) {
      lineas.push(`Vencidas:${vencidas.rows.slice(0, limite).map((c: any) => `<br/>• <strong>${escapeHtml(str(c.cliente_nombre))}</strong> (${escapeHtml(str(c.numero_documento || '—'))}) — ${fmtMonto(c.saldo_pendiente)} · vence ${str(c.fecha_vencimiento)}`).join('')}`);
    }
  }

  if (tipoCxp) {
    const cxp = resumen.porPagar;
    const porPagar = await listarCuentasPorPagar(tenantId, { estado: 'PENDIENTE', limite });
    lineas.push(`<strong>Cuentas por Pagar:</strong> saldo ${fmtMonto(cxp.saldoPorPagar)} · vencido ${fmtMonto(cxp.saldoVencido)} · ${cxp.pendientes} pendiente(s) de ${cxp.totalCuentas}`);
    if (porPagar.rows.length > 0) {
      lineas.push(`Próximas:${porPagar.rows.slice(0, limite).map((c: any) => `<br/>• <strong>${escapeHtml(str(c.proveedor_nombre))}</strong> (${escapeHtml(str(c.numero_documento || '—'))}) — ${fmtMonto(c.saldo_pendiente)} · vence ${str(c.fecha_vencimiento)}`).join('')}`);
    }
  }

  if (lineas.length === 0) {
    return { html: '<strong>No hay cuentas registradas.</strong>', text: 'No hay cuentas registradas.' };
  }

  return {
    html: `<strong>Resumen de cuentas:</strong><br/>${lineas.join('<br/><br/>')}`,
    text: lineas.join(' · ').replace(/<[^>]+>/g, ''),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAR SISTEMA (RAG multi-módulo)
// ─────────────────────────────────────────────────────────────────────────────
async function consultarSistemaRag(
  tenantId: string,
  args: any
): Promise<{ html: string; text: string }> {
  const pregunta = str(args.pregunta || args.query || args.consulta).trim();
  if (!pregunta) {
    return {
      html: '<strong>Indica la pregunta.</strong><br/>Ejemplos: ¿Cuál es la cuenta 1.1.01? ¿Qué asientos hay en marzo? ¿Datos del empleado con cédula…?',
      text: 'Indica la pregunta a consultar en el sistema (plan de cuentas, asientos, etc.).',
    };
  }

  // Defensa: consultas tributarias no deben pasar por embeddings RAG
  const taxLike =
    /\b(iva|obligaci[oó]n|rimpe|declaraci[oó]n|retenci[oó]n|formulario\s*10[34]|saldo a favor|cu[aá]nto debo)\b/i.test(
      pregunta
    );
  if (taxLike && !/\b(plan de cuentas|asiento)\b/i.test(pregunta)) {
    return {
      html: '<strong>Esa consulta es tributaria.</strong><br/>Pregúntala de nuevo en el chat (IVA, obligaciones, retenciones); se responde con tus datos SRI del período, no con el índice contable.',
      text: 'Consulta tributaria: reformula en el chat para usar el resumen SRI, no el RAG contable.',
    };
  }

  const config = getConfig();
  if (!config.enabled) {
    return {
      html: '<strong>Búsqueda semántica no disponible.</strong><br/>Para plan de cuentas/asientos, activa <code>OLLAMA_ENABLED=true</code> y reindexa en Contabilidad → Consulta RAG. Para IVA y obligaciones, pregunta directamente en el chat.',
      text: 'Búsqueda semántica no habilitada (OLLAMA_ENABLED).',
    };
  }

  try {
    const result = await queryRag(tenantId, pregunta, {
      threshold: 0.5,
      topK: 8,
      generate: true,
    });

    if (result.sources.length === 0) {
      return {
        html: `<strong>Sin resultados RAG</strong> para: “${escapeHtml(pregunta)}”.<br/>Prueba reformular o reindexar en Contabilidad → Consulta RAG.`,
        text: `Sin resultados RAG para: ${pregunta}`,
      };
    }

    const fuentes = result.sources
      .slice(0, 5)
      .map(
        (s) =>
          `• <strong>${escapeHtml(s.tipo)}</strong>${s.referenciaId != null ? ` #${s.referenciaId}` : ''} (${Math.round(s.score * 100)}%)`
      )
      .join('<br/>');

    const respuesta = result.answer
      ? escapeHtml(result.answer).replace(/\n/g, '<br/>')
      : '<em>No se pudo generar respuesta; se muestran solo fuentes.</em>';

    return {
      html: `<strong>Consulta al sistema</strong><br/><br/>${respuesta}<br/><br/><strong>Fuentes:</strong><br/>${fuentes}`,
      text: result.answer || result.sources.map((s) => s.contenido).join(' | '),
    };
  } catch (err: any) {
    const msg = err?.message || 'Error en consulta RAG';
    return {
      html: `<strong>Error en consulta RAG.</strong><br/>${escapeHtml(msg)}`,
      text: `Error RAG: ${msg}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROYECCIÓN FISCAL
// ─────────────────────────────────────────────────────────────────────────────
async function proyeccionFiscal(
  tenantId: string,
  userRuc: string,
  args: any
): Promise<{ html: string; text: string }> {
  const meses = Math.min(Math.max(num(args.meses ?? args.horizon ?? 3) || 3, 1), 12);
  const comprobantes = await fetchTenantComprobantes(tenantId, userRuc);
  if (!comprobantes.length) {
    return {
      html: '<strong>Sin comprobantes para proyectar.</strong><br/>Descarga o importa facturas del SRI y vuelve a pedir la proyección fiscal.',
      text: 'Sin comprobantes para proyectar.',
    };
  }
  const proj = buildFiscalProjection(comprobantes, userRuc, meses);
  return formatFiscalProjectionHtml(proj);
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICAR COMPROBANTE EN EL SRI
// ─────────────────────────────────────────────────────────────────────────────
async function verificarComprobante(ctx: AiToolContext, args: any): Promise<{ html: string; text: string }> {
  const clave = str(args.claveAcceso ?? args.clave ?? args.claveDeAcceso).replace(/\s+/g, '').trim();

  if (!clave) {
    return {
      html: '<strong>Indícame la clave de acceso</strong> del comprobante (49 dígitos).<br/>Aparece impresa en el PDF de la factura o nota de crédito, y en Comprobantes → detalle.',
      text: 'Falta la clave de acceso del comprobante.',
    };
  }
  if (!/^\d{49}$/.test(clave)) {
    return {
      html: `<strong>La clave de acceso debe tener exactamente 49 dígitos</strong> (recibí ${clave.length}).<br/>Revísala en el PDF del comprobante o en Comprobantes → detalle.`,
      text: 'La clave de acceso debe tener 49 dígitos.',
    };
  }

  const res = await fetch(`${ctx.baseUrl}/api/sri/verificar/${clave}`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = str(data.message || data.error?.mensaje || 'No se pudo verificar el comprobante');
    return {
      html: `<strong>No se pudo verificar en el SRI.</strong><br/>${escapeHtml(msg)}`,
      text: `No se pudo verificar en el SRI: ${msg}`,
    };
  }

  const estadoSri = str(data.estado);
  const estadoLocal = str(data.estadoLocal);

  if (!data.existeEnSri) {
    const pista = estadoLocal
      ? `<br/>Tu sistema lo registra como <strong>${escapeHtml(estadoLocal)}</strong>, pero el SRI aún no muestra autorización.`
      : '';
    return {
      html: `<strong>El SRI no tiene registro de autorización</strong> para la clave <code>${escapeHtml(clave)}</code>.${pista}<br/>Si fue emitida hace pocos minutos puede seguir en procesamiento: vuelve a consultar en unos momentos.`,
      text: `El SRI no tiene registro de la clave ${clave}.`,
    };
  }

  if (estadoSri === 'AUTORIZADO') {
    let lineas = '<br/>• Estado SRI: <strong>AUTORIZADO</strong>';
    if (data.numeroAutorizacion) lineas += `<br/>• N° Autorización: <code>${escapeHtml(str(data.numeroAutorizacion))}</code>`;
    if (data.fechaAutorizacion) lineas += `<br/>• Fecha de autorización: <strong>${escapeHtml(str(data.fechaAutorizacion))}</strong>`;
    lineas += data.sincronizado
      ? '<br/>• Tu sistema está sincronizado con el SRI.'
      : `<br/>• <strong>Ojo:</strong> tu sistema lo registra como "${escapeHtml(estadoLocal || 'sin registro')}"; actualiza el módulo de comprobantes.`;
    return {
      html: `<strong>Comprobante autorizado en el SRI.</strong>${lineas}`,
      text: `Comprobante AUTORIZADO por el SRI (${str(data.fechaAutorizacion)}).`,
    };
  }

  const mensajesSri = Array.isArray(data.mensajes)
    ? data.mensajes.map((m: any) => `• ${escapeHtml(str(m))}`).join('<br/>')
    : '';
  return {
    html: `<strong>Estado SRI: ${escapeHtml(estadoSri || 'DESCONOCIDO')}</strong>${
      mensajesSri ? `<br/><br/><strong>Mensajes del SRI:</strong><br/>${mensajesSri}` : ''
    }<br/><br/>Si fue devuelto, corrige el problema y vuelve a transmitirlo desde el módulo de Comprobantes.`,
    text: `Estado SRI: ${estadoSri}. ${Array.isArray(data.mensajes) ? data.mensajes.join(' | ') : ''}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EMITIR COMPROBANTE DE RETENCIÓN
// ─────────────────────────────────────────────────────────────────────────────
async function emitirRetencion(ctx: AiToolContext, args: any): Promise<{ html: string; text: string }> {
  const emisorRuc = str(args.emisorRuc).trim() || ctx.userRuc;

  const sujetoRes = await resolverClienteFactura(ctx.tenantId, args.sujetoRetenido || args.proveedor || args.cliente);
  if (sujetoRes.error) {
    return {
      html: '<strong>Faltan datos del sujeto retenido.</strong><br/>Dame la <strong>identificación</strong> y la <strong>razón social</strong> del proveedor al que se retiene, o indica que ya está registrado como contacto.',
      text: 'Faltan datos del sujeto retenido.',
    };
  }
  const sujeto = sujetoRes.cliente!;

  const periodo = str(args.periodoFiscal).trim();
  const periodoNorm = /^\d{6}$/.test(periodo) ? `${periodo.slice(0, 4)}-${periodo.slice(4)}` : periodo;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoNorm)) {
    return {
      html: '<strong>Falta el período fiscal.</strong><br/>Indícalo como año-mes, ej.: <code>2026-08</code>.',
      text: 'Falta el período fiscal (YYYY-MM).',
    };
  }

  const impuestosRaw: any[] = Array.isArray(args.impuestos) ? args.impuestos : [];
  if (impuestosRaw.length === 0) {
    return {
      html: '<strong>No hay impuestos retenidos.</strong><br/>Indícame al menos uno con: base imponible, valor retenido, número del documento sustento (ej. la factura del proveedor) y su fecha.',
      text: 'No hay impuestos retenidos.',
    };
  }

  const impuestos: any[] = [];
  let totalRetenido = 0;
  for (let i = 0; i < impuestosRaw.length; i++) {
    const raw = impuestosRaw[i];
    const base = num(raw.baseImponible);
    const valor = num(raw.valorRetenido);
    const numDoc = str(raw.numDocSustento ?? raw.numeroDocumentoSustento).trim();
    const fechaDoc = normalizeIsoDate(str(raw.fechaEmisionDocSustento ?? raw.fechaDocSustento));
    if (base <= 0 || valor < 0 || !numDoc || !fechaDoc) {
      return {
        html: `<strong>Datos incompletos en el impuesto #${i + 1}.</strong><br/>Necesito: base imponible, valor retenido, número del documento sustento y su fecha de emisión.`,
        text: `Datos incompletos en el impuesto ${i + 1}.`,
      };
    }
    const codigo = str(raw.codigo).trim() === '1' ? '1' : '2';
    impuestos.push({
      codigo,
      codigoRetencion: str(raw.codigoRetencion).trim(),
      baseImponible: base,
      porcentajeRetener: num(raw.porcentajeRetener) || Number(((valor / base) * 100).toFixed(2)),
      valorRetenido: valor,
      codDocSustento: str(raw.codDocSustento).trim() || '01',
      numDocSustento: numDoc,
      fechaEmisionDocSustento: fechaDoc,
    });
    totalRetenido += valor;
  }

  const res = await fetch(`${ctx.baseUrl}/api/sri/emitir/retencion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.token}`,
    },
    body: JSON.stringify({
      emisor: { ruc: emisorRuc },
      fechaEmision: str(args.fechaEmision) || new Date().toISOString().split('T')[0],
      sujetoRetenido: {
        tipoIdentificacion: sujeto.tipoIdentificacion,
        razonSocial: sujeto.razonSocial,
        identificacion: sujeto.identificacion,
        email: sujeto.email || undefined,
      },
      periodoFiscal: periodoNorm,
      impuestos,
    }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || data.success === false) {
    const msg = str(data.message || data.error?.mensaje || 'No se pudo emitir la retención');
    return {
      html: `<strong>No se pudo emitir el comprobante de retención.</strong><br/>${escapeHtml(msg)}`,
      text: `No se pudo emitir la retención: ${msg}`,
    };
  }

  const estado = str(data.estado);
  let lineas = `<br/>• Sujeto retenido: <strong>${escapeHtml(sujeto.razonSocial)}</strong> (${escapeHtml(sujeto.identificacion)})`;
  lineas += `<br/>• Período fiscal: <strong>${escapeHtml(periodoNorm)}</strong>`;
  lineas += `<br/>• ${impuestos.length} impuesto(s) · Total retenido: <strong>${fmtMonto(totalRetenido)}</strong>`;
  lineas += `<br/>• Clave de acceso: <code>${escapeHtml(str(data.claveAcceso))}</code>`;
  if (data.numeroAutorizacion) lineas += `<br/>• N° Autorización: <code>${escapeHtml(str(data.numeroAutorizacion))}</code>`;
  if (estado) lineas += `<br/>• Estado SRI: <strong>${escapeHtml(estado)}</strong>`;

  return {
    html: `<strong>${data.fechaAutorizacion || estado === 'AUTORIZADO' ? '¡Comprobante de retención emitido!' : 'Retención procesada.'}</strong>${lineas}`,
    text: `Retención emitida por ${fmtMonto(totalRetenido)} (${estado}). Clave ${data.claveAcceso}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERAR GUÍA DE REMISIÓN
// ─────────────────────────────────────────────────────────────────────────────
async function generarGuiaRemision(ctx: AiToolContext, args: any): Promise<{ html: string; text: string }> {
  const emisorRuc = str(args.emisorRuc).trim() || ctx.userRuc;

  let emisor: any = null;
  try {
    emisor = await db.queryOne<any>(
      `SELECT id, ruc, razon_social, obligado_contabilidad, dir_matriz
       FROM emisores WHERE ruc = $1 AND activo = true`,
      [ctx.tenantId, emisorRuc]
    );
  } catch {
    emisor = await db.queryOne<any>(
      `SELECT id, ruc, razon_social, obligado_contabilidad, direccion_matriz AS dir_matriz
       FROM emisores WHERE ruc = $1 AND activo = true`,
      [ctx.tenantId, emisorRuc]
    );
  }
  if (!emisor) {
    return {
      html: `<strong>No encontré el emisor con RUC ${escapeHtml(emisorRuc)}.</strong><br/>Configúralo en Configuración → Emisores para poder generar guías de remisión.`,
      text: `Emisor ${emisorRuc} no encontrado.`,
    };
  }

  const destRes = await resolverClienteFactura(ctx.tenantId, args.destinatario);
  if (destRes.error) {
    return {
      html: '<strong>Faltan datos del destinatario.</strong><br/>Dame la <strong>identificación</strong> y la <strong>razón social</strong> de quien recibe la mercadería, o indica que ya está registrado como contacto.',
      text: 'Faltan datos del destinatario.',
    };
  }
  const destinatario = destRes.cliente!;

  const placa = str(args.placa).trim();
  const transRuc = str(args.transportistaRuc ?? args.transportista?.ruc).trim();
  let transRazon = str(args.transportistaRazonSocial ?? args.transportista?.razonSocial).trim();
  if (!placa || !transRuc) {
    return {
      html: '<strong>Faltan datos del transporte.</strong><br/>Necesito la <strong>placa</strong> del vehículo y el <strong>RUC del transportista</strong> (si me das solo el RUC, busco su razón social en tus contactos).',
      text: 'Faltan placa o RUC del transportista.',
    };
  }
  if (!transRazon) {
    const trans = await db.queryOne<any>(
      'SELECT razon_social FROM contactos WHERE tenant_id = $1 AND identificacion = $2 AND activo = true',
      [ctx.tenantId, transRuc]
    );
    transRazon = str(trans?.razon_social).trim();
  }
  if (!transRazon) {
    return {
      html: `<strong>No encontré la razón social del transportista ${escapeHtml(transRuc)}.</strong><br/>Regístralo como contacto o indícamela directamente.`,
      text: 'Falta la razón social del transportista.',
    };
  }

  const motivo = str(args.motivoTraslado ?? args.motivo).trim();
  const direccionPartida = str(args.direccionPartida).trim() || str(emisor.dir_matriz).trim() || 'S/N';
  const direccionLlegada = str(args.direccionLlegada).trim();

  const itemsRaw: any[] = Array.isArray(args.items) ? args.items : args.detalle || [];
  if (itemsRaw.length === 0 && str(args.producto).length > 0) {
    itemsRaw.push({ producto: args.producto, cantidad: args.cantidad || 1 });
  }
  if (itemsRaw.length === 0) {
    return {
      html: '<strong>No hay productos en la guía.</strong><br/>Indícame qué mercadería se traslada (códigos de inventario o descripciones) y las cantidades.',
      text: 'No hay productos en la guía.',
    };
  }

  const detalle: Array<{ codigo: string; descripcion: string; cantidad: number }> = [];
  for (const raw of itemsRaw) {
    const codigo = str(raw.codigo || raw.codigoPrincipal).trim();
    let descripcion = str(raw.descripcion || raw.nombre).trim();
    const cantidad = num(raw.cantidad) || 1;
    if ((!descripcion || !codigo) && (codigo || descripcion)) {
      const producto = await db.queryOne<any>(
        `SELECT codigo, nombre FROM productos
         WHERE tenant_id = $1 AND activo = true AND (codigo = $2 OR LOWER(nombre) LIKE LOWER($3))
         LIMIT 1`,
        [ctx.tenantId, codigo || descripcion, `%${descripcion || codigo}%`]
      );
      if (producto) {
        descripcion = producto.nombre;
      }
    }
    if (!descripcion) {
      return {
        html: `<strong>No pude identificar el producto "${escapeHtml(descripcion || codigo)}".</strong><br/>Indícame su código de inventario o una descripción clara.`,
        text: 'Producto sin descripción en la guía.',
      };
    }
    detalle.push({ codigo: codigo || 'SINCOD', descripcion, cantidad });
  }

  const fechaInicio = normalizeIsoDate(str(args.fechaInicioTransporte)) || new Date().toISOString().split('T')[0];
  const fechaFin = normalizeIsoDate(str(args.fechaFinTransporte)) || undefined;

  const res = await fetch(`${ctx.baseUrl}/api/sri/guia-remision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.token}`,
    },
    body: JSON.stringify({
      emisor: {
        ruc: emisor.ruc,
        razonSocial: emisor.razon_social,
        direccionEstablecimiento: direccionPartida,
        obligadoContabilidad: emisor.obligado_contabilidad || 'NO',
      },
      destinatario: {
        tipoIdentificacion: destinatario.tipoIdentificacion,
        razonSocial: destinatario.razonSocial,
        identificacion: destinatario.identificacion,
        email: destinatario.email || undefined,
      },
      transporte: { placa, transportistaRuc: transRuc, transportistaRazonSocial: transRazon },
      fechaInicioTransporte: fechaInicio,
      ...(fechaFin ? { fechaFinTransporte: fechaFin } : {}),
      motivoTraslado: motivo || 'TRASLADO',
      direccionPartida,
      direccionLlegada: direccionLlegada || 'S/N',
      detalle,
      ...(str(args.numeroFactura).trim() ? { numeroFactura: str(args.numeroFactura).trim() } : {}),
    }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || data.success === false) {
    const msg = str(data.message || data.error || 'No se pudo generar la guía de remisión');
    return {
      html: `<strong>No se pudo generar la guía de remisión.</strong><br/>${escapeHtml(msg)}`,
      text: `No se pudo generar la guía de remisión: ${msg}`,
    };
  }

  let lineas = `<br/>• Destinatario: <strong>${escapeHtml(destinatario.razonSocial)}</strong> (${escapeHtml(destinatario.identificacion)})`;
  lineas += `<br/>• Transporte: placa <strong>${escapeHtml(placa)}</strong> — ${escapeHtml(transRazon)}`;
  lineas += `<br/>• ${detalle.length} producto(s) · Motivo: ${escapeHtml(motivo || 'TRASLADO')}`;
  lineas += `<br/>• Clave de acceso: <code>${escapeHtml(str(data.claveAcceso))}</code>`;
  if (data.numeroAutorizacion) lineas += `<br/>• N° Autorización: <code>${escapeHtml(str(data.numeroAutorizacion))}</code>`;

  return {
    html: `<strong>¡Guía de remisión generada!</strong>${lineas}`,
    text: `Guía de remisión generada. Clave ${data.claveAcceso}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REENVIAR COMPROBANTE AL SRI
// ─────────────────────────────────────────────────────────────────────────────
async function reenviarComprobanteSri(ctx: AiToolContext, args: any): Promise<{ html: string; text: string }> {
  const clave = str(args.claveAcceso ?? args.clave).replace(/\s+/g, '').trim();
  if (!/^\d{49}$/.test(clave)) {
    return {
      html: '<strong>Necesito la clave de acceso de 49 dígitos</strong> del comprobante a reenviar.<br/>Está en Comprobantes → detalle (estados PENDIENTE o DEVUELTA se pueden reenviar).',
      text: 'Falta la clave de acceso de 49 dígitos.',
    };
  }

  const res = await fetch(`${ctx.baseUrl}/api/sri/comprobantes/${clave}/reenviar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.token}`,
    },
  });
  const data = await res.json().catch(() => ({} as any));

  if (res.status === 409 || data.requierePolling) {
    return {
      html: '<strong>El comprobante está EN PROCESO por el SRI.</strong><br/>El sistema consultará automáticamente su autorización; pregunta su estado en unos minutos con <code>verificar_comprobante</code>.',
      text: 'El comprobante está en proceso por el SRI; se consultará automáticamente.',
    };
  }
  if (!res.ok) {
    const msg = str(data.message || data.error?.mensaje || 'No se pudo reenviar el comprobante');
    return {
      html: `<strong>No se pudo reenviar al SRI.</strong><br/>${escapeHtml(msg)}`,
      text: `No se pudo reenviar al SRI: ${msg}`,
    };
  }

  const estado = str(data.estado);
  if (estado === 'AUTORIZADO') {
    let lineas = `<br/>• Clave de acceso: <code>${escapeHtml(clave)}</code>`;
    if (data.numeroAutorizacion) lineas += `<br/>• N° Autorización: <code>${escapeHtml(str(data.numeroAutorizacion))}</code>`;
    if (data.fechaAutorizacion) lineas += `<br/>• Fecha de autorización: <strong>${escapeHtml(str(data.fechaAutorizacion))}</strong>`;
    return {
      html: `<strong>¡Comprobante AUTORIZADO por el SRI!</strong>${lineas}`,
      text: `Comprobante autorizado tras el reenvío. Clave ${clave}.`,
    };
  }

  const mensajes = Array.isArray(data.mensajes)
    ? data.mensajes
        .map((m: any) =>
          str(
            typeof m === 'string'
              ? m
              : [m.tipo, m.identificador, m.mensaje].filter(Boolean).join(' ')
          ).trim()
        )
        .filter(Boolean)
        .map((t: string) => `• ${escapeHtml(t)}`)
        .join('<br/>')
    : '';
  const accion = str(data.error?.accion).trim();
  return {
    html: `<strong>Reenvío realizado. Estado SRI: ${escapeHtml(estado || 'DESCONOCIDO')}</strong>${
      mensajes ? `<br/><br/><strong>Mensajes:</strong><br/>${mensajes}` : ''
    }${accion ? `<br/><br/><strong>Sugerencia:</strong> ${escapeHtml(accion)}` : ''}`,
    text: `Reenvío realizado. Estado: ${estado}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AJUSTAR INVENTARIO
// ─────────────────────────────────────────────────────────────────────────────
async function ajustarInventario(ctx: AiToolContext, args: any): Promise<{ html: string; text: string }> {
  const tenantId = ctx.tenantId;
  const termino = str(args.producto ?? args.productoId ?? args.codigo).trim();
  const tipo = str(args.tipo).toUpperCase();
  const cantidad = num(args.cantidad);

  if (!termino) {
    return {
      html: '<strong>Indícame el producto</strong> (código o nombre) cuyo stock quieres mover.',
      text: 'Falta el producto.',
    };
  }
  if (!['ENTRADA', 'SALIDA', 'AJUSTE'].includes(tipo)) {
    return {
      html: '<strong>Tipo de movimiento inválido.</strong><br/>Usa <strong>ENTRADA</strong> (sumar stock), <strong>SALIDA</strong> (restar) o <strong>AJUSTE</strong> (fijar el stock exacto).',
      text: 'Tipo debe ser ENTRADA, SALIDA o AJUSTE.',
    };
  }
  if (cantidad <= 0) {
    return {
      html: '<strong>Indícame la cantidad</strong> (mayor que cero). Para AJUSTE es el stock final exacto.',
      text: 'Cantidad inválida.',
    };
  }

  const producto = await db.queryOne<any>(
    `SELECT id, codigo, nombre, stock FROM productos
     WHERE tenant_id = $1 AND activo = true AND (codigo = $2 OR LOWER(nombre) LIKE LOWER($3))
     ORDER BY CASE WHEN codigo = $2 THEN 0 ELSE 1 END
     LIMIT 1`,
    [tenantId, termino, `%${termino}%`]
  );
  if (!producto) {
    return {
      html: `<strong>No encontré el producto "${escapeHtml(termino)}".</strong><br/>Verifica el código o el nombre en tu inventario.`,
      text: `Producto ${termino} no encontrado.`,
    };
  }

  const res = await fetch(`${ctx.baseUrl}/api/inventario/movimientos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.token}`,
    },
    body: JSON.stringify({
      productoId: producto.id,
      tipo,
      cantidad,
      motivo: str(args.motivo).trim() || undefined,
      referencia: str(args.referencia).trim() || undefined,
    }),
  });
  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    const msg = str(data.message || 'No se pudo registrar el movimiento');
    return {
      html: `<strong>No se pudo actualizar el stock de "${escapeHtml(producto.nombre)}".</strong><br/>${escapeHtml(msg)}`,
      text: `No se pudo actualizar el stock: ${msg}`,
    };
  }

  const mov = data.data || {};
  const antes = num(mov.stock_antes);
  const despues = num(mov.stock_despues);
  return {
    html: `<strong>Stock actualizado: ${escapeHtml(producto.nombre)}</strong><br/>• Movimiento: <strong>${tipo}</strong> de ${cantidad}<br/>• Stock: ${antes} → <strong>${despues}</strong> unidades${mov.motivo ? `<br/>• Motivo: ${escapeHtml(str(mov.motivo))}` : ''}`,
    text: `Stock de ${producto.nombre}: ${antes} → ${despues} (${tipo}).`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCH PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export async function handleAiTool(
  name: string,
  args: any,
  ctx: AiToolContext
): Promise<{ html: string; text: string }> {
  switch (name) {
    case 'crear_producto':
      return crearProducto(ctx.tenantId, args);
    case 'listar_productos':
      return listarProductos(ctx.tenantId, args);
    case 'crear_contacto':
      return crearContacto(ctx.tenantId, args);
    case 'buscar_contactos':
      return buscarContactos(ctx.tenantId, args);
    case 'emitir_factura':
      return emitirFactura(ctx, args);
    case 'emitir_nota_credito':
      return emitirNotaCredito(ctx, args);
    case 'registrar_pago':
      return registrarPago(ctx, args);
    case 'consultar_cuentas':
      return consultarCuentas(ctx.tenantId, args);
    case 'consultar_vencimientos':
      return consultarVencimientos(ctx.tenantId, args);
    case 'consultar_estado_descarga':
      return consultarEstadoDescarga(ctx.tenantId, args);
    case 'verificar_comprobante':
      return verificarComprobante(ctx, args);
    case 'emitir_retencion':
      return emitirRetencion(ctx, args);
    case 'generar_guia_remision':
      return generarGuiaRemision(ctx, args);
    case 'reenviar_comprobante_sri':
      return reenviarComprobanteSri(ctx, args);
    case 'ajustar_inventario':
      return ajustarInventario(ctx, args);
    case 'proyeccion_fiscal':
      return proyeccionFiscal(ctx.tenantId, ctx.userRuc, args);
    case 'consultar_sistema_rag':
    case 'consultar_contabilidad_rag':
      return consultarSistemaRag(ctx.tenantId, args);
    default:
      return {
        html: `<strong>No conozco la herramienta "${escapeHtml(str(name))}".</strong>`,
        text: `Herramienta desconocida: ${name}`,
      };
  }
}

export const AI_TOOL_NAMES = [
  'extraer_documentos_sri',
  'emitir_factura',
  'emitir_nota_credito',
  'crear_producto',
  'listar_productos',
  'crear_contacto',
  'buscar_contactos',
  'registrar_pago',
  'consultar_cuentas',
  'consultar_vencimientos',
  'consultar_estado_descarga',
  'verificar_comprobante',
  'emitir_retencion',
  'generar_guia_remision',
  'reenviar_comprobante_sri',
  'ajustar_inventario',
  'proyeccion_fiscal',
  'consultar_sistema_rag',
  'consultar_contabilidad_rag',
];

export const MUTATING_TOOLS = [
  'emitir_factura',
  'emitir_nota_credito',
  'emitir_retencion',
  'generar_guia_remision',
  'reenviar_comprobante_sri',
  'crear_producto',
  'crear_contacto',
  'registrar_pago',
  'ajustar_inventario',
] as const;

export function isMutatingTool(name: string): boolean {
  return (MUTATING_TOOLS as readonly string[]).includes(name);
}
