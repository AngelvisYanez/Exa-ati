import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { testLlmConnection } from '@/lib/sri-api/llm-client';
import { getTenantLlmConfig } from '@/lib/sri-api/tenant-llm-config';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();

    const provider = body.provider as 'gemini' | 'claude';
    let apiKey = body.apiKey as string | undefined;
    const model =
      body.model ||
      (provider === 'gemini'
        ? process.env.GEMINI_MODEL || 'gemini-3.5-flash'
        : process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219');

    if (!apiKey) {
      const config = await getTenantLlmConfig(tenantId);
      apiKey = provider === 'gemini' ? config?.geminiKey : config?.claudeKey;
    }

    if (!apiKey && provider === 'gemini') apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey && provider === 'claude') {
      apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: `No hay API key configurada para ${provider}` },
        { status: 400 }
      );
    }

    const ok = await testLlmConnection(provider, apiKey, model);
    return NextResponse.json({
      success: ok,
      message: ok ? `Conexión exitosa con ${provider}` : 'La API no devolvió respuesta válida',
      provider,
      model,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Error al probar conexión IA' },
      { status: 500 }
    );
  }
}
