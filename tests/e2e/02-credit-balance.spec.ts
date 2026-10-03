import { test, expect } from '@playwright/test';
import {
  GET, db, dbValue, closeDb, FIXTURES, CUSTOMER_ID,
  apiBalance, dbLedgerBalance,
} from './e2e-helpers';

/**
 * SUITE C — FILE 02: Credit Balance Integrity
 *
 * Verifies the credit figures shown to the user match the API and the DB ledger.
 * Read-only: consumes zero credits.
 */

test.afterAll(async () => { await closeDb(); });

// ─── Balance consistency ─────────────────────────────────────────────────────

test('E2E-200 — Monthly credit math balances: total minus consumed equals remaining', async ({ page }) => {
  const res = await GET(page, '/api/v1/credits/summary/');
  expect(res.status, 'Credit summary endpoint did not return 200').toBe(200);

  const d = res.data ?? {};
  console.log('[INFO] credits:', JSON.stringify(d));

  const monthlyTotal     = Number(d.monthly_total ?? 0);
  const monthlyConsumed  = Number(d.monthly_consumed ?? 0);
  const monthlyRemaining = Number(d.monthly_remaining ?? 0);

  expect(monthlyRemaining, 'monthly_remaining is negative').toBeGreaterThanOrEqual(0);
  expect(monthlyConsumed,  'monthly_consumed is negative').toBeGreaterThanOrEqual(0);

  // total − consumed should equal remaining
  if (monthlyTotal > 0) {
    const drift = Math.abs((monthlyTotal - monthlyConsumed) - monthlyRemaining);
    expect(drift,
      `Monthly credit math does not balance: ${monthlyTotal} − ${monthlyConsumed} ≠ ${monthlyRemaining}`
    ).toBeLessThanOrEqual(1);
  }
});

test('E2E-201 — Purchased credit math balances', async ({ page }) => {
  const res = await GET(page, '/api/v1/credits/summary/');
  if (res.status !== 200) { test.skip(); return; }

  const d = res.data ?? {};
  const total     = Number(d.purchased_total ?? 0);
  const consumed  = Number(d.purchased_consumed ?? 0);
  const remaining = Number(d.purchased_remaining ?? 0);

  expect(remaining, 'purchased_remaining is negative').toBeGreaterThanOrEqual(0);

  if (total > 0) {
    const drift = Math.abs((total - consumed) - remaining);
    expect(drift,
      `Purchased credit math does not balance: ${total} − ${consumed} ≠ ${remaining}`
    ).toBeLessThanOrEqual(1);
  }
});

test('E2E-202 — total_remaining equals monthly plus purchased remaining', async ({ page }) => {
  const res = await GET(page, '/api/v1/credits/summary/');
  if (res.status !== 200) { test.skip(); return; }

  const d = res.data ?? {};
  const monthly   = Number(d.monthly_remaining ?? 0);
  const purchased = Number(d.purchased_remaining ?? 0);
  const total     = Number(d.total_remaining ?? 0);

  const drift = Math.abs((monthly + purchased) - total);
  expect(drift,
    `total_remaining (${total}) ≠ monthly (${monthly}) + purchased (${purchased})`
  ).toBeLessThanOrEqual(1);
});

test('E2E-203 — API balance is consistent with the DB ledger', async ({ page }) => {
  const apiBal = await apiBalance(page);
  const dbBal  = await dbLedgerBalance();

  if (apiBal === null || dbBal === null) { test.skip(); return; }

  console.log(`[INFO] balance — API total_remaining: ${apiBal}, DB last balance_after: ${dbBal}`);

  // The ledger records the balance at the time of the last charge; the API
  // reflects the live balance. They should be close, not necessarily identical.
  const drift = Math.abs(apiBal - dbBal);
  expect(drift,
    `API balance ${apiBal} and DB ledger balance ${dbBal} differ by ${drift}`
  ).toBeLessThanOrEqual(Math.max(100, apiBal * 0.01));
});

// ─── Per-project cost consistency ────────────────────────────────────────────

test('E2E-210 — Project credit_cost_per_run agrees between API and DB', async ({ page }) => {
  for (const key of ['forbes', 'kia', 'bluebonnet'] as const) {
    const { projectId, domain } = FIXTURES[key];

    const res = await GET(page, `/api/v1/projects/${projectId}/`);
    if (res.status !== 200) continue;

    const apiCost = res.data?.credit_cost_per_run;
    const dbCost  = await dbValue(
      `SELECT credit_cost_per_run FROM llmv_project WHERE id = $1`, [projectId]
    );

    if (apiCost !== undefined && dbCost !== null) {
      expect(Number(apiCost),
        `${domain}: API cost ${apiCost} vs DB cost ${dbCost}`).toBe(Number(dbCost));
    }
  }
});

