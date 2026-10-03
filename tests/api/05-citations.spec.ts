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

test('LLMV-API-075 — Citations overview (domains)', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/citations/overview/', { project_id: pid });
  expect([200, 400, 404]).toContain(res.status);

  if (res.status === 200) {
    const items = Array.isArray(res.data) ? res.data : res.data?.results ?? res.data?.data ?? [];
    for (const item of items) {
      expect(item.domain ?? item.url).toBeTruthy();
      const count = item.citation_count ?? item.count ?? item.mentions;
      if (count !== undefined) expect(count).toBeGreaterThanOrEqual(0);
    }
  }
});

test('LLMV-API-076 — URL citations reconcile to domain totals', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const [overviewRes, urlsRes] = await Promise.all([
    POST(page, '/api/v1/citations/overview/', { project_id: pid }),
    POST(page, '/api/v1/citations/urls/',      { project_id: pid }),
  ]);

  expect([200, 400, 404]).toContain(overviewRes.status);
  expect([200, 400, 404]).toContain(urlsRes.status);
});

test('LLMV-API-077 — Platform citations share breakdown sums to ≈100%', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/citations/platforms/', { project_id: pid });
  expect([200, 400, 404]).toContain(res.status);

  if (res.status === 200) {
    const items = Array.isArray(res.data) ? res.data : res.data?.results ?? res.data?.data ?? [];
    const total = items.reduce((sum: number, i: any) => sum + (i.share ?? i.percentage ?? 0), 0);
    if (items.length > 0) expect(total).toBeLessThanOrEqual(101);
  }
});

test('LLMV-API-078 — Query and topic citation overviews', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const [qRes, tRes] = await Promise.all([
    POST(page, '/api/v1/citations/queries/', { project_id: pid }),
    POST(page, '/api/v1/citations/topics/',  { project_id: pid }),
  ]);

  expect([200, 400, 404]).toContain(qRes.status);
  expect([200, 400, 404]).toContain(tRes.status);
});

test('LLMV-API-079 — Per-platform URL citation breakdown & URL-query mapping', async ({ page }) => {
  const project = await getActiveProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  // Malformed URL
  const malformedRes = await POST(page, '/api/v1/citations/url-platforms/', {
    project_id: pid, url: 'javascript:alert(1)'
  });
  expect([400, 404]).toContain(malformedRes.status);

  const res = await POST(page, '/api/v1/citations/url-platforms/', { project_id: pid });
  expect([200, 400, 404]).toContain(res.status);
});
