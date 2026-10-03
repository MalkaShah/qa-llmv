import { test, expect } from '@playwright/test';
import { GET, goToAPI } from '../../helpers/api';



test.beforeEach(async ({ page }) => {
  await goToAPI(page);
});

test('LLMV-API-010 — List all platforms with status', async ({ page }) => {
  const res = await GET(page, '/api/v1/platforms/');
  expect(res.status).toBe(200);

  const platforms = Array.isArray(res.data) ? res.data : res.data?.results ?? res.data?.data ?? [];
  expect(platforms.length).toBeGreaterThan(0);

  // Each platform has a status field
  for (const p of platforms) {
    expect(p).toHaveProperty('status');
  }

  // No duplicate platform codes
  const codes = platforms.map((p: any) => p.platform ?? p.code ?? p.name ?? p.id);
  expect(new Set(codes).size).toBe(codes.length);
});

test('LLMV-API-011 — Get platform status by valid platform code', async ({ page }) => {
  const listRes = await GET(page, '/api/v1/platforms/');
  expect(listRes.status).toBe(200);

  const platforms = Array.isArray(listRes.data) ? listRes.data : listRes.data?.results ?? [];
  expect(platforms.length).toBeGreaterThan(0);

  // Check first 3 platforms individually — compare status to list
  for (const p of platforms.slice(0, 3)) {
    const code = p.platform ?? p.code ?? p.name ?? p.id;
    const detailRes = await GET(page, `/api/v1/platforms/${code}/`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.data.status).toBe(p.status);
  }
});

test('LLMV-API-012 — Invalid platform code handled cleanly', async ({ page }) => {
  const invalidCodes = ['not-a-platform', 'CHATGPT%20', 'fake999'];

  for (const code of invalidCodes) {
    const res = await GET(page, `/api/v1/platforms/${code}/`);
    expect(res.status, `Expected 404 for: ${code}`).toBe(404);

    // Must not return HTML error page
    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    expect(text.toLowerCase()).not.toContain('<html');
  }
});

test('LLMV-API-013 — Available platforms for a project', async ({ page }) => {
  const projectsRes = await GET(page, '/api/v1/projects/');
  expect(projectsRes.status).toBe(200);

  const projects = Array.isArray(projectsRes.data)
    ? projectsRes.data
    : projectsRes.data?.results ?? [];

  if (projects.length === 0) { test.skip(); return; }

  const pid = projects[0].id ?? projects[0].project_id;

  const res = await GET(page, `/api/v1/available-platforms/?project=${pid}`);
  expect([200, 400, 404]).toContain(res.status);

  // Nonexistent project
  const notFoundRes = await GET(page, '/api/v1/available-platforms/?project=00000000-0000-0000-0000-000000000000');
  expect([400, 404]).toContain(notFoundRes.status);
});

test('LLMV-API-014 — Degraded/disabled platform notifications', async ({ page }) => {
  const res = await GET(page, '/api/v1/platforms/PlatformNotifications/');
  expect([200, 404]).toContain(res.status);

  if (res.status === 200) {
    const notifications = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    for (const n of notifications) {
      expect(['degraded', 'disabled', 'down']).toContain(
        (n.status ?? '').toLowerCase()
      );
    }
  }
});
