import { neon, Pool, neonConfig, type PoolClient, type NeonQueryFunction } from '@neondatabase/serverless';
import ws from 'ws';
type QueryResultRow = any;
import { randomUUID } from 'crypto';

neonConfig.webSocketConstructor = ws;

// ─── Variables globales (persisten en warm starts de Vercel) ──────
declare global {
  var __neonSql: NeonQueryFunction<any, any> | undefined;
  var __txPool: Pool | undefined;
}

// ─── Helper: limpiar URL para WebSocket ───────────────────────────
// El driver por WebSocket (Pool) no necesita channel_binding=require
// (es solo para pgbouncer TCP) y puede causar "Connection terminated unexpectedly".
function cleanForWs(cs: string): string {
  return cs
    .replace(/[?&]channel_binding=require/gi, '')
    .replace(/[?&]channel_binding=\w+/gi, '')
    .replace(/[?&]sslmode=require/gi, '')
    .replace(/[?&]ssl=true/gi, '')
    .replace(/([?&])+$/g, '')
    .replace(/\?$/, '');
}

// ─── HTTP / sin estado (neon) ─────────────────────────────────────
// Recomendado para queries simples. La URL puede ser la pooled con
// todos sus parámetros; el endpoint HTTP los ignora.
function getSql(): NeonQueryFunction<any, any> {
  if (!global.__neonSql) {
    const cs = process.env.DATABASE_URL;
    if (!cs) throw new Error('[DB:Neon] DATABASE_URL no está definido.');
    global.__neonSql = neon(cs);
  }
  return global.__neonSql;
}

// ─── WebSocket Pool (solo para transacciones) ────────────────────
// Se necesita pool.connect() para BEGIN/COMMIT/ROLLBACK.
function getTxPool(): Pool {
  if (!global.__txPool) {
    const cs = process.env.DATABASE_URL;
    if (!cs) throw new Error('[DB:Neon] DATABASE_URL no está definido.');
    global.__txPool = new Pool({
      connectionString: cleanForWs(cs),
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
    global.__txPool.on('error', (err: Error) => {
      console.error('[DB:Neon] tx pool error:', err.message);
    });
  }
  return global.__txPool;
}

// Reintento para el pool transaccional si se cae la conexión.
async function withTxPool<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = getTxPool();
  try {
    return await fn(pool);
  } catch (err: any) {
    if (/Connection terminated unexpectedly|Connection terminated|server closed the connection|terminated/i.test(err?.message || '')) {
      console.warn('[DB:Neon] conexión caída en tx pool, recreando...');
      const old = global.__txPool;
      global.__txPool = undefined;
      getTxPool(); // fuerza recreación
      try {
        return await fn(global.__txPool!);
      } finally {
        old?.end().catch(() => {});
      }
    }
    throw err;
  }
}

// ─── Export ───────────────────────────────────────────────────────
export const dbPrisma = {
  // -----------------------------------------------------------------
  // QUERY – por HTTP (sin conexiones persistentes)
  // -----------------------------------------------------------------
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const start = Date.now();
    const operation = text.trim().split(/\s+/)[0].toUpperCase();

    // Reindexar ? → $1, $2 (para queries que migraron de MySQL)
    let reindexedText = text;
    if (reindexedText.includes('?')) {
      let paramIndex = 1;
      reindexedText = reindexedText.replace(/\?/g, () => `$${paramIndex++}`);
    }

    const sql = getSql();
    // sql.query() devuelve un array de filas directo
    const rows = await sql.query(reindexedText, params || []);

    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' || duration > 800) {
      console.log(`[DB:Neon] ${operation} → ${duration}ms`);
    }

    return { rows: rows as T[], rowCount: (rows as any[]).length };
  },

  async queryOne<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  },

  async queryAll<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  },

  // -----------------------------------------------------------------
  // GET CLIENT – obtiene un cliente del pool WebSocket
  // -----------------------------------------------------------------
  async getClient(): Promise<PoolClient> {
    return withTxPool((p) => p.connect());
  },

  // -----------------------------------------------------------------
  // TRANSACTION – usa el pool WebSocket (BEGIN/COMMIT/ROLLBACK)
  // -----------------------------------------------------------------
  async transaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    const client = await withTxPool((p) => p.connect());
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // -----------------------------------------------------------------
  // INSERT – por HTTP
  // -----------------------------------------------------------------
  async insert<T extends QueryResultRow = any>(
    table: string,
    data: Record<string, any>,
    returning: string = '*'
  ): Promise<T | null> {
    if (!data || Object.keys(data).length === 0) {
      throw new Error(`No data provided for insert into table "${table}"`);
    }

    const isUuidTable = ['usuarios', 'tenants', 'emisores', 'comprobantes', 'tenant_settings'].includes(table);
    if (isUuidTable && !data.id) {
      data.id = randomUUID();
    }

    if (!data.created_at) {
      data.created_at = new Date();
    }
    if (!data.updated_at) {
      data.updated_at = new Date();
    }

    const keys = Object.keys(data);
    const values = Object.values(data);
    const columns = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const returningClause = returning === '*' ? '*' : returning;

    const queryStr = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING ${returningClause}`;
    const sql = getSql();
    const rows = await sql.query(queryStr, values);
    return (rows as any[])[0] || null;
  },

  // -----------------------------------------------------------------
  // UPDATE – por HTTP
  // -----------------------------------------------------------------
  async update<T extends QueryResultRow = any>(
    table: string,
    data: Record<string, any>,
    where: string,
    whereParams: any[],
    returning: string = '*',
    options?: { strict?: boolean }
  ): Promise<T[]> {
    if (!data || Object.keys(data).length === 0) {
      throw new Error(`No data provided for update in table "${table}"`);
    }

    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');

    let paramIndex = values.length + 1;
    const reindexedWhere = where.replace(/\?|\$\d+/g, () => `$${paramIndex++}`);

    const returningClause = returning === '*' ? '*' : returning;
    const queryStr = `UPDATE "${table}" SET ${setClause} WHERE ${reindexedWhere} RETURNING ${returningClause}`;

    const sql = getSql();
    const rows = await sql.query(queryStr, [...values, ...whereParams]);

    if (options?.strict && (rows as any[]).length === 0) {
      throw new Error(`Record to update in "${table}" was not found.`);
    }

    return rows as T[];
  },
};
