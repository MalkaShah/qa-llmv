---
name: playwright-tester
description: >
  Automated E2E testing for LLM Visibility (LLMV) using Playwright's native
  test runner. Writes persistent .spec.ts files, runs them free via
  `npx playwright test`, and fixes failures automatically. Use this skill
  whenever Malka wants to test LLMV — API endpoints, UI flows, database
  consistency, or deep multi-step journeys. Triggers: "write specs for",
  "run the tests", "fix this failure", "test the happy path", "does this
  endpoint work", "check the DB", "swarm mode". This skill is the single
  source of truth for how all LLMV testing is done.
---

# Playwright Tester — LLMV Edition

Write `.spec.ts` test files, run them natively (zero AI tokens per run),
and fix failures in an automated loop. All testing is black-box:
no codebase access, URL + credentials + read-only DB only.

---

## Why this approach

Three ways to do browser testing with AI:

1. **AI drives the browser live** — burns tokens on every click and assertion
2. **Screenshot-based** — even worse; images are token-heavy, single-threaded
3. **AI writes tests, Playwright runs them** — tokens spent once on authoring;
   execution is free forever, runs in parallel, persists as a regression suite

This skill uses approach 3. Sub-agents write tests in parallel (swarm mode).
Playwright's native worker system runs them. You never pay AI tokens for
execution regardless of how many times you run the suite.

---

## Four suites

| Suite | IDs | Cases | Source | Execution |
|---|---|---|---|---|
| A — API | LLMV-API-* | 106 | `llmv_api_test_suite.html` | serial, 1 worker |
| B — UI smoke | SMKT-LLMV-* | 110 | `llmv_ui_smoke_test_suite.html` | parallel, 4 workers |
| DB — Database | DB-010 to DB-079 | 63 | `llmv_db_test_suite.html` | serial, ts-node |
| C — Deep E2E | (authored here) | ~30 | cross-suite flows | serial, 1 worker |

Phase 0 (DB-000 to DB-009) runs once manually before Suite DB.

---

## Prerequisites

On first use in a new environment:

```bash
npm install
npx playwright install chromium
npm run auth:save          # saves auth-state.json — headed, solve any challenge
```

Verify `playwright.config.ts` exists. It already defines three projects:
`api` (serial), `ui` (parallel), `e2e` (serial).

For DB suites: Twingate must be active (`postgres-llmv` must resolve).
Run Phase 0 first: `npx ts-node tests/db/phase0-discovery.ts`

---

## Workflow

### Phase 1 — Assess

1. Read `CLAUDE.md` for project context and absolute rules
2. Identify which suite the task belongs to (API / UI / DB / E2E)
3. Read the relevant source HTML file to get exact IDs, steps, and expected values
4. Check `tests/<suite>/` for existing spec files — do not duplicate coverage
5. For DB cases: load `config/schema-map.json` and substitute all `{PLACEHOLDER}` tokens

### Phase 2 — Author tests

Write `.spec.ts` files into the correct directory.

**Suite A — API specs** use Playwright's `request` fixture (no browser):

```ts
import { test, expect } from '@playwright/test';

test('LLMV-API-020 — Create system-tracked project (happy path)', async ({ request }) => {
  const res = await request.post('/api/v1/projects/', {
    data: { domain: 'kia.com', country_code: 'US' },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body).toHaveProperty('id');
  expect(body.domain).toBe('kia.com');
});
```

**Suite B — UI smoke specs** use the `page` fixture:

```ts
import { test, expect } from '@playwright/test';

test('SMKT-LLMV-NAV-001 — Navigation to Summary section', async ({ page }) => {
  await page.goto('/llm-visibility');
  await page.getByRole('tab', { name: 'Summary' }).click();
  await expect(page.getByRole('tab', { name: 'Summary' }))
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-testid="summary-content"]')).toBeVisible();
});
```

**Suite DB specs** use the `db` helper — SELECT only, never write:

```ts
import { test, expect } from '@playwright/test';
import { query } from '../../helpers/db';
import schemaMap from '../../config/schema-map.json';

test('DB-020 — No orphaned queries', async () => {
  const { rows } = await query(
    `SELECT COUNT(*) AS orphaned
     FROM ${schemaMap.QUERIES} q
     LEFT JOIN ${schemaMap.PROJECTS} p ON q.project_id = p.id
     WHERE p.id IS NULL`
  );
  expect(Number(rows[0].orphaned)).toBe(0);
});
```

**Suite C — Deep E2E** chains API → UI → DB in one test:

```ts
test('E2E-001 — Activate project: API → UI reflects → DB confirms', async ({ request, page }) => {
  // 1. API action
  const activate = await request.post(`/api/v1/projects/${PROJECT_ID}/activate/`);
  expect(activate.status()).toBe(200);

  // 2. UI verification
  await page.goto('/llm-visibility');
  await expect(page.getByText('Active')).toBeVisible();

  // 3. DB assertion
  const { rows } = await query(
    `SELECT is_llm_activated FROM ${schemaMap.PROJECTS} WHERE id = $1`,
    [PROJECT_ID]
  );
  expect(rows[0].is_llm_activated).toBe(true);
});
```

**Writing rules:**
- Every test title starts with its case ID: `'LLMV-API-020 — ...'`
- One behaviour per test — multiple assertions are fine if they verify the same thing
- Use `getByRole()`, `getByLabel()`, `getByText()` — never CSS selectors
- Each test is independent — no shared state, use `beforeEach` for setup
- Never hardcode table names in DB specs — always use `schemaMap`
- Never hardcode project IDs — read from env or create a fixture project

