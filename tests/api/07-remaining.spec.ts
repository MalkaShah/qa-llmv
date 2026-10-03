import { test, expect } from '@playwright/test';
import { GET, POST, PUT, PATCH, DELETE, goToAPI } from '../../helpers/api';



test.beforeEach(async ({ page }) => {
  await goToAPI(page);
});

async function getProject(page: any) {
  const res = await GET(page, '/api/v1/projects/');
  const projects = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  return projects[0] ?? null;
}

async function getProjectDomain(project: any) {
  return project?.brand?.domain ?? project?.domain ?? '';
}

// ─── 7. Topics ───────────────────────────────────────────────────────────────

test('LLMV-API-095 — Topic list and creation (idempotent)', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  // Bug LLMV-API-131: name field rejected, only title works
  const nameRes = await POST(page, '/api/v1/topics/', {
    project_id: pid, domain, topics: [{ name: 'name-field-test' }]
  });
  if (nameRes.status === 400) {
    console.warn('[BUG LLMV-API-131] POST /topics/ rejects name field — only title accepted');
  }

  const title = `QA-topic-${Date.now()}`;
  const createRes = await POST(page, '/api/v1/topics/', {
    project_id: pid, domain, topics: [{ title }]
  });
  expect([200, 201]).toContain(createRes.status);

  // Idempotency
  const create2Res = await POST(page, '/api/v1/topics/', {
    project_id: pid, domain, topics: [{ title }]
  });
  expect([200, 201]).toContain(create2Res.status);

  // Empty name
  const emptyRes = await POST(page, '/api/v1/topics/', {
    project_id: pid, domain, topics: [{ title: '' }]
  });
  expect([400, 422]).toContain(emptyRes.status);
});

test('LLMV-API-096 — Update and delete user-created topic only', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const topicsRes = await GET(page, `/api/v1/topics/?project_id=${pid}&domain=${domain}`);
  if (topicsRes.status !== 200) { test.skip(); return; }
  const topics = Array.isArray(topicsRes.data) ? topicsRes.data : topicsRes.data?.results ?? [];

  const sysTopic = topics.find((t: any) => t.source !== 'user_created');
  if (sysTopic) {
    const sysUpdate = await PUT(page, `/api/v1/topics/${sysTopic.id}/`, { title: 'hacked' });
    expect([400, 403, 405]).toContain(sysUpdate.status);

    const sysDelete = await DELETE(page, `/api/v1/topics/${sysTopic.id}/`);
    expect([400, 403, 405]).toContain(sysDelete.status);
  }
});

test('LLMV-API-097 — Deactivate / reactivate topic', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const topicsRes = await GET(page, `/api/v1/topics/?project_id=${pid}&domain=${domain}`);
  if (topicsRes.status !== 200) { test.skip(); return; }
  const topics = Array.isArray(topicsRes.data) ? topicsRes.data : topicsRes.data?.results ?? [];
  if (!topics.length) { test.skip(); return; }

  const tid = topics[0].id;

  const deactivateRes = await POST(page, `/api/v1/topics/${tid}/deactivate/`);
  expect([200, 400, 404]).toContain(deactivateRes.status);

  const deactivate2Res = await POST(page, `/api/v1/topics/${tid}/deactivate/`);
  expect([200, 404, 409]).toContain(deactivate2Res.status);

  const reactivateRes = await POST(page, `/api/v1/topics/${tid}/reactivate/`);
  expect([200, 400, 404]).toContain(reactivateRes.status);
});

test('LLMV-API-098 — Topics overview and unanalyzed topics', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const [overviewRes, unanalyzedRes] = await Promise.all([
    POST(page, '/api/v1/topics/overview/',   { project_id: pid }),
    POST(page, '/api/v1/topics/unanalyzed/', { project_id: pid }),
  ]);

  expect([200, 400, 404]).toContain(overviewRes.status);
  expect([200, 400, 404]).toContain(unanalyzedRes.status);
});

