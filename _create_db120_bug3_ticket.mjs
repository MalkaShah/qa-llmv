const LINEAR_API_KEY = '';
const TEAM_ID = '7c254d88-f9b5-4875-a722-9e2cee57bca4';

const description = `## What Is Happening

When a user deactivates a project (via \`POST /v1/projects/{id}/deactivate/\` or the UI settings drawer), any analysis snapshot that is already running at that moment continues to completion and commits the full credit charge. The deactivation only flips \`is_active=False\` — it does not stop in-progress Celery workers or cancel in-flight snapshots.

The same gap exists in the OTTO batch-deactivation path (\`_handle_otto_removal\` in \`otto.py:57-72\`), which deactivates up to 19 projects at once when a customer exceeds plan quota.

## Root Cause

**\`project.py:1459-1491\` — entire deactivate() body:**
\`\`\`python
def deactivate(self, request, pk=None):
    project.is_active = False
    project.save(update_fields=["is_active"])
    sync_project_quota_usage(request.user)
    return Response(...)
\`\`\`
No snapshot lookup. No Celery task revocation. In-flight workers are unaffected.

**\`otto.py:57-72\` — OTTO batch deactivation:**
\`\`\`python
project.is_user_tracked = False
project.is_active = False
project.next_run_at = None
project.save(...)
# no in-flight snapshot check
\`\`\`

**\`run_visibility_pipeline\` (pipeline.py:61)** runs entirely at the snapshot level and never re-checks \`project.is_active\` during execution. Once dispatched, it runs to completion regardless of project state.

## Production DB Evidence

**30-day window — snapshots completing under inactive projects:**
| Trigger | Snapshots | Succeeded | Credits Burned |
|---|---|---|---|
| track | 91 | 87 | 300 |
| scheduled | 83 | 83 | 42 |
| manual | 7 | 7 | 0 |
| **Total** | **181** | **177** | **342** |

All 181 snapshots were created while the project was still active — the credit charge happened during the window between the run starting and the project being deactivated.

**OTTO batch deactivation pattern (same-hour batches, last 30 days):**
| Hour (UTC) | Projects deactivated |
|---|---|
| 08-05 06 | 19 |
| 07-10 09 | 12 |
| 07-09 14 | 8 |
| 07-14 05 | 8 |

When 19 projects are deactivated simultaneously, the probability that at least one has an in-flight snapshot is significant.

**Live monitoring query** (returns snapshots that will complete and charge despite inactive project):
\`\`\`sql
SELECT s.status, count(*)
FROM llmv_analysissnapshot s
JOIN llmv_project p ON p.id = s.project_id
WHERE s.status IN (
  'gathering_responses','brand_research','generating_topics',
  'generating_queries','gathering_brand_info','pending'
)
  AND s.is_deleted = false
  AND p.is_active = false
  AND p.is_deleted = false
GROUP BY s.status;
\`\`\`

## User Impact

- UI deactivation confirm text says *"pause all scheduled scans"* — this promise is broken for any in-flight run
- User clicks Deactivate, project shows inactive, credits still consumed — no indication in UI
- OTTO cascade deactivates silently (no user notification) — user may not even know a deactivation occurred
- **342 credits burned** against inactive projects in the last 30 days, confirmed from production DB

## How to Reproduce

1. Go to a tracked project in the UI
2. Click **Run Analysis** (trigger a manual run)
3. Wait until status shows \`Gathering Responses\` or \`Brand Research\`
4. Open settings → click **Deactivate AI Visibility** → confirm
5. Project shows as inactive immediately
6. Wait for analysis to complete
7. Check credit balance — credits consumed after deactivation

**Verification query after test:**
\`\`\`sql
SELECT s.id::text, s.status, s.credits_consumed,
  to_char(s.completed_at, 'MM-DD HH24:MI') completed,
  to_char(p.modified, 'MM-DD HH24:MI') deactivated_at,
  p.is_active
FROM llmv_analysissnapshot s
JOIN llmv_project p ON p.id = s.project_id
WHERE p.is_active = false
  AND s.credits_consumed > 0
  AND s.created >= now() - interval '1 day'
ORDER BY s.created DESC;
\`\`\`

## Proposed Fix

Inside \`deactivate()\` and \`_handle_otto_removal()\`, before saving \`is_active=False\`, mark all in-flight snapshots as failed:

\`\`\`python
from llmv.models.snapshots import ACTIVE_ANALYSIS_STATUSES, SnapshotStatus

AnalysisSnapshot.objects.filter(
    project=project,
    status__in=ACTIVE_ANALYSIS_STATUSES,
    is_deleted=False,
).update(
    status=SnapshotStatus.FAILED,
    completed_at=timezone.now(),
)
\`\`\`

Marking the snapshot \`FAILED\` before the Celery worker reaches \`finalize_project_analysis\` prevents \`_commit_credits_for_snapshot\` from being called (it is only invoked from the success path). For workers already past that gate, the CAS guard at \`pipeline.py:1029\` (\`credits_consumed=0\` check) prevents double-commit.

Long-term: store Celery task ID on the snapshot row and call \`celery.control.revoke()\` at deactivation time to fully stop in-progress workers.

## Acceptance Criteria

- [ ] Triggering \`deactivate()\` while an analysis is in \`ACTIVE_ANALYSIS_STATUSES\` marks those snapshots as \`failed\` before returning
- [ ] \`_handle_otto_removal()\` applies the same cancellation before setting \`is_active=False\`
- [ ] No credits committed for snapshots cancelled by deactivation
- [ ] Live monitoring query returns 0 after fix is deployed
- [ ] Unit test: deactivating a project with an active snapshot results in that snapshot being \`failed\` with \`credits_consumed=0\``;

const mutation = `
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        title
        url
      }
    }
  }
`;

const variables = {
  input: {
    teamId: TEAM_ID,
    title: "deactivate() does not cancel in-flight snapshots — credits consumed post-deactivation",
    description,
    priority: 1, // urgent
    labelIds: [],
  },
};

const res = await fetch('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Authorization': LINEAR_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: mutation, variables }),
});

const data = await res.json();
if (data.errors) {
  console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
} else {
  const issue = data.data.issueCreate.issue;
  console.log('✅ Ticket created successfully');
  console.log(`   ID:         ${issue.identifier}`);
  console.log(`   Title:      ${issue.title}`);
  console.log(`   URL:        ${issue.url}`);
}
