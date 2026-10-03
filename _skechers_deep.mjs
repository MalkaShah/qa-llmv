import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '10.11.240.34', port: 5432, database: 'llmv_db',
  user: 'llmv_app_read_only', password: "4$uqfhBt2`djRjF1",
  connectionTimeoutMillis: 8000, statement_timeout: 30000
});

await client.connect();
console.log('DB connected');

const PROJECT_ID = 'c43aba1d-c51e-432c-8efc-a6293c13e3f7';
const BRAND_ID   = '80a51610-6178-4893-b4d8-1cd32c97f091';

// 1. ALL snapshots including soft-deleted
const allSnapshots = await client.query(`
  SELECT id, status, started_at, completed_at, last_failed_at,
         success_response_count, is_deleted, trigger
  FROM llmv_analysissnapshot
  WHERE project_id = $1
  ORDER BY started_at DESC
`, [PROJECT_ID]);
console.log('\n=== ALL SNAPSHOTS (incl deleted) ===');
console.log(JSON.stringify(allSnapshots.rows, null, 2));

// 2. Credit usage log for this project
const credits = await client.query(`
  SELECT id, action, amount, customer_id, project_id, snapshot_id,
         created, description
  FROM llmv_creditusagelog
  WHERE project_id = $1
  ORDER BY created DESC
  LIMIT 20
`, [PROJECT_ID]);
console.log('\n=== CREDIT LOG ===');
console.log(JSON.stringify(credits.rows, null, 2));

// 3. LLM query queue entries — any errors/failures
const queueEntries = await client.query(`
  SELECT q.id, q.platform, q.status, q.error_message, q.created, q.delivered_at,
         q.retry_count
  FROM llmv_llmqueryqueue q
  JOIN llmv_analysissnapshot s ON s.id = q.snapshot_id
  WHERE s.project_id = $1
  ORDER BY q.created DESC
  LIMIT 30
`, [PROJECT_ID]);
console.log('\n=== QUEUE ENTRIES (last 30) ===');
console.log(JSON.stringify(queueEntries.rows, null, 2));

// 4. Query responses — success/fail counts per snapshot
const responses = await client.query(`
  SELECT r.snapshot_id, r.platform, r.success, COUNT(*) as cnt
  FROM llmv_queryresponse r
  WHERE r.snapshot_id IN (
    SELECT id FROM llmv_analysissnapshot WHERE project_id = $1
  )
  GROUP BY r.snapshot_id, r.platform, r.success
  ORDER BY r.snapshot_id, r.platform
`, [PROJECT_ID]);
console.log('\n=== QUERY RESPONSES (per platform/success) ===');
console.log(JSON.stringify(responses.rows, null, 2));

// 5. Brand info / topics / queries counts
const brandData = await client.query(`
  SELECT
    (SELECT COUNT(*) FROM llmv_topic WHERE brand_id = $1 AND is_deleted = false) as active_topics,
    (SELECT COUNT(*) FROM llmv_topic WHERE brand_id = $1) as total_topics,
    (SELECT COUNT(*) FROM llmv_query q JOIN llmv_topic t ON t.id = q.topic_id WHERE t.brand_id = $1 AND q.is_deleted = false) as active_queries,
    (SELECT COUNT(*) FROM llmv_brandinfo WHERE brand_id = $1) as brand_info_count
`, [BRAND_ID]);
console.log('\n=== BRAND DATA COUNTS ===');
console.log(JSON.stringify(brandData.rows, null, 2));

await client.end();