**File organisation:**
```
tests/
  api/
    01-platforms.spec.ts          ← LLMV-API-011 to 014
    02-projects-lifecycle.spec.ts ← LLMV-API-020 to 041
    03-topics.spec.ts             ← LLMV-API-042 to 05x
    04-analytics.spec.ts          ← remaining LLMV-API-*
  ui/
    01-navigation.spec.ts         ← SMKT-LLMV-NAV-*
    02-summary.spec.ts            ← SMKT-LLMV-SUMMARY-*
    03-visibility.spec.ts         ← SMKT-LLMV-VIS-*
    04-sentiment.spec.ts          ← SMKT-LLMV-SENT-*
    05-topics-queries.spec.ts     ← SMKT-LLMV-TQ-*
  db/
    phase0-discovery.ts           ← run once manually
    01-schema-integrity.spec.ts   ← DB-010 to DB-018
    02-data-integrity.spec.ts     ← DB-020 to DB-029
    03-kia-fixture.spec.ts        ← DB-030 to DB-039
    04-api-db-consistency.spec.ts ← DB-040 to DB-046
    05-business-logic.spec.ts     ← DB-050 to DB-05x
    06-edge-cases.spec.ts         ← DB-060 to DB-06x
    07-security.spec.ts           ← DB-070 to DB-079
  e2e/
    01-activate-flow.spec.ts
    02-run-analysis-credit.spec.ts
    03-quota-enforcement.spec.ts
```

### Phase 3 — Execute

**Suite A (serial — always):**
```bash
npx playwright test tests/api --project=api --reporter=line 2>&1
```

**Suite B (parallel):**
```bash
npx playwright test tests/ui --project=ui --reporter=line 2>&1
```

**Suite DB:**
```bash
npm run test:db
```

**Suite C (serial):**
```bash
npx playwright test tests/e2e --project=e2e --reporter=line 2>&1
```

**All suites in order:**
```bash
npm run test:all
```

Key flags:
- Never use `--workers` > 1 for Suite A or C
- Use `--reporter=line` for readable terminal output
- Use `--trace on` when a failure is ambiguous — generates a full trace file

### Phase 4 — Fix loop (max 3 attempts)

When tests fail:

1. **Read the full error** — Playwright includes expected vs actual, selector, page state
2. **Classify the failure:**
   - `test bug` — wrong selector, stale expected value, timing issue → fix the spec
   - `API bug` — endpoint returns wrong status or body → file ticket, do not auto-fix
   - `UI bug` — element missing or wrong text → file ticket, do not auto-fix
   - `DB mismatch` — API response contradicts DB row → file ticket with SQL diff
3. **Fix only test bugs automatically.** For app bugs, report and stop.
4. **Rerun after fixing** and report the result — always, even if all pass.
5. **After 3 failed attempts** — stop, report what is still failing and why,
   ask Malka for guidance.

**Timing issues** — add `waitFor` on the specific action, not a blanket sleep:
```ts
await page.waitForResponse(res => res.url().includes('/api/v1/projects/'));
```

**Report format for every failure:**
```
✗ LLMV-API-032 — Concurrent run-analysis calls (double-charge race)
  Class   : API bug
  Expected: one credit deduction row in DB
  Actual  : two rows
  DB diff : 2 rows in credit_usage for project_id='...'
  Action  : ticket filed — do not retry without Malka confirmation
```

### Phase 5 — Report

After all tests pass (or fix loop exhausts):

1. Print summary table: total · passed · failed · skipped · duration
2. List every failure with class label and DB diff if applicable
3. Suggest additional coverage if gaps are obvious
4. Flag any test that passed on retry — these are flaky and need attention

---

## Swarm mode

When Malka says "swarm mode" or "write all specs for Suite X":

Spawn sub-agents per section — each writes its own spec file in parallel.
Sub-agents author tests only; they never drive the browser or run analysis.

Example for Suite A swarm:
- **Agent 1** → `tests/api/01-platforms.spec.ts` (LLMV-API-011 to 014)
- **Agent 2** → `tests/api/02-projects-lifecycle.spec.ts` (LLMV-API-020 to 041)
- **Agent 3** → `tests/api/03-topics.spec.ts`
- **Agent 4** → `tests/api/04-analytics.spec.ts`

Once all agents finish, run once:
```bash
npx playwright test tests/api --project=api --reporter=line 2>&1
```

Tokens are spent once on authoring. Execution is always free.

---

## Absolute rules (never break)

1. **Read-only DB** — SELECT only. No INSERT, UPDATE, DELETE, ever.
2. **Never run `run-analysis` without Malka's explicit confirmation** — it burns real Universal Credits on production.
3. **Suite A is always serial** — `workers: 1`. Credit-integrity cases break under parallelism.
4. **Phase 0 before Suite DB** — `config/schema-map.json` must exist and be fully populated.
5. **Twingate must be active** for any DB run — if `postgres-llmv` cannot resolve, stop immediately.
6. **Never invent test IDs** — IDs come from the uploaded HTML suite files only.
7. **Never commit `.env.db` or `auth-state.json`** — both are in `.gitignore`.
8. **Never hardcode credentials** in any spec file.

---

## Tips

- **Start with Suite A** — all 106 cases are fully documented with endpoints,
  payloads, and expected responses in `llmv_api_test_suite.html`. Highest ROI first.
- **kia.com is the fixture project** — DB-030 to DB-039 anchor Suite C flows.
  Always verify kia.com exists in the DB before running Suite C.
- **Trace on ambiguous failures** — `npx playwright test --trace on` generates
  a `.zip` trace file. Open with `npx playwright show-trace trace.zip`.
- **Re-save auth if you get 401s** — `npm run auth:save` and retry.
- **Schema map is the single source of truth for table names** — never bypass it.
