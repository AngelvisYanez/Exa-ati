import { verifyAuth } from "@/services/sri-api/auth-helper";
import { localPresence, authenticateConnector, claimConnectorJob, connectorHasXml, finishConnectorJob,
  getActiveConnectorJob, persistConnectorXml, progressConnectorJob } from '@/services/scraping/local-connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let tenantId = authenticateConnector(req);
  let desktop = false;
  if (!tenantId &&
      req.headers.get('authorization')?.startsWith('Bearer ') && !req.headers.has('x-exa-api-key')) {
    const user = await verifyAuth(req).catch(() => null);
    if (user?.type === 'access' && user.rol === 'ADMIN' && user.tenantId) {
      tenantId = user.tenantId;
      desktop = true;
    }
  }
  if (!tenantId) return Response.json({ error: 'Conector no autorizado' }, { status: 401 });
  const length = Number(req.headers.get('content-length') || 0);
  if (length > 2_200_000) return Response.json({ error: 'Solicitud demasiado grande' }, { status: 413 });
  try {
    const body = await req.json();
    if (desktop && ['connect', 'disconnect'].includes(body.action)) {
      localPresence(tenantId, body.action === 'connect');
      return Response.json({ success: true });
    }
    if (desktop) localPresence(tenantId, true);
    if (body.action === 'claim') {
      const job = await claimConnectorJob(tenantId);
      return Response.json({ job });
    }
    const jobId = Number(body.jobId);
    if (!Number.isSafeInteger(jobId) || jobId < 1) {
      return Response.json({ error: 'jobId inválido' }, { status: 400 });
    }
    if (body.action === 'status') {
      const job = await getActiveConnectorJob(tenantId, jobId);
      return Response.json({ status: job?.status || null });
    }
    if (body.action === 'hasXml') {
      return Response.json({ exists: await connectorHasXml(tenantId, jobId, String(body.clave || '')) });
    }
    if (body.action === 'uploadXml') {
      await persistConnectorXml(tenantId, jobId, String(body.clave || ''), body.xml);
      return Response.json({ success: true });
    }
    if (body.action === 'progress') {
      if (typeof body.message !== 'string') return Response.json({ error: 'Mensaje inválido' }, { status: 400 });
      const ok = await progressConnectorJob(tenantId, jobId, body.message);
      return Response.json({ success: ok }, { status: ok ? 200 : 409 });
    }
    if (body.action === 'finish') {
      if (typeof body.message !== 'string' || typeof body.success !== 'boolean') {
        return Response.json({ error: 'Resultado inválido' }, { status: 400 });
      }
      const ok = await finishConnectorJob(tenantId, jobId, body.success, body.message);
      return Response.json({ success: ok }, { status: ok ? 200 : 409 });
    }
    return Response.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error: any) {
    const message = String(error?.message || 'Error interno');
    const invalid = /inválid|no corresponde|otro tenant|no activo|pertenece/i.test(message);
    console.error('[SRI local connector]', invalid ? message : error);
    return Response.json({ error: invalid ? message : 'Error procesando solicitud del conector' },
      { status: invalid ? 400 : 500 });
  }
}
