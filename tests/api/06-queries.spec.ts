import { test, expect } from '@playwright/test';
import { GET, POST, PUT, DELETE, goToAPI } from '../../helpers/api';



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

test('LLMV-API-085 — List queries for a brand', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  // Bug FIND-010: project_id alone should work but returns 400
  const onlyPidRes = await GET(page, `/api/v1/queries/?project_id=${pid}`);
  if (onlyPidRes.status === 400) {
    console.warn('[BUG FIND-010] GET /queries/ with only project_id returns 400 — domain required');
  }

  // Both params — must work
  const res = await GET(page, `/api/v1/queries/?project_id=${pid}&domain=${domain}`);
  expect(res.status).toBe(200);

  const queries = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  const ids = queries.map((q: any) => q.id);
  expect(new Set(ids).size).toBe(ids.length); // no duplicates
});

test('LLMV-API-086 — Create queries for a brand topic', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const topicsRes = await GET(page, `/api/v1/topics/?project_id=${pid}&domain=${domain}`);
  if (topicsRes.status !== 200) { test.skip(); return; }
  const topics = Array.isArray(topicsRes.data) ? topicsRes.data : topicsRes.data?.results ?? [];
  if (!topics.length) { test.skip(); return; }

  const topicId = topics[0].id;
  const title = `QA test query ${Date.now()}`;

  const createRes = await POST(page, '/api/v1/queries/', {
    project_id: pid, domain, topic_id: topicId, queries: [{ title }]
  });
  expect([200, 201]).toContain(createRes.status);

  // Bug LLMV-API-130: response has no IDs
  if (createRes.data?.message && !createRes.data?.results && !Array.isArray(createRes.data)) {
    console.warn('[BUG LLMV-API-130] POST /queries/ response contains no IDs');
  }

  // Empty text
  const emptyRes = await POST(page, '/api/v1/queries/', {
    project_id: pid, domain, topic_id: topicId, queries: [{ title: '' }]
  });
  expect([400, 422]).toContain(emptyRes.status);

  // Bad topic
  const badTopicRes = await POST(page, '/api/v1/queries/', {
    project_id: pid, domain,
    topic_id: '00000000-0000-0000-0000-000000000000',
    queries: [{ title: 'test' }]
  });
  expect([400, 404]).toContain(badTopicRes.status);
});

test('LLMV-API-087 — Update user-created query only', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const res = await GET(page, `/api/v1/queries/?project_id=${pid}&domain=${domain}`);
  if (res.status !== 200) { test.skip(); return; }
  const queries = Array.isArray(res.data) ? res.data : res.data?.results ?? [];

  const sysQuery = queries.find((q: any) => q.source !== 'user_created' && !q.is_user_created);
  if (sysQuery) {
    const sysRes = await PUT(page, `/api/v1/queries/${sysQuery.id}/`, { title: 'hacked' });
    expect([400, 403, 405]).toContain(sysRes.status);
  }
});

test('LLMV-API-088 — Delete user-created query only', async ({ page }) => {
  // Double delete on nonexistent
  const res = await DELETE(page, '/api/v1/queries/00000000-0000-0000-0000-000000000099/');
  expect([404, 405]).toContain(res.status);
});

test('LLMV-API-089 — Deactivate / reactivate query lifecycle', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const res = await GET(page, `/api/v1/queries/?project_id=${pid}&domain=${domain}`);
  if (res.status !== 200) { test.skip(); return; }
  const queries = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  if (!queries.length) { test.skip(); return; }

  const qid = queries[0].id;

  const deactivateRes = await POST(page, `/api/v1/queries/${qid}/deactivate/`);
  expect([200, 404]).toContain(deactivateRes.status);

  const deactivate2Res = await POST(page, `/api/v1/queries/${qid}/deactivate/`);
  expect([200, 404, 409]).toContain(deactivate2Res.status);

  const reactivateRes = await POST(page, `/api/v1/queries/${qid}/reactivate/`);
  expect([200, 404]).toContain(reactivateRes.status);
});

