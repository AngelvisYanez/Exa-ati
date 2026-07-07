import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
type QueryResultRow = any;
import { randomUUID } from 'crypto';

neonConfig.webSocketConstructor = ws;

declare global {
  var __pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        '[DB:Postgres] DATABASE_URL no está definido.'
      );
    }
    global.__pgPool = new Pool({ connectionString });
  }
  return global.__pgPool;
}

export const dbPrisma = {
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const start = Date.now();
    const operation = text.trim().split(/\s+/)[0].toUpperCase();

    let reindexedText = text;
    if (reindexedText.includes('?')) {
      let paramIndex = 1;
      reindexedText = reindexedText.replace(/\?/g, () => `$${paramIndex++}`);
    }

    const result = await getPool().query<any>(reindexedText, params || []);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development' || duration > 800) {
      console.log(`[DB:Postgres] ${operation} → ${duration}ms`);
    }

    return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
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
    const result = await getPool().query<any>(queryStr, values);
    return result.rows[0] || null;
  },

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
    const result = await getPool().query<any>(queryStr, [...values, ...whereParams]);

    if (options?.strict && result.rows.length === 0) {
      throw new Error(`Record to update in "${table}" was not found.`);
    }

    return result.rows;
  },
};
