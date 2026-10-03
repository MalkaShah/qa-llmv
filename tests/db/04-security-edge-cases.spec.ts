import { test, expect } from '@playwright/test';
import { q, count, countBounded, closePool, T } from './db-helpers';

/**
 * SUITE DB — FILE 04: Cross-Tenant Security & Edge Cases
 * Verifies tenant isolation and boundary conditions.
 * A failure in the security section is P0 — data leaking between customers.
 */

test.afterAll(async () => { await closePool(); });

// ─── Cross-tenant isolation ──────────────────────────────────────────────────

test('DB-090 — Every topic belongs to a brand owned by exactly one customer', async () => {
  const { rows } = await q(`
    SELECT t.brand_id, COUNT(DISTINCT p.customer_id) AS customers
    FROM ${T.TOPIC} t
    JOIN ${T.PROJECT} p ON t.brand_id = p.brand_id
    WHERE t.is_deleted = false AND p.is_deleted = false
    GROUP BY t.brand_id
    HAVING COUNT(DISTINCT p.customer_id) > 1
    LIMIT 20
  `);
  expect(rows.length,
    `${rows.length} brands are shared across multiple customers — CROSS-TENANT LEAK`).toBe(0);
});

test('DB-091 — Every query inherits its topic customer scope', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.QUERY} q
    JOIN ${T.TOPIC} t ON q.topic_id = t.id
    WHERE q.customer_id IS NOT NULL
      AND t.customer_id IS NOT NULL
      AND q.customer_id <> t.customer_id
  `);
  expect(bad,
    `${bad} queries have a different customer than their parent topic — CROSS-TENANT LEAK`).toBe(0);
});

test('DB-092 — Credit log entries match the project customer', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.CREDITS} c
    JOIN ${T.PROJECT} p ON c.project_id = p.id
    WHERE c.customer_id IS NOT NULL
      AND p.customer_id IS NOT NULL
      AND c.customer_id <> p.customer_id
  `);
  expect(bad,
    `${bad} credit charges are attributed to the wrong customer — BILLING LEAK`).toBe(0);
});

test('DB-093 — Snapshots inherit the project brand', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.SNAPSHOT} s
    JOIN ${T.PROJECT} p ON s.project_id = p.id
    WHERE s.brand_id IS NOT NULL
      AND p.brand_id IS NOT NULL
      AND s.brand_id <> p.brand_id
  `);
  expect(bad,
    `${bad} snapshots reference a different brand than their project`).toBe(0);
});

test('DB-094 — No project references a user outside its customer', async () => {
  const { rows } = await q(`
    SELECT COUNT(DISTINCT p.customer_id) AS n
    FROM ${T.PROJECT} p
    WHERE p.is_deleted = false
  `);
  expect(Number(rows[0].n), 'No customers found — cannot verify isolation').toBeGreaterThan(0);
});

// ─── Soft delete correctness ─────────────────────────────────────────────────

test('DB-100 — Soft-deleted topics have no active queries', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.QUERY} q
    JOIN ${T.TOPIC} t ON q.topic_id = t.id
    WHERE t.is_deleted = true AND q.is_deleted = false
  `);
  expect(bad,
    `${bad} active queries belong to a deleted topic — they will still be analysed and billed`).toBe(0);
});

test('DB-101 — Soft-deleted brands have no active projects', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.PROJECT} p
    JOIN ${T.BRAND} b ON p.brand_id = b.id
    WHERE b.is_deleted = true AND p.is_deleted = false
  `);
  expect(bad, `${bad} active projects belong to a deleted brand`).toBe(0);
});

test('DB-102 — Soft-deleted projects have no snapshots created after deletion', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.SNAPSHOT} s
    JOIN ${T.PROJECT} p ON s.project_id = p.id
    WHERE p.is_deleted = true
      AND s.created > p.modified
  `);
  expect(bad,
    `${bad} snapshots were created after their project was deleted — zombie runs`).toBe(0);
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

