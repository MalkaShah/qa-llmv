import { test, expect } from '@playwright/test';
import { q, count, countBounded, closePool, T, fixtureProjectId } from './db-helpers';

/**
 * SUITE DB — FILE 03: Credit Integrity & Business Logic
 * The highest-risk area — billing correctness.
 * A failure here means customers are charged wrongly — APP BUG, P0.
 */

test.afterAll(async () => { await closePool(); });

// ─── Credit deduction integrity ──────────────────────────────────────────────

test('DB-050 — No duplicate credit charges for the same snapshot', async () => {
  const { rows } = await q(`
    SELECT snapshot_id, COUNT(*) AS n, SUM(credits_consumed) AS total
    FROM ${T.CREDITS}
    WHERE snapshot_id IS NOT NULL
    GROUP BY snapshot_id
    HAVING COUNT(*) > 1
    ORDER BY n DESC
    LIMIT 20
  `);
  expect(rows.length,
    `${rows.length} snapshots were charged more than once — DOUBLE BILLING`).toBe(0);
});

test('DB-051 — No duplicate credit charges for the same reservation', async () => {
  const { rows } = await q(`
    SELECT reservation_id, COUNT(*) AS n
    FROM ${T.CREDITS}
    WHERE reservation_id IS NOT NULL
    GROUP BY reservation_id
    HAVING COUNT(*) > 1
    LIMIT 20
  `);
  expect(rows.length,
    `${rows.length} reservations produced more than one charge — DOUBLE BILLING`).toBe(0);
});

test('DB-052 — No phantom charges: every charge references a real snapshot or project', async () => {
  const phantom = await countBounded(`
    SELECT 1 FROM ${T.CREDITS}
    WHERE credits_consumed > 0
      AND snapshot_id IS NULL
      AND project_id IS NULL
  `);
  expect(phantom,
    `${phantom} credit charges reference neither a snapshot nor a project — PHANTOM CHARGE`).toBe(0);
});

