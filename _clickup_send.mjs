const TOKEN = 'pk_87376104_GZW3XHKYLVSZVMC8PEMWZSSIEW1HUWCX';
const headers = { 'Authorization': TOKEN, 'Content-Type': 'application/json' };

const get = async (url) => {
  const r = await fetch(url, { headers });
  return r.json();
};

// Step 1: Get teams
const teams = await get('https://api.clickup.com/api/v2/team');
console.log('Teams:', teams.teams?.map(t => `${t.name} (${t.id})`));

const teamId = teams.teams?.[0]?.id;
if (!teamId) { console.error('No team found'); process.exit(1); }

// Step 2: Get all spaces
const spaces = await get(`https://api.clickup.com/api/v2/team/${teamId}/space?archived=false`);
console.log('\nSpaces:', spaces.spaces?.map(s => `${s.name} (${s.id})`));

// Step 3: Get chat views at team level (channels live here)
const views = await get(`https://api.clickup.com/api/v2/team/${teamId}/view`);
const allViews = views.views || [];
console.log('\nTeam views:', allViews.map(v => `${v.name} [${v.type}] (${v.id})`));

// Find product-llm-visibility channel
const channel = allViews.find(v =>
  v.type === 'chat' && v.name.toLowerCase().includes('llm')
) || allViews.find(v =>
  v.name.toLowerCase().includes('llm') || v.name.toLowerCase().includes('visibility')
);

if (channel) {
  console.log(`\nFound channel: ${channel.name} (${channel.id})`);
} else {
  console.log('\nChannel not found in team views. Listing all chat views:');
  allViews.filter(v => v.type === 'chat').forEach(v => console.log(`  ${v.name} (${v.id})`));
}
