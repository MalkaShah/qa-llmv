# MalkaQA — LLMV Test Report (DB)

**Suite:** DB  
**Generated:** 2026-08-04T10:31:01.916Z  
**Duration:** 12.6 min  
**Environment:** production (`dashboard.searchatlas.com`)  
**Fixture project:** microsoft.com / US (id 843571)

## Summary

| Result | Count |
|---|---|
| ✅ Passed | 52 |
| 🔴 App bugs | 22 |
| 🟡 Test bugs | 3 |
| 🔁 Flaky | 0 |
| ⚙️ Infra | 0 |
| ⏭️ Skipped | 0 |
| 📋 Logged defects | 0 |
| **Total** | **77** |

---

# 🔴 App Bugs

_The application is broken. File these as defects._

## DB-030 — No duplicate active projects for the same brand and country

**Severity:** P1  
**Tab:** Database  
**Spec file:** `02-data-integrity.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 10 offending row(s). 10 brand+country combos have duplicate active projects

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `02-data-integrity.spec.ts` for case DB-030
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 10 brand+country combos have duplicate active projects
Expected: 0
Received: 10
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-030` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-031 — No duplicate query titles within the same topic

**Severity:** P1  
**Tab:** Database  
**Spec file:** `02-data-integrity.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 10 offending row(s). 10 topics contain duplicate query titles

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `02-data-integrity.spec.ts` for case DB-031
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 10 topics contain duplicate query titles
Expected: 0
Received: 10
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-031` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-032 — No duplicate topic titles within the same brand

**Severity:** P1  
**Tab:** Database  
**Spec file:** `02-data-integrity.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 10 offending row(s). 10 brands contain duplicate topic titles

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `02-data-integrity.spec.ts` for case DB-032
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 10 brands contain duplicate topic titles
Expected: 0
Received: 10
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-032` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-050 — No duplicate credit charges for the same snapshot

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 20 offending row(s). 20 snapshots were charged more than once — DOUBLE BILLING

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-050
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 20 snapshots were charged more than once — DOUBLE BILLING
Expected: 0
Received: 20
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-050` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-051 — No duplicate credit charges for the same reservation

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 1 offending row(s). 1 reservations produced more than one charge — DOUBLE BILLING

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-051
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 1 reservations produced more than one charge — DOUBLE BILLING
Expected: 0
Received: 1
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-051` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-053 — No charge recorded against a failed snapshot

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 100 offending row(s). 100 charges were made for snapshots that failed — customers billed for nothing

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-053
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 100 charges were made for snapshots that failed — customers billed for nothing
Expected: 0
Received: 100
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-053` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-054 — Snapshot credits_consumed matches the credit log

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 20 offending row(s). 20 snapshots disagree with the credit log on amount charged

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-054
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 20 snapshots disagree with the credit log on amount charged
Expected: 0
Received: 20
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-054` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-055 — Balance decreases monotonically within a customer ledger

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 20 offending row(s). 20 ledger entries show the balance increasing on a charge

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-055
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 20 ledger entries show the balance increasing on a charge
Expected: 0
Received: 20
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-055` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-060 — Projects flagged insufficient actually have a cost set

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 1063 offending row(s). 1063 projects are flagged insufficient but have no per-run cost

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-060
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 1063 projects are flagged insufficient but have no per-run cost
Expected: 0
Received: 1063
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-060` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-063 — Deleted projects are not still marked active

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 690 offending row(s). 690 projects are soft-deleted but still active — they may still consume credits

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-063
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 690 projects are soft-deleted but still active — they may still consume credits
Expected: 0
Received: 690
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-063` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-064 — Every project belongs to a customer

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 4507 offending row(s). 4507 projects have no customer_id — billing cannot be attributed

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-064
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 4507 projects have no customer_id — billing cannot be attributed
Expected: 0
Received: 4507
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-064` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-070 — No project ran more often than its configured frequency

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 20 offending row(s). 20 projects ran significantly more often than configured — over-billing risk

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-070
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 20 projects ran significantly more often than configured — over-billing risk
Expected: 0
Received: 20
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-070` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-071 — No snapshot stuck in a running state for over 24 hours

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 100 offending row(s). 100 snapshots have been running for over 24 hours — likely stuck jobs holding credits

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-071
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 100 snapshots have been running for over 24 hours — likely stuck jobs holding credits
Expected: 0
Received: 100
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-071` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-072 — No completed snapshot has zero successful responses

**Severity:** P1  
**Tab:** Database  
**Spec file:** `03-credits-business-logic.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 100 offending row(s). 100 snapshots are marked complete but returned no successful responses

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `03-credits-business-logic.spec.ts` for case DB-072
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 100 snapshots are marked complete but returned no successful responses
Expected: 0
Received: 100
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-072` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-090 — Every topic belongs to a brand owned by exactly one customer

**Severity:** P1  
**Tab:** Database  
**Spec file:** `04-security-edge-cases.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 20 offending row(s). 20 brands are shared across multiple customers — CROSS-TENANT LEAK

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `04-security-edge-cases.spec.ts` for case DB-090
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 20 brands are shared across multiple customers — CROSS-TENANT LEAK
Expected: 0
Received: 20
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-090` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-092 — Credit log entries match the project customer