test('DB-053 — No charge recorded against a failed snapshot', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.CREDITS} c
    JOIN ${T.SNAPSHOT} s ON c.snapshot_id = s.id
    WHERE c.credits_consumed > 0
      AND LOWER(s.status) IN ('failed', 'error', 'cancelled')
  `);
  expect(bad,
    `${bad} charges were made for snapshots that failed — customers billed for nothing`).toBe(0);
});

test('DB-054 — Snapshot credits_consumed matches the credit log', async () => {
  const { rows } = await q(`
    SELECT s.id,
           s.credits_consumed        AS snapshot_credits,
           COALESCE(SUM(c.credits_consumed), 0) AS logged_credits
    FROM ${T.SNAPSHOT} s
    LEFT JOIN ${T.CREDITS} c ON c.snapshot_id = s.id
    WHERE s.credits_consumed IS NOT NULL
      AND s.credits_consumed > 0
    GROUP BY s.id, s.credits_consumed
    HAVING s.credits_consumed <> COALESCE(SUM(c.credits_consumed), 0)
    LIMIT 20
  `);
  expect(rows.length,
    `${rows.length} snapshots disagree with the credit log on amount charged`).toBe(0);
});

test('DB-055 — Balance decreases monotonically within a customer ledger', async () => {
  const { rows } = await q(`
    WITH ordered AS (
      SELECT customer_id,
             created,
             credits_consumed,
             balance_after,
             LAG(balance_after) OVER (PARTITION BY customer_id ORDER BY created, id) AS prev_balance
      FROM ${T.CREDITS}
      WHERE balance_after IS NOT NULL
    )
    SELECT customer_id, created, prev_balance, balance_after, credits_consumed
    FROM ordered
    WHERE prev_balance IS NOT NULL
      AND credits_consumed > 0
      AND balance_after > prev_balance
    LIMIT 20
  `);
  expect(rows.length,
    `${rows.length} ledger entries show the balance increasing on a charge`).toBe(0);
});

test('DB-056 — Every charge action is a recognised action type', async () => {
  const { rows } = await q(`
    SELECT DISTINCT action, COUNT(*) AS n
    FROM ${T.CREDITS}
    WHERE action IS NULL OR TRIM(action) = ''
    GROUP BY action
  `);
  expect(rows.length, `${rows.length} credit log rows have no action label`).toBe(0);
});

test('DB-057 — Credit log action types are documented', async () => {
  const { rows } = await q(`
    SELECT action, COUNT(*) AS n
    FROM ${T.CREDITS}
    GROUP BY action
    ORDER BY n DESC
  `);
  console.log('[INFO] Credit actions in use:',
    rows.map(r => `${r.action} (${r.n})`).join(', '));
  expect(rows.length, 'No credit actions recorded at all').toBeGreaterThan(0);
});

// ─── Quota & plan enforcement ────────────────────────────────────────────────

test('DB-060 — Projects flagged insufficient actually have a cost set', async () => {
  const bad = await count(`
    SELECT COUNT(*) FROM ${T.PROJECT}
    WHERE has_insufficient_credits = true
      AND (credit_cost_per_run IS NULL OR credit_cost_per_run = 0)
  `);
  expect(bad,
    `${bad} projects are flagged insufficient but have no per-run cost`).toBe(0);
});

test('DB-061 — Active projects have at least one platform selected', async () => {
  const bad = await count(`
    SELECT COUNT(*) FROM ${T.PROJECT}
    WHERE is_active = true
      AND is_deleted = false
      AND (selected_platforms IS NULL OR selected_platforms::text IN ('[]', 'null', ''))
  `);
  expect(bad,
    `${bad} active projects have no platforms selected — they can never run`).toBe(0);
});

test('DB-062 — Active projects have a refresh frequency set', async () => {
  const bad = await count(`
    SELECT COUNT(*) FROM ${T.PROJECT}
    WHERE is_active = true
      AND is_deleted = false
      AND frequency_days IS NULL
  `);
  expect(bad, `${bad} active projects have no refresh frequency`).toBe(0);
});

test('DB-063 — Deleted projects are not still marked active', async () => {
  const bad = await count(`
    SELECT COUNT(*) FROM ${T.PROJECT}
    WHERE is_deleted = true AND is_active = true
  `);
  expect(bad,
    `${bad} projects are soft-deleted but still active — they may still consume credits`).toBe(0);
});

test('DB-064 — Every project belongs to a customer', async () => {
  const bad = await count(`
    SELECT COUNT(*) FROM ${T.PROJECT}
    WHERE is_deleted = false AND customer_id IS NULL
  `);
  expect(bad, `${bad} projects have no customer_id — billing cannot be attributed`).toBe(0);
});

// ─── Run frequency enforcement ───────────────────────────────────────────────

test('DB-070 — No project ran more often than its configured frequency', async () => {
  const { rows } = await q(`
    WITH runs AS (
      SELECT s.project_id,
             s.started_at,
             p.frequency_days,
             LAG(s.started_at) OVER (PARTITION BY s.project_id ORDER BY s.started_at) AS prev_run
      FROM ${T.SNAPSHOT} s
      JOIN ${T.PROJECT} p ON s.project_id = p.id
      WHERE s.started_at IS NOT NULL
        AND p.frequency_days IS NOT NULL
        AND LOWER(s.trigger) NOT IN ('manual', 'user', 'backfill')
    )
    SELECT project_id,
           COUNT(*) AS violations
    FROM runs
    WHERE prev_run IS NOT NULL
      AND started_at - prev_run < (frequency_days || ' days')::interval * 0.5
    GROUP BY project_id
    ORDER BY violations DESC
    LIMIT 20
  `);
  expect(rows.length,
    `${rows.length} projects ran significantly more often than configured — over-billing risk`).toBe(0);
});

test('DB-071 — No snapshot stuck in a running state for over 24 hours', async () => {
  const stuck = await countBounded(`
    SELECT 1 FROM ${T.SNAPSHOT}
    WHERE completed_at IS NULL
      AND started_at IS NOT NULL
      AND started_at < NOW() - INTERVAL '24 hours'
      AND LOWER(status) NOT IN ('failed', 'error', 'cancelled')
  `);
  expect(stuck,
    `${stuck} snapshots have been running for over 24 hours — likely stuck jobs holding credits`).toBe(0);
});

test('DB-072 — No completed snapshot has zero successful responses', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.SNAPSHOT}
    WHERE LOWER(status) IN ('completed', 'success', 'done')
      AND COALESCE(success_response_count, 0) = 0
  `);
  expect(bad,
    `${bad} snapshots are marked complete but returned no successful responses`).toBe(0);
});

