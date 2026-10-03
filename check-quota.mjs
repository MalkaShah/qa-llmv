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

const { rows } = await p.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_name = 'llmv_userprofile'
   ORDER BY ordinal_position`
);
console.log('llmv_userprofile columns:');
console.log(rows.map(r => r.column_name));
await p.end();