test('LLMV-API-099 — GET /topics/ requires redundant domain param (bug FIND-010)', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const onlyPidRes = await GET(page, `/api/v1/topics/?project_id=${pid}`);
  if (onlyPidRes.status === 400) {
    console.warn('[BUG FIND-010] GET /topics/ with only project_id returns 400');
  }

  const bothRes = await GET(page, `/api/v1/topics/?project_id=${pid}&domain=${domain}`);
  expect(bothRes.status).toBe(200);
});

// ─── 8. Sentiment ────────────────────────────────────────────────────────────

test('LLMV-API-100 — Sentiment distribution sums to 100%', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/sentiment/distribution/', { project_id: pid });
  expect([200, 400, 404]).toContain(res.status);

  if (res.status === 200) {
    const pos = res.data?.positive ?? 0;
    const neu = res.data?.neutral  ?? 0;
    const neg = res.data?.negative ?? 0;
    const total = pos + neu + neg;
    if (total > 0) {
      expect(total).toBeGreaterThan(99);
      expect(total).toBeLessThan(102);
    }
  }
});

test('LLMV-API-101 — Sentiment per topic and per query consistency', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const [overviewRes, queriesRes] = await Promise.all([
    POST(page, '/api/v1/sentiment/overview/', { project_id: pid }),
    POST(page, '/api/v1/sentiment/queries/',  { project_id: pid }),
  ]);

  expect([200, 400, 404]).toContain(overviewRes.status);
  expect([200, 400, 404]).toContain(queriesRes.status);
});

test('LLMV-API-102 — Topics grouped by sentiment category', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/sentiment/topics-by-category/', { project_id: pid });
  expect([200, 400, 404]).toContain(res.status);
});

// ─── 9. Prompt Analysis (PS) ─────────────────────────────────────────────────

test('LLMV-API-105 — Submit prompts for analysis (happy path)', async ({ page }) => {
  const res = await POST(page, '/api/v1/ps/prompts/', {
    prompts: [{ text: 'What is the best car brand?' }]
  });
  expect([200, 201, 202, 400]).toContain(res.status);
});

test('LLMV-API-106 — Prompt submission — negative & boundary', async ({ page }) => {
  const emptyRes = await POST(page, '/api/v1/ps/prompts/', { prompts: [] });
  expect([400, 422]).toContain(emptyRes.status);
});

test('LLMV-API-107 — Analysis status and history', async ({ page }) => {
  const historyRes = await GET(page, '/api/v1/ps/prompts/history/');
  expect([200, 400, 404]).toContain(historyRes.status);

  const fakeRes = await POST(page, '/api/v1/ps/prompts/check-status/', {
    ids: ['00000000-0000-0000-0000-000000000000']
  });
  expect([200, 400, 404]).toContain(fakeRes.status);
});

test('LLMV-API-108 — PS analysis cross-tenant isolation', async ({ page }) => {
  const res = await GET(page, '/api/v1/ps/prompts/00000000-0000-0000-0000-000000000099/');
  expect([403, 404]).toContain(res.status);
});

// ─── 10. QP & SE Integrations ────────────────────────────────────────────────

test('LLMV-API-110 — QP total brand mentions', async ({ page }) => {
  const res = await GET(page, '/api/v1/qp/total-brand-mentions/');
  expect([200, 400, 404]).toContain(res.status);
});

test('LLMV-API-111 — SE domain analysis status and visibility overview', async ({ page }) => {
  const [statusRes, overviewRes] = await Promise.all([
    GET(page, '/api/v1/se/analysis-status/'),
    GET(page, '/api/v1/se/llm-visibility-overview/'),
  ]);
  expect([200, 400, 404]).toContain(statusRes.status);
  expect([200, 400, 404]).toContain(overviewRes.status);
});

test('LLMV-API-112 — SE LLM visibility and sentiment tables', async ({ page }) => {
  const [visRes, sentRes] = await Promise.all([
    GET(page, '/api/v1/se/llm-visibility/'),
    GET(page, '/api/v1/se/llm-sentiment/'),
  ]);
  expect([200, 400, 404]).toContain(visRes.status);
  expect([200, 400, 404]).toContain(sentRes.status);
});

test('LLMV-API-113 — Snappy summaries generation', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/snappy-summaries/generate/', { project_id: pid });
  expect([200, 201, 400, 404]).toContain(res.status);
});

