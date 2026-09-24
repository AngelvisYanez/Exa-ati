import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { verifyAuth, requireTenantId } from '@/services/sri-api/auth-helper';
import { db } from '@/services/sri-api/db';
import { embeddings } from '@/services/sri-api/embeddings';

const CUENTA_CXC = '1.1.02.01';
const CUENTA_VENTAS = '4.1.01.01';
const CUENTA_IVA = '2.1.03.01';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const body = await req.json();
    const { periodo } = body as { periodo: number | string };

    if (!periodo) {
      return NextResponse.json({ message: 'periodo requerido (YYYYMM)' }, { status: 400 });
    }

    const periodoStr = String(periodo);
    if (periodoStr.length !== 6) {
      return NextResponse.json({ message: 'periodo debe ser YYYYMM' }, { status: 400 });
    }

    const anio = parseInt(periodoStr.slice(0, 4), 10);
    const mes = parseInt(periodoStr.slice(4, 6), 10);
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const emisor = await db.queryOne<{ ruc: string }>(
      `SELECT ruc FROM emisores WHERE tenant_id = $1 AND activo = true ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    if (!emisor?.ruc) {
      return NextResponse.json(
        { message: 'No hay emisor activo para generar asientos' },
        { status: 400 }
      );
    }

    const comprobantes = await db.queryAll<{
      id: string;
      clave_acceso: string;
      tipo: string;
      fecha_emision: string;
      importe_total: string;
      total_sin_impuesto: string;
      total_iva: string;
      emisor_ruc: string;
      receptor_identificacion: string;
    }>(
      `SELECT c.id, c.clave_acceso, c.tipo, c.fecha_emision, c.importe_total,
              c.total_sin_impuesto, c.total_iva, c.emisor_ruc, c.receptor_identificacion
       FROM comprobantes c
       WHERE c.tenant_id = $1
         AND c.estado = 'AUTORIZADO'
         AND c.tipo = '01'
         AND c.emisor_ruc = $2
         AND c.fecha_emision >= $3
         AND c.fecha_emision <= $4
         AND NOT EXISTS (
           SELECT 1 FROM asientos a
           WHERE a.tenant_id = $1 AND a.comprobante_id = c.id
         )`,
      [tenantId, emisor.ruc, desde, hasta]
    );

    const maxRow = await db.queryOne<{ max_num: number | null }>(
      'SELECT MAX(numero) AS max_num FROM asientos WHERE tenant_id = $1',
      [tenantId]
    );
    let numero = (maxRow?.max_num ?? 0) + 1;

    const generados: unknown[] = [];

    for (const comp of comprobantes) {
      const total = Number(comp.importe_total || 0);
      let base = Number(comp.total_sin_impuesto || 0);
      let iva = Number(comp.total_iva || 0);

      if (total <= 0) continue;

      // Cuadrar debe/haber: Debe = total; Haber = base + iva
      if (Math.abs(base + iva - total) > 0.01) {
        if (base <= 0 && iva <= 0) {
          base = total;
          iva = 0;
        } else if (base > 0) {
          iva = Math.round((total - base) * 100) / 100;
        } else {
          base = Math.round((total - iva) * 100) / 100;
        }
      }
      if (Math.abs(base + iva - total) > 0.01) {
        console.warn('[Asientos generar] Saltando comprobante descuadrado', comp.id, { total, base, iva });
        continue;
      }

      const asientoId = randomUUID();
      const now = new Date();
      const glosa = `Venta factura ${comp.clave_acceso?.slice(-9) || comp.id}`;

      await db.insert('asientos', {
        id: asientoId,
        tenant_id: tenantId,
        fecha: comp.fecha_emision,
        numero,
        glosa,
        origen: 'COMPROBANTE',
        comprobante_id: comp.id,
        estado: 'CONTABILIZADO',
        created_at: now,
        updated_at: now,
      });

      const lineas = [
        {
          cuenta_codigo: CUENTA_CXC,
          cuenta_nombre: 'Cuentas por cobrar clientes',
          debe: total,
          haber: 0,
        },
        {
          cuenta_codigo: CUENTA_VENTAS,
          cuenta_nombre: 'Ventas de bienes y servicios',
          debe: 0,
          haber: base,
        },
        {
          cuenta_codigo: CUENTA_IVA,
          cuenta_nombre: 'IVA por pagar',
          debe: 0,
          haber: iva,
        },
      ].filter((l) => l.debe > 0 || l.haber > 0);

      for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i];
        await db.insert('asiento_lineas', {
          id: randomUUID(),
          asiento_id: asientoId,
          cuenta_codigo: l.cuenta_codigo,
          cuenta_nombre: l.cuenta_nombre,
          debe: l.debe,
          haber: l.haber,
          orden: i + 1,
        });
      }

      if (process.env.OLLAMA_ENABLED === 'true') {
        embeddings.store(
          tenantId,
          'asiento',
          numero,
          embeddings.buildContent('asiento', {
            numero,
            fecha: comp.fecha_emision || desde,
            glosa,
            origen: 'COMPROBANTE',
            comprobante_id: comp.id,
            estado: 'CONTABILIZADO',
            lineas,
          })
        ).catch((err) => console.error('[Embeddings] asiento generar:', err));
      }

      generados.push({ asientoId, numero, comprobanteId: comp.id, glosa });
      numero += 1;
    }

    return NextResponse.json({
      data: {
        periodo: periodoStr,
        generados: generados.length,
        asientos: generados,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { message },
      { status: message.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