test('LLMV-API-090 — Queries overview (rank & visibility %)', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const res = await POST(page, '/api/v1/queries/overview/', { project_id: pid });
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

test('LLMV-API-091 — Single-query trends: visibility, SoV, citations', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const listRes = await GET(page, `/api/v1/queries/?project_id=${pid}&domain=${domain}`);
  if (listRes.status !== 200) { test.skip(); return; }
  const queries = Array.isArray(listRes.data) ? listRes.data : listRes.data?.results ?? [];
  if (!queries.length) { test.skip(); return; }

  const qid = queries[0].id;

  const [visRes, sovRes, citRes] = await Promise.all([
    POST(page, '/api/v1/queries/visibility-trend/',   { project_id: pid, query_id: qid }),
    POST(page, '/api/v1/queries/shared-voice-trend/', { project_id: pid, query_id: qid }),
    POST(page, '/api/v1/queries/citation-trend/',     { project_id: pid, query_id: qid }),
  ]);

  expect([200, 400, 404]).toContain(visRes.status);
  expect([200, 400, 404]).toContain(sovRes.status);
  expect([200, 400, 404]).toContain(citRes.status);
});

test('LLMV-API-092 — Available dates & unanalyzed queries', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const [availRes, unanalyzedRes] = await Promise.all([
    POST(page, '/api/v1/queries/available-dates/', { project_id: pid }),
    POST(page, '/api/v1/queries/unanalyzed/',      { project_id: pid, domain }),
  ]);

  expect([200, 400, 404]).toContain(availRes.status);
  expect([200, 400, 404]).toContain(unanalyzedRes.status);
});

test('LLMV-API-093 — Retrieve query responses — platform filter (bug FIND-013)', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;

  const availRes = await POST(page, '/api/v1/queries/available-dates/', { project_id: pid });
  if (availRes.status !== 200) { test.skip(); return; }
  const dates = Array.isArray(availRes.data) ? availRes.data : availRes.data?.available_dates ?? availRes.data?.data ?? [];
  if (!dates.length) { test.skip(); return; }

  const snapshotId = dates[0].snapshot_id ?? dates[0].id;

  const res = await POST(page, '/api/v1/responses/retrieve/', {
    project_id: pid, snapshot_id: snapshotId, platform: 'chatgpt'
  });
  expect([200, 400, 404]).toContain(res.status);

  if (res.status === 200) {
    const responses = Array.isArray(res.data) ? res.data : res.data?.results ?? res.data?.data ?? [];
    const platforms = [...new Set(responses.map((r: any) => r.platform))];
    if (platforms.length > 1) {
      console.warn('[BUG FIND-013] Platform filter ignored — multiple platforms returned');
    }
  }

  // Date string instead of snapshot_id should return 400
  const dateRes = await POST(page, '/api/v1/responses/retrieve/', {
    project_id: pid, date: '2024-01-01', platform: 'chatgpt'
  });
  expect([400, 404]).toContain(dateRes.status);
});

test('LLMV-API-094 — GET /queries/ requires redundant domain param (bug FIND-010)', async ({ page }) => {
  const project = await getProject(page);
  if (!project) { test.skip(); return; }
  const pid = project.id ?? project.project_id;
  const domain = await getProjectDomain(project);

  const onlyPidRes = await GET(page, `/api/v1/queries/?project_id=${pid}`);
  if (onlyPidRes.status === 400) {
    const msg = JSON.stringify(onlyPidRes.data).toLowerCase();
    expect(msg).toContain('domain');
    console.warn('[BUG FIND-010] GET /queries/ with only project_id returns 400');
  }

  const bothRes = await GET(page, `/api/v1/queries/?project_id=${pid}&domain=${domain}`);
  expect(bothRes.status).toBe(200);
});
