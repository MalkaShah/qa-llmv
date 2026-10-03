# MalkaQA — LLMV Test Report (API)

**Suite:** API  
**Generated:** 2026-08-07T16:25:11.069Z  
**Duration:** 2.8 min  
**Environment:** production (`dashboard.searchatlas.com`)  
**Fixture project:** microsoft.com / US (id 843571)

## Summary

| Result | Count |
|---|---|
| ✅ Passed | 88 |
| 🔴 App bugs | 0 |
| 🟡 Test bugs | 0 |
| 🔁 Flaky | 0 |
| ⚙️ Infra | 0 |
| ⏭️ Skipped | 6 |
| 📋 Logged defects | 4 |
| **Total** | **94** |

---

# 📋 Logged Defects

_These tests passed, but a known defect was detected and logged during the run._
_The test tolerates the current behaviour; the defect still needs a fix._

| Defect ID | Description |
|---|---|
| `LLMV-API-130` | POST /queries/ response contains no IDs |
| `LLMV-API-130` | POST /queries/ returns message only — no IDs in response |
| `LLMV-API-132` | Raw array rejected — only {items:[...]} wrapper accepted |
| `LLMV-API-136` | Naive {competitors:[...]} rejected — use operation fields |

---

# Rerun Commands

**Full suite:**
```bash
npx playwright test --workers=1
```
