const TOKEN = 'pk_87376104_GZW3XHKYLVSZVMC8PEMWZSSIEW1HUWCX';
const headers = { 'Authorization': TOKEN, 'Content-Type': 'application/json' };
const get = async (url) => { const r = await fetch(url, { headers }); return r.json(); };

// Search for channel in specific spaces likely to have product-llm-visibility
const targetSpaces = [
  { name: 'Product', id: '90111931368' },
  { name: 'Engineering', id: '90114113519' },
  { name: 'CU Engineering', id: '90113633959' },
];

for (const space of targetSpaces) {
  console.log(`\n=== Space: ${space.name} ===`);

  // Get folders in space
  const folders = await get(`https://api.clickup.com/api/v2/space/${space.id}/folder?archived=false`);
  for (const folder of folders.folders || []) {
    console.log(`  Folder: ${folder.name} (${folder.id})`);

    // Get views in folder
    const fviews = await get(`https://api.clickup.com/api/v2/folder/${folder.id}/view`);
    const chats = (fviews.views || []).filter(v => v.type === 'chat' || v.name.toLowerCase().includes('llm') || v.name.toLowerCase().includes('visibility'));
    chats.forEach(v => console.log(`    VIEW: ${v.name} [${v.type}] (${v.id})`));
  }

  // Get lists directly in space (no folder)
  const lists = await get(`https://api.clickup.com/api/v2/space/${space.id}/list?archived=false`);
  for (const list of lists.lists || []) {
    if (list.name.toLowerCase().includes('llm') || list.name.toLowerCase().includes('visibility')) {
      console.log(`  List: ${list.name} (${list.id})`);
    }
  }

  // Get space-level views
  const sviews = await get(`https://api.clickup.com/api/v2/space/${space.id}/view`);
  const schats = (sviews.views || []).filter(v => v.type === 'chat' || v.name.toLowerCase().includes('llm') || v.name.toLowerCase().includes('visibility'));
  schats.forEach(v => console.log(`  SPACE VIEW: ${v.name} [${v.type}] (${v.id})`));
}
