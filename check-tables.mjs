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
  ssl: { rejectUnauthorized: false }
});

const tables = [
  'llmv_brandanalysisconfig',
  'llmv_creditusagelog',
  'llmv_brand',
  'llmv_project',
];

for (const table of tables) {
  const { rows } = await p.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  console.log(`\n${table}:`);
  console.log(rows.map(r => r.column_name));
}

await p.end();
