import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import {
  listAllProxies,
  countAvailable,
  countInUse,
  addProxy,
  removeProxy,
  toggleProxy,
  releaseProxyById,
  releaseAllProxies,
} from '@/lib/scraping/proxy-assigner';
import { discoverProxies } from '@/lib/scraping/proxy-discoverer';
import { testearProxy, testearTodosLosProxies } from '@/lib/scraping/proxy-assigner';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const proxies = await listAllProxies();
    const available = await countAvailable();
    const inUse = await countInUse();

    return NextResponse.json({
      success: true,
      proxies,
      stats: { total: proxies.length, available, inUse },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'add') {
      const { proxy_host, proxy_port, proxy_user, proxy_pass, pais } = body;
      if (!proxy_host || !proxy_port) {
        return NextResponse.json(
          { success: false, error: 'proxy_host y proxy_port son requeridos' },
          { status: 400 }
        );
      }
      const proxy = await addProxy({ proxy_host, proxy_port, proxy_user, proxy_pass, pais });
      return NextResponse.json({ success: true, proxy });
    }

    if (action === 'remove') {
      const { proxy_id } = body;
      if (!proxy_id) {
        return NextResponse.json({ success: false, error: 'proxy_id requerido' }, { status: 400 });
      }
      await removeProxy(proxy_id);
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle') {
      const { proxy_id, activo } = body;
      if (!proxy_id || activo === undefined) {
        return NextResponse.json({ success: false, error: 'proxy_id y activo requeridos' }, { status: 400 });
      }
      await toggleProxy(proxy_id, activo);
      return NextResponse.json({ success: true });
    }

    if (action === 'release') {
      const { proxy_id } = body;
      if (!proxy_id) {
        return NextResponse.json({ success: false, error: 'proxy_id requerido' }, { status: 400 });
      }
      await releaseProxyById(proxy_id);
      return NextResponse.json({ success: true });
    }

    if (action === 'releaseAll') {
      await releaseAllProxies();
      return NextResponse.json({ success: true });
    }

    if (action === 'test') {
      const { proxy_id } = body;
      if (!proxy_id) {
        return NextResponse.json({ success: false, error: 'proxy_id requerido' }, { status: 400 });
      }
      const result = await testearProxy(proxy_id);
      return NextResponse.json({ success: true, result });
    }

    if (action === 'testAll') {
      const results = await testearTodosLosProxies();
      const alive = results.filter(r => r.alive).length;
      const dead = results.filter(r => !r.alive).length;
      return NextResponse.json({
        success: true,
        results,
        stats: { total: results.length, alive, dead },
      });
    }

    if (action === 'discover') {
      const country = body.country || 'EC';
      console.log(`[Proxy Discover] Starting proxy discovery for ${country}...`);
      const result = await discoverProxies(country);

      let newCount = 0;
      for (const proxy of result.alive) {
        try {
          const existing = await listAllProxies();
          const exists = existing.some(
            (p: any) => p.proxy_host === proxy.host && p.proxy_port === proxy.port
          );
          if (!exists) {
            await addProxy({
              proxy_host: proxy.host,
              proxy_port: proxy.port,
              pais: result.country,
            });
            newCount++;
          }
        } catch (err) {
          console.error(`[Proxy Discover] Error inserting ${proxy.host}:${proxy.port}:`, err);
        }
      }

      console.log(
        `[Proxy Discover] ${result.country}: ${result.alive.length} alive, ${newCount} new, ${result.dead} dead`
      );

      return NextResponse.json({
        success: true,
        result: {
          total: result.total,
          alive: result.alive.length,
          new: newCount,
          dead: result.dead,
          errors: result.errors,
          proxies: result.alive,
          country: result.country,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
