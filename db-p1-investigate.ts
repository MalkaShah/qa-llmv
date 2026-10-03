import { q, closePool, T } from './tests/db/db-helpers';

async function main() {

  // ── DB-063: is_deleted=true but is_active=true ─────────────────────────────
  console.log('\n════ DB-063: Soft-deleted projects still marked active ════');
  const { rows: del063 } = await q(`
    SELECT COUNT(*)::int AS total FROM ${T.PROJECT}
    WHERE is_deleted = true AND is_active = true
  `);
  console.log(`Total: ${del063[0].total}`);

  // Are any of these still being scheduled? (next_run_at in the future + is_user_tracked)
  const { rows: del063_sched } = await q(`
    SELECT COUNT(*)::int AS n FROM ${T.PROJECT}
    WHERE is_deleted = true AND is_active = true
      AND is_user_tracked = true
      AND next_run_at IS NOT NULL
  `);
  console.log(`Of those, still user-tracked with next_run_at set: ${del063_sched[0].n}`);

  // Did any fire recently? (snapshots created in last 30 days for deleted projects)
  const { rows: del063_snaps } = await q(`
    SELECT COUNT(*)::int AS n FROM ${T.SNAPSHOT} s
    JOIN ${T.PROJECT} p ON s.project_id = p.id
    WHERE p.is_deleted = true
      AND s.created > NOW() - INTERVAL '30 days'
  `);
  console.log(`Snapshots created in last 30 days on deleted projects: ${del063_snaps[0].n}`);

  // Sample — what do these projects look like?
  const { rows: del063_sample } = await q(`
    SELECT p.id, p.is_active, p.is_user_tracked, p.next_run_at,
           p.customer_id, b.domain, p.created, p.modified
    FROM ${T.PROJECT} p
    JOIN ${T.BRAND} b ON p.brand_id = b.id
    WHERE p.is_deleted = true AND p.is_active = true
    ORDER BY p.modified DESC
    LIMIT 5
  `);
  console.log('Sample (most recently modified):');
  del063_sample.forEach((r: any) => console.log(
    `  ${r.domain} | customer=${r.customer_id} | user_tracked=${r.is_user_tracked} | next_run_at=${r.next_run_at} | modified=${r.modified}`
  ));


  // ── DB-071: Snapshots stuck running >24h ───────────────────────────────────
  console.log('\n════ DB-071: Snapshots stuck running >24h ════');
  const { rows: stuck71 } = await q(`
    SELECT COUNT(*)::int AS total FROM ${T.SNAPSHOT}
    WHERE completed_at IS NULL
      AND started_at IS NOT NULL
      AND started_at < NOW() - INTERVAL '24 hours'
      AND LOWER(status) NOT IN ('failed', 'error', 'cancelled')
  `);
  console.log(`Total stuck: ${stuck71[0].total}`);

  const { rows: stuck71_by_status } = await q(`
    SELECT status, COUNT(*)::int AS n,
           MIN(started_at) AS oldest,
           MAX(started_at) AS newest
    FROM ${T.SNAPSHOT}
    WHERE completed_at IS NULL
      AND started_at IS NOT NULL
      AND started_at < NOW() - INTERVAL '24 hours'
      AND LOWER(status) NOT IN ('failed', 'error', 'cancelled')
    GROUP BY status
    ORDER BY n DESC
  `);
  console.log('By status:');
  stuck71_by_status.forEach((r: any) => console.log(
    `  status="${r.status}" | count=${r.n} | oldest=${r.oldest} | newest=${r.newest}`
  ));

  // Are credit reservations still held for stuck snapshots?
  const { rows: stuck71_credits } = await q(`
    SELECT COUNT(*)::int AS n, SUM(s.credits_consumed)::int AS total_credits
    FROM ${T.SNAPSHOT} s
    WHERE s.completed_at IS NULL
      AND s.started_at IS NOT NULL
      AND s.started_at < NOW() - INTERVAL '24 hours'
      AND LOWER(s.status) NOT IN ('failed', 'error', 'cancelled')
      AND s.credits_consumed > 0
  `);
  console.log(`With credits consumed already recorded: ${stuck71_credits[0].n} (total credits: ${stuck71_credits[0].total_credits})`);

  const { rows: stuck71_res } = await q(`
    SELECT COUNT(*)::int AS n FROM ${T.SNAPSHOT}
    WHERE completed_at IS NULL
      AND started_at IS NOT NULL
      AND started_at < NOW() - INTERVAL '24 hours'
      AND LOWER(status) NOT IN ('failed', 'error', 'cancelled')
      AND reservation_id IS NOT NULL
  `);
  console.log(`With open reservation_id (credits reserved but not yet committed): ${stuck71_res[0].n}`);


  // ── DB-072: Completed snapshots with 0 successful responses ───────────────
  console.log('\n════ DB-072: Completed snapshots with 0 successful responses ════');
  const { rows: c72 } = await q(`
    SELECT COUNT(*)::int AS total FROM ${T.SNAPSHOT}
    WHERE LOWER(status) IN ('completed', 'success', 'done')
      AND COALESCE(success_response_count, 0) = 0
  `);
  console.log(`Total: ${c72[0].total}`);

  const { rows: c72_credits } = await q(`
    SELECT COUNT(*)::int AS n, SUM(credits_consumed)::int AS total_credits
    FROM ${T.SNAPSHOT}
    WHERE LOWER(status) IN ('completed', 'success', 'done')
      AND COALESCE(success_response_count, 0) = 0
      AND credits_consumed > 0
  `);
  console.log(`Of those, with credits_consumed > 0 (billed for nothing): ${c72_credits[0].n} | total credits: ${c72_credits[0].total_credits}`);

  const { rows: c72_recent } = await q(`
    SELECT COUNT(*)::int AS n FROM ${T.SNAPSHOT}
    WHERE LOWER(status) IN ('completed', 'success', 'done')
      AND COALESCE(success_response_count, 0) = 0
      AND completed_at > NOW() - INTERVAL '7 days'
  `);
  console.log(`Of those, completed in last 7 days: ${c72_recent[0].n}`);

  const { rows: c72_triggers } = await q(`
    SELECT trigger, COUNT(*)::int AS n
    FROM ${T.SNAPSHOT}
    WHERE LOWER(status) IN ('completed', 'success', 'done')
      AND COALESCE(success_response_count, 0) = 0
    GROUP BY trigger ORDER BY n DESC LIMIT 5
  `);
  console.log('By trigger type:');
  c72_triggers.forEach((r: any) => console.log(`  ${r.trigger}: ${r.n}`));


  // ── DB-121: Paid responses never analysed ──────────────────────────────────
  console.log('\n════ DB-121: Successful LLM responses with no sentiment/citation rows (7d) ════');
  const { rows: r121 } = await q(`
    SELECT COUNT(*)::int AS n FROM ${T.RESPONSE} r
    WHERE r.success = true
      AND r.created > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (SELECT 1 FROM ${T.SENTIMENT} sa WHERE sa.query_response_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM ${T.CITATION}  c  WHERE c.query_response_id  = r.id)
  `);
  console.log(`Total orphaned responses (7d): ${r121[0].n}`);

  // Which snapshot statuses do these responses belong to?
  const { rows: r121_snap } = await q(`
    SELECT s.status, COUNT(*)::int AS n
    FROM ${T.RESPONSE} r
    JOIN ${T.SNAPSHOT} s ON r.snapshot_id = s.id
    WHERE r.success = true
      AND r.created > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (SELECT 1 FROM ${T.SENTIMENT} sa WHERE sa.query_response_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM ${T.CITATION}  c  WHERE c.query_response_id  = r.id)
    GROUP BY s.status ORDER BY n DESC
  `);
  console.log('Parent snapshot statuses:');
  r121_snap.forEach((r: any) => console.log(`  status="${r.status}": ${r.n} responses`));

  // Are these snapshots stuck or completed?
  const { rows: r121_completed } = await q(`
    SELECT COUNT(DISTINCT r.snapshot_id)::int AS n
    FROM ${T.RESPONSE} r
    JOIN ${T.SNAPSHOT} s ON r.snapshot_id = s.id
    WHERE r.success = true
      AND r.created > NOW() - INTERVAL '7 days'
      AND LOWER(s.status) IN ('completed', 'success', 'done')
      AND NOT EXISTS (SELECT 1 FROM ${T.SENTIMENT} sa WHERE sa.query_response_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM ${T.CITATION}  c  WHERE c.query_response_id  = r.id)
  `);
  console.log(`Distinct completed snapshots with orphaned responses: ${r121_completed[0].n}`);


  // ── DB-122: Completed snapshots with no platform metrics ──────────────────
  console.log('\n════ DB-122: Completed snapshots with no platform metrics (7d) ════');
  const { rows: r122 } = await q(`
    SELECT COUNT(*)::int AS n FROM ${T.SNAPSHOT} s
    WHERE LOWER(s.status) IN ('completed', 'success', 'done')
      AND s.completed_at IS NOT NULL
      AND s.completed_at > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM ${T.SNAP_METRICS} m WHERE m.snapshot_id = s.id
      )
  `);
  console.log(`Total (7d): ${r122[0].n}`);

  // Do these snapshots have response data at all?
  const { rows: r122_responses } = await q(`
    SELECT COUNT(*)::int AS with_responses, COUNT(*)::int AS total
    FROM ${T.SNAPSHOT} s
    WHERE LOWER(s.status) IN ('completed', 'success', 'done')
      AND s.completed_at IS NOT NULL
      AND s.completed_at > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (SELECT 1 FROM ${T.SNAP_METRICS} m WHERE m.snapshot_id = s.id)
      AND EXISTS (
        SELECT 1 FROM ${T.RESPONSE} r
        WHERE r.snapshot_id = s.id AND r.success = true
      )
  `);
  console.log(`Of those, have at least 1 successful response: ${r122_responses[0].with_responses}`);

  // Credits charged on these snapshots?
  const { rows: r122_credits } = await q(`
    SELECT COUNT(*)::int AS n, SUM(s.credits_consumed)::int AS total_credits
    FROM ${T.SNAPSHOT} s
    WHERE LOWER(s.status) IN ('completed', 'success', 'done')
      AND s.completed_at IS NOT NULL
      AND s.completed_at > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (SELECT 1 FROM ${T.SNAP_METRICS} m WHERE m.snapshot_id = s.id)
      AND s.credits_consumed > 0
  `);
  console.log(`With credits charged (billed, no metrics written): ${r122_credits[0].n} | credits: ${r122_credits[0].total_credits}`);

}

main().finally(closePool);
