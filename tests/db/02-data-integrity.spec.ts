import { test, expect } from '@playwright/test';
import { q, count, countBounded, closePool, T } from './db-helpers';

/**
 * SUITE DB — FILE 02: Data Integrity
 *
 * Large analytics tables use countBounded() — it stops scanning after the first
 * N offending rows, so the query returns quickly instead of timing out.
 * A non-zero result still means the defect exists; the number is a floor, not a total.
 */

test.afterAll(async () => { await closePool(); });

// ─── Orphaned rows ───────────────────────────────────────────────────────────

test('DB-020 — No queries orphaned from a topic', async () => {
  const orphans = await countBounded(`
    SELECT 1 FROM ${T.QUERY} q
    LEFT JOIN ${T.TOPIC} t ON q.topic_id = t.id
    WHERE q.topic_id IS NOT NULL AND t.id IS NULL
  `);
  expect(orphans, `${orphans}+ queries reference a topic that no longer exists`).toBe(0);
});

test('DB-021 — No topics orphaned from a brand', async () => {
  const orphans = await countBounded(`
    SELECT 1 FROM ${T.TOPIC} t
    LEFT JOIN ${T.BRAND} b ON t.brand_id = b.id
    WHERE t.brand_id IS NOT NULL AND b.id IS NULL
  `);
  expect(orphans, `${orphans}+ topics reference a brand that no longer exists`).toBe(0);
});

test('DB-022 — No projects orphaned from a brand', async () => {
  const orphans = await countBounded(`
    SELECT 1 FROM ${T.PROJECT} p
    LEFT JOIN ${T.BRAND} b ON p.brand_id = b.id
    WHERE p.brand_id IS NOT NULL AND b.id IS NULL
  `);
  expect(orphans, `${orphans}+ projects reference a brand that no longer exists`).toBe(0);
});

test('DB-023 — No snapshots orphaned from a project', async () => {
  const orphans = await countBounded(`
    SELECT 1 FROM ${T.SNAPSHOT} s
    LEFT JOIN ${T.PROJECT} p ON s.project_id = p.id
    WHERE s.project_id IS NOT NULL AND p.id IS NULL
  `);
  expect(orphans, `${orphans}+ snapshots reference a project that no longer exists`).toBe(0);
});

test('DB-024 — No query responses orphaned from a snapshot', async () => {
  const orphans = await countBounded(`
    SELECT 1 FROM ${T.RESPONSE} r
    LEFT JOIN ${T.SNAPSHOT} s ON r.snapshot_id = s.id
    WHERE r.snapshot_id IS NOT NULL AND s.id IS NULL
  `);
  expect(orphans, `${orphans}+ responses reference a snapshot that no longer exists`).toBe(0);
});

test('DB-025 — No sentiment rows orphaned from a query response', async () => {
  // Scoped to the last 30 days so the created index is usable.
  const orphans = await countBounded(`
    SELECT 1 FROM ${T.SENTIMENT} sa
    WHERE sa.created > NOW() - INTERVAL '7 days'
      AND sa.query_response_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ${T.RESPONSE} r WHERE r.id = sa.query_response_id)
  `, [], 50);
  expect(orphans, `${orphans}+ sentiment rows (last 7d) reference a missing response`).toBe(0);
});

test('DB-026 — No citation rows orphaned from a query response', async () => {
  // Scoped to the last 30 days so the created index is usable.
  const orphans = await countBounded(`
    SELECT 1 FROM ${T.CITATION} c
    WHERE c.created > NOW() - INTERVAL '7 days'
      AND c.query_response_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ${T.RESPONSE} r WHERE r.id = c.query_response_id)
  `, [], 50);
  expect(orphans, `${orphans}+ citation rows (last 7d) reference a missing response`).toBe(0);
});

test('DB-027 — No credit log rows orphaned from a project', async () => {
  const orphans = await countBounded(`
    SELECT 1 FROM ${T.CREDITS} c
    LEFT JOIN ${T.PROJECT} p ON c.project_id = p.id
    WHERE c.project_id IS NOT NULL AND p.id IS NULL
  `);
  expect(orphans, `${orphans}+ credit log rows reference a deleted project`).toBe(0);
});

