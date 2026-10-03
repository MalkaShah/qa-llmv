// Search Linear for existing tickets related to DB billing bugs and API defects
const API_KEY = '';

const gql = async (query, variables = {}) => {
  const r = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await r.json();
  if (json.errors) { console.error('GQL errors:', json.errors); }
  return json.data;
};

// 1. Get all teams to understand workspace
const teamsData = await gql(`{ teams { nodes { id name key } } }`);
console.log('\n=== Teams ===');
teamsData.teams.nodes.forEach(t => console.log(`  ${t.key} — ${t.name} (${t.id})`));

// 2. Search for issues matching our bug IDs and keywords
const searchTerms = [
  'DB-050', 'DB-053', 'DB-090', 'DB-092', 'DB-064',
  'double billing', 'phantom billing', 'double charge', 'cross-tenant',
  'credits_consumed', 'snapshot charged', 'billing leak',
  'LLMV-API-130', 'LLMV-API-132', 'LLMV-API-136',
  'duplicate billing', 'overcharge', 'llmv billing',
  'DB-030', 'DB-031', 'DB-032', 'DB-060', 'DB-063',
  'DB-070', 'DB-071', 'DB-072', 'DB-100', 'DB-111',
  'DB-120', 'DB-121', 'DB-122',
];

const allIssues = new Map(); // dedupe by id

for (const term of searchTerms) {
  const data = await gql(`
    query($term: String!) {
      issueSearch(query: $term, first: 10) {
        nodes { id identifier title state { name } team { key } priority createdAt }
      }
    }`, { term });
  for (const issue of (data?.issueSearch?.nodes || [])) {
    allIssues.set(issue.id, issue);
  }
}

console.log(`\n=== Found ${allIssues.size} unique issues ===`);
if (allIssues.size === 0) {
  console.log('  No matching tickets found.');
} else {
  for (const issue of allIssues.values()) {
    console.log(`  [${issue.identifier}] ${issue.team?.key} | ${issue.state?.name} | P${issue.priority} | ${issue.title}`);
  }
}