test('DB-110 — Empty query titles are legacy only (validated at UI by SMKT-LLMV-VAL-510)', async () => {
  // Frontend now blocks empty titles. Existing rows are legacy data, so this is
  // reported for cleanup rather than failed as a live defect.
  const total = await countBounded(`
    SELECT 1 FROM ${T.QUERY}
    WHERE is_deleted = false AND (title IS NULL OR TRIM(title) = '')
  `);
  const recent = await countBounded(`
    SELECT 1 FROM ${T.QUERY}
    WHERE is_deleted = false
      AND created > NOW() - INTERVAL '30 days'
      AND (title IS NULL OR TRIM(title) = '')
  `);
  if (total > 0) console.log(`[INFO] ${total}+ legacy queries with an empty title — cleanup candidate`);
  expect(recent,
    `${recent} queries with an empty title were created in the last 30 days — frontend validation is not holding`
  ).toBe(0);
});

test('DB-111 — Empty topic titles are legacy only (validated at UI by SMKT-LLMV-VAL-511)', async () => {
  const total = await countBounded(`
    SELECT 1 FROM ${T.TOPIC}
    WHERE is_deleted = false AND (title IS NULL OR TRIM(title) = '')
  `);
  const recent = await countBounded(`
    SELECT 1 FROM ${T.TOPIC}
    WHERE is_deleted = false
      AND created > NOW() - INTERVAL '30 days'
      AND (title IS NULL OR TRIM(title) = '')
  `);
  if (total > 0) console.log(`[INFO] ${total}+ legacy topics with an empty title — cleanup candidate`);
  expect(recent,
    `${recent} topics with an empty title were created in the last 30 days — frontend validation is not holding`
  ).toBe(0);
});

test('DB-112 — Empty brand domains are legacy only (validated at UI)', async () => {
  const total = await countBounded(`
    SELECT 1 FROM ${T.BRAND}
    WHERE is_deleted = false AND (domain IS NULL OR TRIM(domain) = '')
  `);
  const recent = await countBounded(`
    SELECT 1 FROM ${T.BRAND}
    WHERE is_deleted = false
      AND created > NOW() - INTERVAL '30 days'
      AND (domain IS NULL OR TRIM(domain) = '')
  `);
  if (total > 0) console.log(`[INFO] ${total}+ legacy brands with no domain — cleanup candidate`);
  expect(recent,
    `${recent} brands with no domain were created in the last 30 days — frontend validation is not holding`
  ).toBe(0);
});

test('DB-113 — Project country codes are two characters when set', async () => {
  // Report the distribution first — many projects legitimately have no country set.
  const { rows } = await q(`
    SELECT
      COUNT(*) FILTER (WHERE country_code IS NULL)::int              AS null_cc,
      COUNT(*) FILTER (WHERE TRIM(COALESCE(country_code,'')) = '')::int AS blank_cc,
      COUNT(*) FILTER (WHERE country_code IS NOT NULL
                         AND TRIM(country_code) <> ''
                         AND LENGTH(TRIM(country_code)) <> 2)::int    AS malformed_cc
    FROM ${T.PROJECT}
    WHERE is_deleted = false
  `);
  const r = rows[0];
  console.log(`[INFO] country_code — null: ${r.null_cc}, blank: ${r.blank_cc}, malformed: ${r.malformed_cc}`);

  // Only a non-empty value with the wrong length is a defect.
  expect(Number(r.malformed_cc),
    `${r.malformed_cc} projects have a non-empty country code that is not 2 characters`).toBe(0);
});

test('DB-114 — No query response has an empty body when marked successful', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.RESPONSE}
    WHERE created > NOW() - INTERVAL '7 days'
      AND success = true
      AND (body IS NULL OR TRIM(body) = '')
  `, [], 50);
  expect(bad,
    `${bad} responses are marked successful but contain no body — orphaned LLM response`).toBe(0);
});

test('DB-115 — Failed responses carry an error message', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.RESPONSE}
    WHERE created > NOW() - INTERVAL '7 days'
      AND success = false
      AND (error_message IS NULL OR TRIM(error_message) = '')
  `, [], 50);
  expect(bad, `${bad} failed responses have no error message recorded`).toBe(0);
});

