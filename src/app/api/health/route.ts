import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();

  const checks: Record<string, string> = {};
  let allOk = true;

  try {
    const { db } = await import('@/lib/sri-api/db');
    await db.query('SELECT 1');
    checks.database = 'ok';
  } catch (err: any) {
    checks.database = `error: ${err.message}`;
    allOk = false;
  }

  const uptime = process.uptime();
  const memory = process.memoryUsage();

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    checks,
    memory: {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
    },
    responseTime: Date.now() - start + 'ms',
  }, { status: allOk ? 200 : 503 });
}
