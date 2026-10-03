const API_KEY = '';
const LLMV_TEAM_ID = '';

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

// Fetch all LLMV issues (up to 250) to search locally
const data = await gql(`
  query($teamId: String!) {
    team(id: $teamId) {
      issues(first: 250, orderBy: updatedAt) {
        nodes {
          identifier title state { name } priority createdAt
          labels { nodes { name } }
        }
      }
    }
  }`, { teamId: LLMV_TEAM_ID });

const issues = data?.team?.issues?.nodes || [];
console.log(`\nTotal LLMV issues fetched: ${issues.length}`);

// Keywords to match against our bug list
const keywords = [
  'DB-050','DB-051','DB-053','DB-054','DB-055',
  'DB-060','DB-063','DB-064','DB-070','DB-071','DB-072',
  'DB-090','DB-092','DB-100','DB-102','DB-111',
  'DB-120','DB-121','DB-122',
  'DB-030','DB-031','DB-032',
  'LLMV-API-130','LLMV-API-132','LLMV-API-136',
  'double bill','double charge','phantom bill','overcharg',
  'cross-tenant','billing leak','wrong customer',
  'stuck snapshot','zombie','failed snapshot',
  'duplicate project','duplicate topic','duplicate query',
  'customer_id','no cost','soft.delet','inactive project',
  'orphan','platform metric','empty title',
];

const matched = issues.filter(i =>
  keywords.some(kw => i.title.toLowerCase().includes(kw.toLowerCase()))
);

console.log(`\n=== Matched issues (${matched.length}) ===`);
if (matched.length === 0) {
  console.log('  None found — no existing tickets for these bugs.');
} else {
  matched.forEach(i => {
    const labels = i.labels?.nodes?.map(l => l.name).join(', ') || '';
    console.log(`  [${i.identifier}] P${i.priority} | ${i.state?.name} | ${i.title}${labels ? ' ['+labels+']' : ''}`);
  });
}

// Also show all LLMV issues so we can scan manually
console.log('\n=== All LLMV issues (most recent first) ===');
issues.slice(0, 50).forEach(i =>
  console.log(`  [${i.identifier}] P${i.priority} | ${i.state?.name} | ${i.title}`)
);
