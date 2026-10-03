/**
 * e2e-helpers.ts
 * Shared helpers for Suite C — deep E2E flows that chain API, UI and DB.
 *
 * Requires:
 *   - LLMV_TOKEN in .env.db (API auth)
 *   - Twingate active (DB access)
 */
import { Pool, QueryResult } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.db') });

// ─── Hosts ───────────────────────────────────────────────────────────────────

export const API  = 'https://llmvis.searchatlas.com';
export const DASH = 'https://dashboard.searchatlas.com';

export function llmvUrl(siteExplorerId: number, domain: string, country = 'us') {
  return `${DASH}/site-explorer/llm-visibility/${siteExplorerId}?domain=${domain}&country_code=${country}`;
}

// ─── Fixtures (verified against llmv_db, customer 211944) ────────────────────

export const FIXTURES = {
  /** Rich read-only data — 11 completed snapshots. */
  forbes: {
    projectId: '2f64a1f2-1f2f-487b-857d-b075ebddb5d9',
    domain: 'forbes.com',
    country: 'US',
  },
  /** Rich read-only data — 12 completed snapshots. */
  kia: {
    projectId: '30246f9a-aebd-488e-9c31-74d1a1c7a9f1',
    domain: 'kia.com',
    country: 'US',
  },
  /** Inactive, 0 UC — safe for activate/deactivate lifecycle tests. */
  starbucks: {
    projectId: '87328524-ded8-4999-8f0e-de22458efb4f',
    domain: 'starbucks.com',
    country: 'US',
  },
  /** 5 UC per run — cheapest project that actually charges. @costly only. */
  bluebonnet: {
    projectId: '495ad635-6622-4115-9611-e8fdb7b82574',
    domain: 'bluebonnetcafe.net',
    country: 'US',
  },
} as const;

export const CUSTOMER_ID = 211944;

// ─── API layer ───────────────────────────────────────────────────────────────

function token(): string {
  const t = process.env.LLMV_TOKEN;
  if (!t) throw new Error('LLMV_TOKEN not set in .env.db — run: node set-token.mjs <TOKEN>');
  return t;
}

export async function api(
  page: any, method: string, path: string, body?: any
): Promise<{ status: number; data: any }> {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token()}`,
  };
  const url = `${API}${path}`;

  let res: any;
  if (method === 'GET')         res = await page.request.get(url, { headers });
  else if (method === 'DELETE') res = await page.request.delete(url, { headers });
  else res = await page.request[method.toLowerCase()](url, { headers, data: body });

  let data: any;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status(), data };
}

export const GET   = (p: any, path: string)            => api(p, 'GET', path);
export const POST  = (p: any, path: string, body?: any) => api(p, 'POST', path, body);
export const PATCH = (p: any, path: string, body?: any) => api(p, 'PATCH', path, body);

// ─── DB layer (read-only) ────────────────────────────────────────────────────

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
      statement_timeout: 60_000,
      max: 3,
    });
  }
  return pool;
}

export async function db<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
  const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|GRANT|REVOKE)\b/i;
  if (forbidden.test(sql)) throw new Error('Write statement blocked — E2E DB access is read-only');
  return getPool().query<T>(sql, params);
}

export async function dbValue(sql: string, params: any[] = []): Promise<any> {
  const { rows } = await db(sql, params);
  return Object.values(rows[0] ?? {})[0] ?? null;
}

export async function closeDb() {
  if (pool) { await pool.end(); pool = null; }
}

// ─── UI layer ────────────────────────────────────────────────────────────────

/** Removes the "AI Visibility is now more flexible" modal that blocks clicks. */
export async function dismissModal(page: any) {
  try {
    await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll('div'))) {
        const cls = typeof el.className === 'string' ? el.className : '';
        const isOverlay = cls.includes('z-[1050]') || cls.includes('z-[1060]');
        const txt = (el as HTMLElement).innerText ?? '';
        if (isOverlay && txt.includes('AI Visibility')) { el.remove(); return; }
      }
    });
    await page.waitForTimeout(300);
  } catch { /* no modal */ }
}

export async function clickTab(page: any, name: string) {
  await dismissModal(page);
  await page.locator('.ant-tabs-tab-btn', { hasText: name }).first().click();
  await page.waitForTimeout(2500);
}

/** Reads the numeric value shown under a metric card label. */
export async function readCardValue(page: any, label: string): Promise<number | null> {
  const body = await page.locator('body').innerText();
  const idx = body.toUpperCase().indexOf(label.toUpperCase());
  if (idx === -1) return null;
  const after = body.slice(idx + label.length, idx + label.length + 60);
  const m = after.match(/([\d,]+\.?\d*)\s*(%|K)?/);
  if (!m) return null;
  let v = parseFloat(m[1].replace(/,/g, ''));
  if (m[2] === 'K') v *= 1000;
  return v;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Polls until a snapshot reaches a terminal state, or the timeout elapses. */
export async function waitForSnapshot(
  snapshotId: string, timeoutMs = 240_000
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await dbValue(
      `SELECT status FROM llmv_analysissnapshot WHERE id = $1`, [snapshotId]
    );
    if (status && ['completed', 'success', 'done', 'failed', 'error', 'cancelled']
        .includes(String(status).toLowerCase())) {
      return String(status);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  return null;
}

/** Current credit balance from the API. */
export async function apiBalance(page: any): Promise<number | null> {
  const res = await GET(page, '/api/v1/credits/summary/');
  if (res.status !== 200) return null;
  return res.data?.total_remaining ?? null;
}

/** Most recent balance_after recorded in the DB ledger for this customer. */
export async function dbLedgerBalance(): Promise<number | null> {
  const v = await dbValue(`
    SELECT balance_after FROM llmv_creditusagelog
    WHERE customer_id = $1 AND balance_after IS NOT NULL
    ORDER BY created DESC, id DESC
    LIMIT 1
  `, [CUSTOMER_ID]);
  return v === null ? null : Number(v);
}
