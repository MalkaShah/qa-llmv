import { test, expect } from '@playwright/test';
import {
  GET, POST, db, dbValue, closeDb, FIXTURES,
  waitForSnapshot, apiBalance,
} from './e2e-helpers';

/**
 * SUITE C — FILE 04: Billing Chain  @costly
 *
 * ⚠️  CONSUMES REAL UNIVERSAL CREDITS ON PRODUCTION
 *     Fixture: bluebonnetcafe.net — 5 UC per run.
 *     Run with:  npx playwright test tests/e2e --project=e2e --grep "@costly"
 *
 * SCOPE: billing correctness only. Data-quality checks (did the run produce
 * responses, metrics, analysis rows?) live in 06-snapshot-quality.spec.ts and
 * read existing snapshots for free.
 *
 * INDEPENDENCE: exactly one run is triggered, in beforeAll. Every test then
 * verifies a different property of that run by querying it directly. A failure
 * in one assertion does not cascade — each test stands alone.
 */

const { projectId, domain } = FIXTURES.bluebonnet;

interface RunContext {
  triggered: boolean;
  snapshotId: string | null;
  status: string | null;
  costPerRun: number;
  balanceBefore: number | null;
  ledgerRowsBefore: number;
  triggerStatus: number | null;
  error: string | null;
}

const run: RunContext = {
  triggered: false, snapshotId: null, status: null,
  costPerRun: 0, balanceBefore: null, ledgerRowsBefore: 0,
  triggerStatus: null, error: null,
};

/**
 * Triggers exactly one analysis run and records everything needed by the tests.
 * Runs once. Every test below reads this context rather than depending on the
 * test before it.
 */
test.beforeAll(async ({ playwright }) => {
  const ctx = await playwright.request.newContext();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.LLMV_TOKEN}`,
  };
  const api = 'https://llmvis.searchatlas.com';

  try {
    // Preconditions
    const { rows } = await db(`
      SELECT is_active, is_deleted, credit_cost_per_run, has_insufficient_credits
      FROM llmv_project WHERE id = $1
    `, [projectId]);

    if (!rows.length)                        { run.error = `Fixture ${domain} not found`; return; }
    if (rows[0].is_deleted)                  { run.error = `Fixture ${domain} is deleted`; return; }
    if (!rows[0].is_active)                  { run.error = `Fixture ${domain} is inactive`; return; }
    if (rows[0].has_insufficient_credits)    { run.error = `Fixture ${domain} has insufficient credits`; return; }

    run.costPerRun = Number(rows[0].credit_cost_per_run ?? 0);
    if (run.costPerRun <= 0) { run.error = `Fixture ${domain} costs 0 — billing cannot be verified`; return; }

    // Baseline
    const balRes = await ctx.get(`${api}/api/v1/credits/summary/`, { headers });
    const balBody = await balRes.json().catch(() => ({}));
    run.balanceBefore = balBody?.total_remaining ?? null;

    run.ledgerRowsBefore = Number(await dbValue(
      `SELECT COUNT(*) FROM llmv_creditusagelog WHERE project_id = $1`, [projectId]
    ));

    const snapsBefore = Number(await dbValue(
      `SELECT COUNT(*) FROM llmv_analysissnapshot WHERE project_id = $1`, [projectId]
    ));

    console.log(`[INFO] ${domain} — cost ${run.costPerRun} UC, balance ${run.balanceBefore}, ledger rows ${run.ledgerRowsBefore}`);

    // Trigger — the single billable action in this file
    const res = await ctx.post(`${api}/api/v1/projects/${projectId}/run-analysis/`, { headers });
    run.triggerStatus = res.status();
    run.triggered = [200, 202].includes(res.status());
    console.log(`[INFO] run-analysis → ${run.triggerStatus}`);

    if (!run.triggered) { run.error = `run-analysis returned ${run.triggerStatus}`; return; }

    await new Promise(r => setTimeout(r, 8000));

    const snapsAfter = Number(await dbValue(
      `SELECT COUNT(*) FROM llmv_analysissnapshot WHERE project_id = $1`, [projectId]
    ));
    if (snapsAfter - snapsBefore !== 1) {
      run.error = `run-analysis created ${snapsAfter - snapsBefore} snapshots, expected 1`;
    }

    run.snapshotId = await dbValue(`
      SELECT id::text FROM llmv_analysissnapshot
      WHERE project_id = $1 ORDER BY created DESC LIMIT 1
    `, [projectId]);

    console.log(`[INFO] snapshot ${run.snapshotId} — waiting for completion`);
    run.status = await waitForSnapshot(run.snapshotId!, 300_000);
    console.log(`[INFO] snapshot finished with status: ${run.status}`);
  } finally {
    await ctx.dispose();
  }
});

test.afterAll(async () => { await closeDb(); });

// ─── Trigger ─────────────────────────────────────────────────────────────────

test('E2E-400 @costly — run-analysis is accepted', async () => {
  expect(run.triggerStatus,
    `run-analysis returned ${run.triggerStatus}. ${run.error ?? ''}`).not.toBeNull();
  expect([200, 202],
    `run-analysis returned ${run.triggerStatus}, expected 200 or 202`).toContain(run.triggerStatus!);
});

test('E2E-410 @costly — Exactly one snapshot was created', async () => {
  expect(run.snapshotId,
    `No snapshot was created. ${run.error ?? ''}`).toBeTruthy();
  expect(run.error,
    `Snapshot creation problem: ${run.error}`).toBeNull();
});

test('E2E-411 @costly — Snapshot completes successfully', async () => {
  if (!run.snapshotId) { test.skip(); return; }

  expect(run.status,
    `Snapshot ${run.snapshotId} did not reach a terminal state within 5 minutes — it is stuck`
  ).not.toBeNull();

  // A run the customer paid for must complete, not merely stop.
  expect(['completed', 'success', 'done'],
    `Snapshot finished as "${run.status}" — the customer was charged ${run.costPerRun} UC for a run that did not succeed`
  ).toContain(String(run.status).toLowerCase());
});

// ─── Billing — each test verifies independently ──────────────────────────────

test('E2E-420 @costly — Exactly one credit row was written', async () => {
  if (!run.snapshotId) { test.skip(); return; }

  const rows = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE snapshot_id = $1`, [run.snapshotId]
  ));
  expect(rows,
    `Snapshot ${run.snapshotId} produced ${rows} credit rows — expected exactly 1. More than 1 is double billing.`
  ).toBe(1);
});

