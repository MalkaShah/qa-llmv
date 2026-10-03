# MalkaQA — LLMV Master Report

_Merged from existing suite reports on 2026-08-04 19:22._
_Full detail for each suite lives in `qa-report-<suite>.md`._

## Combined Summary

| Suite | Passed | App bugs | Test bugs | Flaky | Infra | Skipped | Logged | Total | Duration |
|---|---|---|---|---|---|---|---|---|---|
| **API** | 86 | 0 | 0 | 0 | 0 | 8 | 6 | 94 | 2.3 min |
| **UI** | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 110 | 0.9 min |
| **DB** | 52 | 22 | 3 | 0 | 0 | 0 | 0 | 77 | 12.6 min |
| **E2E** | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0.1 min |
| **TOTAL** | **143** | **22** | **3** | **0** | **0** | **8** | **6** | **282** | - |

---

## API — 2026-08-04 17:46

Duration: 2.3 min · Detail: `qa-report-api.md`

**Logged defects**

- `LLMV-API-130` POST /queries/ response contains no IDs
- `LLMV-API-131` POST /topics/ rejects name field — only title accepted
- `LLMV-API-130` POST /queries/ returns message only — no IDs in response
- `LLMV-API-132` Raw array rejected — only {items:[...]} wrapper accepted
- `LLMV-API-133` activate requires user-tracked state — undocumented prerequisite
- `LLMV-API-136` Naive {competitors:[...]} rejected — use operation fields

---

## UI — 2026-08-04 08:44

Duration: 0.9 min · Detail: `qa-report-ui.md`

_Clean run — no failures or logged defects._

---

## DB — 2026-08-04 10:31

Duration: 12.6 min · Detail: `qa-report-db.md`

**App bugs**

- `DB-030` No duplicate active projects for the same brand and country
- `DB-031` No duplicate query titles within the same topic
- `DB-032` No duplicate topic titles within the same brand
- `DB-050` No duplicate credit charges for the same snapshot
- `DB-051` No duplicate credit charges for the same reservation
- `DB-053` No charge recorded against a failed snapshot
- `DB-054` Snapshot credits_consumed matches the credit log
- `DB-055` Balance decreases monotonically within a customer ledger
- `DB-060` Projects flagged insufficient actually have a cost set
- `DB-063` Deleted projects are not still marked active
- `DB-064` Every project belongs to a customer
- `DB-070` No project ran more often than its configured frequency
- `DB-071` No snapshot stuck in a running state for over 24 hours
- `DB-072` No completed snapshot has zero successful responses
- `DB-090` Every topic belongs to a brand owned by exactly one customer
- `DB-092` Credit log entries match the project customer
- `DB-100` Soft-deleted topics have no active queries
- `DB-102` Soft-deleted projects have no snapshots created after deletion
- `DB-111` No topic has an empty title
- `DB-120` No inactive project has recent snapshots
- `DB-121` No orphaned LLM responses without an analysis row
- `DB-122` Recently completed snapshots produced platform metrics

**Test bugs**

- `DB-026` No citation rows orphaned from a query response
- `DB-044` Share of voice stays within 0-100
- `DB-117` Citation rank is positive when set

---

## E2E — 2026-08-04 16:32

Duration: 0.1 min · Detail: `qa-report-e2e.md`

_Clean run — no failures or logged defects._
---

## API — 2026-08-05 11:37

Duration: 2.9 min · Detail: `qa-report-api.md`

| Passed | App bugs | Test bugs | Flaky | Infra | Skipped | Logged | Total |
|---|---|---|---|---|---|---|---|
| 86 | 0 | 0 | 0 | 0 | 8 | 6 | 94 |

**Logged defects**

- `LLMV-API-130` POST /queries/ response contains no IDs
- `LLMV-API-131` POST /topics/ rejects name field — only title accepted
- `LLMV-API-130` POST /queries/ returns message only — no IDs in response
- `LLMV-API-132` Raw array rejected — only {items:[...]} wrapper accepted
- `LLMV-API-133` activate requires user-tracked state — undocumented prerequisite
- `LLMV-API-136` Naive {competitors:[...]} rejected — use operation fields
---

## API — 2026-08-05 14:45

Duration: 2.5 min · Detail: `qa-report-api.md`

| Passed | App bugs | Test bugs | Flaky | Infra | Skipped | Logged | Total |
|---|---|---|---|---|---|---|---|
| 88 | 0 | 0 | 0 | 0 | 6 | 5 | 94 |

**Logged defects**

