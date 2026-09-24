import { getTenantLlmConfig, type TenantLlmConfig } from './tenant-llm-config';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type LlmProvider = 'gemini' | 'claude';

function getAnthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
}

export function resolveLlmProvider(tenantConfig?: TenantLlmConfig | null): LlmProvider | null {
  if (tenantConfig) {
    if (tenantConfig.provider === 'gemini' && tenantConfig.geminiKey) return 'gemini';
    if (tenantConfig.provider === 'claude' && tenantConfig.claudeKey) return 'claude';
    if (tenantConfig.geminiKey) return 'gemini';
    if (tenantConfig.claudeKey) return 'claude';
  }

  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasClaude = !!getAnthropicKey();

  if (explicit === 'gemini' && hasGemini) return 'gemini';
  if (explicit === 'claude' && hasClaude) return 'claude';
  if (hasGemini) return 'gemini';
  if (hasClaude) return 'claude';
  return null;
}

export async function resolveLlmForTenant(tenantId?: string | null) {
  const tenantConfig = tenantId ? await getTenantLlmConfig(tenantId) : null;
  const provider = resolveLlmProvider(tenantConfig);
  const model =
    tenantConfig?.model ||
    (provider === 'gemini'
      ? process.env.GEMINI_MODEL || 'gemini-2.5-flash'
      : process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219');

  const geminiKey = tenantConfig?.geminiKey || process.env.GEMINI_API_KEY;
  const claudeKey = tenantConfig?.claudeKey || getAnthropicKey();

  return { provider, model, geminiKey, claudeKey, tenantConfig };
}

const SRI_TOOLS_GEMINI = [
  {
    functionDeclarations: [
      {
        name: 'extraer_documentos_sri',
        description: 'Conecta al SRI, inicia sesión con el RUC y contraseña del contribuyente, y extrae (descarga) los comprobantes electrónicos (facturas, retenciones, etc.) en un rango de fechas. Si el usuario menciona un mes o período (ej. "agosto", "agosto 2026", "el mes pasado"), calcula el rango completo de ese mes: fechaDesde = día 1 del mes y fechaHasta = último día del mes. Usa el año actual salvo que el usuario indique otro.',
        parameters: {
          type: 'OBJECT',
          properties: {
            ruc: {
              type: 'STRING',
              description: 'RUC de 13 dígitos del contribuyente. Opcional si ya está configurado en el sistema.',
            },
            sriPassword: {
              type: 'STRING',
              description: 'Contraseña de la cuenta del SRI. Opcional si ya está configurada en el sistema.',
            },
            fechaDesde: {
              type: 'STRING',
              description: 'Fecha de inicio del rango a consultar (YYYY-MM-DD, ej: 2026-08-01). Si el usuario pide un mes, usa el día 1 de ese mes.',
            },
            fechaHasta: {
              type: 'STRING',
              description: 'Fecha de fin del rango a consultar (YYYY-MM-DD, ej: 2026-08-31). Si el usuario pide un mes, usa el último día de ese mes.',
            },
            tipoComprobante: {
              type: 'STRING',
              description: 'Tipo de comprobante a buscar: "1" (Facturas), "2" (Liquidaciones), "3" (Notas de Crédito), "4" (Notas de Débito), "6" (Retenciones), o "todos". Por defecto "todos".',
              enum: ['1', '2', '3', '4', '6', 'todos'],
            },
          },
          required: ['fechaDesde', 'fechaHasta'],
        },
      },
      {
        name: 'crear_producto',
        description: 'Crea un producto en el inventario con su código, nombre, precio unitario, porcentaje de IVA y stock. Úsala cuando el usuario pida agregar un producto o artículo con precio y existencia.',
        parameters: {
          type: 'OBJECT',
          properties: {
            codigo: { type: 'STRING', description: 'Código único del producto (ej: P001, SKU).' },
            nombre: { type: 'STRING', description: 'Nombre o descripción breve del producto.' },
            precio: { type: 'NUMBER', description: 'Precio unitario sin IVA en dólares.' },
            iva: { type: 'NUMBER', description: 'Porcentaje de IVA aplicable (0, 5 o 15). Por defecto 15.' },
            stock: { type: 'NUMBER', description: 'Cantidad en stock inicial. Por defecto 0.' },
            descripcion: { type: 'STRING', description: 'Descripción extendida (opcional).' },
          },
          required: ['codigo', 'nombre', 'precio'],
        },
      },
      {
        name: 'listar_productos',
        description: 'Lista los productos del inventario (código, nombre, precio, IVA y stock). Úsala cuando el usuario pregunte por sus productos, precios o stock disponible.',
        parameters: {
          type: 'OBJECT',
          properties: {
            termino: { type: 'STRING', description: 'Texto de búsqueda por nombre o código (opcional).' },
          },
        },
      },
      {
        name: 'crear_contacto',
        description: 'Registra un cliente y/o proveedor (RUC, cédula, razón social, email, teléfono). Úsala cuando el usuario quiera dar de alta un cliente o proveedor nuevo.',
        parameters: {
          type: 'OBJECT',
          properties: {
            tipoIdentificacion: { type: 'STRING', description: 'Tipo de identificación: 04=RUC, 05=Cédula, 06=Pasaporte, 07=Consumidor Final.' },
            identificacion: { type: 'STRING', description: 'Número de RUC (13 dígitos) o cédula (10 dígitos).' },
            razonSocial: { type: 'STRING', description: 'Razón social o nombres del cliente/proveedor.' },
            email: { type: 'STRING', description: 'Correo electrónico (opcional).' },
            telefono: { type: 'STRING', description: 'Teléfono (opcional).' },
            direccion: { type: 'STRING', description: 'Dirección (opcional).' },
            esCliente: { type: 'BOOLEAN', description: 'Si es cliente. Por defecto true.' },
            esProveedor: { type: 'BOOLEAN', description: 'Si es proveedor. Por defecto false.' },
          },
          required: ['identificacion', 'razonSocial'],
        },
      },
      {
        name: 'emitir_factura',
        description: 'Emite una factura electrónica al SRI en tiempo real con los productos indicados (por código de inventario o con precio/cantidad), calculando IVA y totales. Genera cuenta por cobrar automáticamente si el plazo (crédito) es mayor a 0.',
        parameters: {
          type: 'OBJECT',
          properties: {
            emisorRuc: { type: 'STRING', description: 'RUC del emisor (opcional; se usa el RUC vinculado por defecto).' },
            cliente: {
              type: 'OBJECT',
              description: 'Datos del comprador. Si solo das la identificación y existe un contacto, se completa solo.',
              properties: {
                tipoIdentificacion: { type: 'STRING', description: '04=RUC, 05=Cédula, 06=Pasaporte, 07=Consumidor Final.' },
                identificacion: { type: 'STRING', description: 'RUC o cédula del cliente.' },
                razonSocial: { type: 'STRING', description: 'Razón social del cliente.' },
                email: { type: 'STRING', description: 'Email del cliente (opcional).' },
              },
            },
            items: {
              type: 'ARRAY',
              description: 'Lista de productos a facturar. Puedes usar código o nombre de inventario (el sistema completa precio/IVA), o indicar descripcion/precioUnitario/cantidad directamente.',
              items: {
                type: 'OBJECT',
                properties: {
                  codigo: { type: 'STRING', description: 'Código de inventario (opcional si das precio).' },
                  descripcion: { type: 'STRING', description: 'Descripción o nombre del producto.' },
                  cantidad: { type: 'NUMBER', description: 'Cantidad. Por defecto 1.' },
                  precioUnitario: { type: 'NUMBER', description: 'Precio unitario sin IVA (opcional si existe en inventario).' },
                  iva: { type: 'NUMBER', description: 'Porcentaje IVA: 0, 5 o 15 (opcional; usa el de inventario).' },
                },
              },
            },
            plazo: { type: 'NUMBER', description: 'Días de crédito. Si es mayor a 0 se genera cuenta por cobrar automáticamente (0 = contado).' },
            formaPago: { type: 'STRING', description: 'Forma de pago SRI: 01=sin utilización sistema financiero (contado), 15=compensación de deudas (crédito), etc.' },
            fechaEmision: { type: 'STRING', description: 'Fecha de emisión (YYYY-MM-DD). Por defecto hoy.' },
          },
          required: ['cliente', 'items'],
        },
      },
      {
        name: 'registrar_pago',
        description: 'Registra un pago o abono sobre una cuenta por cobrar (de un cliente) o por pagar (a un proveedor), actualizando saldo y estado. Localiza la cuenta por su ID, número de documento o identificación.',
        parameters: {
          type: 'OBJECT',
          properties: {
            tipoCuenta: { type: 'STRING', description: 'Tipo de cuenta: "COBRAR" (cobrar a cliente) o "PAGAR" (pagar a proveedor). Por defecto COBRAR.', enum: ['COBRAR', 'PAGAR'] },
            monto: { type: 'NUMBER', description: 'Monto del pago o abono en dólares.' },
            numeroDocumento: { type: 'STRING', description: 'Número del documento de la cuenta (ej: 001-001-000000001).' },
            identificacion: { type: 'STRING', description: 'RUC o cédula del cliente (COBRAR) o proveedor (PAGAR).' },
            cuentaId: { type: 'STRING', description: 'ID de la cuenta (opcional, si se conoce).' },
            fecha: { type: 'STRING', description: 'Fecha del pago (YYYY-MM-DD). Por defecto hoy.' },
            metodoPago: { type: 'STRING', description: 'Método: EFECTIVO, TRANSFERENCIA, TARJETA, CHEQUE, DEPOSITO, BANCO, OTRO.' },
            referencia: { type: 'STRING', description: 'Referencia (n° transferencia, cheque...).' },
          },
          required: ['monto', 'tipoCuenta'],
        },
      },
      {
        name: 'consultar_cuentas',
        description: 'Consulta el resumen de cuentas por cobrar y por pagar: saldos pendientes, vencidos, cuentas vencidas y próximos vencimientos. Úsala cuando el usuario pregunte cuánto le deben, cuánto debe, o por sus cuentas por cobrar/pagar.',
        parameters: {
          type: 'OBJECT',
          properties: {
            tipo: { type: 'STRING', description: 'Qué consultar: "COBRAR", "PAGAR" o "TODAS" (ambas).', enum: ['COBRAR', 'PAGAR', 'TODAS'] },
            limite: { type: 'NUMBER', description: 'Máximo de cuentas a detallar (por defecto 5).' },
          },
        },
      },
      {
        name: 'proyeccion_fiscal',
        description:
          'Calcula la proyección fiscal de IVA e Impuesto a la Renta para los próximos N meses con base en el promedio de comprobantes históricos. Úsala cuando el usuario pida proyección fiscal, estimación de IVA/IR a futuro o proyección de los próximos meses.',
        parameters: {
          type: 'OBJECT',
          properties: {
            meses: {
              type: 'NUMBER',
              description: 'Cantidad de meses a proyectar (1–12). Por defecto 3.',
            },
          },
        },
      },
      {
        name: 'consultar_estado_descarga',
        description: 'Consulta el estado de las descargas de comprobantes del SRI (en cola, en proceso, completada, error). Úsala cuando el usuario pregunte cómo va o en qué estado está su descarga del SRI, sin necesidad de jobId.',
        parameters: {
          type: 'OBJECT',
          properties: {
            jobId: { type: 'STRING', description: 'ID de la tarea de descarga (opcional; si se omite se muestran las últimas 5).' },
          },
        },
      },
      {
        name: 'verificar_comprobante',
        description: 'Verifica en el SRI el estado de autorización de un comprobante electrónico (AUTORIZADO, NO AUTORIZADO, devuelto o en proceso) usando su clave de acceso de 49 dígitos. Úsala cuando el usuario pregunte si una factura o nota de crédito ya está autorizada, aceptada o rechazada.',
        parameters: {
          type: 'OBJECT',
          properties: {
            claveAcceso: { type: 'STRING', description: 'Clave de acceso de 49 dígitos del comprobante.' },
          },
          required: ['claveAcceso'],
        },
      },
      {
        name: 'emitir_retencion',
        description: 'Emite un comprobante de retención electrónico al SRI para un proveedor. Requiere el período fiscal y los impuestos retenidos con su documento sustento. El sujeto retenido se completa desde contactos si solo das la identificación.',
        parameters: {
          type: 'OBJECT',
          properties: {
            emisorRuc: { type: 'STRING', description: 'RUC del emisor (opcional; se usa el RUC vinculado por defecto).' },
            sujetoRetenido: {
              type: 'OBJECT',
              description: 'Proveedor al que se retiene.',
              properties: {
                tipoIdentificacion: { type: 'STRING', description: '04=RUC, 05=Cédula, 06=Pasaporte.' },
                razonSocial: { type: 'STRING', description: 'Razón social del proveedor.' },
                identificacion: { type: 'STRING', description: 'RUC o cédula del proveedor.' },
                email: { type: 'STRING', description: 'Email para envío del comprobante (opcional).' },
              },
            },
            periodoFiscal: { type: 'STRING', description: 'Período fiscal en formato YYYY-MM (ej. 2026-08).' },
            fechaEmision: { type: 'STRING', description: 'Fecha de emisión (por defecto hoy).' },
            impuestos: {
              type: 'ARRAY',
              description: 'Impuestos retenidos. codigo: 1=Renta, 2=IVA. codDocSustento: 01=Factura, 04=NC, 05=ND, 06=Nota de venta.',
              items: {
                type: 'OBJECT',
                properties: {
                  codigo: { type: 'STRING', description: '"1" renta o "2" IVA (por defecto "2").' },
                  codigoRetencion: { type: 'STRING', description: 'Código de retención SRI (ej. IVA: 1..6; Renta: 303, 304, etc.).' },
                  baseImponible: { type: 'NUMBER', description: 'Base imponible del documento sustento.' },
                  porcentajeRetener: { type: 'NUMBER', description: 'Porcentaje retenido (si se omite se calcula del valor retenido).' },
                  valorRetenido: { type: 'NUMBER', description: 'Valor retenido.' },
                  codDocSustento: { type: 'STRING', description: 'Tipo de documento sustento ("01" factura por defecto).' },
                  numDocSustento: { type: 'STRING', description: 'Número del documento sustento (ej. 001-001-000000012).' },
                  fechaEmisionDocSustento: { type: 'STRING', description: 'Fecha de emisión del sustento (YYYY-MM-DD o DD/MM/YYYY).' },
                },
                required: ['baseImponible', 'valorRetenido', 'numDocSustento', 'fechaEmisionDocSustento'],
              },
            },
          },
          required: ['sujetoRetenido', 'periodoFiscal', 'impuestos'],
        },
      },
      {
        name: 'generar_guia_remision',
        description: 'Genera una guía de remisión electrónica al SRI para traslado de mercadería. Requiere destinatario, placa y RUC del transportista, motivo del traslado, direcciones de partida/llegada y los productos con cantidades.',
        parameters: {
          type: 'OBJECT',
          properties: {
            emisorRuc: { type: 'STRING', description: 'RUC del emisor (opcional; se usa el RUC vinculado por defecto).' },
            destinatario: {
              type: 'OBJECT',
              description: 'Quien recibe la mercadería.',
              properties: {
                tipoIdentificacion: { type: 'STRING', description: '04=RUC, 05=Cédula, 06=Pasaporte.' },
                razonSocial: { type: 'STRING', description: 'Razón social del destinatario.' },
                identificacion: { type: 'STRING', description: 'RUC o cédula del destinatario.' },
              },
            },
            placa: { type: 'STRING', description: 'Placa del vehículo de transporte.' },
            transportistaRuc: { type: 'STRING', description: 'RUC o cédula del transportista.' },
            transportistaRazonSocial: { type: 'STRING', description: 'Razón social del transportista (se busca en contactos si se omite).' },
            motivoTraslado: { type: 'STRING', description: 'Motivo del traslado (ej. VENTA, TRASLADO, CONSIGNACIÓN).' },
            fechaInicioTransporte: { type: 'STRING', description: 'Fecha de inicio del transporte (por defecto hoy).' },
            fechaFinTransporte: { type: 'STRING', description: 'Fecha fin del transporte (opcional).' },
            direccionPartida: { type: 'STRING', description: 'Dirección de partida (por defecto la matriz del emisor).' },
            direccionLlegada: { type: 'STRING', description: 'Dirección de llegada.' },
            numeroFactura: { type: 'STRING', description: 'Factura asociada (opcional, ej. 001-001-000000012).' },
            items: {
              type: 'ARRAY',
              description: 'Mercadería trasladada; se completa desde inventario si falta descripción.',
              items: {
                type: 'OBJECT',
                properties: {
                  codigo: { type: 'STRING', description: 'Código del producto.' },
                  descripcion: { type: 'STRING', description: 'Descripción del producto.' },
                  cantidad: { type: 'NUMBER', description: 'Cantidad (por defecto 1).' },
                },
              },
            },
          },
          required: ['destinatario', 'placa', 'transportistaRuc', 'items'],
        },
      },
      {
        name: 'reenviar_comprobante_sri',
        description: 'Reenvía (retransmite) al SRI un comprobante que quedó PENDIENTE o DEVUELTA usando su clave de acceso de 49 dígitos. No aplica a comprobantes ya AUTORIZADOS ni EN_PROCESO.',
        parameters: {
          type: 'OBJECT',
          properties: {
            claveAcceso: { type: 'STRING', description: 'Clave de acceso de 49 dígitos del comprobante.' },
          },
          required: ['claveAcceso'],
        },
      },
      {
        name: 'ajustar_inventario',
        description: 'Registra un movimiento de inventario (ENTRADA suma stock, SALIDA resta, AJUSTE fija el stock exacto) para un producto encontrado por código o nombre. Úsala cuando el usuario pida agregar/sumar stock, descontar unidades o corregir el stock de un producto.',
        parameters: {
          type: 'OBJECT',
          properties: {
            producto: { type: 'STRING', description: 'Código o nombre del producto.' },
            tipo: { type: 'STRING', description: 'ENTRADA, SALIDA o AJUSTE.', enum: ['ENTRADA', 'SALIDA', 'AJUSTE'] },
            cantidad: { type: 'NUMBER', description: 'Cantidad a mover (>0). Para AJUSTE es el stock final exacto.' },
            motivo: { type: 'STRING', description: 'Motivo del movimiento (opcional).' },
            referencia: { type: 'STRING', description: 'Referencia documental (opcional).' },
          },
          required: ['producto', 'tipo', 'cantidad'],
        },
      },
      {
        name: 'buscar_contactos',
        description: 'Busca y lista contactos registrados (clientes y/o proveedores) por nombre o identificación, mostrando email y teléfono. Úsala cuando el usuario pregunte si tiene registrado un cliente/proveedor o pida sus datos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            termino: { type: 'STRING', description: 'Nombre o identificación a buscar (opcional).' },
            tipo: { type: 'STRING', description: 'Filtrar por "CLIENTE" o "PROVEEDOR" (opcional).' },
          },
        },
      },
      {
        name: 'consultar_vencimientos',
        description: 'Muestra la antigüedad de saldos (aging) de cuentas por cobrar y por pagar en rangos 0-30, 31-60, 61-90 y 90+ días, más las cuentas vencidas más antiguas. Úsala cuando el usuario pregunte por vencimientos, morosidad o antigüedad de deudas.',
        parameters: {
          type: 'OBJECT',
          properties: {
            tipo: { type: 'STRING', description: '"COBRAR", "PAGAR" o "TODAS" (por defecto TODAS).', enum: ['COBRAR', 'PAGAR', 'TODAS'] },
          },
        },
      },
      {
        name: 'emitir_nota_credito',
        description: 'Emite una nota de crédito electrónica al SRI para modificar una factura ya emitida (devoluciones, descuentos, correcciones). Requiere el número y fecha de la factura modificada y el motivo. Los ítems se resuelven igual que en emitir_factura.',
        parameters: {
          type: 'OBJECT',
          properties: {
            emisorRuc: { type: 'STRING', description: 'RUC del emisor (opcional; se usa el RUC vinculado por defecto).' },
            cliente: {
              type: 'OBJECT',
              description: 'Datos del comprador original. Si solo das la identificación y existe un contacto, se completa solo.',
              properties: {
                tipoIdentificacion: { type: 'STRING', description: '04=RUC, 05=Cédula, 06=Pasaporte, 07=Consumidor Final.' },
                identificacion: { type: 'STRING', description: 'RUC o cédula del cliente.' },
                razonSocial: { type: 'STRING', description: 'Razón social del cliente.' },
                email: { type: 'STRING', description: 'Email del cliente (opcional).' },
              },
            },
            docModificado: {
              type: 'OBJECT',
              description: 'Factura que se modifica (obligatoria).',
              properties: {
                tipo: { type: 'STRING', description: 'Tipo del documento modificado: "01" = factura (por defecto).' },
                numero: { type: 'STRING', description: 'Número completo (ej: 001-001-000000012).' },
                fecha: { type: 'STRING', description: 'Fecha de emisión del documento modificado (YYYY-MM-DD o DD/MM/YYYY).' },
              },
              required: ['numero', 'fecha'],
            },
            motivo: { type: 'STRING', description: 'Motivo de la nota de crédito (devolución, error de precio, descuento...).' },
            items: {
              type: 'ARRAY',
              description: 'Productos/devoluciones incluidos (igual que en emitir_factura: código de inventario o descripcion/precioUnitario/cantidad).',
              items: {
                type: 'OBJECT',
                properties: {
                  codigo: { type: 'STRING', description: 'Código de inventario (opcional si das precio).' },
                  descripcion: { type: 'STRING', description: 'Descripción o nombre del producto.' },
                  cantidad: { type: 'NUMBER', description: 'Cantidad. Por defecto 1.' },
                  precioUnitario: { type: 'NUMBER', description: 'Precio unitario sin IVA (opcional si existe en inventario).' },
                  iva: { type: 'NUMBER', description: 'Porcentaje IVA: 0, 5 o 15 (opcional; usa el de inventario).' },
                },
              },
            },
          },
          required: ['cliente', 'docModificado', 'motivo', 'items'],
        },
      },
      {
        name: 'consultar_contabilidad_rag',
        description:
          'Alias de consultar_sistema_rag. NO usar para IVA, obligaciones ni resumen tributario (eso va con datosCuenta).',
        parameters: {
          type: 'OBJECT',
          properties: {
            pregunta: {
              type: 'STRING',
              description: 'Pregunta contable/semántica (plan de cuentas, asientos, empleado, producto). No IVA ni obligaciones.',
            },
          },
          required: ['pregunta'],
        },
      },
      {
        name: 'consultar_sistema_rag',
        description:
          'Búsqueda semántica (RAG) SOLO para plan de cuentas, asientos contables, detalle de empleados o productos cuando no baste listar_productos. NO usar para IVA a pagar, obligaciones, retenciones, formularios 103/104, RIMPE, alertas ni totales de compras/ventas (responde con el contexto tributario del chat). NO usar si existe herramienta específica (consultar_cuentas, listar_productos, extraer_documentos_sri).',
        parameters: {
          type: 'OBJECT',
          properties: {
            pregunta: {
              type: 'STRING',
              description:
                'Pregunta contable/semántica (ej. cuenta 1.1.01, asiento de marzo, cédula de un empleado). No preguntar IVA ni obligaciones aquí.',
            },
          },
          required: ['pregunta'],
        },
      },
    ],
  },
];

