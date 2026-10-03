import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Pool } = require('pg');
dotenv.config({ path: '.env.db' });

const p = new Pool({
  host: process.env.LLMV_DB_HOST, port: 5432, database: 'llmv_db',
  user: process.env.LLMV_DB_USER, password: process.env.LLMV_DB_PASS,
  ssl: { rejectUnauthorized: false }
});

const tables = [
  'llmv_query', 'llmv_topic', 'llmv_responsesentimentanalysis',
  'llmv_analysissnapshot', 'llmv_creditusagelog', 'llmv_platformstatus',
  'llmv_queryresponse', 'llmv_responsecitationanalysis', 'ps_prompt',
  'llmv_snapshot_platform_metrics', 'llmv_snapshotcompetitor', 'auth_user'
];

for (const t of tables) {
  const { rows } = await p.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
  console.log(`\n${t}:`);
  console.log('  ' + rows.map(r => r.column_name).join(', '));
}
await p.end();