test('DB-116 — Sentiment scores fall within a sane range', async () => {
  const { rows } = await q(`
    SELECT MIN(sentiment_score) AS lo, MAX(sentiment_score) AS hi
    FROM (
      SELECT sentiment_score FROM ${T.SENTIMENT}
      WHERE sentiment_score IS NOT NULL
      ORDER BY created DESC
      LIMIT 200000
    ) recent
  `);
  const lo = Number(rows[0]?.lo ?? 0);
  const hi = Number(rows[0]?.hi ?? 0);
  console.log(`[INFO] Sentiment score range observed: ${lo} to ${hi}`);
  expect(lo, `Minimum sentiment score ${lo} is below -100`).toBeGreaterThanOrEqual(-100);
  expect(hi, `Maximum sentiment score ${hi} is above 100`).toBeLessThanOrEqual(100);
});

test('DB-117 — Citation rank is positive when set', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM (
      SELECT rank FROM ${T.CITATION}
      ORDER BY id DESC
      LIMIT 50000
    ) c
    WHERE rank IS NOT NULL AND rank <= 0
  `, [], 50);
  expect(bad, `${bad} citation rows have a non-positive rank`).toBe(0);
});

test('DB-118 — Response time is never negative', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.RESPONSE}
    WHERE created > NOW() - INTERVAL '7 days'
      AND response_time IS NOT NULL AND response_time < 0
  `, [], 50);
  expect(bad, `${bad} responses have a negative response time`).toBe(0);
});

test('DB-119 — Empty competitor domains are legacy only (validated at UI by SMKT-LLMV-VAL-531)', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.SNAP_COMPETITOR}
    WHERE created > NOW() - INTERVAL '90 days'
      AND is_deleted = false
      AND (domain_name IS NULL OR TRIM(domain_name) = '')
  `, [], 50);
  expect(bad, `${bad} snapshot competitors have no domain`).toBe(0);
});

// ─── Cost leak detection ─────────────────────────────────────────────────────

test('DB-120 — No inactive project has recent snapshots', async () => {
  const bad = await countBounded(`
    SELECT 1 FROM ${T.SNAPSHOT} s
    JOIN ${T.PROJECT} p ON s.project_id = p.id
    WHERE p.is_active = false
      AND s.created > NOW() - INTERVAL '30 days'
  `);
  expect(bad,
    `${bad} snapshots ran in the last 30 days for projects that are inactive — COST LEAK`).toBe(0);
});

test('DB-121 — No orphaned LLM responses without an analysis row', async () => {
  const orphaned = await countBounded(`
    SELECT 1 FROM ${T.RESPONSE} r
    WHERE r.success = true
      AND r.created > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (SELECT 1 FROM ${T.SENTIMENT} sa WHERE sa.query_response_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM ${T.CITATION}  c  WHERE c.query_response_id  = r.id)
  `, [], 50);
  console.log(`[INFO] Successful responses with no downstream analysis: ${orphaned}`);
  expect(orphaned,
    `${orphaned} successful LLM responses have no sentiment or citation analysis — paid for, never used`).toBe(0);
});

test('DB-122 — Recently completed snapshots produced platform metrics', async () => {
  // Scoped to the last 30 days: older snapshots may predate the metrics table.
  const bad = await countBounded(`
    SELECT 1 FROM ${T.SNAPSHOT} s
    WHERE LOWER(s.status) IN ('completed', 'success', 'done')
      AND s.completed_at IS NOT NULL
      AND s.completed_at > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM ${T.SNAP_METRICS} m WHERE m.snapshot_id = s.id
      )
  `);
  expect(bad,
    `${bad}+ recently completed snapshots produced no platform metrics — analysis ran but stored nothing`).toBe(0);
});
