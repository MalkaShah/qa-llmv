import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Client } = require('pg');
dotenv.config({ path: '.env.db' });
const c = new Client({
  host: process.env.LLMV_DB_HOST, port: Number(process.env.LLMV_DB_PORT||5432),
  database: process.env.LLMV_DB_NAME||'llmv_db', user: process.env.LLMV_DB_USER,
  password: process.env.LLMV_DB_PASS, ssl:{rejectUnauthorized:false},
  connectionTimeoutMillis:15000, query_timeout:30000,
});
await c.connect();
const q = async (label, sql) => {
  try { const r = await c.query(sql); console.log(`\n=== ${label} ===`); console.table(r.rows); }
  catch(e){ console.log(`\n=== ${label} FAILED: ${e.message.split('\n')[0]}`); }
};

// ── 1. Find the two test queries by title ──
await q('1. Test queries in DB', `
  SELECT
    q.id::text query_id,
    q.title,
    q.source,
    q.is_deleted,
    q.customer_id,
    q.query_type,
    to_char(q.created,'MM-DD-YY HH24:MI') created,
    t.id::text topic_id,
    t.name topic_name,
    t.is_deleted topic_deleted,
    t.customer_id topic_customer_id,
    b.domain
  FROM llmv_query q
  JOIN llmv_topic t ON t.id=q.topic_id
  JOIN llmv_brand b ON b.id=t.brand_id
  WHERE q.title ILIKE '%bug-130-test%'
     OR q.title ILIKE '%QA test query%'
  ORDER BY q.created DESC`);

// ── 2. Find malka's customer_id via email ──
await q('2. Malka user + customer_id', `
  SELECT u.id, u.email, p.customer_id
  FROM auth_user u
  JOIN users_userprofile p ON p.user_id=u.id
  WHERE u.email ILIKE '%malka%' OR u.email = 'malka.shah12@gmail.com'
  LIMIT 5`);

// ── 3. Find all queries owned by same customer as test queries ──
await q('3. All queries from the test-query customer_id', `
  WITH test_customers AS (
    SELECT DISTINCT q.customer_id
    FROM llmv_query q
    WHERE q.title ILIKE '%bug-130-test%' OR q.title ILIKE '%QA test query%'
  )
  SELECT
    q.customer_id,
    count(*) total_queries,
    count(*) FILTER (WHERE q.title ILIKE '%test%' OR q.title ILIKE '%bug%') test_looking_queries,
    count(*) FILTER (WHERE q.is_deleted=true) deleted_queries,
    count(DISTINCT t.brand_id) distinct_brands
  FROM llmv_query q
  JOIN llmv_topic t ON t.id=q.topic_id
  WHERE q.customer_id IN (SELECT customer_id FROM test_customers)
  GROUP BY q.customer_id`);

// ── 4. Find ebay.com brand + all projects ──
await q('4. ebay.com brand and projects', `
  SELECT
    b.id::text brand_id,
    b.domain,
    p.id::text project_id,
    p.customer_id,
    p.is_active,
    p.is_deleted,
    p.is_user_tracked,
    p.country_code,
    to_char(p.created,'MM-DD-YY HH24:MI') created
  FROM llmv_brand b
  JOIN llmv_project p ON p.brand_id=b.id
  WHERE b.domain ILIKE '%ebay%'
  ORDER BY p.created DESC
  LIMIT 20`);

// ── 5. Find ebay.com topics and their queries ──
await q('5. ebay.com topics with query counts (all customers)', `
  SELECT
    t.id::text topic_id,
    t.name topic_name,
    t.customer_id,
    t.is_deleted,
    count(q.id) total_queries,
    count(q.id) FILTER (WHERE q.is_deleted=false) active_queries,
    count(q.id) FILTER (WHERE q.title ILIKE '%test%' OR q.title ILIKE '%bug%') test_queries
  FROM llmv_topic t
  JOIN llmv_brand b ON b.id=t.brand_id
  LEFT JOIN llmv_query q ON q.topic_id=t.id
  WHERE b.domain ILIKE '%ebay%'
  GROUP BY t.id, t.name, t.customer_id, t.is_deleted
  ORDER BY test_queries DESC, total_queries DESC
  LIMIT 20`);

// ── 6. Check if test queries are in any snapshot's query set ──
await q('6. Snapshots containing test queries (last 30 days)', `
  SELECT
    qs.snapshot_id::text,
    s.status,
    s.trigger,
    to_char(s.created,'MM-DD-YY HH24:MI') created,
    p.customer_id,
    b.domain,
    q.title query_title,
    q.customer_id query_owner
  FROM llmv_query_snapshots qs
  JOIN llmv_query q ON q.id=qs.query_id
  JOIN llmv_analysissnapshot s ON s.id=qs.snapshot_id
  JOIN llmv_project p ON p.id=s.project_id
  JOIN llmv_brand b ON b.id=p.brand_id
  WHERE (q.title ILIKE '%bug-130-test%' OR q.title ILIKE '%QA test query%')
    AND s.created >= now()-interval '30 days'`);

await c.end();
