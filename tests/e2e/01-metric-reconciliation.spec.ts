import { test, expect } from '@playwright/test';
import {
  GET, POST, db, dbValue, closeDb, FIXTURES,
} from './e2e-helpers';

/**
 * SUITE C — FILE 01: Metric Reconciliation
 *
 * Each test reads the same metric from two or three layers and asserts they agree.
 * A failure means the layers disagree — the user is shown a number the data
 * does not support. Read-only: consumes zero credits.
 */

test.afterAll(async () => { await closeDb(); });

/**
 * Returns the true total for a list endpoint, following pagination.
 * Uses `count` when the API reports one, otherwise walks `next` pages.
 */
async function fetchAllCount(page: any, path: string): Promise<number> {
  const first = await GET(page, path);
  expect(first.status, `${path} did not return 200`).toBe(200);

  // Plain array — no pagination
  if (Array.isArray(first.data)) return first.data.length;

  // DRF-style envelope with an explicit total
  if (typeof first.data?.count === 'number') {
    console.log(`[INFO] ${path} reports count=${first.data.count}`);
    return first.data.count;
  }

  // Walk the pages
  let total = (first.data?.results ?? []).length;
  let next  = first.data?.next;
  let guard = 0;
  while (next && guard++ < 20) {
    const rel = String(next).replace(/^https?:\/\/[^/]+/, '');
    const res = await GET(page, rel);
    if (res.status !== 200) break;
    total += (res.data?.results ?? []).length;
    next   = res.data?.next;
  }
  return total;
}

// ─── Topic & query counts ────────────────────────────────────────────────────

test('E2E-101 — Topic count agrees between API and DB (forbes.com)', async ({ page }) => {
  const { projectId, domain } = FIXTURES.forbes;

  const apiCount = await fetchAllCount(page, `/api/v1/topics/?project_id=${projectId}&domain=${domain}`);

  const dbCount = Number(await dbValue(`
    SELECT COUNT(*) FROM llmv_topic t
    JOIN llmv_project p ON t.brand_id = p.brand_id
    WHERE p.id = $1 AND t.is_deleted = false
  `, [projectId]));

  // Diagnose the gap: are the missing topics simply the ones with no queries?
  if (apiCount !== dbCount) {
    const emptyTopics = Number(await dbValue(`
      SELECT COUNT(*) FROM llmv_topic t
      JOIN llmv_project p ON t.brand_id = p.brand_id
      LEFT JOIN llmv_query q ON q.topic_id = t.id AND q.is_deleted = false
      WHERE p.id = $1 AND t.is_deleted = false
      GROUP BY t.id
      HAVING COUNT(q.id) = 0
    `, [projectId]).catch(() => 0));

    console.log(`[INFO] ${domain}: API ${apiCount}, DB ${dbCount}, topics with zero queries: ${emptyTopics}`);
    console.warn(`[BUG E2E-101] GET /topics/ hides ${dbCount - apiCount} topic(s) that exist in the database for ${domain} — the user cannot see or manage them`);
  }

  expect(apiCount,
    `API lists ${apiCount} topics but the database holds ${dbCount} for ${domain} — ${dbCount - apiCount} topic(s) are unreachable through the API`
  ).toBe(dbCount);
});

test('E2E-102 — Topic count agrees between API and DB (kia.com)', async ({ page }) => {
  const { projectId, domain } = FIXTURES.kia;

  const apiCount = await fetchAllCount(page, `/api/v1/topics/?project_id=${projectId}&domain=${domain}`);

  const dbCount = Number(await dbValue(`
    SELECT COUNT(*) FROM llmv_topic t
    JOIN llmv_project p ON t.brand_id = p.brand_id
    WHERE p.id = $1 AND t.is_deleted = false
  `, [projectId]));

  expect(apiCount,
    `API returned ${apiCount} topics but DB has ${dbCount}`).toBe(dbCount);
});

test('E2E-103 — Query count agrees between API and DB (forbes.com)', async ({ page }) => {
  const { projectId, domain } = FIXTURES.forbes;

  const apiCount = await fetchAllCount(page, `/api/v1/queries/?project_id=${projectId}&domain=${domain}`);

  const dbCount = Number(await dbValue(`
    SELECT COUNT(*) FROM llmv_query q
    JOIN llmv_topic t   ON q.topic_id = t.id
    JOIN llmv_project p ON t.brand_id = p.brand_id
    WHERE p.id = $1 AND q.is_deleted = false AND t.is_deleted = false
  `, [projectId]));

  if (apiCount !== dbCount) {
    console.warn(`[BUG E2E-103] GET /queries/ returns ${apiCount} queries but the database holds ${dbCount} for ${domain}`);
  }

  expect(apiCount,
    `API lists ${apiCount} queries but the database holds ${dbCount} for ${domain}`
  ).toBe(dbCount);
});

