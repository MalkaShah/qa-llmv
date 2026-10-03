const TOKEN = 'pk_87376104_GZW3XHKYLVSZVMC8PEMWZSSIEW1HUWCX';
const TEAM_ID = '9011399348';
const headers = { 'Authorization': TOKEN, 'Content-Type': 'application/json' };
const get = async (url) => {
  const r = await fetch(url, { headers });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { _raw: text }; }
};

// Try v3 channel endpoint
console.log('=== v3 /channel ===');
const ch = await get(`https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/channels`);
console.log(JSON.stringify(ch, null, 2).slice(0, 3000));

// Also try getting channels from the team conversation view
console.log('\n=== Team conversation view comments ===');
const conv = await get(`https://api.clickup.com/api/v2/view/7-9011399348-8/comment`);
console.log(JSON.stringify(conv, null, 2).slice(0, 2000));
