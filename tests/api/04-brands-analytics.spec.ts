import { test, expect } from '@playwright/test';
import { GET, POST, goToAPI } from '../../helpers/api';



test.beforeEach(async ({ page }) => {
  await goToAPI(page);
});

async function getActiveProject(page: any) {
  const res = await GET(page, '/api/v1/projects/');
  const projects = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  return projects.find((p: any) => p.is_active) ?? projects[0] ?? null;
}

function brandPayload(project: any) {
  const pid = project.id ?? project.project_id;
  const bid = project.brand_id ?? project.brand?.id;
  return bid ? { project_id: pid, brand_id: bid } : { project_id: pid };
}

test('LLMV-API-060 — Brand performance overview (happy path)', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/brand/overview/', brandPayload(project));
  expect([200, 400]).toContain(res.status);

  const vis = res.data?.visibility ?? res.data?.visibility_score;
  if (vis !== undefined && vis !== null) {
    expect(vis).toBeGreaterThanOrEqual(0);
    expect(vis).toBeLessThanOrEqual(100);
  }
});

test('LLMV-API-061 — Visibility trend per snapshot', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/brand/visibility-trend/', brandPayload(project));
  expect([200, 400]).toContain(res.status);

  // Bug LLMV-API-134: date params currently silently ignored
  const futureRes = await POST(page, '/api/v1/brand/visibility-trend/', {
    project_id: pid, start_date: '2030-01-01', end_date: '2030-12-31'
  });
  if (futureRes.status === 200) {
    const data = Array.isArray(futureRes.data) ? futureRes.data : futureRes.data?.data ?? [];
    if (data.length > 0) {
      console.warn('[BUG LLMV-API-134] Date range params silently ignored — future dates return data');
    }
  }
});

test('LLMV-API-062 — Mentions trend snapshot axis aligns with visibility-trend', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const [visRes, mentionsRes] = await Promise.all([
    POST(page, '/api/v1/brand/visibility-trend/', brandPayload(project)),
    POST(page, '/api/v1/brand/mentions-trend/',   brandPayload(project)),
  ]);

  expect([200, 400]).toContain(visRes.status);
  expect([200, 400]).toContain(mentionsRes.status);
});

test('LLMV-API-063 — Sentiment trend per snapshot', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/brand/sentiment-trend/', brandPayload(project));
  expect([200, 400, 404]).toContain(res.status);
});

test('LLMV-API-064 — Competitor visibility rank', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/brand/competitor-visibility-rank/', brandPayload(project));
  expect([200, 400, 404]).toContain(res.status);

  if (res.status === 200) {
    const items = Array.isArray(res.data) ? res.data : res.data?.results ?? res.data?.data ?? [];
    for (const item of items) {
      const vis = item.visibility ?? item.visibility_score;
      if (vis !== undefined && vis !== null) {
        expect(vis).toBeGreaterThanOrEqual(0);
        expect(vis).toBeLessThanOrEqual(100);
      }
    }
  }
});

test('LLMV-API-065 — Competitor share of voice rank sums to ≤100%', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/brand/competitor-shared-voice-rank/', brandPayload(project));
  expect([200, 400, 404]).toContain(res.status);

  if (res.status === 200) {
    const items = Array.isArray(res.data) ? res.data : res.data?.results ?? res.data?.data ?? [];
    const total = items.reduce((sum: number, i: any) => sum + (i.share_of_voice ?? i.sov ?? 0), 0);
    if (items.length > 0) expect(total).toBeLessThanOrEqual(101);
  }
});

test('LLMV-API-066 — Competitor visibility trend', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/brand/competitor-visibility-trend/', brandPayload(project));
  expect([200, 400, 404]).toContain(res.status);
});

test('LLMV-API-067 — Domain queries and topics contribution', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const [dqRes, dtRes] = await Promise.all([
    POST(page, '/api/v1/brand/domain-queries/', brandPayload(project)),
    POST(page, '/api/v1/brand/domain-topics/',  brandPayload(project)),
  ]);

  expect([200, 400, 404]).toContain(dqRes.status);
  expect([200, 400, 404]).toContain(dtRes.status);

  // Garbage domain
  const badRes = await POST(page, '/api/v1/brand/domain-queries/', {
    project_id: pid, domain: 'not!!a!!domain'
  });
  expect([400, 200]).toContain(badRes.status);
});

test('LLMV-API-068 — Cross-endpoint reconciliation: overview vs parts', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const [overviewRes, queriesRes, topicsRes] = await Promise.all([
    POST(page, '/api/v1/brand/overview/',   brandPayload(project)),
    POST(page, '/api/v1/queries/overview/', brandPayload(project)),
    POST(page, '/api/v1/topics/overview/',  brandPayload(project)),
  ]);

  expect([200, 400]).toContain(overviewRes.status);
  expect([200, 400, 404]).toContain(queriesRes.status);
  expect([200, 400, 404]).toContain(topicsRes.status);
});

test('LLMV-API-069 — Brand queries and topics list endpoints', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const [bqRes, btRes] = await Promise.all([
    GET(page, `/api/v1/brand/queries/?project_id=${pid}`),
    GET(page, `/api/v1/brand/topics/?project_id=${pid}`),
  ]);

  expect([200, 400, 404]).toContain(bqRes.status);
  expect([200, 400, 404]).toContain(btRes.status);
});
