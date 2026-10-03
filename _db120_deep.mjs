import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Client } = require('pg');
dotenv.config({ path: '.env.db' });
const c = new Client({
  host: process.env.LLMV_DB_HOST, port: Number(process.env.LLMV_DB_PORT||5432),
  database: process.env.LLMV_DB_NAME||'llmv_db', user: process.env.LLMV_DB_USER,
  password: process.env.LLMV_DB_PASS, ssl:{rejectUnauthorized:false},
  connectionTimeoutMillis:15000, query_timeout:45000,
});
await c.connect();
const q = async (label, sql) => {
  try { const r = await c.query(sql); console.log(`\n=== ${label} ===`); console.table(r.rows); }
  catch(e){ console.log(`\n=== ${label} FAILED: ${e.message.split('\n')[0]}`); }
};

// ── 1. SCOPE: How many inactive projects exist total vs last-30-day active ones ──
await q('1. Inactive project population', `
  SELECT
    count(*) FILTER (WHERE is_active=false AND is_deleted=false) total_inactive_projects,
    count(*) FILTER (WHERE is_active=false AND is_deleted=false AND is_user_tracked=true)  inactive_user_tracked,
    count(*) FILTER (WHERE is_active=false AND is_deleted=false AND is_user_tracked=false) inactive_sys_tracked
  FROM llmv_project`);

// ── 2. CREDIT BURN: credits consumed by trigger for inactive-project snapshots ──
await q('2. Credits burned by trigger (30 days, inactive projects)', `
  SELECT
    COALESCE(s.trigger,'(blank)') trigger,
    count(*) snapshots,
    count(*) FILTER (WHERE s.status='success') succeeded,
    count(*) FILTER (WHERE s.status='failed') failed,
    sum(s.credits_consumed) credits_burned,
    count(DISTINCT s.project_id) distinct_projects
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false
  GROUP BY s.trigger
  ORDER BY credits_burned DESC NULLS LAST`);

// ── 3. TIMELINE: Did deactivation happen BEFORE or AFTER snapshot creation? ──
await q('3. Snapshot vs project deactivation timing (30 days)', `
  SELECT
    count(*) FILTER (WHERE s.created < p.modified) snapshot_before_deactivation,
    count(*) FILTER (WHERE s.created >= p.modified) snapshot_after_deactivation,
    count(*) total
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false`);

// ── 4. RETRY PATH: failed snapshots under inactive (non-deleted) projects eligible for retry ──
await q('4. Failed snapshots eligible for retry under inactive projects (RIGHT NOW)', `
  SELECT
    count(*) total_eligible,
    count(DISTINCT s.project_id) distinct_projects,
    min(s.retry_count) min_retries,
    max(s.retry_count) max_retries,
    count(*) FILTER (WHERE s.retry_count=0) retry0,
    count(*) FILTER (WHERE s.retry_count=1) retry1,
    count(*) FILTER (WHERE s.retry_count>=2) retry2plus
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE s.status='failed'
    AND s.is_deleted=false
    AND p.is_deleted=false
    AND p.is_active=false
    AND s.retry_count < 3`);

// ── 5. STUCK SWEEPER: in-flight snapshots under inactive projects ──
await q('5. In-flight snapshots under inactive projects (stuck sweeper targets)', `
  SELECT s.status, count(*) cnt,
    sum(s.credits_consumed) credits_consumed,
    min(to_char(s.created,'MM-DD HH24:MI')) earliest,
    max(to_char(s.created,'MM-DD HH24:MI')) latest
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE s.status IN ('gathering_responses','brand_research','generating_topics','generating_queries','gathering_brand_info','pending','active')
    AND s.is_deleted=false
    AND p.is_active=false
    AND p.is_deleted=false
  GROUP BY s.status
  ORDER BY cnt DESC`);

// ── 6. DEACTIVATION PATH: untrack vs deactivate endpoint usage (90 days) ──
await q('6. How many projects went inactive via untrack vs deactivate (90 days modified)', `
  SELECT
    count(*) FILTER (WHERE is_user_tracked=false AND is_active=false AND is_deleted=false) untracked_inactive,
    count(*) FILTER (WHERE is_user_tracked=true  AND is_active=false AND is_deleted=false) deactivated_but_still_tracked,
    count(*) FILTER (WHERE is_active=false AND is_deleted=false) total_inactive
  FROM llmv_project
  WHERE modified >= now()-interval '90 days'`);

// ── 7. CUSTOMER IMPACT: top customers affected by credits burned ──
await q('7. Top 10 customers with credits burned on inactive projects (30 days)', `
  SELECT
    p.customer_id,
    count(DISTINCT s.project_id) projects,
    count(s.id) snapshots,
    sum(s.credits_consumed) credits_burned
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false
    AND s.credits_consumed > 0
  GROUP BY p.customer_id
  ORDER BY credits_burned DESC
  LIMIT 10`);

// ── 8. DEACTIVATE TIMING: how long after deactivation did snapshots run? ──
await q('8. Lag between project deactivation and snapshot completion (30 days)', `
  SELECT
    ROUND(EXTRACT(EPOCH FROM (s.completed_at - p.modified))/60,0) lag_mins,
    s.trigger, s.status, s.credits_consumed,
    to_char(p.modified,'MM-DD HH24:MI') deactivated_at,
    to_char(s.created,'MM-DD HH24:MI') snap_created,
    to_char(s.completed_at,'MM-DD HH24:MI') completed,
    s.id::text snap_id
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false
    AND s.credits_consumed > 0
  ORDER BY lag_mins DESC NULLS LAST
  LIMIT 15`);

// ── 9. RETRY PATH CONFIRMED: snapshots completed AFTER deactivation (retry candidate) ──
await q('9. Snapshots spawned after project deactivation (retry leak proof)', `
  SELECT
    s.trigger, s.status,
    count(*) cnt,
    sum(s.credits_consumed) credits,
    min(ROUND(EXTRACT(EPOCH FROM (s.created - p.modified))/60,0)) min_lag_mins,
    max(ROUND(EXTRACT(EPOCH FROM (s.created - p.modified))/60,0)) max_lag_mins
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.created > p.modified
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false
  GROUP BY s.trigger, s.status
  ORDER BY cnt DESC`);

await c.end();