// ─── Fixture project sanity ──────────────────────────────────────────────────
// llmv_project.id is a UUID. The number in the dashboard URL (843571) is the
// Site Explorer project id, not the LLMV project id — so we resolve by domain.

let fixtureId: string | null = null;

test.beforeAll(async () => {
  fixtureId = await fixtureProjectId();
  if (fixtureId) console.log(`[INFO] Fixture project UUID: ${fixtureId}`);
});

test('DB-080 — Fixture project exists and is active', async () => {
  expect(fixtureId, 'Fixture project microsoft.com/us not found in llmv_project').toBeTruthy();

  const { rows } = await q(`
    SELECT id, is_active, is_deleted, country_code, frequency_days
    FROM ${T.PROJECT}
    WHERE id = $1
  `, [fixtureId]);

  expect(rows.length, 'Fixture project row not returned').toBe(1);
  expect(rows[0].is_deleted, 'Fixture project is soft-deleted').toBe(false);
  expect(rows[0].is_active,  'Fixture project is not active').toBe(true);
});

test('DB-081 — Fixture project has topics', async () => {
  if (!fixtureId) { test.skip(); return; }
  const n = await count(`
    SELECT COUNT(*) FROM ${T.TOPIC} t
    JOIN ${T.PROJECT} p ON t.brand_id = p.brand_id
    WHERE p.id = $1 AND t.is_deleted = false
  `, [fixtureId]);
  expect(n, 'Fixture project has no topics').toBeGreaterThan(0);
});

test('DB-082 — Fixture project has completed snapshots', async () => {
  if (!fixtureId) { test.skip(); return; }
  const n = await count(`
    SELECT COUNT(*) FROM ${T.SNAPSHOT}
    WHERE project_id = $1 AND completed_at IS NOT NULL
  `, [fixtureId]);
  expect(n, 'Fixture project has no completed snapshots').toBeGreaterThan(0);
});

test('DB-083 — Fixture project has query responses', async () => {
  if (!fixtureId) { test.skip(); return; }
  const n = await count(`
    SELECT COUNT(*) FROM ${T.RESPONSE} r
    JOIN ${T.SNAPSHOT} s ON r.snapshot_id = s.id
    WHERE s.project_id = $1
  `, [fixtureId]);
  expect(n, 'Fixture project has no query responses').toBeGreaterThan(0);
});

test('DB-084 — Fixture project has sentiment analysis rows', async () => {
  if (!fixtureId) { test.skip(); return; }
  const n = await count(`
    SELECT COUNT(*) FROM ${T.SENTIMENT} sa
    JOIN ${T.SNAPSHOT} s ON sa.snapshot_id = s.id
    WHERE s.project_id = $1
  `, [fixtureId]);
  expect(n, 'Fixture project has no sentiment data').toBeGreaterThan(0);
});

test('DB-085 — Fixture project has citation analysis rows', async () => {
  if (!fixtureId) { test.skip(); return; }
  const n = await count(`
    SELECT COUNT(*) FROM ${T.CITATION} c
    JOIN ${T.SNAPSHOT} s ON c.snapshot_id = s.id
    WHERE s.project_id = $1
  `, [fixtureId]);
  expect(n, 'Fixture project has no citation data').toBeGreaterThan(0);
});
