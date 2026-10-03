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

// Get M2M columns
await q('llmv_query_snapshots columns', `SELECT column_name FROM information_schema.columns WHERE table_name='llmv_query_snapshots' ORDER BY ordinal_position`);
await q('llmv_userprofile columns', `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='llmv_userprofile' ORDER BY ordinal_position LIMIT 10`);

// ── 1. Find the two test queries by title (corrected) ──
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
    t.title topic_title,
    t.is_deleted topic_deleted,
    t.customer_id topic_customer_id,
    b.domain
  FROM llmv_query q
  JOIN llmv_topic t ON t.id=q.topic_id
  JOIN llmv_brand b ON b.id=t.brand_id
  WHERE q.title ILIKE '%bug-130-test%'
     OR q.title ILIKE '%QA test query%'
  ORDER BY q.created DESC`);

// ── 2. Malka customer_id ──
await q('2. Malka user + customer_id', `
  SELECT u.id, u.email, p.customer_id
  FROM auth_user u
  JOIN llmv_userprofile p ON p.user_id=u.id
  WHERE u.email ILIKE '%malka%' OR u.email = 'malka.shah12@gmail.com'
  LIMIT 5`);

// ── 3. Topics for ebay.com belonging to customer 211944 ──
await q('3. ebay.com topics for customer 211944', `
  SELECT
    t.id::text topic_id,
    t.title topic_title,
    t.is_deleted,
    t.customer_id,
    t.source,
    count(q.id) total_queries,
    count(q.id) FILTER (WHERE q.is_deleted=false) active_queries,
    count(q.id) FILTER (WHERE q.title ILIKE '%test%' OR q.title ILIKE '%bug%') test_looking_queries,
    to_char(t.created,'MM-DD-YY HH24:MI') created
  FROM llmv_topic t
  JOIN llmv_brand b ON b.id=t.brand_id
  LEFT JOIN llmv_query q ON q.topic_id=t.id
  WHERE b.domain = 'ebay.com'
    AND t.customer_id = 211944
  GROUP BY t.id
  ORDER BY t.created DESC`);

// ── 4. ALL queries under ebay.com topics for customer 211944 ──
await q('4. All queries under ebay.com for customer 211944', `
  SELECT
    q.id::text query_id,
    q.title,
    q.source,
    q.is_deleted,
    q.customer_id query_customer,
    t.title topic_title,
    t.is_deleted topic_deleted,
    t.customer_id topic_customer
  FROM llmv_query q
  JOIN llmv_topic t ON t.id=q.topic_id
  JOIN llmv_brand b ON b.id=t.brand_id
  WHERE b.domain = 'ebay.com'
    AND (t.customer_id=211944 OR q.customer_id=211944)
    AND q.is_deleted=false
  ORDER BY t.id, q.title`);

// ── 5. What topics/brands do the test queries belong to? ──
await q('5. Test query full context', `
  SELECT
    q.id::text query_id,
    q.title,
    q.source,
    q.is_deleted q_deleted,
    q.customer_id q_customer,
    t.id::text topic_id,
    t.title topic_title,
    t.is_deleted t_deleted,
    t.customer_id t_customer,
    b.domain,
    b.id::text brand_id
  FROM llmv_query q
  JOIN llmv_topic t ON t.id=q.topic_id
  JOIN llmv_brand b ON b.id=t.brand_id
  WHERE q.title ILIKE '%bug-130-test%'
     OR q.title ILIKE '%QA test query%'`);

// ── 6. Are test queries appearing in snapshots for ebay.com? ──
await q('6. Snapshots containing test queries', `
  SELECT
    qs.analysissnapshot_id::text snap_id,
    s.status,
    s.trigger,
    s.customer_id snap_customer,
    to_char(s.created,'MM-DD-YY HH24:MI') snap_created,
    p.customer_id proj_customer,
    b.domain,
    q.title query_title,
    q.customer_id query_customer
  FROM llmv_query_snapshots qs
  JOIN llmv_query q ON q.id=qs.query_id
  JOIN llmv_analysissnapshot s ON s.id=qs.analysissnapshot_id
  JOIN llmv_project p ON p.id=s.project_id
  JOIN llmv_brand b ON b.id=p.brand_id
  WHERE (q.title ILIKE '%bug-130-test%' OR q.title ILIKE '%QA test query%')
  ORDER BY s.created DESC
  LIMIT 20`);

// ── 7. Cross-customer query leak: queries in ebay.com snapshots NOT owned by snapshot customer ──
await q('7. Cross-customer query leak check for ebay.com', `
  SELECT
    q.customer_id query_owner,
    p.customer_id snapshot_owner,
    count(*) leaked_query_uses,
    array_agg(DISTINCT q.title ORDER BY q.title) FILTER (WHERE q.title ILIKE '%test%' OR q.title ILIKE '%bug%' OR q.title ILIKE '%QA%') test_query_titles
  FROM llmv_query_snapshots qs
  JOIN llmv_query q ON q.id=qs.query_id
  JOIN llmv_analysissnapshot s ON s.id=qs.analysissnapshot_id
  JOIN llmv_project p ON p.id=s.project_id
  JOIN llmv_brand b ON b.id=p.brand_id
  WHERE b.domain='ebay.com'
    AND q.customer_id != p.customer_id
    AND s.created >= now()-interval '30 days'
  GROUP BY q.customer_id, p.customer_id
  ORDER BY leaked_query_uses DESC
  LIMIT 10`);

await c.end();
