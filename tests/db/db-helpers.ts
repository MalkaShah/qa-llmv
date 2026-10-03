/**
 * db-helpers.ts
 * Read-only PostgreSQL access for Suite DB.
 * Requires Twingate active — postgres-llmv only resolves via VPN.
 */
import { Pool, QueryResult } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.db') });

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host:     process.env.LLMV_DB_HOST,
      port:     Number(process.env.LLMV_DB_PORT ?? 5432),
      database: process.env.LLMV_DB_NAME ?? 'llmv_db',
      user:     process.env.LLMV_DB_USER,
      password: process.env.LLMV_DB_PASS,
      ssl:      { rejectUnauthorized: false },
      connectionTimeoutMillis: 15_000,
      // Raise the per-statement timeout — analytics tables are large
      statement_timeout: 120_000,
      max: 3,
    });
    pool.on('error', e => console.error('DB pool error:', e.message));
  }
  return pool;
}

/** Runs a read-only query. Blocks any write statement. */
export async function q<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
  const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|GRANT|REVOKE)\b/i;
  if (forbidden.test(sql)) {
    throw new Error('Write statement blocked — Suite DB is read-only');
  }
  return getPool().query<T>(sql, params);
}

/** Returns the first row's single value as a number. */
export async function count(sql: string, params: any[] = []): Promise<number> {
  const { rows } = await q(sql, params);
  const v = Object.values(rows[0] ?? {})[0];
  return Number(v ?? 0);
}

/**
 * Bounded existence check for very large tables.
 * Stops scanning as soon as `limit` offending rows are found,
 * so it never scans the whole table.
 */
export async function countBounded(
  innerSql: string, params: any[] = [], limit = 100
): Promise<number> {
  const { rows } = await q(
    `SELECT COUNT(*)::int AS n FROM ( ${innerSql} LIMIT ${limit} ) sub`,
    params
  );
  return Number(rows[0]?.n ?? 0);
}

export async function closePool() {
  if (pool) { await pool.end(); pool = null; }
}

/** Real table names — verified against llmv_db. */
export const T = {
  PROJECT:        'llmv_project',
  BRAND:          'llmv_brand',
  TOPIC:          'llmv_topic',
  QUERY:          'llmv_query',
  SNAPSHOT:       'llmv_analysissnapshot',
  RESPONSE:       'llmv_queryresponse',
  SENTIMENT:      'llmv_responsesentimentanalysis',
  CITATION:       'llmv_responsecitationanalysis',
  URL_CITATION:   'llmv_responseurlcitationanalysis',
  BRAND_ANALYSIS: 'llmv_responsebrandanalysis',
  CREDITS:        'llmv_creditusagelog',
  PLATFORM:       'llmv_platformstatus',
  SNAP_METRICS:   'llmv_snapshot_platform_metrics',
  SNAP_COMPETITOR:'llmv_snapshotcompetitor',
  USER_PROFILE:   'llmv_userprofile',
  AUTH_USER:      'auth_user',
  PS_PROMPT:      'ps_prompt',
} as const;

/**
 * Resolves the QA fixture project's UUID from its domain.
 * llmv_project.id is a UUID — the number in the dashboard URL is the
 * Site Explorer project id, not the LLMV project id.
 */
export async function fixtureProjectId(): Promise<string | null> {
  const { rows } = await q(`
    SELECT p.id
    FROM ${T.PROJECT} p
    JOIN ${T.BRAND} b ON p.brand_id = b.id
    WHERE b.domain = $1
      AND LOWER(p.country_code) = $2
      AND p.is_deleted = false
    ORDER BY p.is_active DESC, p.created DESC
    LIMIT 1
  `, ['microsoft.com', 'us']);
  return rows[0]?.id ?? null;
}

export const FIXTURE = {
  domain:  'microsoft.com',
  country: 'us',
} as const;
