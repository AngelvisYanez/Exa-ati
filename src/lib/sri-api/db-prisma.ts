/**
 * db-prisma.ts — Adaptador Prisma para producción (Neon PostgreSQL)
 *
 * Expone la misma interfaz que db.ts para que el código existente funcione
 * sin cambios en producción.
 *
 * Prisma 7 + @prisma/adapter-neon para serverless Neon PostgreSQL.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';

declare global {
  // Evita instancias múltiples en desarrollo con hot reload
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    // En producción: nueva instancia con adapter Neon por invocación serverless
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter } as any);
  }
  // En desarrollo: reusar instancia global para evitar múltiples pools
  if (!global.__prisma) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    global.__prisma = new PrismaClient({ adapter } as any);
  }
  return global.__prisma;
}

const prisma = getPrismaClient();

// Converts PostgreSQL-style $1, $2 placeholders (no-op for Prisma raw queries — already uses $1 style)
function toPositionalParams(sql: string, params?: any[]): { query: string; values: any[] } {
  return { query: sql, values: params || [] };
}

export const dbPrisma = {
  async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const start = Date.now();
    const { query, values } = toPositionalParams(text, params);

    try {
      const rows = await prisma.$queryRawUnsafe<T[]>(query, ...values);
      const duration = Date.now() - start;
      const operation = text.trim().split(/\s+/)[0].toUpperCase();
      if (process.env.NODE_ENV === 'development' || duration > 800) {
        console.log(`[DB:Prisma] ${operation} → ${duration}ms`);
      }
      return { rows: Array.isArray(rows) ? rows : [], rowCount: Array.isArray(rows) ? rows.length : 0 };
    } catch (err: any) {
      // Prisma raw execute returns affected count for INSERT/UPDATE/DELETE
      if (err?.code === 'P2010' || typeof err?.message === 'string') {
        throw err;
      }
      throw err;
    }
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
    // Prisma doesn't expose raw connections the same way — return a transaction-like object
    return prisma;
  },

  async transaction<T>(
    callback: (client: PrismaClient) => Promise<T>
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      return callback(tx as unknown as PrismaClient);
    });
  },

  async insert<T = any>(
    table: string,
    data: Record<string, any>,
    returning: string = '*'
  ): Promise<T | null> {
    if (!data || Object.keys(data).length === 0) {
      throw new Error(`No data provided for insert into table "${table}"`);
    }

    const keys = Object.keys(data);
    const values = Object.values(data);
    const columns = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const returningClause = returning === '*' ? '*' : returning;

    const queryStr = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING ${returningClause}`;
    const rows = await prisma.$queryRawUnsafe<T[]>(queryStr, ...values);
    return (rows as T[])[0] || null;
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
    const whereClause = where.replace(/\?/g, (_, i) => `$${values.length + i + 1}`);

    // Re-index $N params in where clause
    let paramIndex = values.length + 1;
    const reindexedWhere = where.replace(/\?|\$\d+/g, () => `$${paramIndex++}`);

    const queryStr = `UPDATE "${table}" SET ${setClause} WHERE ${reindexedWhere} RETURNING ${returning === '*' ? '*' : returning}`;
    const rows = await prisma.$queryRawUnsafe<T[]>(queryStr, ...values, ...whereParams);
    
    if (options?.strict && rows.length === 0) {
      throw new Error(`Record to update in "${table}" was not found.`);
    }

    return rows;
  },
};

export { prisma };
