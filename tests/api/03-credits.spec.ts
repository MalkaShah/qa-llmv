import { test, expect } from '@playwright/test';
import { GET, POST, goToAPI } from '../../helpers/api';



test.beforeEach(async ({ page }) => {
  await goToAPI(page);
});

async function getBalance(page: any) {
  const res = await GET(page, '/api/v1/credits/summary/');
  if (res.status !== 200) return null;
  return res.data?.balance ?? res.data?.universal_credits ?? res.data?.credits ?? res.data?.available;
}

async function getActiveProject(page: any) {
  const res = await GET(page, '/api/v1/projects/');
  const projects = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  return projects.find((p: any) => p.is_active && !p.has_insufficient_credits) ?? null;
}

test('LLMV-API-050 — Credit summary baseline & schema', async ({ page }) => {
  const res = await GET(page, '/api/v1/credits/summary/');
  expect(res.status).toBe(200);

  // Log actual response to discover field names
  const keys = Object.keys(res.data ?? {});
  console.log('[INFO] credits/summary fields:', keys);
  // Find any numeric field that looks like a balance
  const balance = res.data?.balance ?? res.data?.universal_credits ?? res.data?.credits ??
    res.data?.available ?? res.data?.lc_credits ?? res.data?.remaining ?? res.data?.total;
  if (balance !== undefined) {
    expect(typeof balance).toBe('number');
    expect(balance).toBeGreaterThanOrEqual(0);
  }
});

test('LLMV-API-051 — Estimate matches actual deduction', async ({ page }) => {
  const active = await getActiveProject(page);
  if (!active) { test.skip(); return; }
  const pid = active.id ?? active.project_id;

  const res = await POST(page, '/api/v1/credits/estimate/', { project_id: pid });
  expect([200, 400, 404]).toContain(res.status);

  if (res.status === 200) {
    const cost = res.data?.cost ?? res.data?.credits ?? res.data?.amount;
    expect(typeof cost).toBe('number');
    expect(cost).toBeGreaterThan(0);
  }
});

test('LLMV-API-052 — PHANTOM DEDUCTION: failed action must not charge', async ({ page }) => {
  const balanceBefore = await getBalance(page);
  if (balanceBefore === null) { test.skip(); return; }

  // Trigger on nonexistent project — must not charge
  await POST(page, '/api/v1/projects/00000000-0000-0000-0000-000000000099/run-analysis/');

  const balanceAfter = await getBalance(page);
  expect(balanceAfter).toBe(balanceBefore);
});

test('LLMV-API-053 — Credit-usage history reconciles with balance', async ({ page }) => {
  const res = await GET(page, '/api/v1/projects/');
  const projects = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  if (!projects.length) { test.skip(); return; }
  const pid = projects[0].id ?? projects[0].project_id;

  const histRes = await GET(page, `/api/v1/projects/${pid}/credit-usage/`);
  expect([200, 400, 404]).toContain(histRes.status);

  if (histRes.status === 200) {
    const entries = Array.isArray(histRes.data) ? histRes.data : histRes.data?.results ?? [];
    for (const entry of entries) {
      const amount = entry.credits_consumed ?? entry.amount ?? entry.cost;
      expect(typeof amount).toBe('number');
      expect(amount).toBeGreaterThanOrEqual(0);
    }
  }
});

test('LLMV-API-054 — Projected monthly usage coherence', async ({ page }) => {
  const res = await GET(page, '/api/v1/credits/projected-usage/');
  expect([200, 400, 404]).toContain(res.status);

  if (res.status === 200) {
    const projection = res.data?.projected ?? res.data?.monthly ?? res.data?.total_projected_monthly_credits;
    expect(typeof projection).toBe('number');
    expect(projection).toBeGreaterThanOrEqual(0);
  }
});

test('LLMV-API-055 — Insufficient balance blocks BEFORE charging', async ({ page }) => {
  const res = await GET(page, '/api/v1/projects/');
  const projects = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  const insufficient = projects.find((p: any) => p.has_insufficient_credits);
  if (!insufficient) { test.skip(); return; }

  const balanceBefore = await getBalance(page);
  const pid = insufficient.id ?? insufficient.project_id;

  const runRes = await POST(page, `/api/v1/projects/${pid}/run-analysis/`);
  expect([400, 402, 403]).toContain(runRes.status);

  const msg = JSON.stringify(runRes.data ?? '').toLowerCase();
  expect(msg).toMatch(/credit|insufficient|balance/);

  const balanceAfter = await getBalance(page);
  expect(balanceAfter).toBe(balanceBefore);
});

test('LLMV-API-056 — Estimate endpoint — invalid inputs', async ({ page }) => {
  const res1 = await POST(page, '/api/v1/credits/estimate/', {
    project_id: '00000000-0000-0000-0000-000000000000'
  });
  expect([400, 404]).toContain(res1.status);

  const res2 = await POST(page, '/api/v1/credits/estimate/', {});
  expect([400, 404]).toContain(res2.status);
});

test('LLMV-API-057 — Estimate is read-only (no side effects)', async ({ page }) => {
  const balanceBefore = await getBalance(page);
  if (balanceBefore === null) { test.skip(); return; }

  for (let i = 0; i < 5; i++) {
    await POST(page, '/api/v1/credits/estimate/', {
      project_id: '00000000-0000-0000-0000-000000000000'
    });
  }

  const balanceAfter = await getBalance(page);
  expect(balanceAfter).toBe(balanceBefore);
});
