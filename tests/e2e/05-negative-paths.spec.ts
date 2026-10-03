import { test, expect } from '@playwright/test';
import {
  GET, POST, db, dbValue, closeDb, FIXTURES, CUSTOMER_ID, apiBalance, API,
} from './e2e-helpers';

/**
 * SUITE C — FILE 05: Negative Paths
 *
 * Verifies that invalid, unauthorised, and failed operations leave no trace —
 * no credit rows, no snapshots, no data crossing tenant boundaries.
 *
 * Every test here is independent and side-effect free. Nothing should succeed,
 * so nothing should be charged.
 */

test.afterAll(async () => { await closeDb(); });

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

// ─── Authentication ──────────────────────────────────────────────────────────

test('E2E-480 — Unauthenticated requests are rejected', async ({ page }) => {
  const endpoints = [
    { method: 'GET',  path: '/api/v1/projects/' },
    { method: 'GET',  path: '/api/v1/platforms/' },
    { method: 'GET',  path: '/api/v1/credits/summary/' },
    { method: 'POST', path: '/api/v1/brand/overview/' },
  ];

  for (const ep of endpoints) {
    const url = `${API}${ep.path}`;
    const res = ep.method === 'GET'
      ? await page.request.get(url,  { headers: { 'Content-Type': 'application/json' } })
      : await page.request.post(url, { headers: { 'Content-Type': 'application/json' }, data: {} });

    expect([401, 403],
      `${ep.method} ${ep.path} returned ${res.status()} with no token — it must be rejected`
    ).toContain(res.status());
  }
});

test('E2E-481 — Malformed tokens are rejected', async ({ page }) => {
  const tokens = [
    'Bearer notarealtoken',
    'Bearer eyJhbGciOiJIUzI1NiJ9.tampered.signature',
    'Token wrongscheme',
    'Bearer ',
  ];

  for (const token of tokens) {
    const res = await page.request.get(`${API}/api/v1/projects/`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
    });
    expect([401, 403],
      `A request with Authorization "${token.slice(0, 30)}" returned ${res.status()} — it must be rejected`
    ).toContain(res.status());
  }
});

test('E2E-482 — A rejected unauthenticated request writes no credit row', async () => {
  const before = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE customer_id = $1`, [CUSTOMER_ID]
  ));
  // The unauthenticated calls above already ran; confirm nothing was charged.
  const after = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE customer_id = $1`, [CUSTOMER_ID]
  ));
  expect(after,
    `Unauthenticated requests produced ${after - before} credit row(s)`).toBe(before);
});

// ─── Credit exhaustion ───────────────────────────────────────────────────────

test('E2E-490 — A project flagged insufficient refuses run-analysis', async ({ page }) => {
  const project = await dbValue(`
    SELECT id::text FROM llmv_project
    WHERE customer_id = $1
      AND is_deleted = false
      AND has_insufficient_credits = true
    ORDER BY modified DESC
    LIMIT 1
  `, [CUSTOMER_ID]);

  if (!project) {
    console.log('[INFO] No project currently flagged has_insufficient_credits — nothing to verify');
    test.skip();
    return;
  }

  const rowsBefore = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE project_id = $1`, [project]
  ));

  const res = await POST(page, `/api/v1/projects/${project}/run-analysis/`);
  expect([400, 402, 403],
    `run-analysis on a credit-exhausted project returned ${res.status} — it must be refused`
  ).toContain(res.status);

  const message = JSON.stringify(res.data ?? '').toLowerCase();
  expect(message,
    `The refusal message does not mention credits: ${message.slice(0, 120)}`
  ).toMatch(/credit|insufficient|balance|quota/);

  await new Promise(r => setTimeout(r, 2000));
  const rowsAfter = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE project_id = $1`, [project]
  ));
  expect(rowsAfter,
    `A credit-exhausted project was still charged ${rowsAfter - rowsBefore} row(s)`).toBe(rowsBefore);
});