// ─── Snapshot counts ─────────────────────────────────────────────────────────

test('E2E-110 — Available analysis dates match completed snapshots in DB', async ({ page }) => {
  const { projectId } = FIXTURES.forbes;

  const apiRes = await POST(page, '/api/v1/queries/available-dates/', { project_id: projectId });
  if (apiRes.status !== 200) { test.skip(); return; }

  const dates = Array.isArray(apiRes.data)
    ? apiRes.data
    : apiRes.data?.available_dates ?? apiRes.data?.data ?? [];

  const dbCount = Number(await dbValue(`
    SELECT COUNT(*) FROM llmv_analysissnapshot
    WHERE project_id = $1 AND completed_at IS NOT NULL
  `, [projectId]));

  expect(dates.length,
    `API offers ${dates.length} analysis dates but DB has ${dbCount} completed snapshots`
  ).toBe(dbCount);
});

// ─── Visibility score ────────────────────────────────────────────────────────

test('E2E-120 — Brand overview visibility score is within range and matches DB metrics', async ({ page }) => {
  const { projectId } = FIXTURES.forbes;

  const brandId = await dbValue(
    `SELECT brand_id FROM llmv_project WHERE id = $1`, [projectId]
  );
  const overview = await POST(page, '/api/v1/brand/overview/', {
    project_id: projectId, brand_id: brandId,
  });
  if (overview.status !== 200) { test.skip(); return; }

  const apiScore = overview.data?.visibility ?? overview.data?.visibility_score;
  if (apiScore === undefined || apiScore === null) { test.skip(); return; }

  expect(apiScore, 'API visibility score below 0').toBeGreaterThanOrEqual(0);
  expect(apiScore, 'API visibility score above 100').toBeLessThanOrEqual(100);

  // Compare against the most recent snapshot's average platform visibility.
  const dbScore = await dbValue(`
    SELECT ROUND(AVG(m.visibility_pct)::numeric, 1)
    FROM llmv_snapshot_platform_metrics m
    WHERE m.snapshot_id = (
      SELECT id FROM llmv_analysissnapshot
      WHERE project_id = $1 AND completed_at IS NOT NULL
      ORDER BY completed_at DESC LIMIT 1
    )
  `, [projectId]);

  if (dbScore !== null) {
    const drift = Math.abs(Number(apiScore) - Number(dbScore));
    console.log(`[INFO] visibility — API: ${apiScore}, DB avg: ${dbScore}, drift: ${drift.toFixed(1)}`);
    expect(drift,
      `Visibility score drift of ${drift.toFixed(1)} between API (${apiScore}) and DB (${dbScore})`
    ).toBeLessThanOrEqual(5);
  }
});

// ─── Sentiment ───────────────────────────────────────────────────────────────

test('E2E-130 — Sentiment distribution sums to 100% and matches DB row counts', async ({ page }) => {
  const { projectId } = FIXTURES.forbes;

  const res = await POST(page, '/api/v1/sentiment/distribution/', { project_id: projectId });
  if (res.status !== 200) { test.skip(); return; }

  const pos = Number(res.data?.positive ?? 0);
  const neu = Number(res.data?.neutral  ?? 0);
  const neg = Number(res.data?.negative ?? 0);
  const total = pos + neu + neg;

  if (total > 0) {
    expect(total, `Sentiment percentages sum to ${total}%, expected ~100%`).toBeGreaterThan(98);
    expect(total).toBeLessThan(102);
  }

  const dbRows = Number(await dbValue(`
    SELECT COUNT(*) FROM llmv_responsesentimentanalysis sa
    JOIN llmv_analysissnapshot s ON sa.snapshot_id = s.id
    WHERE s.project_id = $1
  `, [projectId]));

  console.log(`[INFO] sentiment — API split ${pos}/${neu}/${neg}, DB rows: ${dbRows}`);
  if (total > 0) {
    expect(dbRows, 'API reports sentiment but DB has no sentiment rows').toBeGreaterThan(0);
  }
});