**Severity:** P1  
**Tab:** Database  
**Spec file:** `04-security-edge-cases.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 11 offending row(s). 11 credit charges are attributed to the wrong customer — BILLING LEAK

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `04-security-edge-cases.spec.ts` for case DB-092
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 11 credit charges are attributed to the wrong customer — BILLING LEAK
Expected: 0
Received: 11
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-092` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-100 — Soft-deleted topics have no active queries

**Severity:** P1  
**Tab:** Database  
**Spec file:** `04-security-edge-cases.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 100 offending row(s). 100 active queries belong to a deleted topic — they will still be analysed and billed

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `04-security-edge-cases.spec.ts` for case DB-100
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 100 active queries belong to a deleted topic — they will still be analysed and billed
Expected: 0
Received: 100
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-100` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-102 — Soft-deleted projects have no snapshots created after deletion

**Severity:** P1  
**Tab:** Database  
**Spec file:** `04-security-edge-cases.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 1 offending row(s). 1 snapshots were created after their project was deleted — zombie runs

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `04-security-edge-cases.spec.ts` for case DB-102
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 1 snapshots were created after their project was deleted — zombie runs
Expected: 0
Received: 1
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-102` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-111 — No topic has an empty title

**Severity:** P1  
**Tab:** Database  
**Spec file:** `04-security-edge-cases.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 1 offending row(s). 1 active topics have an empty title

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `04-security-edge-cases.spec.ts` for case DB-111
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 1 active topics have an empty title
Expected: 0
Received: 1
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-111` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-120 — No inactive project has recent snapshots

**Severity:** P1  
**Tab:** Database  
**Spec file:** `04-security-edge-cases.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 100 offending row(s). 100 snapshots ran in the last 30 days for projects that are inactive — COST LEAK

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `04-security-edge-cases.spec.ts` for case DB-120
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 100 snapshots ran in the last 30 days for projects that are inactive — COST LEAK
Expected: 0
Received: 100
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-120` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-121 — No orphaned LLM responses without an analysis row

**Severity:** P1  
**Tab:** Database  
**Spec file:** `04-security-edge-cases.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 50 offending row(s). 50 successful LLM responses have no sentiment or citation analysis — paid for, never used

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `04-security-edge-cases.spec.ts` for case DB-121
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 50 successful LLM responses have no sentiment or citation analysis — paid for, never used
Expected: 0
Received: 50
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-121` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-122 — Recently completed snapshots produced platform metrics

**Severity:** P1  
**Tab:** Database  
**Spec file:** `04-security-edge-cases.spec.ts`  
**Classification:** Assertion failed

### Description

A data-integrity check against `llmv_db` returned 100 offending row(s). 100+ recently completed snapshots produced no platform metrics — analysis ran but stored nothing

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `04-security-edge-cases.spec.ts` for case DB-122
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
Error: 100+ recently completed snapshots produced no platform metrics — analysis ran but stored nothing
Expected: 0
Received: 100
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-122` passes on a clean run with no retries
- No regression in other tests on the Database tab

---

# 🟡 Test Bugs

_The test is incorrect. Fix the spec, not the app._

## DB-026 — No citation rows orphaned from a query response

**Severity:** P2  
**Tab:** Database  
**Spec file:** `02-data-integrity.spec.ts`  
**Classification:** Query too slow — needs narrowing, result unknown

### Description

The verification query for this case did not complete within the timeout. This is usually a query-performance problem on a large table rather than a data defect — the check needs narrowing before the result can be trusted.

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `02-data-integrity.spec.ts` for case DB-026
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
error: canceling statement due to statement timeout
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-026` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-044 — Share of voice stays within 0-100

**Severity:** P2  
**Tab:** Database  
**Spec file:** `02-data-integrity.spec.ts`  
**Classification:** Query too slow — needs narrowing, result unknown

### Description

The verification query for this case did not complete within the timeout. This is usually a query-performance problem on a large table rather than a data defect — the check needs narrowing before the result can be trusted.

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `02-data-integrity.spec.ts` for case DB-044
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
error: canceling statement due to statement timeout
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-044` passes on a clean run with no retries
- No regression in other tests on the Database tab

## DB-117 — Citation rank is positive when set

**Severity:** P2  
**Tab:** Database  
**Spec file:** `04-security-edge-cases.spec.ts`  
**Classification:** Query too slow — needs narrowing, result unknown

### Description

The verification query for this case did not complete within the timeout. This is usually a query-performance problem on a large table rather than a data defect — the check needs narrowing before the result can be trusted.

### Steps to Reproduce

1. Connect to Twingate (postgres-llmv must resolve)
2. Connect to the llmv_db database with the read-only account
3. Run the query defined in `04-security-edge-cases.spec.ts` for case DB-117
4. Compare the returned row count against the expected value below

### Expected Result

The query returns zero offending rows.

### Actual Result

```
error: canceling statement due to statement timeout
```

### Acceptance Criteria

- The query returns zero offending rows.
- `DB-117` passes on a clean run with no retries
- No regression in other tests on the Database tab

---

# Rerun Commands

**App bugs (verify after fix ships):**
```bash
npx playwright test --workers=1 -g "DB-030|DB-031|DB-032|DB-050|DB-051|DB-053|DB-054|DB-055|DB-060|DB-063|DB-064|DB-070|DB-071|DB-072|DB-090|DB-092|DB-100|DB-102|DB-111|DB-120|DB-121|DB-122"
```

**Test bugs (after fixing specs):**
```bash
npx playwright test --workers=1 -g "DB-026|DB-044|DB-117"
```

**Full suite:**
```bash
npx playwright test --workers=1
```
