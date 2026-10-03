/**
 * db.ts
 * Shared read-only PostgreSQL client for all DB-* test cases.
 * Requires Twingate to be active (postgres-llmv resolves only via VPN).
 *
 * Usage in any test file:
 *   import { query, endPool } from '../../helpers/db';
 *   const { rows } = await query('SELECT ...', [param1]);
 */
import { Pool, QueryResult } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.db') });

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host:     process.env.LLMV_DB_HOST,
      port:     Number(process.env.LLMV_DB_PORT ?? 5432),
      database: process.env.LLMV_DB_NAME,
      user:     process.env.LLMV_DB_USER,
      password: process.env.LLMV_DB_PASS,
      ssl:      { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
      max: 3, // read-only — keep connections low
    });

    pool.on('error', (err) => {
      console.error('DB pool error:', err.message);
    });
  }
  return pool;
}

export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, params);
}

export async function endPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