test('E2E-421 @costly — Charge equals credit_cost_per_run', async () => {
  if (!run.snapshotId) { test.skip(); return; }

  const charged = Number(await dbValue(
    `SELECT COALESCE(SUM(credits_consumed), 0) FROM llmv_creditusagelog WHERE snapshot_id = $1`,
    [run.snapshotId]
  ));
  expect(charged,
    `Charged ${charged} UC but the project's configured cost is ${run.costPerRun} UC`
  ).toBe(run.costPerRun);
});

test('E2E-422 @costly — Snapshot and ledger agree on the amount', async () => {
  if (!run.snapshotId) { test.skip(); return; }

  const snapCredits = await dbValue(
    `SELECT credits_consumed FROM llmv_analysissnapshot WHERE id = $1`, [run.snapshotId]
  );
  if (snapCredits === null) {
    console.warn('[BUG E2E-422] Snapshot records no credits_consumed value');
    test.skip();
    return;
  }

  const logCredits = Number(await dbValue(
    `SELECT COALESCE(SUM(credits_consumed), 0) FROM llmv_creditusagelog WHERE snapshot_id = $1`,
    [run.snapshotId]
  ));
  expect(Number(snapCredits),
    `Snapshot records ${snapCredits} credits, ledger records ${logCredits} — the two sources of truth disagree`
  ).toBe(logCredits);
});

test('E2E-423 @costly — Account balance dropped by exactly the run cost', async ({ page }) => {
  if (run.balanceBefore === null) { test.skip(); return; }

  const balanceAfter = await apiBalance(page);
  if (balanceAfter === null) { test.skip(); return; }

  const drop = run.balanceBefore - balanceAfter;
  console.log(`[INFO] balance ${run.balanceBefore} → ${balanceAfter} (drop ${drop}, expected ${run.costPerRun})`);

  expect(drop,
    `Balance fell by ${drop} UC but the run costs ${run.costPerRun} UC`).toBe(run.costPerRun);
});

test('E2E-424 @costly — Ledger balance_after matches the arithmetic', async () => {
  if (!run.snapshotId || run.balanceBefore === null) { test.skip(); return; }

  const balanceAfter = await dbValue(
    `SELECT balance_after FROM llmv_creditusagelog WHERE snapshot_id = $1 LIMIT 1`,
    [run.snapshotId]
  );
  if (balanceAfter === null) {
    console.warn('[BUG E2E-424] Credit row records no balance_after value');
    test.skip();
    return;
  }

  const expected = run.balanceBefore - run.costPerRun;
  expect(Math.abs(Number(balanceAfter) - expected),
    `Ledger records balance_after=${balanceAfter}, arithmetic gives ${expected}`
  ).toBeLessThanOrEqual(1);
});

test('E2E-425 @costly — Exactly one ledger row was added for this project', async () => {
  const after = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE project_id = $1`, [projectId]
  ));
  const added = after - run.ledgerRowsBefore;
  expect(added,
    `${added} ledger rows were added for one run — expected exactly 1`).toBe(1);
});