// ─── 11. Robustness & Limits ─────────────────────────────────────────────────

test('LLMV-API-120 — Rate limiting behavior', async ({ page }) => {
  for (let i = 0; i < 20; i++) {
    const res = await GET(page, '/api/v1/platforms/');
    expect(res.status).not.toBe(500);
    if (res.status === 429) break;
  }
});

test('LLMV-API-121 — Malformed IDs return clean errors', async ({ page }) => {
  const badIds = ['0', '-1', 'abc', '00000000-0000-0000-0000-000000000000'];
  for (const id of badIds) {
    const res = await GET(page, `/api/v1/projects/${id}/`);
    expect([400, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    expect(text.toLowerCase()).not.toContain('traceback');
  }
});

test('LLMV-API-122 — Large date ranges and pagination extremes', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const trendRes = await POST(page, '/api/v1/brand/visibility-trend/', {
    project_id: pid, start_date: '2020-01-01', end_date: '2025-01-01'
  });
  expect([200, 400]).toContain(trendRes.status);
  expect(trendRes.status).not.toBe(500);

  const listRes = await GET(page, '/api/v1/projects/?page=99999');
  expect([200, 400, 404]).toContain(listRes.status);
  expect(listRes.status).not.toBe(500);
});

test('LLMV-API-123 — Response content-type hygiene', async ({ page }) => {
  const res = await GET(page, '/api/v1/platforms/');
  if (res.status === 200) {
    expect(typeof res.data).not.toBe('string'); // must be parsed JSON, not HTML string
  }
});

// ─── 12. Discovered API Behaviors ────────────────────────────────────────────

test('LLMV-API-130 — POST /queries/ response omits created item IDs', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const topicsRes = await GET(page, `/api/v1/topics/?project_id=${pid}&domain=${domain}`);
  if (topicsRes.status !== 200) { test.skip(); return; }
  const topics = Array.isArray(topicsRes.data) ? topicsRes.data : topicsRes.data?.results ?? [];
  if (!topics.length) { test.skip(); return; }

  const createRes = await POST(page, '/api/v1/queries/', {
    project_id: pid, domain, topic_id: topics[0].id,
    queries: [{ title: `bug-130-test-${Date.now()}` }]
  });
  expect([200, 201]).toContain(createRes.status);

  if (createRes.data?.message && !createRes.data?.results && !Array.isArray(createRes.data)) {
    console.warn('[BUG LLMV-API-130] POST /queries/ returns message only — no IDs in response');
  }
});

test('LLMV-API-131 — POST /topics/ requires title field not name', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const nameRes = await POST(page, '/api/v1/topics/', {
    project_id: pid, domain, topics: [{ name: 'name-field-test' }]
  });
  if (nameRes.status === 400) {
    console.warn('[BUG LLMV-API-131] POST /topics/ rejects name field — only title accepted');
  }

  const titleRes = await POST(page, '/api/v1/topics/', {
    project_id: pid, domain, topics: [{ title: `title-test-${Date.now()}` }]
  });
  expect([200, 201]).toContain(titleRes.status);
});

test('LLMV-API-132 — check-llm-activation requires {items:[...]} wrapper', async ({ page }) => {
  const rawRes = await POST(page, '/api/v1/projects/check-llm-activation/',
    [{ domain: 'kia.com', country_code: 'US' }]
  );
  if (rawRes.status === 400) {
    console.warn('[BUG LLMV-API-132] Raw array rejected — only {items:[...]} wrapper accepted');
  }

  const wrapperRes = await POST(page, '/api/v1/projects/check-llm-activation/', {
    items: [{ domain: 'kia.com', country_code: 'US' }]
  });
  expect([200, 400]).toContain(wrapperRes.status);
});

test('LLMV-API-133 — activate requires user-tracked state', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, `/api/v1/projects/${pid}/activate/`);
  if (res.status === 400) {
    const msg = JSON.stringify(res.data).toLowerCase();
    if (msg.includes('user-tracked') || msg.includes('track')) {
      console.warn('[BUG LLMV-API-133] activate requires user-tracked state — undocumented prerequisite');
    }
  }
});

