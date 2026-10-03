const API_KEY = ''

const gql = async (query, variables = {}) => {
  const r = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await r.json();
  if (json.errors) console.error('GQL errors:', JSON.stringify(json.errors, null, 2));
  return json.data;
};

// First fetch team labels and workflow states so we can set correct values
const meta = await gql(`
  query($teamId: String!) {
    team(id: $teamId) {
      states { nodes { id name } }
      labels { nodes { id name } }
    }
  }`, { teamId: LLMV_TEAM_ID });

const states = meta?.team?.states?.nodes || [];
const labels = meta?.team?.labels?.nodes || [];

console.log('States:', states.map(s => `${s.name} (${s.id})`).join('\n'));
console.log('\nLabels:', labels.map(l => `${l.name} (${l.id})`).join('\n'));

// Find "Todo" or "Backlog" state
const todoState = states.find(s => s.name === 'Todo') || states.find(s => s.name === 'Backlog');
// Find "Improvement" or "Enhancement" label
const improvementLabel = labels.find(l => l.name.toLowerCase().includes('improvement'))
  || labels.find(l => l.name.toLowerCase().includes('enhancement'));

console.log('\nUsing state:', todoState?.name, todoState?.id);
console.log('Using label:', improvementLabel?.name, improvementLabel?.id);

const title = 'Refund credits when analysis snapshot fails (no-reservation path)';

const description = `## Summary

When an analysis snapshot fails, the system should refund any credits already consumed. This works correctly for snapshots that used the **reservation path** — \`_mark_snapshot_failed()\` calls \`cancel_reservation()\` which releases the held credits.

However, snapshots that went through the **direct consume path** (no \`reservation_id\` — legacy triggers, manual runs) receive no refund on failure. \`_mark_snapshot_failed()\` only checks for a reservation to cancel; if there is none, it exits without touching the credit balance. The \`refund_credits()\` function exists in \`quota_v2.py\` but is never called from any failure handler.

## Evidence

Confirmed from backend code (\`tasks/pipeline.py:_mark_snapshot_failed()\`) and production DB:

- 6 failed snapshots identified with real credit charges and no corresponding refund
- Clearest example: snapshot \`b5049674\` — \`credits_consumed = 0\` on the snapshot record (system doesn't register the charge) but the \`llmv_creditusagelog\` ledger shows **129 credits** consumed against the customer's account
- Customer was billed for an analysis run that produced zero data and showed as failed in the dashboard

## Root Cause

\`\`\`python
# pipeline.py — _mark_snapshot_failed()
if snapshot.reservation_id and snapshot.project:
    _cancel_reservation_safe(...)   # ✅ reservation path: credits released
# No else branch — consume_credits() path: credits are NOT refunded
\`\`\`

\`refund_credits()\` in \`quota_v2.py\` is the correct mechanism but is never invoked on failure.

## Proposed Fix

In \`_mark_snapshot_failed()\`, add a refund for the no-reservation path when credits were already consumed:

\`\`\`python
if snapshot.reservation_id and snapshot.project:
    _cancel_reservation_safe(snapshot.reservation_id, project=snapshot.project, reason=reason)
elif snapshot.credits_consumed and snapshot.credits_consumed > 0 and snapshot.project:
    # No reservation — credits were consumed directly; refund on failure
    refund_credits(
        snapshot.project.user,
        snapshot.credits_consumed,
        project=snapshot.project,
        reason=f"snapshot failed: {reason}",
    )
\`\`\`

## Acceptance Criteria

- A failed snapshot with \`credits_consumed > 0\` and \`reservation_id = NULL\` produces a \`CreditUsageLog\` row with \`action = 'refund'\` and \`credits_consumed\` as a negative value
- Customer credit balance is restored to pre-run level
- Snapshots that were never charged (\`credits_consumed = 0\`) are unaffected
- Existing reservation-path cancellation behavior is unchanged

## Notes

- Scope of historical damage: 6 confirmed snapshots from a limited query window; full historical scan needed to determine total exposure across all time
- This does **not** cover DB-050 (double billing) — that is a separate historical data remediation issue
- Discovered during QA DB suite run 2026-08-04 (test DB-053)`;

// Create the issue
const createVars = {
  teamId: LLMV_TEAM_ID,
  title,
  description,
  priority: 2, // High
  ...(todoState ? { stateId: todoState.id } : {}),
  ...(improvementLabel ? { labelIds: [improvementLabel.id] } : {}),
};

const result = await gql(`
  mutation CreateIssue(
    $teamId: String!
    $title: String!
    $description: String!
    $priority: Int
    $stateId: String
    $labelIds: [String!]
  ) {
    issueCreate(input: {
      teamId: $teamId
      title: $title
      description: $description
      priority: $priority
      stateId: $stateId
      labelIds: $labelIds
    }) {
      success
      issue {
        id
        identifier
        title
        priority
        state { name }
        labels { nodes { name } }
        url
      }
    }
  }`, createVars);

const issue = result?.issueCreate?.issue;
if (issue) {
  console.log('\n✅ Ticket created successfully!');
  console.log(`  ID:       ${issue.identifier}`);
  console.log(`  Title:    ${issue.title}`);
  console.log(`  Priority: P${issue.priority}`);
  console.log(`  State:    ${issue.state?.name}`);
  console.log(`  Labels:   ${issue.labels?.nodes?.map(l => l.name).join(', ') || 'none'}`);
  console.log(`  URL:      ${issue.url}`);
} else {
  console.log('\n❌ Failed to create ticket');
  console.log(JSON.stringify(result, null, 2));
}
