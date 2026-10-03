import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Client } = require('pg');
dotenv.config({ path: '.env.db' });
const c = new Client({
  host: process.env.LLMV_DB_HOST, port: Number(process.env.LLMV_DB_PORT||5432),
  database: process.env.LLMV_DB_NAME||'llmv_db', user: process.env.LLMV_DB_USER,
  password: process.env.LLMV_DB_PASS, ssl:{rejectUnauthorized:false},
  connectionTimeoutMillis:15000, query_timeout:28000,
});
await c.connect();
const q = async (label, sql) => {
  try { const r = await c.query(sql); console.log(`\n=== ${label} ===`); console.table(r.rows); }
  catch(e){ console.log(`\n=== ${label} FAILED: ${e.message.split('\n')[0]}`); }
};

// 1. DB-053 snapshot detail with correct columns
await q('DB-053: failed-but-charged snapshot detail', `
  SELECT s.id::text snap_id, s.status, s.trigger,
    s.retry_count,
    to_char(s.created,'MM-DD HH24:MI') created,
    to_char(s.completed_at,'MM-DD HH24:MI') completed,
    ROUND(EXTRACT(EPOCH FROM (s.completed_at - s.created))/3600, 1) hours_open,
    s.credits_consumed snap_credits,
    s.success_response_count sr,
    s.reservation_id::text snap_res,
    s.is_backfilled
  FROM llmv_analysissnapshot s
  WHERE s.status='failed'
    AND EXISTS (SELECT 1 FROM llmv_creditusagelog cl WHERE cl.snapshot_id=s.id AND cl.credits_consumed>0)
  ORDER BY s.created`);

// 2. Credit log rows for those failed snapshots (correct column: created)
await q('DB-053: credit log entries for failed-charged snapshots', `
  SELECT cl.snapshot_id::text snap_id,
    cl.reservation_id res_id,
    cl.credits_consumed,
    cl.query_count, cl.platform_count,
    cl.balance_after,
    to_char(cl.created,'MM-DD HH24:MI') charged_at,
    cl.action
  FROM llmv_creditusagelog cl
  JOIN llmv_analysissnapshot s ON s.id = cl.snapshot_id
  WHERE s.status='failed' AND cl.credits_consumed>0
  ORDER BY cl.snapshot_id, cl.created
  LIMIT 60`);

// 3. DB-050 root cause: does charge_rows = success_response_count?
await q('DB-050 root cause: charge_rows vs success_response_count', `
  SELECT s.id::text snap_id, s.status,
    s.success_response_count,
    count(cl.*) charge_rows,
    sum(cl.credits_consumed) total_charged,
    s.credits_consumed expected_charge,
    sum(cl.credits_consumed) - s.credits_consumed overcharge,
    ROUND(count(cl.*)::numeric / NULLIF(s.success_response_count,0), 2) ratio
  FROM llmv_analysissnapshot s
  JOIN llmv_creditusagelog cl ON cl.snapshot_id=s.id
  WHERE cl.credits_consumed>0
  GROUP BY s.id, s.status, s.success_response_count, s.credits_consumed
  HAVING count(cl.*) > 1
  ORDER BY overcharge DESC
  LIMIT 20`);

// 4. DB-050 total financial damage
await q('DB-050 total overcharge across all double-billed snapshots', `
  SELECT
    count(DISTINCT s.id) affected_snapshots,
    sum(s.credits_consumed) correct_total,
    sum(total_charged) actual_total_charged,
    sum(total_charged) - sum(s.credits_consumed) total_overcharge
  FROM llmv_analysissnapshot s
  JOIN (
    SELECT snapshot_id, sum(credits_consumed) total_charged, count(*) charge_rows
    FROM llmv_creditusagelog WHERE credits_consumed>0 GROUP BY snapshot_id HAVING count(*)>1
  ) cl ON cl.snapshot_id = s.id`);

// 5. DB-055: balance goes UP on a charge (using LAG on balance_after)
await q('DB-055: charges where balance_after > previous balance_after (sample 15)', `
  SELECT snap_id, customer_id, credits_consumed, prev_bal, balance_after,
    balance_after - prev_bal delta, charged_at, action
  FROM (
    SELECT cl.snapshot_id::text snap_id, cl.customer_id,
      cl.credits_consumed, cl.balance_after,
      LAG(cl.balance_after) OVER (PARTITION BY cl.customer_id ORDER BY cl.created) prev_bal,
      to_char(cl.created,'MM-DD HH24:MI') charged_at,
      cl.action
    FROM llmv_creditusagelog cl
    WHERE cl.credits_consumed > 0
  ) t
  WHERE balance_after > prev_bal
  ORDER BY delta DESC
  LIMIT 15`);

await c.end();
