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

// 1. Full status + timing for the 6 failed-but-charged snapshots
await q('Snapshot detail: status + timing', `
  SELECT s.id::text snap_id,
    s.status, s.retry_count,
    to_char(s.created,'MM-DD HH24:MI') created,
    to_char(s.completed_at,'MM-DD HH24:MI') completed,
    ROUND(EXTRACT(EPOCH FROM (s.completed_at - s.created))/3600, 1) hours_open,
    s.credits_consumed snap_credits,
    s.success_response_count sr,
    s.total_response_count tr
  FROM llmv_analysissnapshot s
  WHERE s.status='failed'
    AND EXISTS (SELECT 1 FROM llmv_creditusagelog cl WHERE cl.snapshot_id=s.id AND cl.credits_consumed>0)
  ORDER BY s.created`);

// 2. Credit log rows for those snapshots — charge timestamps and reservation_id
await q('Credit log rows for failed-charged snapshots (first 60)', `
  SELECT cl.snapshot_id::text snap_id,
    cl.reservation_id::text res_id,
    cl.credits_consumed,
    to_char(cl.created_at,'MM-DD HH24:MI') charged_at,
    cl.charge_type
  FROM llmv_creditusagelog cl
  JOIN llmv_analysissnapshot s ON s.id = cl.snapshot_id
  WHERE s.status='failed' AND cl.credits_consumed>0
  ORDER BY cl.snapshot_id, cl.created_at
  LIMIT 60`);

// 3. DB-050: all snapshots charged more than once (any status)
await q('DB-050: snapshots with >1 charge row', `
  SELECT s.id::text snap_id, s.status,
    count(cl.*) charge_rows,
    sum(cl.credits_consumed) total_ledger,
    COALESCE(s.credits_consumed,0) snap_col,
    count(DISTINCT cl.reservation_id) distinct_res
  FROM llmv_analysissnapshot s
  JOIN llmv_creditusagelog cl ON cl.snapshot_id=s.id
  WHERE cl.credits_consumed>0
  GROUP BY s.id, s.status, s.credits_consumed
  HAVING count(cl.*)>1
  ORDER BY charge_rows DESC
  LIMIT 25`);

// 4. DB-055: ledger entries where balance went up on a charge
await q('DB-055: ledger entries where balance increases on charge (sample 20)', `
  SELECT cl.id::text log_id,
    cl.snapshot_id::text snap_id,
    cl.credits_consumed,
    cl.balance_before,
    cl.balance_after,
    (cl.balance_after - cl.balance_before) delta,
    to_char(cl.created_at,'MM-DD HH24:MI') charged_at,
    cl.charge_type
  FROM llmv_creditusagelog cl
  WHERE cl.credits_consumed > 0
    AND cl.balance_after > cl.balance_before
  ORDER BY cl.created_at DESC
  LIMIT 20`);

await c.end();
