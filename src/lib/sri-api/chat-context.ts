import { AuditAlert } from './audit-engine';
import { calculateTaxSummary, ComprobanteTaxRow } from './tax-calculator';

export function buildChatSystemPrompt(context: {
  userRuc: string;
  razonSocial: string;
  regimen: string | null;
  ambiente: string;
  certDaysLeft: number | null;
  certExpiry: string | null;
  whatsappEstado: string;
  whatsappNumero: string | null;
  comprobantes: ComprobanteTaxRow[];
  alerts: AuditAlert[];
  recentJobs?: any[];
}) {
  const summary = calculateTaxSummary(context.comprobantes, context.userRuc);

  const noAutorizados = context.comprobantes.filter(
    (c) => c.estado && c.estado !== 'AUTORIZADO'
  ).length;

  const categorias = context.comprobantes.reduce<Record<string, number>>((acc, c) => {
    const cat = c.categoria || 'Sin categoría';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const alertasResumen = context.alerts.slice(0, 8).map((a) => ({
    titulo: a.title,
    riesgo: a.risk,
    descripcion: a.description,
  }));

  const formatDate = (d: any): string | null => {
    if (!d) return null;
    try {
      return new Date(d).toISOString().slice(0, 10);
    } catch (e) {
      return String(d);
    }
  };

  const accountData = {
    contribuyente: {
      ruc: context.userRuc,
      razonSocial: context.razonSocial,
      regimen: context.regimen,
      ambiente: context.ambiente,
      firmaDigital: {
        vence: context.certExpiry,
        diasRestantes: context.certDaysLeft,
      },
      whatsapp: {
        estado: context.whatsappEstado,
        numero: context.whatsappNumero,
      },
    },
    resumenTributario: {
      totalComprobantes: context.comprobantes.length,
      facturasCompras: summary.compras.length,
      facturasVentas: summary.ventas.length,
      retenciones: summary.retenciones.length,
      comprasSubtotal: round(summary.totalComprasSub),
      comprasIva: round(summary.totalComprasIva),
      comprasTotal: round(summary.totalComprasImporte),
      ventasSubtotal: round(summary.totalVentasSub),
      ventasIva: round(summary.totalVentasIva),
      ventasTotal: round(summary.totalVentasImporte),
      retencionesImporte: round(summary.totalRetencionesImporte),
      ivaAPagar: round(summary.ivaAPagar),
      ivaAPagarNeto: round(summary.ivaAPagarNeto),
      saldoAFavor: summary.ivaAPagar < 0 ? round(Math.abs(summary.ivaAPagar)) : 0,
      comprobantesNoAutorizados: noAutorizados,
    },
    categoriasGasto: categorias,
    alertasAuditoria: alertasResumen,
    tareasDescargaRecientes: context.recentJobs?.map((j) => ({
      id: j.id,
      desde: formatDate(j.fecha_desde),
      hasta: formatDate(j.fecha_hasta),
      tipo: j.tipo_comprobante === '1' ? 'Facturas' : j.tipo_comprobante === '6' ? 'Retenciones' : j.tipo_comprobante,
      estado: j.status, // PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
      progreso: j.progress_message || '',
      fechaSolicitud: formatDate(j.created_at),
    })) || [],
    ultimosComprobantes: context.comprobantes.slice(0, 5).map((c) => ({
      tipo: c.tipo || c.tipo_comprobante,
      secuencial: c.secuencial,
      emisor: c.emisor_razon_social,
      importe: c.importe_total,
      estado: c.estado,
      fecha: c.fecha_emision,
    })),
  };

  return `Eres el Asistente Tributario IA de OFSERCONT para contribuyentes ecuatorianos.

REGLAS:
- Responde SIEMPRE en español ecuatoriano, claro y profesional.
- Usa ÚNICAMENTE los datos del JSON "datosCuenta" para cifras, montos y hechos de ESTE contribuyente.
- Si el usuario pregunta algo que no está en los datos, dilo explícitamente y sugiere qué módulo usar (Documentos, Declaraciones, Auditoría, Configuración).
- Si el usuario te pide descargar, extraer, sincronizar o buscar comprobantes/documentos del SRI para un rango de fechas o período, debes llamar obligatoriamente a la herramienta/función ` + "`extraer_documentos_sri`" + `. No respondas con texto plano de que no puedes o de que lo harás manualmente; usa la función para realizar la descarga en segundo plano.
- Si la función requiere RUC o Contraseña del SRI y no están configurados en datosCuenta ni provistos en el chat, pídelos cortésmente.
- Si el usuario pregunta por el estado de una descarga, sincronización o tarea solicitada (ej. "¿Cómo va la descarga?", "¿Qué pasó con mi solicitud?", "¿Se bajaron los documentos?"), consulta la lista de "tareasDescargaRecientes" en datosCuenta. Responde resumiendo el estado actual de las tareas recientes, incluyendo el rango de fechas, el RUC, el estado (PENDING/PROCESSING/COMPLETED/etc.) y el mensaje de progreso actual. Si está COMPLETED, infórmale que los documentos ya se pueden revisar en el panel o módulo de comprobantes.
- No inventes montos, fechas, RUCs ni obligaciones no respaldadas por los datos.
- Puedes explicar normativa general del SRI/IVA/RIMPE cuando ayude, pero distingue entre norma general y datos reales de la cuenta.
- Formato de respuesta: HTML simple (<strong>, <em>, <br/>, viñetas con "• "). Sin markdown.
- Sé conciso (máximo 3-4 párrafos salvo que pidan detalle).
- Si preguntan por IVA a pagar, muestra el desglose con los valores reales.
- Si hay alertas de auditoría, menciónalas cuando sea relevante.
- Fecha de referencia: ${new Date().toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

datosCuenta = ${JSON.stringify(accountData, null, 2)}`;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
