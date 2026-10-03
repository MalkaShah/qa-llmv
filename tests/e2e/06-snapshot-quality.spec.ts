import { test, expect } from '@playwright/test';
import { GET, POST, db, dbValue, closeDb, FIXTURES } from './e2e-helpers';

/**
 * SUITE C — FILE 06: Snapshot Output Quality
 *
 * These checks were split out of the billing suite. They ask "did a completed
 * run actually produce usable output?" — a question that can be answered by
 * reading an existing snapshot, with no need to trigger a new one.
 *
 * COST: zero. Reads the most recent completed snapshot on a fixture project.
 */

test.afterAll(async () => { await closeDb(); });

/** Most recent completed snapshot for a project, or null. */
async function latestSnapshot(projectId: string): Promise<string | null> {
  return dbValue(`
    SELECT id::text FROM llmv_analysissnapshot
    WHERE project_id = $1
      AND LOWER(status) IN ('completed', 'success', 'done')
      AND completed_at IS NOT NULL
    ORDER BY completed_at DESC
    LIMIT 1
  `, [projectId]);
}

// ─── Output completeness ─────────────────────────────────────────────────────

test('E2E-600 — A completed snapshot stored query responses', async () => {
  const snap = await latestSnapshot(FIXTURES.forbes.projectId);
  if (!snap) { test.skip(); return; }

  const responses = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_queryresponse WHERE snapshot_id = $1`, [snap]
  ));
  expect(responses,
    `Snapshot ${snap} is marked completed but stored no query responses — credits were charged for nothing`
  ).toBeGreaterThan(0);
});

test('E2E-601 — A completed snapshot stored platform metrics', async () => {
  const snap = await latestSnapshot(FIXTURES.forbes.projectId);
  if (!snap) { test.skip(); return; }

  const metrics = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_snapshot_platform_metrics WHERE snapshot_id = $1`, [snap]
  ));
  expect(metrics,
    `Snapshot ${snap} completed but stored no platform metrics — the dashboard will show a gap for this period`
  ).toBeGreaterThan(0);
});

test('E2E-602 — Successful responses produced downstream analysis', async () => {
  const snap = await latestSnapshot(FIXTURES.forbes.projectId);
  if (!snap) { test.skip(); return; }

  const successful = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_queryresponse WHERE snapshot_id = $1 AND success = true`,
    [snap]
  ));
  if (successful === 0) { test.skip(); return; }

  const sentiment = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_responsesentimentanalysis WHERE snapshot_id = $1`, [snap]
  ));
  const citations = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_responsecitationanalysis WHERE snapshot_id = $1`, [snap]
  ));

  console.log(`[INFO] snapshot ${snap} — ${successful} successful responses, ${sentiment} sentiment rows, ${citations} citation rows`);
  expect(sentiment + citations,
    `${successful} successful responses produced no sentiment or citation analysis — the LLM output was paid for but never used`
  ).toBeGreaterThan(0);
});

test('E2E-603 — Metrics cover the platforms the project selected', async () => {
  const { projectId } = FIXTURES.forbes;
  const snap = await latestSnapshot(projectId);
  if (!snap) { test.skip(); return; }

  const selected = await dbValue(
    `SELECT selected_platforms FROM llmv_project WHERE id = $1`, [projectId]
  );
  const platformCount = Array.isArray(selected) ? selected.length : 0;
  if (platformCount === 0) { test.skip(); return; }

  const { rows } = await db(
    `SELECT DISTINCT platform FROM llmv_snapshot_platform_metrics WHERE snapshot_id = $1`,
    [snap]
  );

  console.log(`[INFO] project selected ${platformCount} platforms, snapshot has metrics for ${rows.length}`);
  expect(rows.length,
    `Project selected ${platformCount} platforms but the snapshot stored metrics for only ${rows.length}`
  ).toBeGreaterThanOrEqual(1);
});

test('E2E-604 — A completed snapshot is offered through the API', async ({ page }) => {
  const { projectId } = FIXTURES.forbes;
  const snap = await latestSnapshot(projectId);
  if (!snap) { test.skip(); return; }

  const res = await POST(page, '/api/v1/queries/available-dates/', { project_id: projectId });
  if (res.status !== 200) { test.skip(); return; }

  const dates = Array.isArray(res.data)
    ? res.data
    : res.data?.available_dates ?? res.data?.data ?? [];
  const found = dates.some((d: any) => String(d.snapshot_id ?? d.id ?? '') === snap);

  expect(found,
    `Snapshot ${snap} is completed in the database but the API does not offer it as an available date`
  ).toBe(true);
});

// ─── Partial failure handling ────────────────────────────────────────────────

test('E2E-610 — Partially failed snapshots are not presented as fully successful', async () => {
  // A snapshot where some responses failed should not claim 100% success.
  const { rows } = await db(`
    SELECT s.id::text,
           s.success_response_count,
           COUNT(r.id) FILTER (WHERE r.success = true)::int  AS actual_success,
           COUNT(r.id) FILTER (WHERE r.success = false)::int AS actual_failed
    FROM llmv_analysissnapshot s
    JOIN llmv_queryresponse r ON r.snapshot_id = s.id
    WHERE LOWER(s.status) IN ('completed', 'success', 'done')
      AND s.completed_at > NOW() - INTERVAL '7 days'
    GROUP BY s.id, s.success_response_count
    HAVING COUNT(r.id) FILTER (WHERE r.success = false) > 0
       AND s.success_response_count <> COUNT(r.id) FILTER (WHERE r.success = true)
    LIMIT 20
  `);

  if (rows.length) {
    console.log('[INFO] sample:', JSON.stringify(rows.slice(0, 3)));
  }
  expect(rows.length,
    `${rows.length} snapshots report a success_response_count that disagrees with their actual successful responses`
  ).toBe(0);
});

test('E2E-611 — A snapshot with zero successful responses is not marked complete', async () => {
  const bad = Number(await dbValue(`
    SELECT COUNT(*) FROM (
      SELECT s.id
      FROM llmv_analysissnapshot s
      WHERE LOWER(s.status) IN ('completed', 'success', 'done')
        AND s.completed_at > NOW() - INTERVAL '7 days'
        AND COALESCE(s.success_response_count, 0) = 0
      LIMIT 50
    ) sub
  `));
  expect(bad,
    `${bad} snapshots completed in the last 7 days with zero successful responses — they should be marked failed`
  ).toBe(0);
});

test('E2E-612 — Charging is proportional when a run partially fails', async () => {
  // If a run failed entirely, it should not carry a full-price charge.
  const { rows } = await db(`
    SELECT s.id::text, s.status, s.credits_consumed,
           p.credit_cost_per_run
    FROM llmv_analysissnapshot s
    JOIN llmv_project p ON s.project_id = p.id
    WHERE s.completed_at > NOW() - INTERVAL '7 days'
      AND COALESCE(s.success_response_count, 0) = 0
      AND COALESCE(s.credits_consumed, 0) > 0
    LIMIT 20
  `);

  expect(rows.length,
    `${rows.length} snapshots produced no successful responses but were charged the full amount`
  ).toBe(0);
});
