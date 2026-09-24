import { db } from './db';

type EmbeddingConfig = {
  enabled: boolean;
  provider: 'ollama' | 'lmstudio';
  baseUrl: string;
  model: string;
  chatModel: string;
};

export function getConfig(): EmbeddingConfig {
  return {
    enabled: process.env.OLLAMA_ENABLED === 'true',
    provider: (process.env.OLLAMA_PROVIDER as 'ollama' | 'lmstudio') || 'ollama',
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'nomic-embed-text',
    chatModel: process.env.OLLAMA_CHAT_MODEL || 'llama3.2',
  };
}

export async function getEmbedding(text: string): Promise<number[]> {
  const config = getConfig();
  if (!config.enabled) {
    throw new Error('OLLAMA_ENABLED no está activado');
  }

  if (config.provider === 'lmstudio') {
    const lmStudioUrl = config.baseUrl.replace(/\/+$/, '') + '/v1/embeddings';
    const res = await fetch(lmStudioUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, input: text }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LM Studio error (${res.status}): ${err.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.data?.[0]?.embedding || data.embedding?.[0] || data.embedding || [];
  }

  const ollamaUrl = config.baseUrl.replace(/\/+$/, '') + '/api/embeddings';
  const res = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, prompt: text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.embedding || [];
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

export type SearchResult = {
  id: number;
  tipo: string;
  contenido: string;
  referenciaId: number | null;
  score: number;
};

/** Hash estable de UUID/clave → entero para referencia_id (columna INTEGER). */
export function refIdFromKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

function money(v: unknown): string {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00';
}

function dateOnly(v: unknown): string {
  if (!v) return '';
  return String(v).slice(0, 10);
}

export async function searchSimilar(
  tenantId: string,
  query: string,
  threshold = 0.5,
  limit = 50
): Promise<SearchResult[]> {
  const queryVec = await getEmbedding(query);

  const rows = await db.queryAll<{
    id: number;
    tipo: string;
    contenido: string;
    referencia_id: number | null;
    embedding: string | null;
  }>(
    `SELECT id, tipo, contenido, referencia_id, embedding
     FROM contable_embeddings
     WHERE tenant_id = $1 AND embedding IS NOT NULL`,
    [tenantId]
  );

  const results: SearchResult[] = [];

  for (const row of rows) {
    let storedVec: number[];
    try {
      storedVec = JSON.parse(row.embedding || '[]');
    } catch {
      continue;
    }
    if (!Array.isArray(storedVec) || storedVec.length === 0) continue;

    const score = cosineSimilarity(queryVec, storedVec);
    if (score >= threshold) {
      results.push({
        id: row.id,
        tipo: row.tipo,
        contenido: row.contenido,
        referenciaId: row.referencia_id,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, Math.max(1, limit));
}

const RAG_SYSTEM_PROMPT = `Eres un asistente del sistema OFSERCONT (Ecuador / SRI).
Responde SOLO con base en el CONTEXTO recuperado (contabilidad, comprobantes, contactos, productos, empleados, CxC/CxP, inventario).
Si no alcanza para responder, dilo claramente.
Cuando sumes montos (IVA, totales, saldos), muestra el cálculo de forma breve.
Cita las fuentes por tipo cuando sea posible.
Responde en español, claro y conciso.`;

async function generateLocalCompletion(prompt: string): Promise<{ text: string; model: string }> {
  const config = getConfig();
  if (!config.enabled) {
    throw new Error('OLLAMA_ENABLED no está activado');
  }

  const model = config.chatModel;

  if (config.provider === 'lmstudio') {
    const url = config.baseUrl.replace(/\/+$/, '') + '/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: RAG_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LM Studio chat error (${res.status}): ${err.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) throw new Error('LM Studio no devolvió texto');
    return { text, model };
  }

  const url = config.baseUrl.replace(/\/+$/, '') + '/api/chat';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: RAG_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      stream: false,
      options: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama chat error (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.message?.content?.trim() || data?.response?.trim() || '';
  if (!text) throw new Error('Ollama no devolvió texto');
  return { text, model };
}

export type RagQueryResult = {
  answer: string | null;
  sources: SearchResult[];
  model: string | null;
  generated: boolean;
};

export async function queryRag(
  tenantId: string,
  query: string,
  options: { threshold?: number; topK?: number; generate?: boolean } = {}
): Promise<RagQueryResult> {
  const threshold = options.threshold ?? 0.5;
  const topK = options.topK ?? 8;
  const generate = options.generate !== false;

  const sources = await searchSimilar(tenantId, query, threshold, topK);

  if (!generate || sources.length === 0) {
    return { answer: null, sources, model: null, generated: false };
  }

  const context = sources
    .map(
      (s, i) =>
        `[${i + 1}] tipo=${s.tipo}` +
        (s.referenciaId != null ? ` ref=#${s.referenciaId}` : '') +
        ` score=${(s.score * 100).toFixed(0)}%\n${s.contenido}`
    )
    .join('\n\n');

  const prompt =
    `Pregunta del usuario:\n${query}\n\n` +
    `CONTEXTO recuperado (ordenado por relevancia):\n${context}\n\n` +
    `Responde la pregunta usando solo el contexto.`;

  const { text, model } = await generateLocalCompletion(prompt);
  return { answer: text, sources, model, generated: true };
}

async function upsertEmbedding(
  tenantId: string,
  tipo: string,
  referenciaId: number | null,
  contenido: string
): Promise<void> {
  const config = getConfig();
  if (!config.enabled) return;

  let embedding: number[];
  try {
    embedding = await getEmbedding(contenido);
  } catch (err) {
    console.error(`[Embeddings] Error generating embedding for ${tipo}#${referenciaId}:`, err);
    return;
  }

  const embeddingJson = JSON.stringify(embedding);

  await db.query(
    `DELETE FROM contable_embeddings
     WHERE tenant_id = $1 AND tipo = $2 AND referencia_id IS NOT DISTINCT FROM $3`,
    [tenantId, tipo, referenciaId]
  );

  await db.query(
    `INSERT INTO contable_embeddings (tenant_id, referencia_id, tipo, contenido, embedding, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [tenantId, referenciaId, tipo, contenido, embeddingJson]
  );
}

async function removeEmbedding(
  tenantId: string,
  tipo: string,
  referenciaId: number | null
): Promise<void> {
  const config = getConfig();
  if (!config.enabled) return;

  await db.query(
    `DELETE FROM contable_embeddings
     WHERE tenant_id = $1 AND tipo = $2 AND referencia_id IS NOT DISTINCT FROM $3`,
    [tenantId, tipo, referenciaId]
  );
}

export function buildContent(tipo: string, record: any): string {
  switch (tipo) {
    case 'plan_cuenta':
      return [
        `Código: ${record.codigo || ''}`,
        `Nombre: ${record.nombre || ''}`,
        `Nivel: ${record.nivel || ''}`,
        `Tipo: ${record.tipo || ''}`,
        record.es_auxiliar ? 'Es auxiliar' : '',
        record.activo === false ? 'Inactivo' : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'impuesto':
      return [
        `Código: ${record.codigo || ''}`,
        `Código porcentaje: ${record.codigo_porcentaje || ''}`,
        `Nombre: ${record.nombre || ''}`,
        `Porcentaje: ${record.porcentaje || 0}%`,
        `Tarifa: ${record.tarifa || 0}`,
        `Tipo impuesto: ${record.tipo_impuesto || ''}`,
        record.codigo_ats ? `Código ATS: ${record.codigo_ats}` : '',
        record.codigo_formulario_103 ? `Formulario 103: ${record.codigo_formulario_103}` : '',
        record.codigo_formulario_104 ? `Formulario 104: ${record.codigo_formulario_104}` : '',
        record.activo === false ? 'Inactivo' : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'posicion_fiscal':
      return [
        `Nombre: ${record.nombre || ''}`,
        `Tipo contribuyente: ${record.tipo_contribuyente || ''}`,
        record.lineas && Array.isArray(record.lineas)
          ? `Líneas: ${record.lineas
              .map(
                (l: any) =>
                  `${l.tipo_operacion || ''} - ${l.impuesto_nombre || l.impuesto?.nombre || ''} (${l.porcentaje || l.impuesto?.porcentaje || ''}%)`
              )
              .join('; ')}`
          : '',
        record.activo === false ? 'Inactivo' : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'tipo_documento':
      return [
        `Código: ${record.codigo || ''}`,
        `Nombre: ${record.nombre || ''}`,
        record.descripcion ? `Descripción: ${record.descripcion}` : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'tipo_sustento':
      return [
        `Código: ${record.codigo || ''}`,
        `Nombre: ${record.nombre || ''}`,
        record.descripcion ? `Descripción: ${record.descripcion}` : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'comprobante':
      return [
        `Tipo: ${record.tipo || ''}`,
        record.serie ? `Serie: ${record.serie}` : '',
        record.secuencial ? `Secuencial: ${record.secuencial}` : '',
        record.clave_acceso ? `Clave acceso: ${record.clave_acceso}` : '',
        record.fecha_emision ? `Fecha emisión: ${record.fecha_emision}` : '',
        `Receptor: ${record.receptor_razon_social || ''}`,
        `RUC: ${record.receptor_identificacion || ''}`,
        `Emisor: ${record.emisor_razon_social || record.emisor_ruc || ''}`,
        record.importe_total ? `Total: $${parseFloat(record.importe_total).toFixed(2)}` : '',
        record.total_iva ? `IVA: $${parseFloat(record.total_iva).toFixed(2)}` : '',
        record.total_sin_impuesto
          ? `Subtotal sin impuestos: $${parseFloat(record.total_sin_impuesto).toFixed(2)}`
          : '',
        record.subtotal_sin_impuesto
          ? `Subtotal sin impuestos: $${parseFloat(record.subtotal_sin_impuesto).toFixed(2)}`
          : '',
        record.estado ? `Estado SRI: ${record.estado}` : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'asiento': {
      const lineasTxt =
        record.lineas && Array.isArray(record.lineas)
          ? record.lineas
              .map(
                (l: any) =>
                  `${l.cuenta_codigo || l.cuentaCodigo || ''} ${l.cuenta_nombre || l.cuentaNombre || ''} ` +
                  `debe=${money(l.debe)} ` +
                  `haber=${money(l.haber)}`
              )
              .join('; ')
          : '';
      return [
        `Asiento contable #${record.numero || ''}`,
        record.fecha ? `Fecha: ${dateOnly(record.fecha)}` : '',
        record.glosa ? `Glosa: ${record.glosa}` : '',
        record.origen ? `Origen: ${record.origen}` : '',
        record.estado ? `Estado: ${record.estado}` : '',
        record.comprobante_id || record.comprobanteId
          ? `Comprobante vinculado: ${record.comprobante_id || record.comprobanteId}`
          : '',
        lineasTxt ? `Líneas: ${lineasTxt}` : '',
      ]
        .filter(Boolean)
        .join('. ');
    }

    case 'contacto':
      return [
        'Contacto',
        record.id ? `id=${record.id}` : '',
        `Identificación: ${record.identificacion || ''}`,
        `Tipo ID: ${record.tipo_identificacion || record.tipoIdentificacion || ''}`,
        `Razón social: ${record.razon_social || record.razonSocial || ''}`,
        record.nombre_comercial || record.nombreComercial
          ? `Nombre comercial: ${record.nombre_comercial || record.nombreComercial}`
          : '',
        record.es_cliente || record.esCliente ? 'Es cliente' : '',
        record.es_proveedor || record.esProveedor ? 'Es proveedor' : '',
        record.email ? `Email: ${record.email}` : '',
        record.telefono ? `Teléfono: ${record.telefono}` : '',
        record.direccion ? `Dirección: ${record.direccion}` : '',
        record.activo === false || record.activo === 0 ? 'Inactivo' : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'producto':
      return [
        'Producto',
        record.id ? `id=${record.id}` : '',
        `Código: ${record.codigo || ''}`,
        `Nombre: ${record.nombre || ''}`,
        record.descripcion ? `Descripción: ${record.descripcion}` : '',
        `Precio: ${money(record.precio_unitario ?? record.precioUnitario)}`,
        `IVA: ${record.iva_porcentaje ?? record.ivaPorcentaje ?? 15}%`,
        `Stock: ${record.stock ?? 0}`,
        record.activo === false || record.activo === 0 ? 'Inactivo' : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'empleado':
      return [
        'Empleado',
        record.id ? `id=${record.id}` : '',
        `Cédula: ${record.cedula || ''}`,
        `Nombre: ${[record.nombres, record.apellidos].filter(Boolean).join(' ') || record.nombre_completo || ''}`,
        record.cargo ? `Cargo: ${record.cargo}` : '',
        record.sueldo != null ? `Sueldo: ${money(record.sueldo)}` : '',
        record.fecha_ingreso || record.fechaIngreso
          ? `Ingreso: ${dateOnly(record.fecha_ingreso || record.fechaIngreso)}`
          : '',
        record.email ? `Email: ${record.email}` : '',
        record.activo === false || record.activo === 0 ? 'Inactivo' : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'cuenta_cobrar':
      return [
        'Cuenta por cobrar',
        record.id ? `id=${record.id}` : '',
        `Cliente: ${record.cliente_nombre || record.clienteNombre || ''}`,
        `Identificación: ${record.cliente_identificacion || record.clienteIdentificacion || ''}`,
        record.numero_documento || record.numeroDocumento
          ? `Documento: ${record.numero_documento || record.numeroDocumento}`
          : '',
        `Monto original: ${money(record.monto_original ?? record.montoOriginal)}`,
        `Saldo pendiente: ${money(record.saldo_pendiente ?? record.saldoPendiente)}`,
        `Estado: ${record.estado || ''}`,
        record.fecha_emision || record.fechaEmision
          ? `Emisión: ${dateOnly(record.fecha_emision || record.fechaEmision)}`
          : '',
        record.fecha_vencimiento || record.fechaVencimiento
          ? `Vence: ${dateOnly(record.fecha_vencimiento || record.fechaVencimiento)}`
          : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'cuenta_pagar':
      return [
        'Cuenta por pagar',
        record.id ? `id=${record.id}` : '',
        `Proveedor: ${record.proveedor_nombre || record.proveedorNombre || ''}`,
        `Identificación: ${record.proveedor_identificacion || record.proveedorIdentificacion || ''}`,
        record.numero_documento || record.numeroDocumento
          ? `Documento: ${record.numero_documento || record.numeroDocumento}`
          : '',
        `Monto original: ${money(record.monto_original ?? record.montoOriginal)}`,
        `Saldo pendiente: ${money(record.saldo_pendiente ?? record.saldoPendiente)}`,
        `Estado: ${record.estado || ''}`,
        record.fecha_emision || record.fechaEmision
          ? `Emisión: ${dateOnly(record.fecha_emision || record.fechaEmision)}`
          : '',
        record.fecha_vencimiento || record.fechaVencimiento
          ? `Vence: ${dateOnly(record.fecha_vencimiento || record.fechaVencimiento)}`
          : '',
      ]
        .filter(Boolean)
        .join('. ');

    case 'inventario_movimiento':
      return [
        'Movimiento de inventario',
        record.id ? `id=${record.id}` : '',
        `Tipo: ${record.tipo || ''}`,
        record.producto_codigo || record.productoCodigo
          ? `Producto código: ${record.producto_codigo || record.productoCodigo}`
          : '',
        record.producto_nombre || record.productoNombre
          ? `Producto: ${record.producto_nombre || record.productoNombre}`
          : '',
        `Cantidad: ${record.cantidad ?? 0}`,
        record.stock_antes != null || record.stockAntes != null
          ? `Stock antes: ${record.stock_antes ?? record.stockAntes}`
          : '',
        record.stock_despues != null || record.stockDespues != null
          ? `Stock después: ${record.stock_despues ?? record.stockDespues}`
          : '',
        record.created_at || record.createdAt
          ? `Fecha: ${dateOnly(record.created_at || record.createdAt)}`
          : '',
        record.motivo ? `Motivo: ${record.motivo}` : '',
        record.referencia ? `Referencia: ${record.referencia}` : '',
      ]
        .filter(Boolean)
        .join('. ');

    default:
      return JSON.stringify(record);
  }
}

type IndexStats = {
  plan_cuenta: number;
  impuesto: number;
  posicion_fiscal: number;
  tipo_documento: number;
  tipo_sustento: number;
  comprobante: number;
  asiento: number;
  contacto: number;
  producto: number;
  empleado: number;
  cuenta_cobrar: number;
  cuenta_pagar: number;
  inventario_movimiento: number;
};

async function indexBatch(
  tenantId: string,
  tipo: string,
  rows: any[],
  getRefId: (row: any) => number | null,
  batchSize = 10
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map((row) =>
        upsertEmbedding(tenantId, tipo, getRefId(row), buildContent(tipo, row))
      )
    );
  }
}

export async function reindexAll(
  tenantId: string,
  types?: string[]
): Promise<IndexStats> {
  const config = getConfig();
  if (!config.enabled) {
    throw new Error('OLLAMA_ENABLED no está activado');
  }

  const allowedTypes = types || [
    'plan_cuenta',
    'impuesto',
    'posicion_fiscal',
    'tipo_documento',
    'tipo_sustento',
    'comprobante',
    'asiento',
    'contacto',
    'producto',
    'empleado',
    'cuenta_cobrar',
    'cuenta_pagar',
    'inventario_movimiento',
  ];

  const stats: IndexStats = {
    plan_cuenta: 0,
    impuesto: 0,
    posicion_fiscal: 0,
    tipo_documento: 0,
    tipo_sustento: 0,
    comprobante: 0,
    asiento: 0,
    contacto: 0,
    producto: 0,
    empleado: 0,
    cuenta_cobrar: 0,
    cuenta_pagar: 0,
    inventario_movimiento: 0,
  };

  await db.query(
    `DELETE FROM contable_embeddings WHERE tenant_id = $1`,
    [tenantId]
  );

  const batchSize = 10;

  if (allowedTypes.includes('plan_cuenta')) {
    const cuentas = await db.queryAll<any>(
      `SELECT id, codigo, nombre, nivel, tipo, es_auxiliar, activo
       FROM plan_cuentas WHERE tenant_id = $1`,
      [tenantId]
    );
    await indexBatch(tenantId, 'plan_cuenta', cuentas, (c) => c.id, batchSize);
    stats.plan_cuenta = cuentas.length;
  }

  if (allowedTypes.includes('impuesto')) {
    const impuestos = await db.queryAll<any>(
      `SELECT id, codigo, codigo_porcentaje, nombre, porcentaje, tarifa,
              tipo_impuesto, codigo_ats, codigo_formulario_103, codigo_formulario_104, activo
       FROM impuestos WHERE tenant_id = $1`,
      [tenantId]
    );
    await indexBatch(tenantId, 'impuesto', impuestos, (imp) => imp.id, batchSize);
    stats.impuesto = impuestos.length;
  }

  if (allowedTypes.includes('posicion_fiscal')) {
    const posiciones = await db.queryAll<any>(
      `SELECT pf.id, pf.nombre, pf.tipo_contribuyente, pf.activo
       FROM posiciones_fiscales pf WHERE pf.tenant_id = $1`,
      [tenantId]
    );
    for (const pos of posiciones) {
      const lineas = await db.queryAll<any>(
        `SELECT pfl."tipoOperacion" AS tipo_operacion, pfl.aplica_retencion,
                i.nombre AS impuesto_nombre, i.porcentaje
         FROM posiciones_fiscales_lineas pfl
         LEFT JOIN impuestos i ON pfl.impuesto_id = i.id
         WHERE pfl.posicion_fiscal_id = $1`,
        [pos.id]
      );
      pos.lineas = lineas;
    }
    await indexBatch(tenantId, 'posicion_fiscal', posiciones, (pos) => pos.id, batchSize);
    stats.posicion_fiscal = posiciones.length;
  }

  if (allowedTypes.includes('tipo_documento')) {
    const tiposDoc = await db.queryAll<any>(
      `SELECT id, codigo, nombre, descripcion FROM tipos_documento_sri WHERE activo = true`
    );
    await indexBatch(tenantId, 'tipo_documento', tiposDoc, (td) => td.id, batchSize);
    stats.tipo_documento = tiposDoc.length;
  }

  if (allowedTypes.includes('tipo_sustento')) {
    const sustentos = await db.queryAll<any>(
      `SELECT id, codigo, nombre, descripcion FROM tipos_sustento_tributario WHERE activo = true`
    );
    await indexBatch(tenantId, 'tipo_sustento', sustentos, (ts) => ts.id, batchSize);
    stats.tipo_sustento = sustentos.length;
  }

  if (allowedTypes.includes('comprobante')) {
    const comprobantes = await db.queryAll<any>(
      `SELECT id, tipo, serie, secuencial, clave_acceso, fecha_emision,
              receptor_razon_social, receptor_identificacion,
              emisor_razon_social, emisor_ruc,
              importe_total, total_iva, total_sin_impuesto, subtotal_sin_impuesto, estado
       FROM comprobantes WHERE tenant_id = $1
       ORDER BY fecha_emision DESC NULLS LAST
       LIMIT 5000`,
      [tenantId]
    );
    await indexBatch(
      tenantId,
      'comprobante',
      comprobantes,
      (comp) => (typeof comp.id === 'number' ? comp.id : refIdFromKey(String(comp.id))),
      batchSize
    );
    stats.comprobante = comprobantes.length;
  }

  if (allowedTypes.includes('asiento')) {
    const asientos = await db.queryAll<any>(
      `SELECT id, fecha, numero, glosa, origen, comprobante_id, estado
       FROM asientos WHERE tenant_id = $1
       ORDER BY fecha DESC, numero DESC
       LIMIT 5000`,
      [tenantId]
    );
    for (const a of asientos) {
      a.lineas = await db.queryAll<any>(
        `SELECT cuenta_codigo, cuenta_nombre, debe, haber
         FROM asiento_lineas WHERE asiento_id = $1 ORDER BY orden ASC`,
        [a.id]
      );
    }
    await indexBatch(tenantId, 'asiento', asientos, (a) => a.numero, batchSize);
    stats.asiento = asientos.length;
  }

  if (allowedTypes.includes('contacto')) {
    const contactos = await db.queryAll<any>(
      `SELECT id, tipo_identificacion, identificacion, razon_social, nombre_comercial,
              email, telefono, direccion, es_cliente, es_proveedor, activo
       FROM contactos WHERE tenant_id = $1
       ORDER BY razon_social ASC
       LIMIT 2000`,
      [tenantId]
    );
    await indexBatch(tenantId, 'contacto', contactos, (c) => refIdFromKey(String(c.id)), batchSize);
    stats.contacto = contactos.length;
  }

  if (allowedTypes.includes('producto')) {
    const productos = await db.queryAll<any>(
      `SELECT id, codigo, nombre, descripcion, precio_unitario, iva_porcentaje, stock, activo
       FROM productos WHERE tenant_id = $1
       ORDER BY nombre ASC
       LIMIT 2000`,
      [tenantId]
    );
    await indexBatch(tenantId, 'producto', productos, (p) => refIdFromKey(String(p.id)), batchSize);
    stats.producto = productos.length;
  }

  if (allowedTypes.includes('empleado')) {
    const empleados = await db.queryAll<any>(
      `SELECT id, cedula, nombres, apellidos, email, telefono, cargo, fecha_ingreso, sueldo, activo
       FROM empleados WHERE tenant_id = $1
       ORDER BY apellidos ASC, nombres ASC
       LIMIT 2000`,
      [tenantId]
    );
    await indexBatch(tenantId, 'empleado', empleados, (e) => refIdFromKey(String(e.id)), batchSize);
    stats.empleado = empleados.length;
  }

  if (allowedTypes.includes('cuenta_cobrar')) {
    const cxc = await db.queryAll<any>(
      `SELECT id, cliente_identificacion, cliente_nombre, numero_documento,
              fecha_emision, fecha_vencimiento, monto_original, saldo_pendiente, estado
       FROM cuentas_por_cobrar WHERE tenant_id = $1
       ORDER BY fecha_emision DESC NULLS LAST
       LIMIT 5000`,
      [tenantId]
    );
    await indexBatch(tenantId, 'cuenta_cobrar', cxc, (r) => refIdFromKey(String(r.id)), batchSize);
    stats.cuenta_cobrar = cxc.length;
  }

  if (allowedTypes.includes('cuenta_pagar')) {
    const cxp = await db.queryAll<any>(
      `SELECT id, proveedor_identificacion, proveedor_nombre, numero_documento,
              fecha_emision, fecha_vencimiento, monto_original, saldo_pendiente, estado
       FROM cuentas_por_pagar WHERE tenant_id = $1
       ORDER BY fecha_emision DESC NULLS LAST
       LIMIT 5000`,
      [tenantId]
    );
    await indexBatch(tenantId, 'cuenta_pagar', cxp, (r) => refIdFromKey(String(r.id)), batchSize);
    stats.cuenta_pagar = cxp.length;
  }

  if (allowedTypes.includes('inventario_movimiento')) {
    const movimientos = await db.queryAll<any>(
      `SELECT m.id, m.tipo, m.cantidad, m.stock_antes, m.stock_despues, m.created_at,
              p.codigo AS producto_codigo, p.nombre AS producto_nombre
       FROM inventario_movimientos m
       LEFT JOIN productos p ON p.id = m.producto_id
       WHERE m.tenant_id = $1
       ORDER BY m.created_at DESC
       LIMIT 5000`,
      [tenantId]
    );
    await indexBatch(
      tenantId,
      'inventario_movimiento',
      movimientos,
      (m) => refIdFromKey(String(m.id)),
      batchSize
    );
    stats.inventario_movimiento = movimientos.length;
  }

  return stats;
}

async function storeByKey(
  tenantId: string,
  tipo: string,
  key: string,
  contenido: string
): Promise<void> {
  return upsertEmbedding(tenantId, tipo, refIdFromKey(key), contenido);
}

async function removeByKey(tenantId: string, tipo: string, key: string): Promise<void> {
  return removeEmbedding(tenantId, tipo, refIdFromKey(key));
}

/** Indexa en background si RAG está habilitado (no bloquea la respuesta HTTP). */
function maybeIndex(tenantId: string, tipo: string, key: string, record: any): void {
  if (process.env.OLLAMA_ENABLED !== 'true' || !key) return;
  storeByKey(tenantId, tipo, key, buildContent(tipo, record)).catch((err) =>
    console.error(`[Embeddings] store ${tipo}:`, err)
  );
}

function maybeUnindex(tenantId: string, tipo: string, key: string): void {
  if (process.env.OLLAMA_ENABLED !== 'true' || !key) return;
  removeByKey(tenantId, tipo, key).catch((err) =>
    console.error(`[Embeddings] remove ${tipo}:`, err)
  );
}

export const embeddings = {
  getEmbedding,
  cosineSimilarity,
  searchSimilar,
  queryRag,
  store: upsertEmbedding,
  remove: removeEmbedding,
  storeByKey,
  removeByKey,
  maybeIndex,
  maybeUnindex,
  refIdFromKey,
  buildContent,
  reindexAll,
  getConfig,
};
