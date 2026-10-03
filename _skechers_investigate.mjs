import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '10.11.240.34', port: 5432, database: 'llmv_db',
  user: 'llmv_app_read_only', password: "4$uqfhBt2`djRjF1",
  connectionTimeoutMillis: 8000, statement_timeout: 25000
});

await client.connect();
console.log('DB connected');

// 1. Find the brand + all projects for skechers.com
const brand = await client.query(`
  SELECT id, domain, created, modified
  FROM llmv_brand
  WHERE domain ILIKE '%skechers%'
`);
console.log('\n=== BRANDS ===');
console.log(JSON.stringify(brand.rows, null, 2));

if (!brand.rows.length) {
  console.log('No skechers brand found. Trying loose search...');
  const loose = await client.query(`SELECT id, domain FROM llmv_brand WHERE domain ILIKE 'skechers%' LIMIT 10`);
  console.log(JSON.stringify(loose.rows, null, 2));
  await client.end();
  process.exit(0);
}

const brandIds = brand.rows.map(r => r.id);

// 2. All projects for this brand
const projects = await client.query(`
  SELECT
    p.id, p.is_active, p.is_deleted, p.customer_id, p.country_code,
    p.frequency_days, p.next_run_at, p.created, p.modified,
    p.has_insufficient_credits
  FROM llmv_project p
  WHERE p.brand_id = ANY($1)
  ORDER BY p.created DESC
`, [brandIds]);
console.log('\n=== PROJECTS ===');
console.log(JSON.stringify(projects.rows, null, 2));

// 3. All snapshots — recent ones first
const snapshots = await client.query(`
  SELECT
    s.id, s.project_id, s.status, s.started_at, s.completed_at,
    s.last_failed_at, s.selected_platforms, s.success_response_count,
    s.country_code, s.trigger, s.is_deleted
  FROM llmv_analysissnapshot s
  WHERE s.project_id = ANY($1::uuid[])
  ORDER BY s.started_at DESC
  LIMIT 15
`, [projects.rows.map(r => r.id)]);
console.log('\n=== SNAPSHOTS (last 15) ===');
console.log(JSON.stringify(snapshots.rows, null, 2));

await client.end();