const SRI_TOOLS_CLAUDE = [
  {
    name: 'extraer_documentos_sri',
    description: 'Conecta al SRI, inicia sesión con el RUC y contraseña del contribuyente, y extrae (descarga) los comprobantes electrónicos (facturas, retenciones, etc.) en un rango de fechas. Si el usuario menciona un mes o período (ej. "agosto", "agosto 2026", "el mes pasado"), calcula el rango completo de ese mes: fechaDesde = día 1 del mes y fechaHasta = último día del mes. Usa el año actual salvo que el usuario indique otro.',
    input_schema: {
      type: 'object',
      properties: {
        ruc: {
          type: 'string',
          description: 'RUC de 13 dígitos del contribuyente. Opcional si ya está configurado en el sistema.',
        },
        sriPassword: {
          type: 'string',
          description: 'Contraseña de la cuenta del SRI. Opcional si ya está configurada en el sistema.',
        },
        fechaDesde: {
          type: 'string',
          description: 'Fecha de inicio del rango a consultar (YYYY-MM-DD, ej: 2026-08-01). Si el usuario pide un mes, usa el día 1 de ese mes.',
        },
        fechaHasta: {
          type: 'string',
          description: 'Fecha de fin del rango a consultar (YYYY-MM-DD, ej: 2026-08-31). Si el usuario pide un mes, usa el último día de ese mes.',
        },
        tipoComprobante: {
          type: 'string',
          description: 'Tipo de comprobante a buscar: "1" (Facturas), "2" (Liquidaciones), "3" (Notas de Crédito), "4" (Notas de Débito), "6" (Retenciones), o "todos". Por defecto "todos".',
          enum: ['1', '2', '3', '4', '6', 'todos'],
        },
      },
      required: ['fechaDesde', 'fechaHasta'],
    },
  },
  {
    name: 'crear_producto',
    description: 'Crea un producto en el inventario con su código, nombre, precio unitario, porcentaje de IVA y stock. Úsala cuando el usuario pida agregar un producto o artículo con precio y existencia.',
    input_schema: {
      type: 'object',
      properties: {
        codigo: { type: 'string', description: 'Código único del producto (ej: P001, SKU).' },
        nombre: { type: 'string', description: 'Nombre o descripción breve del producto.' },
        precio: { type: 'number', description: 'Precio unitario sin IVA en dólares.' },
        iva: { type: 'number', description: 'Porcentaje de IVA aplicable (0, 5 o 15). Por defecto 15.' },
        stock: { type: 'number', description: 'Cantidad en stock inicial. Por defecto 0.' },
        descripcion: { type: 'string', description: 'Descripción extendida (opcional).' },
      },
      required: ['codigo', 'nombre', 'precio'],
    },
  },
  {
    name: 'listar_productos',
    description: 'Lista los productos del inventario (código, nombre, precio, IVA y stock). Úsala cuando el usuario pregunte por sus productos, precios o stock disponible.',
    input_schema: {
      type: 'object',
      properties: {
        termino: { type: 'string', description: 'Texto de búsqueda por nombre o código (opcional).' },
      },
    },
  },
  {
    name: 'crear_contacto',
    description: 'Registra un cliente y/o proveedor (RUC, cédula, razón social, email, teléfono). Úsala cuando el usuario quiera dar de alta un cliente o proveedor nuevo.',
    input_schema: {
      type: 'object',
      properties: {
        tipoIdentificacion: { type: 'string', description: 'Tipo de identificación: 04=RUC, 05=Cédula, 06=Pasaporte, 07=Consumidor Final.' },
        identificacion: { type: 'string', description: 'Número de RUC (13 dígitos) o cédula (10 dígitos).' },
        razonSocial: { type: 'string', description: 'Razón social o nombres del cliente/proveedor.' },
        email: { type: 'string', description: 'Correo electrónico (opcional).' },
        telefono: { type: 'string', description: 'Teléfono (opcional).' },
        direccion: { type: 'string', description: 'Dirección (opcional).' },
        esCliente: { type: 'boolean', description: 'Si es cliente. Por defecto true.' },
        esProveedor: { type: 'boolean', description: 'Si es proveedor. Por defecto false.' },
      },
      required: ['identificacion', 'razonSocial'],
    },
  },
  {
    name: 'emitir_factura',
    description: 'Emite una factura electrónica al SRI en tiempo real con los productos indicados (por código de inventario o con precio/cantidad), calculando IVA y totales. Genera cuenta por cobrar automáticamente si el plazo (crédito) es mayor a 0.',
    input_schema: {
      type: 'object',
      properties: {
        emisorRuc: { type: 'string', description: 'RUC del emisor (opcional; se usa el RUC vinculado por defecto).' },
        cliente: {
          type: 'object',
          description: 'Datos del comprador. Si solo das la identificación y existe un contacto, se completa solo.',
          properties: {
            tipoIdentificacion: { type: 'string', description: '04=RUC, 05=Cédula, 06=Pasaporte, 07=Consumidor Final.' },
            identificacion: { type: 'string', description: 'RUC o cédula del cliente.' },
            razonSocial: { type: 'string', description: 'Razón social del cliente.' },
            email: { type: 'string', description: 'Email del cliente (opcional).' },
          },
        },
        items: {
          type: 'array',
          description: 'Lista de productos a facturar. Puedes usar código o nombre de inventario (el sistema completa precio/IVA), o indicar descripcion/precioUnitario/cantidad directamente.',
          items: {
            type: 'object',
            properties: {
              codigo: { type: 'string', description: 'Código de inventario (opcional si das precio).' },
              descripcion: { type: 'string', description: 'Descripción o nombre del producto.' },
              cantidad: { type: 'number', description: 'Cantidad. Por defecto 1.' },
              precioUnitario: { type: 'number', description: 'Precio unitario sin IVA (opcional si existe en inventario).' },
              iva: { type: 'number', description: 'Porcentaje IVA: 0, 5 o 15 (opcional; usa el de inventario).' },
            },
          },
        },
        plazo: { type: 'number', description: 'Días de crédito. Si es mayor a 0 se genera cuenta por cobrar automáticamente (0 = contado).' },
        formaPago: { type: 'string', description: 'Forma de pago SRI: 01=sin utilización sistema financiero (contado), 15=compensación de deudas (crédito), etc.' },
        fechaEmision: { type: 'string', description: 'Fecha de emisión (YYYY-MM-DD). Por defecto hoy.' },
      },
      required: ['cliente', 'items'],
    },
  },
  {
    name: 'registrar_pago',
    description: 'Registra un pago o abono sobre una cuenta por cobrar (de un cliente) o por pagar (a un proveedor), actualizando saldo y estado. Localiza la cuenta por su ID, número de documento o identificación.',
    input_schema: {
      type: 'object',
      properties: {
        tipoCuenta: { type: 'string', description: 'Tipo de cuenta: "COBRAR" (cobrar a cliente) o "PAGAR" (pagar a proveedor). Por defecto COBRAR.', enum: ['COBRAR', 'PAGAR'] },
        monto: { type: 'number', description: 'Monto del pago o abono en dólares.' },
        numeroDocumento: { type: 'string', description: 'Número del documento de la cuenta (ej: 001-001-000000001).' },
        identificacion: { type: 'string', description: 'RUC o cédula del cliente (COBRAR) o proveedor (PAGAR).' },
        cuentaId: { type: 'string', description: 'ID de la cuenta (opcional, si se conoce).' },
        fecha: { type: 'string', description: 'Fecha del pago (YYYY-MM-DD). Por defecto hoy.' },
        metodoPago: { type: 'string', description: 'Método: EFECTIVO, TRANSFERENCIA, TARJETA, CHEQUE, DEPOSITO, BANCO, OTRO.' },
        referencia: { type: 'string', description: 'Referencia (n° transferencia, cheque...).' },
      },
      required: ['monto', 'tipoCuenta'],
    },
  },
  {
    name: 'consultar_cuentas',
    description: 'Consulta el resumen de cuentas por cobrar y por pagar: saldos pendientes, vencidos, cuentas vencidas y próximos vencimientos. Úsala cuando el usuario pregunte cuánto le deben, cuánto debe, o por sus cuentas por cobrar/pagar.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'Qué consultar: "COBRAR", "PAGAR" o "TODAS" (ambas).', enum: ['COBRAR', 'PAGAR', 'TODAS'] },
        limite: { type: 'number', description: 'Máximo de cuentas a detallar (por defecto 5).' },
      },
    },
  },
  {
    name: 'proyeccion_fiscal',
    description:
      'Calcula la proyección fiscal de IVA e Impuesto a la Renta para los próximos N meses con base en el promedio de comprobantes históricos. Úsala cuando el usuario pida proyección fiscal, estimación de IVA/IR a futuro o proyección de los próximos meses.',
    input_schema: {
      type: 'object',
      properties: {
        meses: {
          type: 'number',
          description: 'Cantidad de meses a proyectar (1–12). Por defecto 3.',
        },
      },
    },
  },
  {
    name: 'consultar_estado_descarga',
    description: 'Consulta el estado de las descargas de comprobantes del SRI (en cola, en proceso, completada, error). Úsala cuando el usuario pregunte cómo va o en qué estado está su descarga del SRI, sin necesidad de jobId.',
    input_schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'ID de la tarea de descarga (opcional; si se omite se muestran las últimas 5).' },
      },
    },
  },
  {
    name: 'verificar_comprobante',
    description: 'Verifica en el SRI el estado de autorización de un comprobante electrónico (AUTORIZADO, NO AUTORIZADO, devuelto o en proceso) usando su clave de acceso de 49 dígitos. Úsala cuando el usuario pregunte si una factura o nota de crédito ya está autorizada, aceptada o rechazada.',
    input_schema: {
      type: 'object',
      properties: {
        claveAcceso: { type: 'string', description: 'Clave de acceso de 49 dígitos del comprobante.' },
      },
      required: ['claveAcceso'],
    },
  },
  {
    name: 'emitir_retencion',
    description: 'Emite un comprobante de retención electrónico al SRI para un proveedor. Requiere el período fiscal y los impuestos retenidos con su documento sustento. El sujeto retenido se completa desde contactos si solo das la identificación.',
    input_schema: {
      type: 'object',
      properties: {
        emisorRuc: { type: 'string', description: 'RUC del emisor (opcional; se usa el RUC vinculado por defecto).' },
        sujetoRetenido: {
          type: 'object',
          description: 'Proveedor al que se retiene.',
          properties: {
            tipoIdentificacion: { type: 'string', description: '04=RUC, 05=Cédula, 06=Pasaporte.' },
            razonSocial: { type: 'string', description: 'Razón social del proveedor.' },
            identificacion: { type: 'string', description: 'RUC o cédula del proveedor.' },
            email: { type: 'string', description: 'Email para envío del comprobante (opcional).' },
          },
        },
        periodoFiscal: { type: 'string', description: 'Período fiscal en formato YYYY-MM (ej. 2026-08).' },
        fechaEmision: { type: 'string', description: 'Fecha de emisión (por defecto hoy).' },
        impuestos: {
          type: 'array',
          description: 'Impuestos retenidos. codigo: 1=Renta, 2=IVA. codDocSustento: 01=Factura, 04=NC, 05=ND, 06=Nota de venta.',
          items: {
            type: 'object',
            properties: {
              codigo: { type: 'string', description: '"1" renta o "2" IVA (por defecto "2").' },
              codigoRetencion: { type: 'string', description: 'Código de retención SRI (ej. IVA: 1..6; Renta: 303, 304, etc.).' },
              baseImponible: { type: 'number', description: 'Base imponible del documento sustento.' },
              porcentajeRetener: { type: 'number', description: 'Porcentaje retenido (si se omite se calcula del valor retenido).' },
              valorRetenido: { type: 'number', description: 'Valor retenido.' },
              codDocSustento: { type: 'string', description: 'Tipo de documento sustento ("01" factura por defecto).' },
              numDocSustento: { type: 'string', description: 'Número del documento sustento (ej. 001-001-000000012).' },
              fechaEmisionDocSustento: { type: 'string', description: 'Fecha de emisión del sustento (YYYY-MM-DD o DD/MM/YYYY).' },
            },
            required: ['baseImponible', 'valorRetenido', 'numDocSustento', 'fechaEmisionDocSustento'],
          },
        },
      },
      required: ['sujetoRetenido', 'periodoFiscal', 'impuestos'],
    },
  },
  {
    name: 'generar_guia_remision',
    description: 'Genera una guía de remisión electrónica al SRI para traslado de mercadería. Requiere destinatario, placa y RUC del transportista, motivo del traslado, direcciones de partida/llegada y los productos con cantidades.',
    input_schema: {
      type: 'object',
      properties: {
        emisorRuc: { type: 'string', description: 'RUC del emisor (opcional; se usa el RUC vinculado por defecto).' },
        destinatario: {
          type: 'object',
          description: 'Quien recibe la mercadería.',
          properties: {
            tipoIdentificacion: { type: 'string', description: '04=RUC, 05=Cédula, 06=Pasaporte.' },
            razonSocial: { type: 'string', description: 'Razón social del destinatario.' },
            identificacion: { type: 'string', description: 'RUC o cédula del destinatario.' },
          },
        },
        placa: { type: 'string', description: 'Placa del vehículo de transporte.' },
        transportistaRuc: { type: 'string', description: 'RUC o cédula del transportista.' },
        transportistaRazonSocial: { type: 'string', description: 'Razón social del transportista (se busca en contactos si se omite).' },
        motivoTraslado: { type: 'string', description: 'Motivo del traslado (ej. VENTA, TRASLADO, CONSIGNACIÓN).' },
        fechaInicioTransporte: { type: 'string', description: 'Fecha de inicio del transporte (por defecto hoy).' },
        fechaFinTransporte: { type: 'string', description: 'Fecha fin del transporte (opcional).' },
        direccionPartida: { type: 'string', description: 'Dirección de partida (por defecto la matriz del emisor).' },
        direccionLlegada: { type: 'string', description: 'Dirección de llegada.' },
        numeroFactura: { type: 'string', description: 'Factura asociada (opcional, ej. 001-001-000000012).' },
        items: {
          type: 'array',
          description: 'Mercadería trasladada; se completa desde inventario si falta descripción.',
          items: {
            type: 'object',
            properties: {
              codigo: { type: 'string', description: 'Código del producto.' },
              descripcion: { type: 'string', description: 'Descripción del producto.' },
              cantidad: { type: 'number', description: 'Cantidad (por defecto 1).' },
            },
          },
        },
      },
      required: ['destinatario', 'placa', 'transportistaRuc', 'items'],
    },
  },
  {
    name: 'reenviar_comprobante_sri',
    description: 'Reenvía (retransmite) al SRI un comprobante que quedó PENDIENTE o DEVUELTA usando su clave de acceso de 49 dígitos. No aplica a comprobantes ya AUTORIZADOS ni EN_PROCESO.',
    input_schema: {
      type: 'object',
      properties: {
        claveAcceso: { type: 'string', description: 'Clave de acceso de 49 dígitos del comprobante.' },
      },
      required: ['claveAcceso'],
    },
  },
  {
    name: 'ajustar_inventario',
    description: 'Registra un movimiento de inventario (ENTRADA suma stock, SALIDA resta, AJUSTE fija el stock exacto) para un producto encontrado por código o nombre. Úsala cuando el usuario pida agregar/sumar stock, descontar unidades o corregir el stock de un producto.',
    input_schema: {
      type: 'object',
      properties: {
        producto: { type: 'string', description: 'Código o nombre del producto.' },
        tipo: { type: 'string', description: 'ENTRADA, SALIDA o AJUSTE.', enum: ['ENTRADA', 'SALIDA', 'AJUSTE'] },
        cantidad: { type: 'number', description: 'Cantidad a mover (>0). Para AJUSTE es el stock final exacto.' },
        motivo: { type: 'string', description: 'Motivo del movimiento (opcional).' },
        referencia: { type: 'string', description: 'Referencia documental (opcional).' },
      },
      required: ['producto', 'tipo', 'cantidad'],
    },
  },
  {
    name: 'buscar_contactos',
    description: 'Busca y lista contactos registrados (clientes y/o proveedores) por nombre o identificación, mostrando email y teléfono. Úsala cuando el usuario pregunte si tiene registrado un cliente/proveedor o pida sus datos.',
    input_schema: {
      type: 'object',
      properties: {
        termino: { type: 'string', description: 'Nombre o identificación a buscar (opcional).' },
        tipo: { type: 'string', description: 'Filtrar por "CLIENTE" o "PROVEEDOR" (opcional).' },
      },
    },
  },
  {
    name: 'consultar_vencimientos',
    description: 'Muestra la antigüedad de saldos (aging) de cuentas por cobrar y por pagar en rangos 0-30, 31-60, 61-90 y 90+ días, más las cuentas vencidas más antiguas. Úsala cuando el usuario pregunte por vencimientos, morosidad o antigüedad de deudas.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: '"COBRAR", "PAGAR" o "TODAS" (por defecto TODAS).', enum: ['COBRAR', 'PAGAR', 'TODAS'] },
      },
    },
  },
  {
    name: 'emitir_nota_credito',
    description: 'Emite una nota de crédito electrónica al SRI para modificar una factura ya emitida (devoluciones, descuentos, correcciones). Requiere el número y fecha de la factura modificada y el motivo. Los ítems se resuelven igual que en emitir_factura.',
    input_schema: {
      type: 'object',
      properties: {
        emisorRuc: { type: 'string', description: 'RUC del emisor (opcional; se usa el RUC vinculado por defecto).' },
        cliente: {
          type: 'object',
          description: 'Datos del comprador original. Si solo das la identificación y existe un contacto, se completa solo.',
          properties: {
            tipoIdentificacion: { type: 'string', description: '04=RUC, 05=Cédula, 06=Pasaporte, 07=Consumidor Final.' },
            identificacion: { type: 'string', description: 'RUC o cédula del cliente.' },
            razonSocial: { type: 'string', description: 'Razón social del cliente.' },
            email: { type: 'string', description: 'Email del cliente (opcional).' },
          },
        },
        docModificado: {
          type: 'object',
          description: 'Factura que se modifica (obligatoria).',
          properties: {
            tipo: { type: 'string', description: 'Tipo del documento modificado: "01" = factura (por defecto).' },
            numero: { type: 'string', description: 'Número completo (ej: 001-001-000000012).' },
            fecha: { type: 'string', description: 'Fecha de emisión del documento modificado (YYYY-MM-DD o DD/MM/YYYY).' },
          },
          required: ['numero', 'fecha'],
        },
        motivo: { type: 'string', description: 'Motivo de la nota de crédito (devolución, error de precio, descuento...).' },
        items: {
          type: 'array',
          description: 'Productos/devoluciones incluidos (igual que en emitir_factura: código de inventario o descripcion/precioUnitario/cantidad).',
          items: {
            type: 'object',
            properties: {
              codigo: { type: 'string', description: 'Código de inventario (opcional si das precio).' },
              descripcion: { type: 'string', description: 'Descripción o nombre del producto.' },
              cantidad: { type: 'number', description: 'Cantidad. Por defecto 1.' },
              precioUnitario: { type: 'number', description: 'Precio unitario sin IVA (opcional si existe en inventario).' },
              iva: { type: 'number', description: 'Porcentaje IVA: 0, 5 o 15 (opcional; usa el de inventario).' },
            },
          },
        },
      },
      required: ['cliente', 'docModificado', 'motivo', 'items'],
    },
  },
  {
    name: 'consultar_contabilidad_rag',
    description:
      'Alias de consultar_sistema_rag. NO usar para IVA, obligaciones ni resumen tributario (eso va con datosCuenta).',
    input_schema: {
      type: 'object',
      properties: {
        pregunta: {
          type: 'string',
          description: 'Pregunta contable/semántica (plan de cuentas, asientos, empleado, producto). No IVA ni obligaciones.',
        },
      },
      required: ['pregunta'],
    },
  },
  {
    name: 'consultar_sistema_rag',
    description:
      'Búsqueda semántica (RAG) SOLO para plan de cuentas, asientos contables, detalle de empleados o productos cuando no baste listar_productos. NO usar para IVA a pagar, obligaciones, retenciones, formularios 103/104, RIMPE, alertas ni totales de compras/ventas. NO usar si existe herramienta específica (consultar_cuentas, listar_productos, extraer_documentos_sri).',
    input_schema: {
      type: 'object',
      properties: {
        pregunta: {
          type: 'string',
          description:
            'Pregunta contable/semántica (ej. cuenta 1.1.01, asiento de marzo, cédula de un empleado). No preguntar IVA ni obligaciones aquí.',
        },
      },
      required: ['pregunta'],
    },
  },
];

