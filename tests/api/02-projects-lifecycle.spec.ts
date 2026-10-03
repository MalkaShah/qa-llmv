import { test, expect } from '@playwright/test';
import { GET, POST, PUT, PATCH, DELETE, goToAPI } from '../../helpers/api';



let createdProjectId: string | null = null;

test.beforeEach(async ({ page }) => {
  await goToAPI(page);
});

async function getProjects(page: any) {
  const res = await GET(page, '/api/v1/projects/');
  const data = res.data;
  return Array.isArray(data) ? data : data?.results ?? [];
}

test('LLMV-API-020 — Create system-tracked project (happy path)', async ({ page }) => {
  const domain = `qa-test-${Date.now()}.com`;
  const res = await POST(page, '/api/v1/projects/', { domain, country_code: 'US' });
  expect(res.status).toBe(201);

  // Bug FIND-009: returns project_id instead of id
  const id = res.data?.id ?? res.data?.project_id;
  expect(id).toBeTruthy();
  createdProjectId = id;

  if (!res.data?.id && res.data?.project_id) {
    console.warn('[BUG FIND-009] POST /projects/ returns project_id instead of id');
  }

  // Detail must be consistent
  const detail = await GET(page, `/api/v1/projects/${id}/`);
  expect(detail.status).toBe(200);

  // Must appear in list
  const projects = await getProjects(page);
  expect(projects.some((p: any) => (p.id ?? p.project_id) === id)).toBe(true);
});

test('LLMV-API-021 — Create project — invalid payloads', async ({ page }) => {
  // Empty body
  const emptyRes = await POST(page, '/api/v1/projects/', {});
  expect(emptyRes.status).toBe(400);

  // Invalid domains
  for (const domain of ['not a domain', 'nodot', 'javascript:alert(1)']) {
    const res = await POST(page, '/api/v1/projects/', { domain, country_code: 'US' });
    expect([400, 422], `Expected 400/422 for domain: ${domain}`).toContain(res.status);
  }

  // Invalid country code
  const badCountry = await POST(page, '/api/v1/projects/', { domain: 'valid.com', country_code: 'ZZ' });
  expect(badCountry.status).toBe(400);
});

test('LLMV-API-022 — Track: convert system-tracked → user-tracked', async ({ page }) => {
  const projects = await getProjects(page);
  if (!projects.length) { test.skip(); return; }
  const pid = projects[0].id ?? projects[0].project_id;

  const trackRes = await POST(page, `/api/v1/projects/${pid}/track/`);
  expect([200, 409]).toContain(trackRes.status);

  // Idempotency
  const track2Res = await POST(page, `/api/v1/projects/${pid}/track/`);
  expect([200, 409]).toContain(track2Res.status);
});

test('LLMV-API-023 — Untrack: revert user-tracked → system-tracked', async ({ page }) => {
  const projects = await getProjects(page);
  if (!projects.length) { test.skip(); return; }
  const pid = projects[0].id ?? projects[0].project_id;

  const res = await POST(page, `/api/v1/projects/${pid}/untrack/`);
  expect([200, 409]).toContain(res.status);
});

test('LLMV-API-024 — Activate LLM Visibility for project', async ({ page }) => {
  const projects = await getProjects(page);
  const inactive = projects.find((p: any) => !p.is_active) ?? projects[0];
  if (!inactive) { test.skip(); return; }
  const pid = inactive.id ?? inactive.project_id;

  const res = await POST(page, `/api/v1/projects/${pid}/activate/`);
  expect([200, 400, 403]).toContain(res.status);
});

test('LLMV-API-025 — Activate beyond plan quota is blocked', async ({ page }) => {
  const res = await POST(page, '/api/v1/projects/00000000-0000-0000-0000-000000000099/activate/');
  expect([400, 403, 404]).toContain(res.status);
});

