# MalkaQA — LLMV Fresh QA Report
**Generated:** 2026-08-20  
**Environment:** production (`dashboard.searchatlas.com` + `llmvis.searchatlas.com`)  
**Fixture project:** nike.com / US — project ID `853169`, UUID `54c6d8a5-b540-494a-88ea-2b7bf2eb4dc4`  
**Method:** Playwright MCP headed browser (browser_snapshot banned; verification via browser_evaluate DOM only)  
**Instruction:** Run fresh — no reliance on qa-report-master.md

---

## Overall Summary

| Suite | Total | ✅ Pass | 🔴 Fail | ⚠️ Inconclusive | ⏭️ Skip/Blocked |
|---|---|---|---|---|---|
| UI Smoke (140 cases) | 140 | 137 | 1 | 2 | 0 |
| API (106 cases) | 106 | 72 | 1 | 4 | 29 |
| DB (63 cases) | 63 | — | — | — | 63 (Twingate) |
| **Combined** | **309** | **209** | **2** | **6** | **92** |

---

## 🔴 Active Bugs Found This Run

### BUG-UI-116 — Date range filter resets on tab switch
- **Test:** SMKT-LLMV-116  
- **Severity:** Medium  
- **Observation:** Date range filter selection is lost when switching between Summary/Visibility/Sentiment/Topics tabs. Tabs use full `<a href="...">` anchor navigation which triggers a full page state reset, discarding the selected date range.  
- **Expected:** Filter state persists across tab switches.  
- **Impact:** Users must re-select date range on every tab switch.

### BUG-API-132 — `check-llm-activation` raw array body causes network-level failure
- **Test:** LLMV-API-132  
- **Severity:** Low  
- **Observation:** POST `/api/v1/projects/check-llm-activation/` with a raw JSON array body (`[{...}]`) causes a network-level failure (no response). Only `{items:[...]}` wrapper format works. Single-dict format returns 400 `"items: required"`.  
- **Expected per suite spec:** Raw array should return 400 `"Expected a dictionary, but got list."` (not crash/no-response).  
- **Impact:** API consumers sending a raw array get a connection error rather than a descriptive 400.

---

## ✅ Previously Reported Bugs Now FIXED

| Bug ID | Description | Verified Fixed |
|---|---|---|
| FIND-009 / API-042 | `POST /projects/` returned `project_id` instead of `id`; `GET /projects/{id}/` now correctly returns `id` field | ✅ 2026-08-20 |
| FIND-010 / API-094 | `GET /queries/` required redundant `domain` param even when `project_id` provided | ✅ 2026-08-20 — now works with `project_id` alone |
| FIND-010 / API-099 | `GET /topics/` required redundant `domain` param even when `project_id` provided | ✅ 2026-08-20 — now works with `project_id` alone |
| FIND-013 / API-093 | `responses/retrieve/` platform filter was ignored — returned all platforms regardless | ✅ 2026-08-20 — `platform=openai` now returns 1 result only |
| API-130 | `POST /queries/` response omitted created IDs (returned message-only) | ✅ 2026-08-20 — response now includes `queries:[{id, title, topic_id, query_type}]` |
| API-131 | `POST /topics/` rejected `name` field — only accepted `title` | ✅ 2026-08-20 — `name` field now accepted and silently aliased to `title` |
| API-134 | Brand trend endpoints ignored `start_date`/`end_date` — returned full history regardless | ✅ 2026-08-20 — pre-snapshot and future date ranges now return 0 results correctly |

---

## Suite A — API (Fresh Results 2026-08-20)

### Section 0: Cross-Cutting Auth
| Test | Result | Notes |
|---|---|---|
| API-001: No auth → 401 | ✅ PASS | All sampled endpoints return 401 |
| API-002: Invalid token → 401 | ✅ PASS | `Bearer INVALID.TOKEN.HERE` → 401 |
| API-003: IDOR cross-tenant | ⏭️ SKIP | Requires second test account |
| API-004: OpenAPI schema served | ✅ PASS | 200, `application/vnd.oai.openapi` content-type |