test('DB-028 — No snapshot platform metrics orphaned from a snapshot', async () => {
  const orphans = await countBounded(`
    SELECT 1 FROM ${T.SNAP_METRICS} m
    LEFT JOIN ${T.SNAPSHOT} s ON m.snapshot_id = s.id
    WHERE m.snapshot_id IS NOT NULL AND s.id IS NULL
  `);
  expect(orphans, `${orphans}+ platform metric rows reference a missing snapshot`).toBe(0);
});

// ─── Duplicates ──────────────────────────────────────────────────────────────
// NOTE: Duplicates may be legitimate depending on product rules.
// Pending team confirmation — see DB-030/031/032 discussion.

test('DB-030 — No duplicate active projects for the same brand and country', async () => {
  const { rows } = await q(`
    SELECT brand_id, country_code, COUNT(*)::int AS n
    FROM ${T.PROJECT}
    WHERE is_deleted = false
    GROUP BY brand_id, country_code
    HAVING COUNT(*) > 1
    ORDER BY n DESC
    LIMIT 10
  `);
  if (rows.length) {
    console.log('[INFO] Sample duplicate brand+country combos:',
      rows.slice(0, 3).map(r => `${r.brand_id}/${r.country_code} x${r.n}`).join(', '));
  }
  expect(rows.length,
    `${rows.length} brand+country combos have duplicate active projects`).toBe(0);
});

test('DB-031 — No duplicate query titles created recently (UI: SMKT-LLMV-VAL-520)', async () => {
  const all = await q(`
    SELECT topic_id, title, COUNT(*)::int AS n
    FROM ${T.QUERY}
    WHERE is_deleted = false AND topic_id IS NOT NULL
    GROUP BY topic_id, title HAVING COUNT(*) > 1
    LIMIT 10
  `);
  if (all.rows.length) console.log(`[INFO] ${all.rows.length}+ topics contain legacy duplicate query titles`);

  const recent = await q(`
    SELECT topic_id, title, COUNT(*)::int AS n
    FROM ${T.QUERY}
    WHERE is_deleted = false AND topic_id IS NOT NULL
      AND created > NOW() - INTERVAL '30 days'
    GROUP BY topic_id, title HAVING COUNT(*) > 1
    LIMIT 10
  `);
  expect(recent.rows.length,
    `${recent.rows.length} duplicate query titles were created in the last 30 days — deduplication is not holding`
  ).toBe(0);
});

test('DB-032 — No duplicate topic titles created recently (UI: SMKT-LLMV-VAL-520)', async () => {
  const all = await q(`
    SELECT brand_id, title, COUNT(*)::int AS n
    FROM ${T.TOPIC}
    WHERE is_deleted = false AND brand_id IS NOT NULL
    GROUP BY brand_id, title HAVING COUNT(*) > 1
    LIMIT 10
  `);
  if (all.rows.length) console.log(`[INFO] ${all.rows.length}+ brands contain legacy duplicate topic titles`);

  const recent = await q(`
    SELECT brand_id, title, COUNT(*)::int AS n
    FROM ${T.TOPIC}
    WHERE is_deleted = false AND brand_id IS NOT NULL
      AND created > NOW() - INTERVAL '30 days'
    GROUP BY brand_id, title HAVING COUNT(*) > 1
    LIMIT 10
  `);
  expect(recent.rows.length,
    `${recent.rows.length} duplicate topic titles were created in the last 30 days — deduplication is not holding`
  ).toBe(0);
});

test('DB-033 — No duplicate platform metric rows per snapshot', async () => {
  const { rows } = await q(`
    SELECT snapshot_id, platform, COUNT(*)::int AS n
    FROM ${T.SNAP_METRICS}
    GROUP BY snapshot_id, platform
    HAVING COUNT(*) > 1
    LIMIT 10
  `);
  expect(rows.length,
    `${rows.length} snapshots have duplicate metric rows for the same platform`).toBe(0);
});

