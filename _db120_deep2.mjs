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

// ── A: What is the ACTUAL deactivation time for these projects? ──
// p.modified changes on any project update. We need the time the project
// became is_active=False. Since there's no audit log col, we proxy via:
// the LAST snapshot's completed_at (which was still active) vs p.modified

await q('A. Deactivation timing for track-trigger inactive-project snapshots', `
  SELECT
    p.id::text project_id,
    p.is_user_tracked,
    p.is_active,
    p.is_deleted,
    to_char(p.modified,'MM-DD HH24:MI') p_modified,
    count(s.id) total_snaps_30d,
    max(to_char(s.completed_at,'MM-DD HH24:MI')) last_snap_completed,
    sum(s.credits_consumed) total_credits,
    string_agg(DISTINCT s.trigger, ', ') triggers
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false
    AND s.credits_consumed > 0
  GROUP BY p.id
  ORDER BY total_credits DESC
  LIMIT 10`);

// ── B: For these inactive projects, what triggered the deactivation?
// Look at project history: how did is_active become false?
// is_user_tracked=true + is_active=false → /deactivate/ endpoint
// is_user_tracked=false + is_active=false → /untrack/ endpoint or sys-track
await q('B. State breakdown of charged inactive projects', `
  SELECT
    p.is_user_tracked,
    p.is_active,
    count(DISTINCT p.id) projects,
    sum(s.credits_consumed) credits_burned
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false
    AND s.credits_consumed > 0
  GROUP BY p.is_user_tracked, p.is_active`);

// ── C: For the 91 "track"-triggered snapshots under inactive projects,
// what is the LEAD TIME from deactivation to snapshot creation?
// (all are negative = project still active when snapshot ran)
await q('C. Track-triggered snapshot timing relative to deactivation', `
  SELECT
    ROUND(EXTRACT(EPOCH FROM (s.created - p.modified))/3600,1) hours_before_deactivation,
    s.credits_consumed,
    to_char(p.modified,'MM-DD HH24:MI') p_modified,
    to_char(s.created,'MM-DD HH24:MI') snap_created,
    s.trigger, s.status,
    p.id::text project_id
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.trigger='track'
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false
  ORDER BY hours_before_deactivation ASC
  LIMIT 20`);

// ── D: For "track" snapshots, how many credits per unique project?
// Does 1 project have many "track" snapshots = repeated tracking?
await q('D. Track snapshots per project (inactive projects, 30 days)', `
  SELECT
    p.id::text project_id,
    count(s.id) track_snap_count,
    sum(s.credits_consumed) credits,
    min(to_char(s.created,'MM-DD HH24:MI')) first_track,
    max(to_char(s.created,'MM-DD HH24:MI')) last_track,
    to_char(p.modified,'MM-DD HH24:MI') deactivated_at
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.trigger='track'
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false
  GROUP BY p.id
  HAVING count(s.id) > 1
  ORDER BY track_snap_count DESC
  LIMIT 10`);

// ── E: Scheduled snapshots under inactive projects - when was last_analysis_date vs next_run_at?
await q('E. Scheduled snaps for inactive projects - were they properly scheduled?', `
  SELECT
    p.id::text project_id,
    p.frequency_days,
    to_char(p.next_run_at,'MM-DD HH24:MI') next_run_at,
    to_char(p.last_analysis_date,'MM-DD HH24:MI') last_analysis_date,
    to_char(p.modified,'MM-DD HH24:MI') p_modified,
    count(s.id) sched_snaps,
    sum(s.credits_consumed) credits,
    min(to_char(s.created,'MM-DD HH24:MI')) first_run,
    max(to_char(s.created,'MM-DD HH24:MI')) last_run
  FROM llmv_analysissnapshot s
  JOIN llmv_project p ON p.id=s.project_id
  WHERE p.is_active=false
    AND s.trigger='scheduled'
    AND s.created >= now()-interval '30 days'
    AND s.is_deleted=false
    AND s.credits_consumed > 0
  GROUP BY p.id
  ORDER BY credits DESC
  LIMIT 10`);

// ── F: Is there a specific time window (daily) when deactivations cluster?
// Looking at p.modified hour distribution for these inactive projects
await q('F. Deactivation hour distribution for inactive projects with charged snaps', `
  SELECT
    EXTRACT(HOUR FROM p.modified) deactivation_hour_utc,
    count(DISTINCT p.id) projects
  FROM llmv_project p
  WHERE p.is_active=false
    AND p.is_deleted=false
    AND EXISTS (
      SELECT 1 FROM llmv_analysissnapshot s
      WHERE s.project_id=p.id
        AND s.created >= now()-interval '30 days'
        AND s.is_deleted=false
        AND s.credits_consumed > 0
    )
  GROUP BY EXTRACT(HOUR FROM p.modified)
  ORDER BY deactivation_hour_utc`);

// ── G: QUOTA SWEEP: Is there an automated quota sweep that deactivates projects?
// If deactivations cluster at specific hours it may be a system sweep, not user action
await q('G. Projects deactivated at same timestamp (system sweep?)', `
  SELECT
    to_char(p.modified,'MM-DD HH24') deactivation_hour,
    count(*) projects_deactivated_same_hour,
    count(*) FILTER (WHERE is_user_tracked=true) user_tracked,
    count(*) FILTER (WHERE is_user_tracked=false) sys_tracked
  FROM llmv_project p
  WHERE p.is_active=false
    AND p.is_deleted=false
    AND p.modified >= now()-interval '30 days'
  GROUP BY to_char(p.modified,'MM-DD HH24')
  HAVING count(*) >= 3
  ORDER BY projects_deactivated_same_hour DESC
  LIMIT 15`);

await c.end();
