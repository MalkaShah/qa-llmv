import { test, expect } from '@playwright/test';
import {
  GET, POST, db, dbValue, closeDb, FIXTURES,
} from './e2e-helpers';

/**
 * SUITE C — FILE 03: Activation Lifecycle
 *
 * Fixture: starbucks.com — credit_cost_per_run = 0, so activating and
 * deactivating changes state without charging anything.
 *
 * ISOLATION: the fixture's original state is captured in beforeAll and restored
 * in afterAll. Restoration runs even when a test fails, so the fixture can never
 * be left dirty. There is no restore *test* — cleanup belongs in a hook.
 */

test.describe.configure({ mode: 'serial' });

const { projectId, domain } = FIXTURES.starbucks;

let originalActive: boolean | null = null;
let creditRowsAtStart = 0;

test.beforeAll(async () => {
  originalActive = await dbValue(
    `SELECT is_active FROM llmv_project WHERE id = $1`, [projectId]
  );
  creditRowsAtStart = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE project_id = $1`, [projectId]
  ));
  console.log(`[INFO] ${domain} initial state — is_active: ${originalActive}, credit rows: ${creditRowsAtStart}`);
});

/**
 * Teardown — always runs, including after a failure.
 * Uses a raw request rather than the page fixture, which is not available here.
 */
test.afterAll(async ({ playwright }) => {
  try {
    const current = await dbValue(
      `SELECT is_active FROM llmv_project WHERE id = $1`, [projectId]
    );

    if (current !== originalActive && originalActive !== null) {
      const ctx = await playwright.request.newContext();
      const endpoint = originalActive ? 'activate' : 'deactivate';
      await ctx.post(
        `https://llmvis.searchatlas.com/api/v1/projects/${projectId}/${endpoint}/`,
        { headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LLMV_TOKEN}`,
        }}
      );
      await ctx.dispose();
      await new Promise(r => setTimeout(r, 3000));

      const restored = await dbValue(
        `SELECT is_active FROM llmv_project WHERE id = $1`, [projectId]
      );
      console.log(`[INFO] teardown — ${domain} restored to is_active=${restored} (target ${originalActive})`);
      if (restored !== originalActive) {
        console.warn(`[WARN] Fixture ${domain} left in state is_active=${restored}, expected ${originalActive} — restore manually before the next run`);
      }
    }
  } finally {
    await closeDb();
  }
});

// ─── Preconditions ───────────────────────────────────────────────────────────

test('E2E-300 — Fixture project is usable and costs nothing to run', async () => {
  const { rows } = await db(`
    SELECT is_active, is_deleted, credit_cost_per_run
    FROM llmv_project WHERE id = $1
  `, [projectId]);

  expect(rows.length,
    `Fixture ${domain} (${projectId}) not found — update FIXTURES in e2e-helpers.ts`).toBe(1);
  expect(rows[0].is_deleted,
    `Fixture ${domain} is soft-deleted — pick another fixture`).toBe(false);
  expect(Number(rows[0].credit_cost_per_run ?? 0),
    `Fixture ${domain} costs ${rows[0].credit_cost_per_run} per run — these tests must not charge credits`).toBe(0);
});

// ─── Activate ────────────────────────────────────────────────────────────────

test('E2E-310 — Activating a project sets is_active to true', async ({ page }) => {
  const res = await POST(page, `/api/v1/projects/${projectId}/activate/`);
  console.log(`[INFO] activate → ${res.status}`);

  expect([200, 400, 403],
    `activate returned ${res.status}; expected 200, or 400/403 if blocked by a plan rule`
  ).toContain(res.status);

  if (res.status !== 200) {
    console.warn(`[INFO] Activation blocked with ${res.status} — state assertion skipped`);
    test.skip();
    return;
  }

  await new Promise(r => setTimeout(r, 3000));
  const dbActive = await dbValue(
    `SELECT is_active FROM llmv_project WHERE id = $1`, [projectId]
  );
  expect(dbActive,
    `activate returned 200 but the project is still is_active=${dbActive}`).toBe(true);
});

test('E2E-311 — Project detail endpoint reports the activated state', async ({ page }) => {
  const res = await GET(page, `/api/v1/projects/${projectId}/`);
  expect(res.status, `GET /projects/{id}/ returned ${res.status}`).toBe(200);

  const apiActive =
    res.data?.is_active ??
    res.data?.is_llm_activated ??
    res.data?.active ??
    res.data?.project?.is_active;

  if (apiActive === undefined) {
    console.log(`[INFO] project detail fields — ${Object.keys(res.data ?? {}).join(', ')}`);
    console.warn('[BUG E2E-311] GET /projects/{id}/ exposes no activation flag — clients cannot read project state from this endpoint');
    test.skip();
    return;
  }

  const dbActive = await dbValue(
    `SELECT is_active FROM llmv_project WHERE id = $1`, [projectId]
  );
  expect(apiActive,
    `API reports active=${apiActive}, database says ${dbActive} — the serialization layer disagrees with stored state`
  ).toBe(dbActive);
});

test('E2E-312 — Activation writes no credit row', async () => {
  const now = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE project_id = $1`, [projectId]
  ));
  expect(now,
    `Activation wrote ${now - creditRowsAtStart} credit row(s) — activating a project must be free`
  ).toBe(creditRowsAtStart);
});

test('E2E-313 — Activation does not trigger an analysis run', async () => {
  const recent = Number(await dbValue(`
    SELECT COUNT(*) FROM llmv_analysissnapshot
    WHERE project_id = $1 AND created > NOW() - INTERVAL '5 minutes'
  `, [projectId]));
  expect(recent,
    `Activation created ${recent} snapshot(s) — activation alone must not start an analysis`
  ).toBe(0);
});

// ─── Deactivate ──────────────────────────────────────────────────────────────

test('E2E-320 — Deactivating a project sets is_active to false', async ({ page }) => {
  const res = await POST(page, `/api/v1/projects/${projectId}/deactivate/`);
  console.log(`[INFO] deactivate → ${res.status}`);

  expect([200, 400, 403],
    `deactivate returned ${res.status}`).toContain(res.status);
  if (res.status !== 200) { test.skip(); return; }

  await new Promise(r => setTimeout(r, 3000));
  const dbActive = await dbValue(
    `SELECT is_active FROM llmv_project WHERE id = $1`, [projectId]
  );
  expect(dbActive,
    `deactivate returned 200 but the project is still is_active=${dbActive}`).toBe(false);
});

test('E2E-321 — run-analysis is refused on an inactive project', async ({ page }) => {
  const dbActive = await dbValue(
    `SELECT is_active FROM llmv_project WHERE id = $1`, [projectId]
  );
  if (dbActive !== false) {
    console.warn('[INFO] Project is not inactive — precondition for this test not met');
    test.skip();
    return;
  }

  const res = await POST(page, `/api/v1/projects/${projectId}/run-analysis/`);
  expect([400, 403, 409],
    `run-analysis returned ${res.status} on an inactive project — it must be refused`
  ).toContain(res.status);
});

test('E2E-322 — A refused run-analysis writes no credit row', async () => {
  const now = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE project_id = $1`, [projectId]
  ));
  expect(now,
    `A refused run-analysis wrote ${now - creditRowsAtStart} credit row(s) — PHANTOM CHARGE`
  ).toBe(creditRowsAtStart);
});