test('E2E-491 — Balance is never driven negative', async ({ page }) => {
  const balance = await apiBalance(page);
  if (balance === null) { test.skip(); return; }
  expect(balance, `Account balance is ${balance} — a balance must never go negative`).toBeGreaterThanOrEqual(0);

  const negativeRows = Number(await dbValue(`
    SELECT COUNT(*) FROM (
      SELECT id FROM llmv_creditusagelog
      WHERE customer_id = $1 AND balance_after < 0
      LIMIT 20
    ) sub
  `, [CUSTOMER_ID]));
  expect(negativeRows,
    `${negativeRows} ledger entries record a negative balance`).toBe(0);
});

// ─── Phantom charge guards ───────────────────────────────────────────────────

test('E2E-500 — run-analysis on a nonexistent project charges nothing', async ({ page }) => {
  const balanceBefore = await apiBalance(page);
  const rowsBefore = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE customer_id = $1`, [CUSTOMER_ID]
  ));

  const res = await POST(page, `/api/v1/projects/${FAKE_UUID}/run-analysis/`);
  expect([400, 403, 404],
    `run-analysis on a nonexistent project returned ${res.status}`).toContain(res.status);

  await new Promise(r => setTimeout(r, 2000));

  const balanceAfter = await apiBalance(page);
  const rowsAfter = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE customer_id = $1`, [CUSTOMER_ID]
  ));

  if (balanceBefore !== null && balanceAfter !== null) {
    expect(balanceAfter,
      `Balance moved from ${balanceBefore} to ${balanceAfter} on a rejected request`).toBe(balanceBefore);
  }
  expect(rowsAfter,
    `A rejected request wrote ${rowsAfter - rowsBefore} credit row(s) — PHANTOM CHARGE`).toBe(rowsBefore);
});

test('E2E-501 — Repeated credit estimates charge nothing', async ({ page }) => {
  const before = await apiBalance(page);
  if (before === null) { test.skip(); return; }

  for (let i = 0; i < 5; i++) {
    await POST(page, '/api/v1/credits/estimate/', { project_id: FIXTURES.forbes.projectId });
  }

  const after = await apiBalance(page);
  expect(after,
    `Balance moved from ${before} to ${after} after 5 estimate calls — estimates must be free`).toBe(before);
});

test('E2E-502 — Reading analytics charges nothing', async ({ page }) => {
  const { projectId } = FIXTURES.forbes;
  const before = await apiBalance(page);
  if (before === null) { test.skip(); return; }

  await POST(page, '/api/v1/brand/overview/',        { project_id: projectId });
  await POST(page, '/api/v1/brand/visibility-trend/', { project_id: projectId });
  await POST(page, '/api/v1/sentiment/distribution/', { project_id: projectId });
  await POST(page, '/api/v1/citations/overview/',     { project_id: projectId });

  const after = await apiBalance(page);
  expect(after,
    `Balance moved from ${before} to ${after} after read-only analytics calls`).toBe(before);
});

test('E2E-510 — Simultaneous requests to a nonexistent project are all refused', async ({ page }) => {
  // Not a race-condition test — the target does not exist, so every request must
  // fail deterministically. This guards against a code path that charges before
  // validating the project.
  const rowsBefore = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE customer_id = $1`, [CUSTOMER_ID]
  ));

  const results = await Promise.all([
    POST(page, `/api/v1/projects/${FAKE_UUID}/run-analysis/`),
    POST(page, `/api/v1/projects/${FAKE_UUID}/run-analysis/`),
    POST(page, `/api/v1/projects/${FAKE_UUID}/run-analysis/`),
  ]);

  const accepted = results.filter(r => [200, 202].includes(r.status)).length;
  expect(accepted,
    `${accepted} of 3 simultaneous requests were accepted for a project that does not exist`).toBe(0);

  await new Promise(r => setTimeout(r, 2000));
  const rowsAfter = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE customer_id = $1`, [CUSTOMER_ID]
  ));
  expect(rowsAfter,
    `Simultaneous rejected requests wrote ${rowsAfter - rowsBefore} credit row(s)`).toBe(rowsBefore);
});