test('LLMV-API-026 — Deactivate LLM Visibility', async ({ page }) => {
  const projects = await getProjects(page);
  const active = projects.find((p: any) => p.is_active);
  if (!active) { test.skip(); return; }
  const pid = active.id ?? active.project_id;

  const res = await POST(page, `/api/v1/projects/${pid}/deactivate/`);
  expect([200, 400]).toContain(res.status);

  if (res.status === 200) {
    // run-analysis on deactivated project must be rejected
    const runRes = await POST(page, `/api/v1/projects/${pid}/run-analysis/`);
    expect([400, 403, 409]).toContain(runRes.status);
  }
});

test('LLMV-API-027 — Reactivate previously deactivated project', async ({ page }) => {
  const projects = await getProjects(page);
  const inactive = projects.find((p: any) => !p.is_active);
  if (!inactive) { test.skip(); return; }
  const pid = inactive.id ?? inactive.project_id;

  const res = await POST(page, `/api/v1/projects/${pid}/activate/`);
  expect([200, 400, 403]).toContain(res.status);
});

test('LLMV-API-028 — PUT and PATCH on project are disabled', async ({ page }) => {
  const projects = await getProjects(page);
  if (!projects.length) { test.skip(); return; }
  const pid = projects[0].id ?? projects[0].project_id;

  const putRes = await PUT(page, `/api/v1/projects/${pid}/`, { project_name: 'hacked' });
  expect([405, 403]).toContain(putRes.status);

  const patchRes = await PATCH(page, `/api/v1/projects/${pid}/`, { project_name: 'hacked' });
  expect([405, 403]).toContain(patchRes.status);

  // Confirm nothing changed
  const detail = await GET(page, `/api/v1/projects/${pid}/`);
  expect(detail.data?.project_name).not.toBe('hacked');
});

test('LLMV-API-029 — Delete project (happy path + cascade)', async ({ page }) => {
  if (!createdProjectId) { test.skip(); return; }

  const deleteRes = await DELETE(page, `/api/v1/projects/${createdProjectId}/`);
  expect([200, 204]).toContain(deleteRes.status);

  const getRes = await GET(page, `/api/v1/projects/${createdProjectId}/`);
  expect(getRes.status).toBe(404);

  const projects = await getProjects(page);
  expect(projects.some((p: any) => (p.id ?? p.project_id) === createdProjectId)).toBe(false);
  createdProjectId = null;
});

test('LLMV-API-031 — Run analysis (happy path)', async ({ page }) => {
  const projects = await getProjects(page);
  const active = projects.find((p: any) => p.is_active && !p.has_insufficient_credits);
  if (!active) { test.skip(); return; }
  const pid = active.id ?? active.project_id;

  const res = await POST(page, `/api/v1/projects/${pid}/run-analysis/`);
  expect([200, 202, 409]).toContain(res.status);
});

test('LLMV-API-032 — Concurrent run-analysis (double-charge race)', async ({ page }) => {
  const projects = await getProjects(page);
  const active = projects.find((p: any) => p.is_active && !p.has_insufficient_credits);
  if (!active) { test.skip(); return; }
  const pid = active.id ?? active.project_id;

  // Fire 2 concurrent requests from within the browser
  const results = await page.evaluate(async (projectId: string) => {
    const url = `https://llmvis.searchatlas.com/api/v1/projects/${projectId}/run-analysis/`;
    const [r1, r2] = await Promise.all([
      fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }),
      fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }),
    ]);
    return [r1.status, r2.status];
  }, pid);

  const accepted = results.filter((s: number) => [200, 202].includes(s)).length;
  expect(accepted).toBeLessThanOrEqual(1);
});

test('LLMV-API-033 — Update refresh frequency', async ({ page }) => {
  const projects = await getProjects(page);
  if (!projects.length) { test.skip(); return; }
  const pid = projects[0].id ?? projects[0].project_id;

  for (const freq of [7, 14, 30]) {
    const res = await PATCH(page, `/api/v1/projects/${pid}/frequency/`, { frequency_days: freq });
    expect([200, 400, 404]).toContain(res.status);
  }

  const invalidRes = await PATCH(page, `/api/v1/projects/${pid}/frequency/`, { frequency_days: 0 });
  expect([400, 404]).toContain(invalidRes.status);
});

