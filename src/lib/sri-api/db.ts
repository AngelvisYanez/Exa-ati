import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { randomUUID } from 'crypto';

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'db_sri',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    connectionLimit: parseInt(process.env.DB_POOL_MAX || '10', 10),
    waitForConnections: true,
    queueLimit: 0,
    multipleStatements: true,
  });

  return pool;
}

// Converts PostgreSQL-style $1, $2 placeholders to MySQL-style ?
function toMysqlPlaceholders(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?');
}

export const db = {
  async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const start = Date.now();
    const mysqlSql = toMysqlPlaceholders(text);
    const [rows] = await getPool().execute(mysqlSql, params || []) as any;
    const duration = Date.now() - start;
    const operation = text.trim().split(/\s+/)[0].toUpperCase();
    if (process.env.NODE_ENV === 'development' || duration > 800) {
      console.log(`[DB] ${operation} → ${duration}ms`);
    }
    
    // Handle INSERT/UPDATE/DELETE results
    if (!Array.isArray(rows)) {
      const result = rows as ResultSetHeader;
      return { rows: [], rowCount: result.affectedRows || 0 };
    }
    
    return { rows: rows as T[], rowCount: (rows as any[]).length };
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

  async getClient(): Promise<PoolConnection> {
    return await getPool().getConnection();
  },

  async transaction<T>(
    callback: (client: PoolConnection) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.beginTransaction();
      const result = await callback(client);
      await client.commit();
      return result;
    } catch (error) {
      await client.rollback();
      throw error;
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

    let generatedId = null;
    const isUuidTable = ['usuarios', 'tenants', 'emisores', 'comprobantes', 'tenant_settings'].includes(table);
    if (isUuidTable && !data.id) {
      generatedId = randomUUID();
      data.id = generatedId;
    }

    const keys = Object.keys(data);
    const values = Object.values(data);
    const columns = keys.map(k => `\`${k}\``).join(', ');
    const placeholders = keys.map(() => '?').join(', ');

    const queryStr = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;
    const [result] = await getPool().execute(queryStr, values) as any;
    
    const lookupId = (result as ResultSetHeader).insertId || data.id || generatedId;
    if (lookupId) {
      return this.queryOne<T>(`SELECT ${returning === '*' ? '*' : returning} FROM \`${table}\` WHERE id = ?`, [lookupId]);
    }
    return null;
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
    const setClause = keys.map(key => `\`${key}\` = ?`).join(', ');

    // Convert $1 style params in where clause
    const mysqlWhere = toMysqlPlaceholders(where);

    const queryStr = `UPDATE \`${table}\` SET ${setClause} WHERE ${mysqlWhere}`;
    const [result] = await getPool().execute(queryStr, [...values, ...whereParams]) as any;

    if (options?.strict && (result as ResultSetHeader).affectedRows === 0) {
      throw new Error(`Record to update in "${table}" was not found.`);
    }

    // For returning, re-query (MySQL doesn't support RETURNING)
    return [];
  }
};