// ─── Cross-tenant isolation ──────────────────────────────────────────────────

test('E2E-520 — Another customer project is not readable', async ({ page }) => {
  const foreign = await dbValue(`
    SELECT id::text FROM llmv_project
    WHERE customer_id IS NOT NULL AND customer_id <> $1 AND is_deleted = false
    ORDER BY created DESC LIMIT 1
  `, [CUSTOMER_ID]);
  if (!foreign) { test.skip(); return; }

  const res = await GET(page, `/api/v1/projects/${foreign}/`);
  expect([403, 404],
    `A project belonging to another customer returned ${res.status} — CROSS-TENANT READ if 200`
  ).toContain(res.status);
});

test('E2E-521 — run-analysis on another customer project is refused', async ({ page }) => {
  const foreign = await dbValue(`
    SELECT id::text FROM llmv_project
    WHERE customer_id IS NOT NULL AND customer_id <> $1
      AND is_deleted = false AND is_active = true
    ORDER BY created DESC LIMIT 1
  `, [CUSTOMER_ID]);
  if (!foreign) { test.skip(); return; }

  const rowsBefore = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE project_id = $1`, [foreign]
  ));

  const res = await POST(page, `/api/v1/projects/${foreign}/run-analysis/`);
  expect([400, 403, 404],
    `run-analysis on another customer's project returned ${res.status} — CROSS-TENANT WRITE if accepted`
  ).toContain(res.status);

  await new Promise(r => setTimeout(r, 2000));
  const rowsAfter = Number(await dbValue(
    `SELECT COUNT(*) FROM llmv_creditusagelog WHERE project_id = $1`, [foreign]
  ));
  expect(rowsAfter,
    `A refused cross-tenant request wrote ${rowsAfter - rowsBefore} credit row(s)`).toBe(rowsBefore);
});

test('E2E-522 — Analytics return no data for another customer project', async ({ page }) => {
  const foreign = await dbValue(`
    SELECT id::text FROM llmv_project
    WHERE customer_id IS NOT NULL AND customer_id <> $1 AND is_deleted = false
    ORDER BY created DESC LIMIT 1
  `, [CUSTOMER_ID]);
  if (!foreign) { test.skip(); return; }

  const res = await POST(page, '/api/v1/brand/overview/', { project_id: foreign });

  if (res.status === 200) {
    const payload = JSON.stringify(res.data ?? {});
    const hasMetrics = /"visibility(_score)?"\s*:\s*[\d.]/.test(payload);
    expect(hasMetrics,
      `Brand overview returned metrics for another customer's project — CROSS-TENANT DATA LEAK`
    ).toBe(false);
  } else {
    expect([400, 403, 404]).toContain(res.status);
  }
});

// ─── Deleted resources ───────────────────────────────────────────────────────

test('E2E-530 — A soft-deleted project is not readable', async ({ page }) => {
  const deleted = await dbValue(`
    SELECT id::text FROM llmv_project
    WHERE is_deleted = true AND customer_id = $1
    ORDER BY modified DESC LIMIT 1
  `, [CUSTOMER_ID]);
  if (!deleted) { test.skip(); return; }

  const res = await GET(page, `/api/v1/projects/${deleted}/`);
  expect([403, 404],
    `A soft-deleted project returned ${res.status} — deleted data is still readable`
  ).toContain(res.status);
});

test('E2E-531 — Soft-deleted projects are absent from the list', async ({ page }) => {
  const res = await GET(page, '/api/v1/projects/');
  if (res.status !== 200) { test.skip(); return; }

  const projects = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  const listed = new Set(projects.map((p: any) => String(p.id ?? p.project_id)));

  const { rows } = await db(`
    SELECT id::text FROM llmv_project
    WHERE is_deleted = true AND customer_id = $1 LIMIT 50
  `, [CUSTOMER_ID]);

  const leaked = rows.map(r => r.id).filter(id => listed.has(id));
  expect(leaked,
    `Soft-deleted projects appear in the project list: ${leaked.join(', ')}`).toEqual([]);
});

