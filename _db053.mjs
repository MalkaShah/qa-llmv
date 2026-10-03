import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Client } = require('pg');
dotenv.config({ path: '.env.db' });
const c = new Client({
  host: process.env.LLMV_DB_HOST, port: Number(process.env.LLMV_DB_PORT||5432),
  database: process.env.LLMV_DB_NAME||'llmv_db', user: process.env.LLMV_DB_USER,
  password: process.env.LLMV_DB_PASS, ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:15000, query_timeout:26000,
});
await c.connect();
const q = async (label, sql, params=[]) => {
  try { const r = await c.query(sql, params); console.log(`\n=== ${label} ===`); console.table(r.rows); }
  catch(e){ console.log(`\n=== ${label} FAILED: ${e.message.split('\n')[0]}`); }
};

// Per failed snapshot: charge rows, total credits, snapshot.credits_consumed, timing
await q('DB-053: the failed snapshots that carry charges', `
  SELECT s.id::text snapshot, s.retry_count, s.success_response_count sr,
    to_char(s.created,'MM-DD HH24:MI') created, to_char(s.completed_at,'MM-DD HH24:MI') completed,
    COALESCE(s.credits_consumed,0) snap_credits_col,
    count(cl.*) charge_rows, sum(cl.credits_consumed) ledger_credits,
    count(DISTINCT cl.reservation_id) distinct_res
  FROM llmv_analysissnapshot s JOIN llmv_creditusagelog cl ON cl.snapshot_id=s.id
  WHERE s.status='failed' AND cl.credits_consumed>0
  GROUP BY s.id, s.retry_count, s.success_response_count, s.created, s.completed_at, s.credits_consumed
  ORDER BY charge_rows DESC`);

// True DB-053-specific loss: distinct failed snapshots × their own credits_consumed (dedup DB-050 inflation)
await q('DB-053: distinct failed snapshots charged vs inflated ledger total', `
  SELECT count(*) distinct_failed_snaps_charged,
    sum(snap_credits) true_snapshot_credits,
    (SELECT sum(cl.credits_consumed) FROM llmv_creditusagelog cl JOIN llmv_analysissnapshot s2 ON s2.id=cl.snapshot_id WHERE s2.status='failed' AND cl.credits_consumed>0) inflated_ledger_total
  FROM (
    SELECT s.id, COALESCE(s.credits_consumed,0) snap_credits
    FROM llmv_analysissnapshot s
    WHERE s.status='failed' AND EXISTS (SELECT 1 FROM llmv_creditusagelog cl WHERE cl.snapshot_id=s.id AND cl.credits_consumed>0)) t`);

await c.end();