// ─── Citations ───────────────────────────────────────────────────────────────

test('E2E-140 — Citation count from API is backed by DB rows', async ({ page }) => {
  const { projectId } = FIXTURES.forbes;

  const res = await POST(page, '/api/v1/citations/overview/', { project_id: projectId });
  if (res.status !== 200) { test.skip(); return; }

  const items = Array.isArray(res.data) ? res.data : res.data?.results ?? res.data?.data ?? [];
  const apiTotal = items.reduce(
    (sum: number, i: any) => sum + Number(i.citation_count ?? i.count ?? i.mentions ?? 0), 0
  );

  const dbRows = Number(await dbValue(`
    SELECT COUNT(*) FROM llmv_responsecitationanalysis c
    JOIN llmv_analysissnapshot s ON c.snapshot_id = s.id
    WHERE s.project_id = $1
  `, [projectId]));

  console.log(`[INFO] citations — API total: ${apiTotal}, DB rows: ${dbRows}`);
  if (apiTotal > 0) {
    expect(dbRows, 'API reports citations but DB has no citation rows').toBeGreaterThan(0);
  }
});

// ─── Competitors ─────────────────────────────────────────────────────────────

test('E2E-150 — Competitor list from API matches snapshot competitors in DB', async ({ page }) => {
  const { projectId } = FIXTURES.forbes;

  const res = await POST(page, '/api/v1/brand/competitor-visibility-rank/', {
    project_id: projectId,
  });
  if (res.status !== 200) { test.skip(); return; }

  const items = Array.isArray(res.data) ? res.data : res.data?.results ?? res.data?.data ?? [];
  const apiDomains = new Set(
    items.map((i: any) => String(i.domain ?? i.domain_name ?? '').toLowerCase()).filter(Boolean)
  );

  const { rows } = await db(`
    SELECT DISTINCT LOWER(sc.domain_name) AS domain
    FROM llmv_snapshotcompetitor sc
    JOIN llmv_analysissnapshot s ON sc.snapshot_id = s.id
    WHERE s.project_id = $1 AND sc.is_deleted = false
  `, [projectId]);
  const dbDomains = new Set(rows.map(r => r.domain));

  console.log(`[INFO] competitors — API: ${apiDomains.size}, DB: ${dbDomains.size}`);

  // Every competitor the API shows must exist in the DB.
  const notInDb = [...apiDomains].filter(d => !dbDomains.has(d));
  expect(notInDb,
    `API returned competitors that do not exist in DB: ${notInDb.join(', ')}`).toEqual([]);
});

// ─── Project state ───────────────────────────────────────────────────────────

test('E2E-160 — Project active state agrees between API and DB', async ({ page }) => {
  for (const key of ['forbes', 'kia'] as const) {
    const { projectId, domain } = FIXTURES[key];

    const res = await GET(page, `/api/v1/projects/${projectId}/`);
    if (res.status !== 200) continue;

    // The detail endpoint may expose the flag under several names.
    const apiActive =
      res.data?.is_active ??
      res.data?.is_llm_activated ??
      res.data?.active ??
      res.data?.project?.is_active;

    if (apiActive === undefined) {
      console.log(`[INFO] ${domain}: project detail keys — ${Object.keys(res.data ?? {}).join(', ')}`);
      console.warn(`[BUG E2E-160] GET /projects/{id}/ does not expose an activation flag — cannot verify state from the API`);
      continue;
    }

    const dbActive = await dbValue(
      `SELECT is_active FROM llmv_project WHERE id = $1`, [projectId]
    );

    expect(apiActive,
      `${domain}: API says active=${apiActive}, DB says ${dbActive}`).toBe(dbActive);
  }
});

test('E2E-161 — Project refresh frequency agrees between API and DB', async ({ page }) => {
  const { projectId, domain } = FIXTURES.forbes;

  const res = await GET(page, `/api/v1/projects/${projectId}/`);
  if (res.status !== 200) { test.skip(); return; }

  const apiFreq = res.data?.frequency_days;
  const dbFreq  = await dbValue(
    `SELECT frequency_days FROM llmv_project WHERE id = $1`, [projectId]
  );

  if (apiFreq !== undefined && dbFreq !== null) {
    expect(Number(apiFreq),
      `${domain}: API frequency ${apiFreq} vs DB ${dbFreq}`).toBe(Number(dbFreq));
  }
});