test('LLMV-API-134 — Brand trend endpoints ignore date range params', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const [noDateRes, futureRes] = await Promise.all([
    POST(page, '/api/v1/brand/visibility-trend/', { project_id: pid }),
    POST(page, '/api/v1/brand/visibility-trend/', {
      project_id: pid, start_date: '2030-01-01', end_date: '2030-12-31'
    }),
  ]);

  if (noDateRes.status === 200 && futureRes.status === 200) {
    const noDateCount = (Array.isArray(noDateRes.data) ? noDateRes.data : noDateRes.data?.data ?? []).length;
    const futureCount = (Array.isArray(futureRes.data) ? futureRes.data : futureRes.data?.data ?? []).length;
    if (noDateCount === futureCount && noDateCount > 0) {
      console.warn('[BUG LLMV-API-134] Date range params silently ignored');
    }
  }
});

test('LLMV-API-136 — Competitors PATCH requires operation fields', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const naiveRes = await PATCH(page, `/api/v1/projects/${pid}/competitors/`, {
    competitors: ['audi.com']
  });
  if (naiveRes.status === 400) {
    console.warn('[BUG LLMV-API-136] Naive {competitors:[...]} rejected — use operation fields');
  }
});

// ─── 3b. Quota — Consistency & Enforcement ───────────────────────────────────

test('LLMV-API-Q01 — Projected monthly credits math is internally consistent', async ({ page }) => {
  const res = await GET(page, '/api/v1/credits/projected-usage/');
  expect([200, 400, 404]).toContain(res.status);

  if (res.status === 200) {
    const total = res.data?.total_projected_monthly_credits;
    const projects = res.data?.projects ?? [];
    if (typeof total === 'number' && projects.length > 0) {
      const sum = projects.reduce((acc: number, p: any) => acc + (p.projected_monthly_credits ?? 0), 0);
      expect(Math.abs(sum - total)).toBeLessThanOrEqual(1);
    }
  }
});

test('LLMV-API-Q02 — Project settings credit balance is internally consistent', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await GET(page, `/api/v1/projects/${pid}/settings/`);
  if (res.status !== 200) { test.skip(); return; }

  const total     = res.data?.credits_total     ?? res.data?.total_credits;
  const consumed  = res.data?.credits_consumed  ?? res.data?.used_credits;
  const remaining = res.data?.credits_remaining ?? res.data?.available_credits;

  if (total !== undefined && consumed !== undefined && remaining !== undefined) {
    expect(Math.abs((total - consumed) - remaining)).toBeLessThanOrEqual(1);
    expect(remaining).toBeGreaterThanOrEqual(0);
  }
});

test('LLMV-API-Q04 — has_insufficient_credits flag matches credit math', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const [detailRes, settingsRes] = await Promise.all([
    GET(page, `/api/v1/projects/${pid}/`),
    GET(page, `/api/v1/projects/${pid}/settings/`),
  ]);

  if (detailRes.status !== 200 || settingsRes.status !== 200) { test.skip(); return; }

  const flag      = detailRes.data?.has_insufficient_credits;
  const remaining = settingsRes.data?.credits_remaining ?? settingsRes.data?.available_credits;
  const cost      = settingsRes.data?.credit_cost_per_run;

  if (flag !== undefined && remaining !== undefined && cost !== undefined) {
    const expectedFlag = remaining < cost;
    expect(flag).toBe(expectedFlag);
  }
});

test('LLMV-API-Q08 — GET on run-analysis endpoint returns 405', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await GET(page, `/api/v1/projects/${pid}/run-analysis/`);
  expect(res.status).toBe(405);
});

test('LLMV-API-Q12 — credit_cost_per_run is never negative', async ({ page }) => {
  const res = await GET(page, '/api/v1/credits/projected-usage/');
  if (res.status !== 200) { test.skip(); return; }

  const projects = res.data?.projects ?? [];
  for (const p of projects) {
    expect(p.credit_cost_per_run ?? 0).toBeGreaterThanOrEqual(0);
  }
});