### Section 1: Platforms
| Test | Result | Notes |
|---|---|---|
| API-010: List platforms | ✅ PASS | 5 platforms: copilot, gemini, google_ai_mode, openai, perplexity — all `enabled=true`, `status="normal"` |
| API-011: Platform detail per code | ✅ PASS | All 5 codes return 200; status matches list data |
| API-012: Invalid platform code → 404 | ✅ PASS | `not-a-platform` → 404; `CHATGPT%20` → 404; clean error, no 500 |
| API-013: Available platforms for project | ✅ PASS | Valid project → 5 platforms; nonexistent project UUID → 404 |
| API-014: Platform notifications | ✅ PASS | 200, empty array (no degraded platforms) |

### Section 2: Projects — Lifecycle
| Test | Result | Notes |
|---|---|---|
| API-020–030: Create/track/activate/delete lifecycle | ⏭️ SKIP | Would create/modify real projects |
| API-031–032: run-analysis | ⏭️ SKIP | Consumes real UC |
| API-033: PATCH frequency | ⏭️ SKIP | Modifies project state |
| API-034: GET project settings | ✅ PASS | `credits_total=1,030,000`, `credits_consumed=288,762`, `credits_remaining=741,238`; math correct |
| API-036: check-existence | ✅ PASS | Per-item flags correct; nike.com=true, nonexistent=false |
| API-037: check-llm-activation | ✅ PASS | `{items:[...]}` wrapper → 200; correct `is_llm_activated=true` for nike.com |
| API-040–041: Track platform field validation | ⏭️ SKIP | Needs system-tracked project |
| API-042: POST /projects/ response structure | ✅ PASS (BUG FIXED) | GET /projects/{id}/ correctly returns `id` field |

### Section 3: Credits
| Test | Result | Notes |
|---|---|---|
| API-050: credits/summary | ✅ PASS | balance=741,238; `credit_system_enabled=true`; all non-negative |
| API-051: estimate + run-analysis | ⏭️ SKIP | Consumes UC |
| API-052–053: Phantom deduction + history | ⏭️ SKIP / ✅ PARTIAL | credit-usage endpoint accessible; ledger reconciles |
| API-056: Estimate invalid inputs → 400 | ✅ PASS | Missing fields → 400 with field-level errors, not 500 |
| API-057: Estimate is read-only | ✅ PASS | 3 calls → balance unchanged (741,238 before = 741,238 after) |

### Section 3b: Quota Consistency
| Test | Result | Notes |
|---|---|---|
| API-Q01: Projected credits math | ✅ PASS | Sum of per-project credits = `total_projected_monthly_credits` (3,512 = 3,512 exact) |
| API-Q02: Settings credit ledger | ✅ PASS | `1,030,000 − 288,762 = 741,238` exact; `credits_remaining ≥ 0` |
| API-Q03: `credit_cost_per_run` consistent | ✅ PASS | nike.com: cost=5 in both projected-usage and settings |
| API-Q04: `has_insufficient_credits` flag | ✅ PASS | `false` (741,238 ≥ 5); derived flag matches actual |
| API-Q05: Frequency→refreshes mapping | ✅ PASS | 1-day→30, 7-day→4, 30-day→1, 3-day→10; all valid calendar ranges |
| API-Q06: Zero-cost projects | ✅ PASS | 9 projects with `credit_cost_per_run=0`, `projected_monthly_credits=0` |
| API-Q07: Non-LLM-activated excluded from projected-usage | ✅ PASS | projected-usage has 26 of 51 total projects |
| API-Q08: GET /run-analysis/ → 405 | ✅ PASS | 405 `"Method GET not allowed"` — no analysis, no credits charged |
| API-Q09: Cost scales with platform count | ⚠️ PARTIAL | Observable range (0–2,145 UC); no cross-project platform_count data |
| API-Q10: Total projected ≤ plan allocation | ✅ PASS | 3,512 ≪ 1,030,000; no overcommit |
| API-Q12: `credit_cost_per_run` never negative | ✅ PASS | All 26 projects: 0 or positive |
| API-Q13: settings `query_count` = user-created only | ✅ PASS | `query_count=1` = 1 user-created query of 13 total |

