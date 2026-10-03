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

// ── DB-063: Soft-deleted projects still is_active=True ──────────────────────
await q('DB-063: soft-deleted+active projects (total + breakdown by trigger)', `
  SELECT
    count(*) total,
    count(*) FILTER (WHERE is_user_tracked=true)  user_tracked,
    count(*) FILTER (WHERE is_user_tracked=false) not_user_tracked,
    count(*) FILTER (WHERE next_run_at IS NOT NULL) has_next_run_at,
    count(*) FILTER (WHERE next_run_at <= now()) overdue
  FROM llmv_project
  WHERE is_deleted=true AND is_active=true`);

await q('DB-063: sample of soft-deleted+active projects', `
  SELECT p.id::text, p.is_active, p.is_deleted, p.is_user_tracked,
    to_char(p.modified,'MM-DD-YY HH24:MI') deleted_at,
    to_char(p.next_run_at,'MM-DD-YY HH24:MI') next_run_at,
    p.customer_id,
    (SELECT count(*) FROM llmv_analysissnapshot s WHERE s.project_id=p.id AND s.is_deleted=false
     AND s.created > p.modified) snapshots_after_delete
  FROM llmv_project p
  WHERE p.is_deleted=true AND p.is_active=true
  ORDER BY p.modified DESC
  LIMIT 10`);

// ── DB-070: Projects ran more often than frequency ───────────────────────────
await q('DB-070: projects running more often than configured (sample 15)', `
  SELECT
    p.id::text project_id,
    p.frequency_days,
    p.customer_id,
    count(s.id) actual_runs,
    ROUND(30.0 / NULLIF(p.frequency_days,0), 1) expected_per_30days,
    count(s.id) - ROUND(30.0 / NULLIF(p.frequency_days,0), 1) excess_runs,
    min(to_char(s.created,'MM-DD HH24:MI')) first_run,
    max(to_char(s.created,'MM-DD HH24:MI')) last_run
  FROM llmv_project p
  JOIN llmv_analysissnapshot s ON s.project_id=p.id
  WHERE s.created >= now() - interval '30 days'
    AND s.trigger='scheduled'
    AND s.is_deleted=false
    AND p.frequency_days > 0
  GROUP BY p.id, p.frequency_days, p.customer_id
  HAVING count(s.id) > ROUND(30.0 / NULLIF(p.frequency_days,0), 1) * 1.5
  ORDER BY excess_runs DESC
  LIMIT 15`);

await q('DB-070: status breakdown for over-run snapshots (top offender)', `
  SELECT s.status, s.trigger, count(*) cnt,
    min(to_char(s.created,'MM-DD HH24:MI')) first_seen,
    max(to_char(s.created,'MM-DD HH24:MI')) last_seen
  FROM llmv_analysissnapshot s
  JOIN (
    SELECT p.id FROM llmv_project p
    JOIN llmv_analysissnapshot s2 ON s2.project_id=p.id
    WHERE s2.created >= now()-interval '30 days' AND s2.trigger='scheduled' AND s2.is_deleted=false AND p.frequency_days>0
    GROUP BY p.id, p.frequency_days
    HAVING count(s2.id) > ROUND(30.0/NULLIF(p.frequency_days,0),1)*1.5
    ORDER BY count(s2.id) DESC LIMIT 1
  ) top ON top.id = s.project_id
  WHERE s.created >= now()-interval '30 days' AND s.is_deleted=false
  GROUP BY s.status, s.trigger
  ORDER BY cnt DESC`);

// ── DB-072: Success snapshots with zero responses ────────────────────────────
await q('DB-072: success snapshots with zero successful responses (total)', `
  SELECT
    count(*) total_hollow_success,
    count(*) FILTER (WHERE s.credits_consumed > 0) charged_despite_zero,
    count(*) FILTER (WHERE s.credits_consumed = 0) not_charged,
    min(to_char(s.created,'MM-DD-YY')) earliest,
    max(to_char(s.created,'MM-DD-YY')) latest
  FROM llmv_analysissnapshot s
  WHERE s.status='success'
    AND s.is_deleted=false
    AND COALESCE(s.success_response_count,0) = 0`);

await q('DB-072: sample hollow-success snapshots', `
  SELECT s.id::text snap_id, s.status, s.trigger,
    s.success_response_count,
    s.credits_consumed,
    to_char(s.created,'MM-DD-YY HH24:MI') created,
    to_char(s.completed_at,'MM-DD-YY HH24:MI') completed,
    (SELECT count(*) FROM llmv_queryresponse qr WHERE qr.snapshot_id=s.id AND qr.success=true AND qr.is_deleted=false) live_count
  FROM llmv_analysissnapshot s
  WHERE s.status='success' AND s.is_deleted=false AND COALESCE(s.success_response_count,0)=0
  ORDER BY s.created DESC
  LIMIT 10`);

// ── DB-100: Active queries under deleted topics ──────────────────────────────
await q('DB-100: active queries under deleted topics (total)', `
  SELECT
    count(*) total_orphaned_queries,
    count(DISTINCT q.topic_id) affected_topics,
    count(DISTINCT t.brand_id) affected_brands,
    count(*) FILTER (WHERE q.source='user_created') user_created,
    count(*) FILTER (WHERE q.source='auto_generated') auto_generated
  FROM llmv_query q
  JOIN llmv_topic t ON t.id=q.topic_id
  WHERE q.is_deleted=false AND t.is_deleted=true`);

await q('DB-100: are these orphaned queries still being snapshotted?', `
  SELECT count(DISTINCT sq.query_id) queries_still_in_snapshots,
    count(DISTINCT sq.snapshot_id) snapshots_affected,
    min(to_char(s.created,'MM-DD-YY')) earliest_snapshot,
    max(to_char(s.created,'MM-DD-YY')) latest_snapshot
  FROM llmv_analysissnapshot_queries sq
  JOIN llmv_analysissnapshot s ON s.id=sq.snapshot_id
  JOIN llmv_query q ON q.id=sq.query_id
  JOIN llmv_topic t ON t.id=q.topic_id
  WHERE q.is_deleted=false AND t.is_deleted=true
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false`);

// ── DB-102: Snapshots created after project deletion ─────────────────────────
await q('DB-102: snapshots created after project soft-deletion', `
  SELECT s.id::text snap_id, s.status, s.trigger,
    to_char(s.created,'MM-DD-YY HH24:MI') snap_created,
    to_char(p.modified,'MM-DD-YY HH24:MI') project_deleted_at,
    ROUND(EXTRACT(EPOCH FROM (s.created - p.modified))/60,1) mins_after_delete,
    p.id::text project_id,
    p.is_deleted, p.is_active
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_deleted=true
    AND s.created > p.modified
    AND s.is_deleted=false
  ORDER BY mins_after_delete DESC`);

// ── DB-120: Inactive project snapshots in last 30 days ───────────────────────
await q('DB-120: snapshots for inactive projects last 30 days (total)', `
  SELECT
    count(*) total_snapshots,
    count(DISTINCT s.project_id) distinct_projects,
    count(*) FILTER (WHERE s.status='success') succeeded,
    count(*) FILTER (WHERE s.status='failed') failed,
    count(*) FILTER (WHERE s.status IN ('gathering_responses','brand_research','generating_topics','generating_queries','gathering_brand_info')) still_active,
    sum(s.credits_consumed) total_credits_burned
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false`);

await q('DB-120: snapshot triggers for inactive-project runs', `
  SELECT s.trigger, s.status, count(*) cnt
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false
  GROUP BY s.trigger, s.status
  ORDER BY cnt DESC`);

await c.end();
