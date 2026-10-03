import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Client } = require('pg');
dotenv.config({ path: '.env.db' });
const c = new Client({
  host: process.env.LLMV_DB_HOST, port: Number(process.env.LLMV_DB_PORT||5432),
  database: process.env.LLMV_DB_NAME||'llmv_db', user: process.env.LLMV_DB_USER,
  password: process.env.LLMV_DB_PASS, ssl:{rejectUnauthorized:false},
  connectionTimeoutMillis:15000, query_timeout:15000,
});
await c.connect();
const q = async (label, sql) => {
  try { const r = await c.query(sql); console.log(`\n=== ${label} ===`); console.table(r.rows); }
  catch(e){ console.log(`\n=== ${label} FAILED: ${e.message.split('\n')[0]}`); }
};

await q('llmv_topic columns', `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='llmv_topic' ORDER BY ordinal_position`);
await q('llmv_query columns', `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='llmv_query' ORDER BY ordinal_position`);
await q('M2M table for query-snapshot', `SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%query%snapshot%' OR table_name ILIKE '%snapshot%query%'`);
await q('user profile table', `SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%profile%' OR table_name ILIKE '%user%' ORDER BY table_name LIMIT 15`);

await c.end();
