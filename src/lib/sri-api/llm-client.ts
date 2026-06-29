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
      ? process.env.GEMINI_MODEL || 'gemini-3.5-flash'
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
        description: 'Conecta al SRI, inicia sesión con el RUC y contraseña del contribuyente, y extrae (descarga) los comprobantes electrónicos (facturas, retenciones, etc.) en un rango de fechas.',
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
              description: 'Fecha de inicio del rango a consultar (YYYY-MM-DD, ej: 2026-06-01).',
            },
            fechaHasta: {
              type: 'STRING',
              description: 'Fecha de fin del rango a consultar (YYYY-MM-DD, ej: 2026-06-15).',
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
    ],
  },
];

const SRI_TOOLS_CLAUDE = [
  {
    name: 'extraer_documentos_sri',
    description: 'Conecta al SRI, inicia sesión con el RUC y contraseña del contribuyente, y extrae (descarga) los comprobantes electrónicos (facturas, retenciones, etc.) en un rango de fechas.',
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
          description: 'Fecha de inicio del rango a consultar (YYYY-MM-DD, ej: 2026-06-01).',
        },
        fechaHasta: {
          type: 'string',
          description: 'Fecha de fin del rango a consultar (YYYY-MM-DD, ej: 2026-06-15).',
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
];

async function callGemini(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  apiKey: string,
  model: string
): Promise<{ text: string; toolCall?: { name: string; args: any } | null }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [
    ...history.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: SRI_TOOLS_GEMINI,
      generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
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
}

async function callClaude(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  apiKey: string,
  model: string
): Promise<{ text: string; toolCall?: { name: string; args: any } | null }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [
        ...history.map((msg) => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage },
      ],
      tools: SRI_TOOLS_CLAUDE,
    }),
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
  const result =
    provider === 'gemini'
      ? await callGemini(params.systemPrompt, params.history, params.userMessage, apiKey, model)
      : await callClaude(params.systemPrompt, params.history, params.userMessage, apiKey, model);

  return { text: result.text, toolCall: result.toolCall, provider, model };
}

export function formatChatHtml(raw: string): string {
  const trimmed = raw.trim();

  if (/<(strong|em|br|p|ul|li|div|span)\b/i.test(trimmed)) {
    return trimmed.replace(/\n/g, '<br/>');
  }

  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}