test('DB-034 — No duplicate platform entries in platform status', async () => {
  const { rows } = await q(`
    SELECT platform, COUNT(*)::int AS n
    FROM ${T.PLATFORM}
    GROUP BY platform
    HAVING COUNT(*) > 1
  `);
  expect(rows.length, `${rows.length} platforms are listed more than once`).toBe(0);
});

// ─── Value sanity ────────────────────────────────────────────────────────────

test('DB-040 — No negative credits_consumed in the credit log', async () => {
  const bad = await countBounded(
    `SELECT 1 FROM ${T.CREDITS} WHERE credits_consumed < 0`
  );
  expect(bad, `${bad}+ credit log rows have a negative charge`).toBe(0);
});

test('DB-041 — No negative balance_after in the credit log', async () => {
  const bad = await countBounded(
    `SELECT 1 FROM ${T.CREDITS} WHERE balance_after < 0`
  );
  expect(bad, `${bad}+ credit log rows show a negative balance`).toBe(0);
});

test('DB-042 — No negative credit_cost_per_run on projects', async () => {
  const bad = await countBounded(
    `SELECT 1 FROM ${T.PROJECT} WHERE credit_cost_per_run < 0`
  );
  expect(bad, `${bad}+ projects have a negative per-run cost`).toBe(0);
});

test('DB-043 — Visibility percentages stay within 0-100', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.SNAP_METRICS}
    WHERE visibility_pct IS NOT NULL
      AND (visibility_pct < 0 OR visibility_pct > 100)
  `);
  expect(bad, `${bad}+ platform metric rows have visibility outside 0-100`).toBe(0);
});

test('DB-044 — Share of voice stays within 0-100', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM (
      SELECT share_of_voice FROM ${T.CITATION}
      ORDER BY id DESC
      LIMIT 50000
    ) c
    WHERE share_of_voice IS NOT NULL
      AND (share_of_voice < 0 OR share_of_voice > 100)
  `, [], 50);
  expect(bad, `${bad}+ citation rows (newest 50k) have share_of_voice outside 0-100`).toBe(0);
});

test('DB-045 — Mentioned count never exceeds total count', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.SNAP_METRICS}
    WHERE mentioned_count IS NOT NULL
      AND total_count IS NOT NULL
      AND mentioned_count > total_count
  `);
  expect(bad, `${bad}+ metric rows have mentioned_count > total_count`).toBe(0);
});

test('DB-046 — No negative token counts on query responses', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.RESPONSE}
    WHERE created > NOW() - INTERVAL '7 days'
      AND (input_tokens < 0 OR output_tokens < 0)
  `, [], 50);
  expect(bad, `${bad}+ responses (last 7d) have negative token counts`).toBe(0);
});

test('DB-047 — Refresh frequency is positive on recently modified projects (UI-enforced)', async () => {
  const total = await countBounded(`
    SELECT 1 FROM ${T.PROJECT}
    WHERE frequency_days IS NOT NULL AND frequency_days <= 0
  `);
  if (total > 0) console.log(`[INFO] ${total}+ legacy projects have a non-positive refresh frequency`);

  const recent = await countBounded(`
    SELECT 1 FROM ${T.PROJECT}
    WHERE frequency_days IS NOT NULL AND frequency_days <= 0
      AND modified > NOW() - INTERVAL '30 days'
  `);
  expect(recent,
    `${recent} projects were saved in the last 30 days with a non-positive frequency — the settings form allows an invalid value`
  ).toBe(0);
});

test('DB-048 — No snapshot completed before it started', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.SNAPSHOT}
    WHERE started_at IS NOT NULL
      AND completed_at IS NOT NULL
      AND completed_at < started_at
  `);
  expect(bad, `${bad}+ snapshots completed before they started`).toBe(0);
});

test('DB-049 — No row has a modified timestamp before created', async () => {
  for (const table of [T.PROJECT, T.TOPIC, T.QUERY, T.SNAPSHOT, T.CREDITS]) {
    const bad = await countBounded(
      `SELECT 1 FROM ${table} WHERE modified < created`
    );
    expect(bad, `${table} has ${bad}+ rows modified before they were created`).toBe(0);
  }
});
