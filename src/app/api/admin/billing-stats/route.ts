import { NextResponse } from "next/server";
import { verifyAuth } from "@/services/sri-api/auth-helper";
import { db } from "@/services/sri-api/db";
import { forbiddenResponse, requireModule } from "@/services/sri-api/rbac";

function centsToUsd(cents: number): number {
  return Math.round(cents) / 100;
}

export async function GET(req: Request) {
  try {
    const user = await verifyAuth(req);
    await requireModule(user, "admin");

    const empty = {
      mrr: 0,
      ingresosTotales: 0,
      ingresosMesActual: 0,
      ingresosMesAnterior: 0,
      pagosAprobados: 0,
      pagosPendientes: 0,
      pagosFallidos: 0,
      cuentasPorEstado: [] as { estado: string; count: number }[],
      ingresosMensuales: [] as { mes: string; ingresos: number }[],
      ingresosPorPlan: [] as { plan: string; planCodigo: string; ingresos: number; pagos: number }[],
      topUsuarios: [] as {
        usuarioId: string | null;
        email: string;
        nombre: string | null;
        ingresos: number;
        pagos: number;
      }[],
      porMetodo: [] as { metodo: string; ingresos: number; pagos: number }[],
    };

    try {
      // MRR aproximado: cuentas activas con periodo mensual → precio mensual;
      // anuales → precio_anual/12
      const mrrRows = await db.queryAll<{
        plan_periodo: string;
        precio_mensual: string | number;
        precio_anual: string | number | null;
        c: string | number;
      }>(
        `SELECT c.plan_periodo,
                COALESCE(p.precio_mensual, 0) AS precio_mensual,
                p.precio_anual,
                COUNT(*) AS c
         FROM cuentas c
         LEFT JOIN planes_suscripcion p ON p.codigo = c.plan_codigo
         WHERE c.activo = true
           AND COALESCE(c.plan_estado, 'activo') IN ('activo', 'gracia')
         GROUP BY c.plan_periodo, p.precio_mensual, p.precio_anual`
      ).catch(() => []);

      let mrr = 0;
      for (const row of mrrRows) {
        const count = Number(row.c) || 0;
        const mensual = Number(row.precio_mensual) || 0;
        const anual = row.precio_anual != null ? Number(row.precio_anual) : mensual * 10;
        if (row.plan_periodo === "anual") {
          mrr += count * (anual / 12);
        } else {
          mrr += count * mensual;
        }
      }

      const totalRow = await db.queryOne<{ total: string | number; cnt: string | number }>(
        `SELECT COALESCE(SUM(monto_centavos), 0) AS total, COUNT(*) AS cnt
         FROM pagos_suscripcion WHERE estado = 'aprobado'`
      ).catch(() => null);

      const mesActual = await db.queryOne<{ total: string | number }>(
        `SELECT COALESCE(SUM(monto_centavos), 0) AS total
         FROM pagos_suscripcion
         WHERE estado = 'aprobado'
           AND COALESCE(confirmed_at, created_at) >= date_trunc('month', NOW())`
      ).catch(() => null);

      const mesAnterior = await db.queryOne<{ total: string | number }>(
        `SELECT COALESCE(SUM(monto_centavos), 0) AS total
         FROM pagos_suscripcion
         WHERE estado = 'aprobado'
           AND COALESCE(confirmed_at, created_at) >= date_trunc('month', NOW()) - INTERVAL '1 month'
           AND COALESCE(confirmed_at, created_at) < date_trunc('month', NOW())`
      ).catch(() => null);

      const pendientes = await db.queryOne<{ cnt: string | number }>(
        `SELECT COUNT(*) AS cnt FROM pagos_suscripcion
         WHERE estado IN ('pendiente', 'preparado')`
      ).catch(() => null);

      const fallidos = await db.queryOne<{ cnt: string | number }>(
        `SELECT COUNT(*) AS cnt FROM pagos_suscripcion
         WHERE estado IN ('fallido', 'cancelado', 'expirado')`
      ).catch(() => null);

      const cuentasPorEstado = await db.queryAll<{ estado: string; cnt: string | number }>(
        `SELECT COALESCE(plan_estado, 'activo') AS estado, COUNT(*) AS cnt
         FROM cuentas WHERE activo = true
         GROUP BY COALESCE(plan_estado, 'activo')
         ORDER BY cnt DESC`
      ).catch(() => []);

      const ingresosMensuales = await db.queryAll<{
        mes: string;
        total: string | number;
      }>(
        `SELECT to_char(date_trunc('month', COALESCE(confirmed_at, created_at)), 'YYYY-MM') AS mes,
                COALESCE(SUM(monto_centavos), 0) AS total
         FROM pagos_suscripcion
         WHERE estado = 'aprobado'
           AND COALESCE(confirmed_at, created_at) >= NOW() - INTERVAL '12 months'
         GROUP BY date_trunc('month', COALESCE(confirmed_at, created_at))
         ORDER BY mes ASC`
      ).catch(() => []);

      const ingresosPorPlan = await db.queryAll<{
        plan_codigo: string;
        plan_nombre: string | null;
        total: string | number;
        cnt: string | number;
      }>(
        `SELECT ps.plan_codigo,
                pl.nombre AS plan_nombre,
                COALESCE(SUM(ps.monto_centavos), 0) AS total,
                COUNT(*) AS cnt
         FROM pagos_suscripcion ps
         LEFT JOIN planes_suscripcion pl ON pl.codigo = ps.plan_codigo
         WHERE ps.estado = 'aprobado'
         GROUP BY ps.plan_codigo, pl.nombre
         ORDER BY total DESC`
      ).catch(() => []);

      const topUsuarios = await db.queryAll<{
        usuario_id: string | null;
        email: string | null;
        nombre: string | null;
        total: string | number;
        cnt: string | number;
      }>(
        `SELECT ps.usuario_id,
                COALESCE(u.email, c.nombre, 'Sin usuario') AS email,
                u.nombre,
                COALESCE(SUM(ps.monto_centavos), 0) AS total,
                COUNT(*) AS cnt
         FROM pagos_suscripcion ps
         LEFT JOIN usuarios u ON u.id = ps.usuario_id
         LEFT JOIN cuentas c ON c.id = ps.cuenta_id
         WHERE ps.estado = 'aprobado'
         GROUP BY ps.usuario_id, u.email, u.nombre, c.nombre
         ORDER BY total DESC
         LIMIT 15`
      ).catch(() => []);

      const porMetodo = await db.queryAll<{
        metodo: string;
        total: string | number;
        cnt: string | number;
      }>(
        `SELECT COALESCE(ps.metodo_pago_codigo, mp.nombre, 'PAYPHONE') AS metodo,
                COALESCE(SUM(ps.monto_centavos), 0) AS total,
                COUNT(*) AS cnt
         FROM pagos_suscripcion ps
         LEFT JOIN metodos_pago mp ON mp.codigo = ps.metodo_pago_codigo
         WHERE ps.estado = 'aprobado'
         GROUP BY COALESCE(ps.metodo_pago_codigo, mp.nombre, 'PAYPHONE')
         ORDER BY total DESC`
      ).catch(() =>
        db
          .queryAll<{ metodo: string; total: string | number; cnt: string | number }>(
            `SELECT 'PAYPHONE' AS metodo,
                    COALESCE(SUM(monto_centavos), 0) AS total,
                    COUNT(*) AS cnt
             FROM pagos_suscripcion WHERE estado = 'aprobado'`
          )
          .catch(() => [])
      );

      return NextResponse.json({
        mrr: Math.round(mrr * 100) / 100,
        ingresosTotales: centsToUsd(Number(totalRow?.total || 0)),
        ingresosMesActual: centsToUsd(Number(mesActual?.total || 0)),
        ingresosMesAnterior: centsToUsd(Number(mesAnterior?.total || 0)),
        pagosAprobados: Number(totalRow?.cnt || 0),
        pagosPendientes: Number(pendientes?.cnt || 0),
        pagosFallidos: Number(fallidos?.cnt || 0),
        cuentasPorEstado: cuentasPorEstado.map((r) => ({
          estado: r.estado,
          count: Number(r.cnt) || 0,
        })),
        ingresosMensuales: ingresosMensuales.map((r) => ({
          mes: r.mes,
          ingresos: centsToUsd(Number(r.total) || 0),
        })),
        ingresosPorPlan: ingresosPorPlan.map((r) => ({
          plan: r.plan_nombre || r.plan_codigo,
          planCodigo: r.plan_codigo,
          ingresos: centsToUsd(Number(r.total) || 0),
          pagos: Number(r.cnt) || 0,
        })),
        topUsuarios: topUsuarios.map((r) => ({
          usuarioId: r.usuario_id,
          email: r.email || "—",
          nombre: r.nombre,
          ingresos: centsToUsd(Number(r.total) || 0),
          pagos: Number(r.cnt) || 0,
        })),
        porMetodo: porMetodo.map((r) => ({
          metodo: r.metodo,
          ingresos: centsToUsd(Number(r.total) || 0),
          pagos: Number(r.cnt) || 0,
        })),
      });
    } catch (err) {
      console.warn("[admin/billing-stats] fallback vacío:", err);
      return NextResponse.json(empty);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.includes("Acceso denegado")) return forbiddenResponse(message);
    return NextResponse.json(
      { message },
      { status: message.startsWith("No autorizado") ? 401 : 500 }
    );
  }
}
