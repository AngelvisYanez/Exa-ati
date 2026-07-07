import { db } from './db';
import { encryption } from './encryption';

export type LlmProvider = 'gemini' | 'claude';

export type TenantLlmConfig = {
  provider: LlmProvider;
  model: string | null;
  geminiKey?: string;
  claudeKey?: string;
};

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return '••••••••';
  return `${'•'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}`;
}

export async function getTenantLlmConfig(tenantId: string): Promise<TenantLlmConfig | null> {
  const row = await db.queryOne<any>(
    `SELECT llm_provider, llm_model, gemini_api_key_encrypted, claude_api_key_encrypted
     FROM tenant_settings WHERE tenant_id = ?`,
    [tenantId]
  );
  if (!row) return null;

  let geminiKey: string | undefined;
  let claudeKey: string | undefined;

  if (row.gemini_api_key_encrypted) {
    try {
      geminiKey = await encryption.decrypt(row.gemini_api_key_encrypted);
    } catch {
      geminiKey = row.gemini_api_key_encrypted;
    }
  }
  if (row.claude_api_key_encrypted) {
    try {
      claudeKey = await encryption.decrypt(row.claude_api_key_encrypted);
    } catch {
      claudeKey = row.claude_api_key_encrypted;
    }
  }

  return {
    provider: row.llm_provider || 'gemini',
    model: row.llm_model,
    geminiKey,
    claudeKey,
  };
}

export async function saveTenantLlmConfig(
  tenantId: string,
  data: {
    provider?: LlmProvider;
    model?: string | null;
    geminiApiKey?: string;
    claudeApiKey?: string;
  }
) {
  const existing = await db.queryOne('SELECT id FROM tenant_settings WHERE tenant_id = ?', [tenantId]);

  const updates: string[] = [];
  const params: any[] = [];

  if (data.provider) {
    updates.push('llm_provider = ?');
    params.push(data.provider);
  }
  if (data.model !== undefined) {
    updates.push('llm_model = ?');
    params.push(data.model);
  }
  if (data.geminiApiKey) {
    updates.push('gemini_api_key_encrypted = ?');
    params.push(await encryption.encrypt(data.geminiApiKey));
  }
  if (data.claudeApiKey) {
    updates.push('claude_api_key_encrypted = ?');
    params.push(await encryption.encrypt(data.claudeApiKey));
  }

  if (updates.length === 0) return;

  updates.push('llm_configured_at = NOW()');

  if (existing) {
    await db.query(
      `UPDATE tenant_settings SET ${updates.join(', ')}, updated_at = NOW() WHERE tenant_id = ?`,
      [...params, tenantId]
    );
  } else {
    await db.query(
      `INSERT INTO tenant_settings (tenant_id, llm_provider, llm_model, gemini_api_key_encrypted, claude_api_key_encrypted, llm_configured_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        data.provider || 'gemini',
        data.model || null,
        data.geminiApiKey ? await encryption.encrypt(data.geminiApiKey) : null,
        data.claudeApiKey ? await encryption.encrypt(data.claudeApiKey) : null,
      ]
    );
  }
}

export async function getTenantLlmConfigMasked(tenantId: string) {
  const config = await getTenantLlmConfig(tenantId);
  if (!config) {
    return {
      provider: 'gemini' as LlmProvider,
      model: null,
      configured: { gemini: false, claude: false },
      maskedKeys: { gemini: null, claude: null },
    };
  }
  return {
    provider: config.provider,
    model: config.model,
    configured: {
      gemini: !!config.geminiKey || !!process.env.GEMINI_API_KEY,
      claude: !!config.claudeKey || !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
    },
    maskedKeys: {
      gemini: maskKey(config.geminiKey),
      claude: maskKey(config.claudeKey),
    },
  };
}
