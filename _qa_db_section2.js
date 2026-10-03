require('dotenv').config({path:'.env.db'});
const { Client } = require('pg');

const queries = {
  'DB-020 (orphaned queries - via topic->brand chain, real schema has no direct project FK)': `
    SELECT COUNT(*) AS orphaned_queries
    FROM llmv_query q
    LEFT JOIN llmv_topic t ON q.topic_id = t.id
    WHERE t.id IS NULL;`,
  'DB-020b (queries whose topic->brand has zero projects - true orphans)': `
    SELECT COUNT(*) AS orphaned_via_brand
    FROM llmv_query q
    JOIN llmv_topic t ON q.topic_id = t.id
    LEFT JOIN llmv_project p ON p.brand_id = t.brand_id
    WHERE p.id IS NULL;`,
  'DB-021 (orphaned topics - brand must exist)': `
    SELECT COUNT(*) AS orphaned_topics
    FROM llmv_topic t
    LEFT JOIN llmv_brand b ON t.brand_id = b.id
    WHERE b.id IS NULL;`,
  'DB-021b (topics whose brand has zero projects - true orphans)': `
    SELECT COUNT(*) AS orphaned_topics_no_project
    FROM llmv_topic t
    LEFT JOIN llmv_project p ON p.brand_id = t.brand_id
    WHERE p.id IS NULL;`,
  'DB-022 (projects with NULL/empty domain - via brand join)': `
    SELECT COUNT(*) AS null_domain_projects
    FROM llmv_project p
    JOIN llmv_brand b ON p.brand_id = b.id
    WHERE b.domain IS NULL OR TRIM(b.domain) = '';`,
  'DB-023 (projects with NULL/empty country_code)': `
    SELECT COUNT(*) AS null_country
    FROM llmv_project
    WHERE country_code IS NULL OR TRIM(country_code) = '';`,
  'DB-024 (queries with NULL/empty title)': `
    SELECT COUNT(*) AS bad_titles FROM llmv_query WHERE title IS NULL OR TRIM(title) = '';`,
  'DB-025 (duplicate title within same topic)': `
    SELECT topic_id, title, COUNT(*) AS dupe_count
    FROM llmv_query
    GROUP BY topic_id, title
    HAVING COUNT(*) > 1
    ORDER BY dupe_count DESC LIMIT 20;`,
  'DB-026 (duplicate topic title within same brand)': `
    SELECT brand_id, title, COUNT(*) AS dupe_count
    FROM llmv_topic
    GROUP BY brand_id, title
    HAVING COUNT(*) > 1
    ORDER BY dupe_count DESC LIMIT 20;`,
  'DB-027 (active projects with empty selected_platforms)': `
    SELECT COUNT(*) AS active_no_platforms
    FROM llmv_project
    WHERE is_active = TRUE AND (selected_platforms IS NULL OR jsonb_array_length(selected_platforms) = 0);`,
  'DB-028 (platform count exceeds 5 - stored as jsonb array now)': `
    SELECT id, project_name, jsonb_array_length(selected_platforms) AS platform_count
    FROM llmv_project
    WHERE jsonb_array_length(selected_platforms) > 5
    ORDER BY platform_count DESC;`,
  'DB-029 (future-dated created timestamps)': `
    SELECT 'projects' AS tbl, COUNT(*) AS future_rows FROM llmv_project WHERE created > NOW()
    UNION ALL SELECT 'queries', COUNT(*) FROM llmv_query WHERE created > NOW()
    UNION ALL SELECT 'topics', COUNT(*) FROM llmv_topic WHERE created > NOW();`,
  'BONUS (brands with multiple projects - architecture check)': `
    SELECT brand_id, COUNT(*) AS project_count FROM llmv_project GROUP BY brand_id HAVING COUNT(*) > 1 ORDER BY project_count DESC LIMIT 10;`,
};

(async () => {
  const c = new Client({host:process.env.LLMV_DB_HOST,port:parseInt(process.env.LLMV_DB_PORT),database:process.env.LLMV_DB_NAME,user:process.env.LLMV_DB_USER,password:process.env.LLMV_DB_PASS,connectionTimeoutMillis:8000});
  await c.connect();
  for (const [id, sql] of Object.entries(queries)) {
    try {
      const r = await c.query(sql);
      console.log(`\n=== ${id} (${r.rowCount} rows) ===`);
      console.log(JSON.stringify(r.rows));
    } catch (e) {
      console.log(`\n=== ${id} ERROR ===`);
      console.log(e.message);
    }
  }
  await c.end();
})();
