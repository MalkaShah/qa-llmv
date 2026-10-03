const API_KEY = '';
const ISSUE_ID = 'LLMV-1106';

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

// Search for Abdul Hakeem in organization members
const data = await gql(`
  query {
    users(filter: { displayName: { containsIgnoreCase: "hakeem" } }) {
      nodes { id name displayName email }
    }
  }`);

const users = data?.users?.nodes || [];
console.log('Found users:', JSON.stringify(users, null, 2));

if (users.length > 0) {
  const user = users[0];
  console.log(`\nAssigning LLMV-1106 to: ${user.displayName} (${user.id})`);

  // Get issue ID first
  const issueData = await gql(`
    query { issue(id: "LLMV-1106") { id identifier title } }`);
  const issueUUID = issueData?.issue?.id;
  console.log('Issue UUID:', issueUUID);

  if (issueUUID) {
    const result = await gql(`
      mutation($id: String!, $assigneeId: String!) {
        issueUpdate(id: $id, input: { assigneeId: $assigneeId }) {
          success
          issue { identifier title assignee { name displayName } }
        }
      }`, { id: issueUUID, assigneeId: user.id });

    const updated = result?.issueUpdate?.issue;
    if (updated) {
      console.log(`\n✅ Assigned: ${updated.identifier} → ${updated.assignee?.displayName}`);
    } else {
      console.log('❌ Assignment failed:', JSON.stringify(result, null, 2));
    }
  }
}