### Section 4: Brand Analytics
| Test | Result | Notes |
|---|---|---|
| API-060: brand/overview | ✅ PASS | visibility=62.424, sentiment=73.1, citations=3,449; all in valid ranges |
| API-061: visibility-trend | ✅ PASS | 4 snapshots Aug 11→20; chronological; all values 0–100 |
| API-062: mentions-trend | ✅ PASS | 4 snapshots; timestamps identical to visibility-trend (axis aligned) |
| API-063: sentiment-trend | ✅ PASS | 4 snapshots; per-platform values in valid range |
| API-064: competitor-visibility-rank | ✅ PASS | Own brand highest (62.424); competitors in monotonically decreasing order |
| API-065: competitor-shared-voice-rank | ✅ PASS | Shares 0–100; ordered descending |
| API-066: competitor-visibility-trend | ✅ PASS | 200; data object with trend series |
| API-067: domain-queries + domain-topics | ✅ PASS | 8 queries, 4 topics; valid metrics |
| API-069: brand/topics + brand/queries | ✅ PASS | topics count=5; queries count=13 |

### Section 5: Citations
| Test | Result | Notes |
|---|---|---|
| API-075: citations/overview | ✅ PASS | 10 domains; valid structure |
| API-076: citations/urls | ✅ PASS | 10 URLs for nike.com; valid fields |
| API-077: citations/platforms | ✅ PASS | All 5 project platforms present; shares sum ≈96% |
| API-078–079: citations/queries, url-platforms, url-queries | ⚠️ NOT TESTED | Time constraint |

### Section 6: Queries — CRUD & Analytics
| Test | Result | Notes |
|---|---|---|
| API-085: queries list pagination | ✅ PASS | 10+4=14 total; no duplicates across pages |
| API-086: POST /queries/ | ✅ PASS (BUG FIXED) | 201 with `queries:[{id,...}]`; IDs now returned |
| API-088: DELETE user-created query | ✅ PASS | 204; verified via cleanup |
| API-090: queries/overview | ✅ PASS | 10 queries; rank, visibility 0–100, share_of_voice present |
| API-092: queries/available-dates | ✅ PASS | Returns `snapshot_id` UUIDs + timestamps; 15 snapshots for test query |
| API-093: responses/retrieve (happy path) | ✅ PASS (BUG FIXED) | Platform filter now works: `platform=openai` → 1 result; without filter → 5 |
| API-093: date param without snapshot_id | ✅ PASS | 400 `"snapshot_id required (or provide 'timestamp')"` |
| API-094: GET /queries/ project_id-only | ✅ PASS (BUG FIXED) | Returns 200 without `domain` param |

### Section 7: Topics — CRUD & Analytics
| Test | Result | Notes |
|---|---|---|
| API-095: POST /topics/ (name field) | ✅ PASS (BUG FIXED) | `{name:'...'}` now accepted; aliased to `title` in response |
| API-096: DELETE user-created topic | ✅ PASS | 204; verified via cleanup |
| API-098: topics/overview + unanalyzed | ✅ PASS | 4 topics in overview; 0 unanalyzed (all have been run) |
| API-099: GET /topics/ project_id-only | ✅ PASS (BUG FIXED) | Returns 200 without `domain` param |

### Section 8: Sentiment
| Test | Result | Notes |
|---|---|---|
| API-100: sentiment/distribution | ✅ PASS | positive=90%, neutral=9%, negative=1%; sum=100%; all non-negative |
| API-101: sentiment/overview | ✅ PASS | 4 topics; sentiment_score present and valid |
| API-102: sentiment/topics-by-category | ✅ PASS | 4 topics in `positive`; 0 in neutral/negative; mutually exclusive grouping |

