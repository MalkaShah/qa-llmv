import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '10.11.240.34', port: 5432, database: 'llmv_db',
  user: 'llmv_app_read_only', password: "4$uqfhBt2`djRjF1",
  connectionTimeoutMillis: 8000, statement_timeout: 30000
});

await client.connect();
console.log('DB connected');

const BRAND_ID = '80a51610-6178-4893-b4d8-1cd32c97f091';

// 1. ALL snapshots for skechers brand (including shared ones with project=NULL)
const allSnapshots = await client.query(`
  SELECT
    s.id, s.project_id, s.status, s.started_at, s.completed_at,
    s.last_failed_at, s.selected_platforms, s.success_response_count,
    s.country_code, s.trigger, s.is_deleted, s.task_id
  FROM llmv_analysissnapshot s
  WHERE s.brand_id = $1
  ORDER BY s.started_at DESC
`, [BRAND_ID]);
console.log('\n=== ALL SNAPSHOTS FOR SKECHERS BRAND (incl shared project=NULL) ===');
console.log(JSON.stringify(allSnapshots.rows, null, 2));

// 2. Credit log (find actual column names first)
const creditCols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'llmv_creditusagelog'
  ORDER BY ordinal_position
`);
console.log('\n=== CREDIT LOG COLUMNS ===');
console.log(creditCols.rows.map(r => r.column_name).join(', '));

// 3. Credit log for the project
const credits = await client.query(`
  SELECT *
  FROM llmv_creditusagelog
  WHERE project_id = 'c43aba1d-c51e-432c-8efc-a6293c13e3f7'
  ORDER BY created DESC
  LIMIT 20
`);
console.log('\n=== CREDIT LOG ===');
console.log(JSON.stringify(credits.rows, null, 2));

// 4. Check query responses for the shared snapshot
const sharedSnapshotIds = allSnapshots.rows.filter(r => !r.project_id).map(r => r.id);
if (sharedSnapshotIds.length > 0) {
  const sharedResponses = await client.query(`
    SELECT snapshot_id, platform, success, COUNT(*) as cnt
    FROM llmv_queryresponse
    WHERE snapshot_id = ANY($1::uuid[])
    GROUP BY snapshot_id, platform, success
  `, [sharedSnapshotIds]);
  console.log('\n=== RESPONSES FOR SHARED SNAPSHOTS ===');
  console.log(JSON.stringify(sharedResponses.rows, null, 2));
}

// 5. Check LLM queue for all brand snapshots
const allSnapshotIds = allSnapshots.rows.map(r => r.id);
const queueStats = await client.query(`
  SELECT q.snapshot_id, q.platform, q.status, COUNT(*) as cnt
  FROM llmv_llmqueryqueue q
  WHERE q.snapshot_id = ANY($1::uuid[])
  GROUP BY q.snapshot_id, q.platform, q.status
  ORDER BY q.snapshot_id, q.platform
`, [allSnapshotIds]);
console.log('\n=== QUEUE STATS PER SNAPSHOT/PLATFORM ===');
console.log(JSON.stringify(queueStats.rows, null, 2));

await client.end();
