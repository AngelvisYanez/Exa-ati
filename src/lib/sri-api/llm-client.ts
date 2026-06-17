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

async function callGemini(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  apiKey: string,
  model: string
): Promise<string> {
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
      generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini no devolvió contenido en la respuesta');
  return text.trim();
}

async function callClaude(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  apiKey: string,
  model: string
): Promise<string> {
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
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.content?.find((block: { type: string }) => block.type === 'text')?.text;
  if (!text) throw new Error('Claude no devolvió contenido en la respuesta');
  return text.trim();
}

export async function testLlmConnection(provider: LlmProvider, apiKey: string, model: string) {
  const result = await (provider === 'gemini'
    ? callGemini('Responde solo: OK', [], 'test', apiKey, model)
    : callClaude('Responde solo: OK', [], 'test', apiKey, model));
  return result.length > 0;
}

export async function generateChatResponse(params: {
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  tenantId?: string | null;
  provider?: LlmProvider | null;
}): Promise<{ text: string; provider: LlmProvider; model: string }> {
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
  const text =
    provider === 'gemini'
      ? await callGemini(params.systemPrompt, params.history, params.userMessage, apiKey, model)
      : await callClaude(params.systemPrompt, params.history, params.userMessage, apiKey, model);

  return { text, provider, model };
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