const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

async function callGemini(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  apiKey: string,
  model: string,
  options?: { disableTools?: boolean }
): Promise<{ text: string; toolCall?: { name: string; args: any } | null }> {
  const modelsToTry = Array.from(new Set([model, ...GEMINI_FALLBACK_MODELS]));
  let lastError: Error | null = null;

  for (const currentModel of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

    const contents = [
      ...history.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const body: Record<string, unknown> = {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
        };
        if (!options?.disableTools) {
          body.tools = SRI_TOOLS_GEMINI;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errText = await response.text();
          const isTransient = response.status === 503 || response.status === 429;

          if (isTransient && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            continue;
          }

          if (isTransient) {
            lastError = new Error(`Gemini API error (${response.status}): ${errText.slice(0, 300)}`);
            break; // probar con el siguiente modelo disponible
          }

          throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 300)}`);
        }

        const data = await response.json();
        const part = data?.candidates?.[0]?.content?.parts?.[0];

        let text = '';
        let toolCall: { name: string; args: any } | null = null;

        if (part?.functionCall) {
          toolCall = {
            name: part.functionCall.name,
            args: part.functionCall.args,
          };
        }

        if (part?.text) {
          text = part.text.trim();
        } else if (!toolCall) {
          throw new Error('Gemini no devolvió contenido en la respuesta');
        }

        return { text, toolCall };
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries && (err.message?.includes('503') || err.message?.includes('429'))) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        } else if (!err.message?.includes('503') && !err.message?.includes('429')) {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error('El servicio de Gemini no está disponible en este momento por alta demanda.');
}

async function callClaude(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  apiKey: string,
  model: string,
  options?: { disableTools?: boolean }
): Promise<{ text: string; toolCall?: { name: string; args: any } | null }> {
  const payload: Record<string, unknown> = {
    model,
    max_tokens: 1200,
    system: systemPrompt,
    messages: [
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: userMessage },
    ],
  };
  if (!options?.disableTools) {
    payload.tools = SRI_TOOLS_CLAUDE;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const contentBlocks = data?.content || [];
  
  let text = '';
  let toolCall: { name: string; args: any } | null = null;
  
  for (const block of contentBlocks) {
    if (block.type === 'text') {
      text += block.text;
    } else if (block.type === 'tool_use') {
      toolCall = {
        name: block.name,
        args: block.input,
      };
    }
  }
  
  text = text.trim();
  if (text.length === 0 && !toolCall) {
    throw new Error('Claude no devolvió contenido en la respuesta');
  }

  return { text, toolCall };
}

export async function testLlmConnection(provider: LlmProvider, apiKey: string, model: string) {
  const result = await (provider === 'gemini'
    ? callGemini('Responde solo: OK', [], 'test', apiKey, model)
    : callClaude('Responde solo: OK', [], 'test', apiKey, model));
  return result.text.length > 0;
}

export async function generateChatResponse(params: {
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  tenantId?: string | null;
  provider?: LlmProvider | null;
  disableTools?: boolean;
}): Promise<{ text: string; provider: LlmProvider; model: string; toolCall?: { name: string; args: any } | null }> {
  const resolved = await resolveLlmForTenant(params.tenantId);
  const provider = params.provider ?? resolved.provider;

  if (!provider) {
    throw new Error(
      'No hay proveedor de IA configurado. Configura las API keys en Configuración > Inteligencia IA o en .env.local.'
    );
  }

  const apiKey = provider === 'gemini' ? resolved.geminiKey : resolved.claudeKey;
  if (!apiKey) {
    throw new Error(`No hay API key configurada para ${provider}.`);
  }

  const model = resolved.model;
  const callOpts = { disableTools: !!params.disableTools };
  const result =
    provider === 'gemini'
      ? await callGemini(params.systemPrompt, params.history, params.userMessage, apiKey, model, callOpts)
      : await callClaude(params.systemPrompt, params.history, params.userMessage, apiKey, model, callOpts);

  return { text: result.text, toolCall: result.toolCall, provider, model };
}

import { normalizeChatHtml } from '@/lib/chat-html';

export function formatChatHtml(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // If response is already rich HTML (from AI tool execution), normalize bullets + breaks
  if (/<(strong|em|br|p|ul|ol|li|table|div|span)\b/i.test(trimmed)) {
    return normalizeChatHtml(trimmed.replace(/\n(?!\s*<)/g, '<br/>'));
  }

  let formatted = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks & inline code
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  formatted = formatted
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold & Italics
  formatted = formatted
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Bullet Lists (-, *, •)
  formatted = formatted.replace(/^[\s]*[-*•·]\s+(.*)$/gim, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/gis, '<ul>$1</ul>');
  formatted = formatted.replace(/<\/ul>\s*<ul>/gim, '');

  // Line breaks
  formatted = formatted.replace(/\n/g, '<br/>');

  return normalizeChatHtml(formatted);
}

export { normalizeChatHtml } from '@/lib/chat-html';