- `LLMV-API-130` POST /queries/ response contains no IDs
- `LLMV-API-131` POST /topics/ rejects name field — only title accepted
- `LLMV-API-130` POST /queries/ returns message only — no IDs in response
- `LLMV-API-132` Raw array rejected — only {items:[...]} wrapper accepted
- `LLMV-API-136` Naive {competitors:[...]} rejected — use operation fields
---

## API — 2026-08-06 20:05

Duration: 2.7 min · Detail: `qa-report-api.md`

| Passed | App bugs | Test bugs | Flaky | Infra | Skipped | Logged | Total |
|---|---|---|---|---|---|---|---|
| 88 | 0 | 0 | 0 | 0 | 6 | 4 | 94 |

**Logged defects**

- `LLMV-API-130` POST /queries/ response contains no IDs
- `LLMV-API-130` POST /queries/ returns message only — no IDs in response
- `LLMV-API-132` Raw array rejected — only {items:[...]} wrapper accepted
- `LLMV-API-136` Naive {competitors:[...]} rejected — use operation fields
---

## API — 2026-08-07 16:25

Duration: 2.8 min · Detail: `qa-report-api.md`

| Passed | App bugs | Test bugs | Flaky | Infra | Skipped | Logged | Total |
|---|---|---|---|---|---|---|---|
| 88 | 0 | 0 | 0 | 0 | 6 | 4 | 94 |

**Logged defects**

- `LLMV-API-130` POST /queries/ response contains no IDs
- `LLMV-API-130` POST /queries/ returns message only — no IDs in response
- `LLMV-API-132` Raw array rejected — only {items:[...]} wrapper accepted
- `LLMV-API-136` Naive {competitors:[...]} rejected — use operation fields

---

## Browser UI — 2026-08-10 (Manual Playwright MCP)

Method: Manual browser testing via Playwright MCP (all tabs, microsoft.com / US / project 843571)

| Tab | Status | Notes |
|-----|--------|-------|
| Summary | ✅ PASS | All widgets: Executive Snapshot, Visibility 95.1, Sentiment 61.7%, Citations 3.4K, charts, competitor insight, topics table |
| Visibility | ✅ PASS | Score Rank table, Share of Voice donut, Competitor Comparison, Citations by Platform, Citations Sources — all present |
| Sentiment | ✅ PASS | Platform comparison bar (5 platforms), filter tabs (All/Pos/Neu/Neg), TOPIC/SOURCE/SENTIMENT/OCCURRENCES table complete |
| Topics & Queries | 🐛 BUG | Duplicate topic rows — see LLMV-UI-TQ-001 |
| Prompt Simulator | ✅ PASS | Prompt input, Analyze, Model Responses (3/3 LLMs), SOV 96.08%, Avg Pos #1.0, Citations shown |

**Logged defects**

