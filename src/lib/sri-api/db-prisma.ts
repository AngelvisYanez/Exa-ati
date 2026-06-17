/**
 * db-prisma.ts — Adaptador Neon PostgreSQL para producción
 *
 * Usa @neondatabase/serverless Pool directamente (más fiable que Prisma adapter en Next.js).
 * Expone la misma interfaz que db.ts: query, queryOne, queryAll, insert, update, transaction.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';
import ws from 'ws';

// En Node.js (Next.js API routes), WebSocket no es global — hay que inyectarlo
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

// ─── Pool singleton ──────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __neonPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global.__neonPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        '[DB:Neon] DATABASE_URL no está definido. Verifica tu .env o variables de entorno en Vercel.'
      );
    }
    global.__neonPool = new Pool({ connectionString });
  }
  return global.__neonPool;
}

// ─── Interfaz compatible con db.ts ───────────────────────────────────────────
export const dbPrisma = {
  async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const start = Date.now();
    const operation = text.trim().split(/\s+/)[0].toUpperCase();

    const result = await getPool().query<T>(text, params || []);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development' || duration > 800) {
      console.log(`[DB:Neon] ${operation} → ${duration}ms`);
    }

    return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
  },

  async queryOne<T = any>(
    text: string,
    params?: any[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  },

  async queryAll<T = any>(
    text: string,
    params?: any[]
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  },

  async getClient() {
    return getPool().connect();
  },

  async transaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    const client = await getPool().connect();
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

  async insert<T = any>(
    table: string,
    data: Record<string, any>,
    returning: string = '*'
  ): Promise<T | null> {
    if (!data || Object.keys(data).length === 0) {
      throw new Error(`No data provided for insert into table "${table}"`);
    }

    // UUID tables get auto-generated IDs if not provided
    const isUuidTable = ['usuarios', 'tenants', 'emisores', 'comprobantes', 'tenant_settings'].includes(table);
    if (isUuidTable && !data.id) {
      data.id = randomUUID();
    }

    const keys = Object.keys(data);
    const values = Object.values(data);
    const columns = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const returningClause = returning === '*' ? '*' : returning;

    const queryStr = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING ${returningClause}`;
    const result = await getPool().query<T>(queryStr, values);
    return result.rows[0] || null;
  },

  async update<T = any>(
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

    // Re-index $N or ? params in where clause relative to SET params
    let paramIndex = values.length + 1;
    const reindexedWhere = where.replace(/\?|\$\d+/g, () => `$${paramIndex++}`);

    const returningClause = returning === '*' ? '*' : returning;
    const queryStr = `UPDATE "${table}" SET ${setClause} WHERE ${reindexedWhere} RETURNING ${returningClause}`;
    const result = await getPool().query<T>(queryStr, [...values, ...whereParams]);

    if (options?.strict && result.rows.length === 0) {
      throw new Error(`Record to update in "${table}" was not found.`);
    }

    return result.rows;
  },
};
