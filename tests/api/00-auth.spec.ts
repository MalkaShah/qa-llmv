import { test, expect } from '@playwright/test';
import { GET, POST, DELETE, goToAPI } from '../../helpers/api';

const API = 'https://llmvis.searchatlas.com';

test.beforeEach(async ({ page }) => {
  await goToAPI(page);
});

test('LLMV-API-001 — All endpoints reject requests with no auth token', async ({ page }) => {
  const endpoints = [
    { method: 'GET',  url: `${API}/api/v1/platforms/` },
    { method: 'GET',  url: `${API}/api/v1/projects/` },
    { method: 'POST', url: `${API}/api/v1/brand/overview/` },
  ];

  for (const ep of endpoints) {
    // Use page.request with no Authorization header
    const res = ep.method === 'GET'
      ? await page.request.get(ep.url, { headers: { 'Content-Type': 'application/json' } })
      : await page.request.post(ep.url, { headers: { 'Content-Type': 'application/json' }, data: {} });

    expect([401, 403], `Expected 401/403 for ${ep.method} ${ep.url}`).toContain(res.status());
  }
});

test('LLMV-API-002 — All endpoints reject expired/invalid tokens', async ({ page }) => {
  const endpoints = [
    `${API}/api/v1/platforms/`,
    `${API}/api/v1/projects/`,
  ];

  for (const url of endpoints) {
    const res = await page.request.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalidtoken123abc',
      }
    });
    expect([401, 403], `Expected 401/403 for ${url}`).toContain(res.status());
  }
});

test('LLMV-API-003 — Cross-tenant access denied (IDOR sweep)', async ({ page }) => {
  const foreignId = '00000000-0000-0000-0000-000000000001';

  const getRes = await GET(page, `/api/v1/projects/${foreignId}/`);
  expect([401, 403, 404]).toContain(getRes.status);

  const runRes = await POST(page, `/api/v1/projects/${foreignId}/run-analysis/`);
  expect([401, 403, 404]).toContain(runRes.status);

  const deleteRes = await DELETE(page, `/api/v1/projects/${foreignId}/`);
  expect([401, 403, 404]).toContain(deleteRes.status);
});

test('LLMV-API-004 — OpenAPI schema endpoint check', async ({ page }) => {
  const res = await GET(page, '/api/schema/');
  // Schema redirects to Django admin login — not publicly exposed
  // This is an informational test only
  console.log(`[INFO] /api/schema/ returned ${res.status} — schema endpoint behavior documented`);
  expect([200, 301, 302, 401, 403, 404]).toContain(res.status);
});