### Section 9: PS Prompt Analysis
| Test | Result | Notes |
|---|---|---|
| API-105–108 | ⏭️ SKIP | Creates PS analyses, consumes UC |

### Section 10: QP & SE Integrations
| Test | Result | Notes |
|---|---|---|
| API-110: qp/total-brand-mentions | ✅ PASS | current=1,697; previous=1,652; both non-negative |
| API-111: se/analysis-status | ✅ PASS | status="Success"; all 5 platforms completed |
| API-112: se/llm-visibility table | ✅ PASS | 200; per-query rows with visibility_score, brand_rank, citation_share |

### Section 11: Robustness & Limits
| Test | Result | Notes |
|---|---|---|
| API-120: Rate limiting | ✅ PASS | 10 rapid GET requests → all 200; no 429; service stable |
| API-121: Malformed IDs | ✅ PASS | 0, -1, abc, zero-UUID, SQL metacharacters → all 404; no 500 |
| API-122: Large date ranges + extreme pagination | ✅ PASS | 5-year range → 200; page=99999 → 404; page_size=0 → 400 |
| API-123: Response header hygiene | ✅ PASS | `Content-Type: application/json`; server header not exposed |

### Section 12: Discovered API Behaviors
| Test | Result | Notes |
|---|---|---|
| API-130: POST /queries/ returns IDs | ✅ PASS (BUG FIXED) | Response now includes `queries:[{id,...}]` |
| API-131: POST /topics/ accepts `name` field | ✅ PASS (BUG FIXED) | `name` field now accepted |
| API-132: check-llm-activation format | 🔴 STILL BUG | Raw array → network failure; single dict → 400; only `{items:[...]}` works |
| API-134: Brand trend date range filtering | ✅ PASS (BUG FIXED) | Past range → 0 results; future range → 0 results; now filters correctly |

---

## Suite B — UI Smoke (2026-08-20)

**Fixture:** nike.com / US, project 853169, 13 queries, 4 analyzed snapshots  
**Method:** Playwright MCP headed browser, DOM verification via browser_evaluate only  
**Sections tested:** 1–18 (IDs 001–140)

### Summary
- **137 PASS** — all navigation, filter interactions, graph rendering, CRUD flows, settings modal, prompt simulator, credit metering, export/import
- **1 FAIL** — SMKT-LLMV-116 (date range filter resets on tab switch)
- **2 INCONCLUSIVE** — SMKT-LLMV-117, SMKT-LLMV-118 (platform dropdown in Visibility tab; Radix UI popover not openable via JS in test context)

### Key FAIL Detail
**SMKT-LLMV-116 — Date range filter not preserved across tab switches**  
- Date range filter selected in Summary tab is discarded when navigating to Visibility/Sentiment/Topics tabs.  
- Root cause: tabs are full `<a href="...">` anchor links, not React state-managed tabs — each click triggers a hard navigation resetting all filter state.  
- Expected: Filter state persists within the LLMV page session (as per UX spec).

---

## Suite DB — Status

**BLOCKED** — Twingate VPN required to resolve `postgres-llmv`; VPN was not active during this run. All 63 DB validation cases remain untested.

---

## Data Snapshot (nike.com project at time of testing)

| Metric | Value |
|---|---|
| Account UC balance | 741,238 / 1,030,000 |
| Visibility score (last scan) | 62.424% |
| Overall sentiment | 73.1% positive |
| Total citations | 3,449 |
| Analysis snapshots | 4 (Aug 11, 18, 19, 20 2026) |
| Last analysis | 2026-08-20 10:46 UTC |
| Active platforms | 5 (all: ChatGPT, Gemini, Google AI Mode, Perplexity, Copilot) |
| Topics | 5 active |
| Queries | 13 total (1 user-created, 12 auto-generated) |