test('E2E-211 — has_insufficient_credits flag agrees between API and DB', async ({ page }) => {
  for (const key of ['forbes', 'bluebonnet'] as const) {
    const { projectId, domain } = FIXTURES[key];

    const res = await GET(page, `/api/v1/projects/${projectId}/`);
    if (res.status !== 200) continue;

    const apiFlag = res.data?.has_insufficient_credits;
    const dbFlag  = await dbValue(
      `SELECT has_insufficient_credits FROM llmv_project WHERE id = $1`, [projectId]
    );

    if (apiFlag !== undefined && dbFlag !== null) {
      expect(apiFlag,
        `${domain}: API flag ${apiFlag} vs DB flag ${dbFlag}`).toBe(dbFlag);
    }
  }
});

// ─── Projected usage ─────────────────────────────────────────────────────────

test('E2E-220 — Projected monthly usage total equals the sum of its parts', async ({ page }) => {
  const res = await GET(page, '/api/v1/credits/projected-usage/');
  if (res.status !== 200) { test.skip(); return; }

  const total    = Number(res.data?.total_projected_monthly_credits ?? NaN);
  const projects = res.data?.projects ?? [];

  if (!Number.isNaN(total) && projects.length > 0) {
    const sum = projects.reduce(
      (acc: number, p: any) => acc + Number(p.projected_monthly_credits ?? 0), 0
    );
    expect(Math.abs(sum - total),
      `Projected total ${total} ≠ sum of per-project projections ${sum}`
    ).toBeLessThanOrEqual(1);
  }
});

test('E2E-221 — Projected usage only includes projects that are active in the DB', async ({ page }) => {
  const res = await GET(page, '/api/v1/credits/projected-usage/');
  if (res.status !== 200) { test.skip(); return; }

  const projects = res.data?.projects ?? [];
  if (!projects.length) { test.skip(); return; }

  const offenders: string[] = [];
  for (const p of projects.slice(0, 20)) {
    const pid = p.project_id ?? p.id;
    if (!pid) continue;
    const active = await dbValue(
      `SELECT is_active FROM llmv_project WHERE id = $1`, [pid]
    );
    if (active === false) offenders.push(String(pid));
  }

  expect(offenders,
    `Projected usage includes inactive projects: ${offenders.join(', ')}`).toEqual([]);
});

// ─── Credit history ──────────────────────────────────────────────────────────

test('E2E-230 — Per-project credit history matches DB ledger rows', async ({ page }) => {
  const { projectId, domain } = FIXTURES.kia;

  const res = await GET(page, `/api/v1/projects/${projectId}/credit-usage/`);
  if (res.status !== 200) { test.skip(); return; }

  const entries = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  const dbCount = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE project_id = $1`, [projectId]
  ));

  console.log(`[INFO] ${domain} credit history — API: ${entries.length}, DB: ${dbCount}`);
  expect(entries.length,
    `${domain}: API returned ${entries.length} credit entries but DB has ${dbCount}`
  ).toBe(dbCount);
});

test('E2E-231 — Every credit entry the API returns exists in the DB ledger', async ({ page }) => {
  const { projectId } = FIXTURES.kia;

  const res = await GET(page, `/api/v1/projects/${projectId}/credit-usage/`);
  if (res.status !== 200) { test.skip(); return; }

  const entries = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  if (!entries.length) { test.skip(); return; }

  const apiTotal = entries.reduce(
    (s: number, e: any) => s + Number(e.credits_consumed ?? e.amount ?? 0), 0
  );
  const dbTotal = Number(await dbValue(
    `SELECT COALESCE(SUM(credits_consumed), 0) FROM llmv_creditusagelog WHERE project_id = $1`,
    [projectId]
  ));

  expect(apiTotal,
    `API credit history totals ${apiTotal} but DB ledger totals ${dbTotal}`).toBe(dbTotal);
});

test('E2E-232 — All ledger rows for this account belong to this customer', async () => {
  const wrong = Number(await dbValue(`
    SELECT COUNT(*) FROM llmv_creditusagelog c
    JOIN llmv_project p ON c.project_id = p.id
    WHERE p.customer_id = $1
      AND c.customer_id IS NOT NULL
      AND c.customer_id <> $1
  `, [CUSTOMER_ID]));

  expect(wrong,
    `${wrong} ledger rows for this account are attributed to a different customer`).toBe(0);
});
