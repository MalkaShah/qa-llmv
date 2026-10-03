/**
 * find-e2e-project.mjs
 * Lists candidate projects for the Suite C (E2E) fixture.
 * Run: node find-e2e-project.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Pool } = require('pg');
dotenv.config({ path: '.env.db' });

const p = new Pool({
  host: process.env.LLMV_DB_HOST,
  port: 5432,
  database: 'llmv_db',
  user: process.env.LLMV_DB_USER,
  password: process.env.LLMV_DB_PASS,
  ssl: { rejectUnauthorized: false },
});

const { rows } = await p.query(`
  SELECT
    p.id::text                      AS project_id,
    b.domain,
    p.country_code                  AS country,
    p.is_active,
    p.is_user_tracked,
    p.credit_cost_per_run           AS cost_per_run,
    p.frequency_days                AS freq_days,
    p.has_insufficient_credits      AS insufficient,
    (SELECT COUNT(*) FROM llmv_topic t
      WHERE t.brand_id = p.brand_id AND t.is_deleted = false)  AS topics,
    (SELECT COUNT(*) FROM llmv_analysissnapshot s
      WHERE s.project_id = p.id AND s.completed_at IS NOT NULL) AS snapshots
  FROM llmv_project p
  JOIN llmv_brand b ON p.brand_id = b.id
  WHERE p.is_deleted = false
    AND p.customer_id = 211944
  ORDER BY p.is_active DESC, p.credit_cost_per_run NULLS FIRST
  LIMIT 25
`);

console.table(rows);
console.log(`\nTotal projects under this customer: ${rows.length}`);
await p.end();