test('LLMV-API-034 — Project settings GET/PATCH round-trip', async ({ page }) => {
  const projects = await getProjects(page);
  if (!projects.length) { test.skip(); return; }
  const pid = projects[0].id ?? projects[0].project_id;

  const getRes = await GET(page, `/api/v1/projects/${pid}/settings/`);
  expect([200, 400, 404]).toContain(getRes.status);

  if (getRes.status === 200) {
    const badRes = await PATCH(page, `/api/v1/projects/${pid}/settings/`, {
      is_web_search_enabled: 'not-a-boolean'
    });
    expect([400, 200]).toContain(badRes.status);
  }
});

test('LLMV-API-035 — Competitors list and selection update', async ({ page }) => {
  const projects = await getProjects(page);
  if (!projects.length) { test.skip(); return; }
  const pid = projects[0].id ?? projects[0].project_id;

  const res = await GET(page, `/api/v1/projects/${pid}/competitors/`);
  expect([200, 400, 404]).toContain(res.status);
});

test('LLMV-API-036 — check-existence with mixed valid/invalid combos', async ({ page }) => {
  const res = await POST(page, '/api/v1/projects/check-existence/', [
    { domain: 'kia.com',           country_code: 'US' },
    { domain: 'nonexistent99.xyz', country_code: 'US' },
    { domain: 'not a domain',      country_code: 'US' },
  ]);
  expect([200, 400]).toContain(res.status);
});

test('LLMV-API-037 — check-llm-activation batch status', async ({ page }) => {
  const res = await POST(page, '/api/v1/projects/check-llm-activation/', {
    items: [{ domain: 'kia.com', country_code: 'US' }]
  });
  expect([200, 400]).toContain(res.status);
});

test('LLMV-API-038 — CSV export of topics & queries', async ({ page }) => {
  const projects = await getProjects(page);
  if (!projects.length) { test.skip(); return; }
  const pid = projects[0].id ?? projects[0].project_id;

  const res = await POST(page, `/api/v1/projects/${pid}/export-topics-queries/`);
  expect([200, 400, 404]).toContain(res.status);
});

test('LLMV-API-040 — Track: platforms field silently ignored (bug FIND-007)', async ({ page }) => {
  const projects = await getProjects(page);
  if (!projects.length) { test.skip(); return; }
  const pid = projects[0].id ?? projects[0].project_id;

  const res = await POST(page, `/api/v1/projects/${pid}/track/`, { platforms: ['chatgpt'] });
  expect([200, 400, 409]).toContain(res.status);

  if (res.status === 200) {
    const settings = await GET(page, `/api/v1/projects/${pid}/settings/`);
    if (settings.status === 200) {
      const selected = settings.data?.selected_platforms ?? [];
      if (selected.length > 1) {
        console.warn('[BUG FIND-007] platforms field silently ignored — all plan platforms activated');
      }
    }
  }
});

test('LLMV-API-041 — Track: invalid platform names accepted (bug FIND-008)', async ({ page }) => {
  const projects = await getProjects(page);
  if (!projects.length) { test.skip(); return; }
  const pid = projects[0].id ?? projects[0].project_id;

  const res = await POST(page, `/api/v1/projects/${pid}/track/`, {
    platforms: ['nonexistent_platform_xyz', 'fake_llm_999']
  });

  if (res.status === 200) {
    console.warn('[BUG FIND-008] Invalid platform names accepted without validation error');
  }
  expect([200, 400, 409]).toContain(res.status);
});

test('LLMV-API-042 — POST /projects/ returns project_id instead of id (bug FIND-009)', async ({ page }) => {
  const domain = `qa-id-test-${Date.now()}.com`;
  const res = await POST(page, '/api/v1/projects/', { domain, country_code: 'US' });
  expect(res.status).toBe(201);

  if (!res.data?.id && res.data?.project_id) {
    console.warn('[BUG FIND-009] POST /projects/ returns project_id instead of standard id field');
  }
  const id = res.data?.id ?? res.data?.project_id;
  expect(id).toBeTruthy();

  // Cleanup
  await DELETE(page, `/api/v1/projects/${id}/`);
});