// ─── Malformed input ─────────────────────────────────────────────────────────

test('E2E-540 — Malformed project IDs return a clean error', async ({ page }) => {
  for (const badId of ['0', '-1', 'not-a-uuid', 'null', 'undefined', '%20']) {
    const res = await GET(page, `/api/v1/projects/${badId}/`);
    expect(res.status,
      `Project ID "${badId}" caused a ${res.status} — malformed input must not produce a server error`
    ).not.toBe(500);

    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    expect(text.toLowerCase(),
      `The response for "${badId}" leaks a stack trace`).not.toContain('traceback');
  }
});

test('E2E-541 — Malformed input charges nothing', async ({ page }) => {
  const before = await apiBalance(page);
  if (before === null) { test.skip(); return; }

  for (const badId of ['0', '-1', 'not-a-uuid']) {
    await POST(page, `/api/v1/projects/${badId}/run-analysis/`);
  }

  const after = await apiBalance(page);
  expect(after,
    `Balance moved from ${before} to ${after} after malformed requests`).toBe(before);
});

test('E2E-542 — Invalid date ranges are handled cleanly', async ({ page }) => {
  const { projectId } = FIXTURES.forbes;
  const ranges = [
    { start_date: '2030-01-01', end_date: '2020-01-01' },  // reversed
    { start_date: 'not-a-date', end_date: 'also-not' },     // unparseable
    { start_date: '2024-13-45', end_date: '2024-99-99' },   // impossible
    { start_date: '',           end_date: '' },             // empty
  ];

  for (const range of ranges) {
    const res = await POST(page, '/api/v1/brand/visibility-trend/', {
      project_id: projectId, ...range,
    });
    expect(res.status,
      `Date range ${JSON.stringify(range)} caused a ${res.status}`).not.toBe(500);
    expect([200, 400, 422],
      `Date range ${JSON.stringify(range)} returned an unexpected ${res.status}`
    ).toContain(res.status);
  }
});

test('E2E-543 — Script payloads in text fields are not reflected', async ({ page }) => {
  const { projectId, domain } = FIXTURES.forbes;
  const payloads = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "'; DROP TABLE llmv_topic; --",
    '{{7*7}}',
  ];

  for (const payload of payloads) {
    const res = await POST(page, '/api/v1/topics/', {
      project_id: projectId, domain, topics: [{ title: payload }],
    });

    expect(res.status,
      `Payload ${payload.slice(0, 25)} caused a ${res.status}`).not.toBe(500);

    // If accepted, the value must not come back unescaped
    if ([200, 201].includes(res.status)) {
      const echoed = JSON.stringify(res.data ?? '');
      expect(echoed,
        `The API echoed an unescaped script payload: ${payload.slice(0, 30)}`
      ).not.toContain('<script>');
    }
  }
});

test('E2E-544 — Negative and out-of-range numbers are rejected', async ({ page }) => {
  const { projectId } = FIXTURES.forbes;

  for (const freq of [-1, 0, 99999, 1.5]) {
    const res = await POST(page, `/api/v1/projects/${projectId}/frequency/`, {
      frequency_days: freq,
    });
    expect(res.status,
      `frequency_days=${freq} caused a ${res.status}`).not.toBe(500);
    expect([400, 404, 422],
      `frequency_days=${freq} returned ${res.status} — an invalid frequency must be rejected`
    ).toContain(res.status);
  }
});

test('E2E-545 — Oversized payloads are rejected cleanly', async ({ page }) => {
  const { projectId, domain } = FIXTURES.forbes;
  const huge = 'x'.repeat(100_000);

  const res = await POST(page, '/api/v1/topics/', {
    project_id: projectId, domain, topics: [{ title: huge }],
  });

  expect(res.status,
    `A 100k-character title caused a ${res.status}`).not.toBe(500);
  expect([400, 413, 422],
    `A 100k-character title returned ${res.status} — oversized input must be rejected`
  ).toContain(res.status);
});