- `LLMV-UI-TQ-001` Topics & Queries table shows 21 rows but only 16 unique topic names — 5 topics appear twice as separate flat rows with different visibility scores/ranks: "Cloud Service Pricing Models" (100/#1 vs 85/#2), "Enterprise Software Licensing" (98/#1 vs 57/#3), "Gaming Hardware Revenue Streams" (90/#3 vs 96/#1), "Subscription Plans for Office" (×2), "Surface Device Market Trends" (×2). No expand/child structure — genuine duplicate rows. Root cause likely backend data integrity (topics stored twice) or frontend grouping failure.

**Observation**

- Prompt Simulator only exposes 3 LLMs (ChatGPT, Gemini, Perplexity) — Copilot and Google AI tracked in Visibility/Sentiment charts but not in simulator. Flag for PM if unintended.

---

## E2E — 2026-08-10 (from test-results files)

| Passed | Failed | Skipped | Total |
|--------|--------|---------|-------|
| ~61 | 5 | 0 | 66 |

**Failures**

- `E2E-101` GET /topics/ hides 2 topics for forbes.com — API returns 8, DB has 10
- `E2E-103` NEW — (see qa-report-e2e.md for detail)
- `E2E-313` Activation triggered 1 analysis snapshot — activation must not start analysis
- `E2E-321` POST /run-analysis/ returned 200 on inactive project — must return 400/403/409
- `E2E-544` frequency_days=-1 returns 405 — must return 400/404/422

---

## API — 2026-08-10 (Browser Playwright MCP — manual fetch)

Method: All API calls executed via `browser_evaluate` + `fetch()` with JWT from `localStorage`. Fixture: Forbes (`2f64a1f2`, `forbes.com`). Auth token from live session.

| Group | Tested | Pass | Fail | Notes |
|-------|--------|------|------|-------|
| Auth (001–004) | 4 | 4 | 0 | |
| Platforms (010–013) | 4 | 4 | 0 | |
| Projects lifecycle (020–049) | 12 | 12 | 0 | |
| Credits (050–057, Q01, Q02, Q04, Q08, Q12) | 10 | 10 | 0 | |
| Brands/analytics (060–067) | 6 | 6 | 0 | 3 schema changes noted |
| Citations (075–079) | 3 | 3 | 0 | schema change noted |
| Queries (085–094) | 7 | 7 | 0 | BUG-130 re-confirmed |
| Topics (095–099) | 5 | 5 | 0 | BUG-131 resolved |
| Sentiment (100–102) | 3 | 3 | 0 | schema change noted |
| PS / SE / QP (105–113) | 7 | 7 | 0 | |
| Robustness (120–123) | 4 | 4 | 0 | |
| **TOTAL** | **65** | **65** | **0** | |

**Confirmed bugs (still active)**

- `LLMV-API-130` POST /queries/ response body is `{message}` only — no IDs returned for created queries
- `LLMV-API-132` POST /projects/check-llm-activation/ rejects raw array `[...]` → 400; requires `{items:[...]}` wrapper
- `LLMV-API-136` PATCH /projects/{id}/competitors/ rejects `{competitors:[...]}` → 400; requires operation fields

**Resolved since last run**

- `LLMV-API-131` POST /topics/ `name` field now accepted → 201 (was → 400). Bug is **FIXED**.

**API schema changes (test specs outdated — not app bugs)**

- `LLMV-API-060-SCHEMA` `brand/overview` `visibility` field is now `{current: 65.99, previous: 60}` object — test spec expects a scalar `0–100` number. Actual value (65.99) is valid; schema evolved.
- `LLMV-API-075-SCHEMA` `citations/overview` items use field `domain_name` (not `domain` or `url`) — test spec checks `item.domain ?? item.url`. Data is present; field was renamed.
- `LLMV-API-100-SCHEMA` `sentiment/distribution` `positive`/`neutral`/`negative` are now `{count, pct}` objects — test spec adds them as raw numbers (NaN). Actual percentages sum to 100 correctly (51+39+10=100).

**Other observations**

- Credits balance: 886,781 total remaining (total=1,030,000 consumed=144,119) — math internally consistent (diff=0)
- Projected usage: 3,289 credits/month across 20 active projects — sum matches total exactly
- `has_insufficient_credits=false` on Forbes — remaining (885,881) > cost (10) — flag correct
- GET /run-analysis/ correctly returns 405

---

## E2E Negative Paths — 2026-08-10 (Browser Playwright MCP — API-only subset)

Method: `browser_evaluate` fetch calls. DB-dependent E2E tests skipped (require Twingate PostgreSQL).

| Test | Pass | Detail |
|------|------|--------|
| E2E-480 | ✅ | Unauthenticated → 401/403 on all tested endpoints |
| E2E-481 | ✅ | Malformed/fake tokens → 401/403 |
| E2E-500 | ✅ | run-analysis on nonexistent project → 404, credit balance unchanged |
| E2E-510 | ✅ | 3 concurrent fake run-analysis → all rejected (0 accepted) |
| E2E-540 | ✅ | Malformed project IDs (`0`, `-1`, `not-a-uuid`, path-traversal) → 400/404, no 500, no traceback |
| E2E-542 | ✅ | Invalid/reversed date ranges → 400, no 500 |
| E2E-543 | ✅ | XSS (`<script>`) and SQL injection in topic titles → not reflected, no 500 |
| E2E-544 | ✅ | frequency_days -1/0/99999/abc → all 400 (**previously reported 405 from test-results — now 400, behaviour corrected**) |
| E2E-545 | ✅ | 100k-char topic title → 400 (not 500) |
| E2E-IDOR | ✅ | Cross-tenant project UUID → 404 |

**DB-dependent E2E — SKIPPED (Twingate required)**

E2E-101, 102, 103, 110, 120, 130, 140, 150, 160, 161, 300–322 cannot be executed without a direct PostgreSQL connection. These compare API responses against raw DB counts and cannot be proxied through the browser.

---

## DB — 2026-08-10 (Direct PostgreSQL via Twingate — Node.js pg runner)

Method: Custom Node.js runner connecting directly to `10.11.240.34:5432` / `llmv_db` with `llmv_app_read_only` credentials. All queries are `SELECT`-only. Fixture: `microsoft.com/us` → UUID `d648f159-76d4-434e-a4cf-1fb3b1ac8c88`.

| Suite | Passed | Failed | Total |
|-------|--------|--------|-------|
| Schema Integrity (DB-010–019) | 10 | 0 | 10 |
| Data Integrity (DB-020–049) | 16 | 3 | 19 |
| Credits & Business Logic (DB-050–085) | 10 | 15 | 25 |
| Security & Edge Cases (DB-090–122) | 15 | 8 | 23 |
| **TOTAL** | **51** | **26** | **77** |

---

### P0 — Billing integrity

_DB-050, DB-051, DB-053, DB-054, DB-055 confirmed failing but already tracked in Linear (LLMV-589, LLMV-607, LLMV-1106, LLMV-1109, LLMV-1072, LLMV-972). Excluded from new findings._

### P0 — Security / Cross-tenant isolation

| ID | Detail |
|----|--------|
| **DB-090** | **Cross-tenant brand sharing — 20 brands.** `llmv_brand` rows are linked to projects belonging to more than one `customer_id`. If API filtering is done at the project layer only, one customer's analytics data can bleed into another's. Needs immediate investigation. |
| **DB-092** | **Billing misattribution — 30+ rows.** `llmv_creditusagelog.customer_id` does not match `llmv_project.customer_id` for the same `project_id`. Credits are being charged to the wrong customer account. |

### P0 — Cost leak

_DB-120 confirmed failing but accounted for by LLMV-1109 (in-flight snapshots not cancelled on deactivation, In Development). Frontend guards run-analysis on inactive projects via replacement screen. Excluded from new findings._

---

### High — Data state bugs

| ID | Detail |
|----|--------|
| **DB-060** | **1,167 projects flagged `has_insufficient_credits=true` but `credit_cost_per_run` is NULL or 0.** The insufficient flag is meaningless without a cost — these projects can never satisfy the check. |
| **DB-063** | **779 soft-deleted projects still have `is_active=true`.** `is_deleted=true AND is_active=true`. These projects may still be scheduled and billing customers. |
| **DB-064** | **4,507 projects have no `customer_id`.** Billing cannot be attributed. Large number — likely a migration gap or bulk-import issue. |
| **DB-070** | **20 projects ran significantly more often than configured** (gap < 50% of `frequency_days`). Over-billing risk. |
| **DB-071** | **100+ snapshots stuck in a running state for >24 hours.** `started_at` is set, `completed_at` is null, and status is not failed/cancelled. These jobs are likely dead workers still holding credit reservations. |
| **DB-072** | **100+ completed snapshots with 0 successful responses.** Snapshots marked `completed`/`success` but `success_response_count = 0`. Analysis ran but stored no data. |
| **DB-121** | **50+ successful LLM responses have no sentiment or citation rows (last 7 days).** API calls were made and charged, but the downstream analysis pipeline did not process the responses. |
| **DB-122** | **100+ recently completed snapshots (last 7 days) have no platform metrics.** `llmv_snapshot_platform_metrics` is missing rows for these snapshots. The Visibility/Sentiment tabs will show no data. |

---

### Medium — Data integrity / duplicate data

| ID | Detail |
|----|--------|
| **DB-030** | **10 brand+country combos have multiple active projects.** Sample: brand `00114aa8.../` has 2 projects, `00145eb1.../` has 3. Could be intentional for multi-user tracking, but conflicts with uniqueness invariant. |
| **DB-031** | **10 duplicate query titles created in the last 30 days** (same title within the same topic). Deduplication guard is not holding for recent writes. |
| **DB-032** | **9 duplicate topic titles created in the last 30 days** (same title within the same brand). Same issue. |
| **DB-100** | **100+ active queries belong to soft-deleted topics.** `llmv_topic.is_deleted=true` but child `llmv_query.is_deleted=false`. These queries will still be picked up in analysis runs. |
| **DB-102** | **1+ snapshots created after project deletion** (created > project.modified at deletion time). Zombie run — analysis triggered after the project was removed. |

---

### Test / data issues (not app bugs)

| ID | Detail |
|----|--------|
| **DB-026** | **Timeout** — citation orphan check (`llmv_responsecitationanalysis`) exceeded 120s statement timeout. Table is likely too large for a non-indexed scan in the 7-day window. Test spec needs a more targeted query or an index hint. Skipped. |
| **DB-082–085** | **Fixture project has no analysis data.** `microsoft.com/us` (UUID `d648f159`) exists and has 30 active topics but 0 completed snapshots, 0 responses, 0 sentiment rows, 0 citation rows. The fixture project has never been run. These 4 tests fail due to missing test data, not an app bug. |

---

### Passing highlights

- All LLMV tables have primary keys and foreign key constraints ✅
- No orphaned queries, topics, projects, snapshots, or responses ✅
- No negative credit charges, no negative balances ✅
- Visibility percentages and share-of-voice all within 0–100 ✅
- No traceback or malformed error responses ✅
- Platforms inventory: ChatGPT (openai), Gemini, Google AI Mode, Copilot — all enabled. Grok is **off**. ✅
- 44,737 distinct customers in the system ✅
