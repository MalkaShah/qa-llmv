/**
 * check-topics-gap.mjs
 * Investigates why the API reports 5 topics while the DB holds 7 for forbes.com.
 * Run: node check-topics-gap.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Pool } = require('pg');
dotenv.config({ path: '.env.db' });

const PROJECT_ID = '2f64a1f2-1f2f-487b-857d-b075ebddb5d9';

const p = new Pool({
  host: process.env.LLMV_DB_HOST,
  port: 5432,
  database: 'llmv_db',
  user: process.env.LLMV_DB_USER,
  password: process.env.LLMV_DB_PASS,
  ssl: { rejectUnauthorized: false },
});

// 1. How many projects share this brand?
const brand = await p.query(`
  SELECT p.brand_id::text, b.domain,
         COUNT(*) OVER () AS projects_on_brand
  FROM llmv_project p
  JOIN llmv_brand b ON p.brand_id = b.id
  WHERE p.brand_id = (SELECT brand_id FROM llmv_project WHERE id = $1)
    AND p.is_deleted = false
`, [PROJECT_ID]);
console.log('\n=== Projects sharing this brand ===');
console.table(brand.rows);

// 2. All topics on the brand
const topics = await p.query(`
  SELECT t.id::text AS topic_id, t.title, t.source,
         t.customer_id, t.created
  FROM llmv_topic t
  WHERE t.brand_id = (SELECT brand_id FROM llmv_project WHERE id = $1)
    AND t.is_deleted = false
  ORDER BY t.created
`, [PROJECT_ID]);
console.log('\n=== All topics on this brand (DB) ===');
console.table(topics.rows);

// 3. Which topics have queries attached?
const withQueries = await p.query(`
  SELECT t.id::text AS topic_id, t.title,
         COUNT(q.id)::int AS query_count
  FROM llmv_topic t
  LEFT JOIN llmv_query q ON q.topic_id = t.id AND q.is_deleted = false
  WHERE t.brand_id = (SELECT brand_id FROM llmv_project WHERE id = $1)
    AND t.is_deleted = false
  GROUP BY t.id, t.title
  ORDER BY query_count DESC
`, [PROJECT_ID]);
console.log('\n=== Topics with query counts ===');
console.table(withQueries.rows);

// 4. The project's own customer_id for comparison
const proj = await p.query(
  `SELECT customer_id, country_code, is_active FROM llmv_project WHERE id = $1`,
  [PROJECT_ID]
);
console.log('\n=== Project ===');
console.table(proj.rows);

await p.end();
