require('dotenv').config({path:'.env.db'});
const { Client } = require('pg');

const queries = {
  'DB-000': `SELECT current_database(), current_user, pg_postmaster_start_time()::text AS started_at, version();`,
  'DB-001': `SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp','pgcrypto','pg_trgm') ORDER BY extname;`,
  'DB-002': `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;`,
  'DB-003': `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name ILIKE '%project%' ORDER BY table_name, ordinal_position;`,
  'DB-004': `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND (table_name ILIKE '%quer%' OR table_name ILIKE '%topic%') ORDER BY table_name, ordinal_position;`,
  'DB-005': `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name ILIKE '%platform%' ORDER BY table_name, ordinal_position;`,
  'DB-006': `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND (table_name ILIKE '%sentiment%' OR table_name ILIKE '%visibility%' OR table_name ILIKE '%trend%' OR table_name ILIKE '%snapshot%') ORDER BY table_name, ordinal_position;`,
  'DB-007': `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND (table_name ILIKE '%prompt%' OR table_name ILIKE '%ps_%' OR table_name ILIKE '%analysis%') ORDER BY table_name, ordinal_position;`,
  'DB-008': `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND (table_name ILIKE '%credit%' OR table_name ILIKE '%quota%' OR table_name ILIKE '%billing%' OR table_name ILIKE '%usage%') ORDER BY table_name, ordinal_position;`,
  'DB-009': `SELECT table_name, COUNT(*) AS deleted_at_cols FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('deleted_at','is_deleted','is_active','archived_at') GROUP BY table_name ORDER BY table_name;`,
};

(async () => {
  const c = new Client({
    host: process.env.LLMV_DB_HOST,
    port: parseInt(process.env.LLMV_DB_PORT),
    database: process.env.LLMV_DB_NAME,
    user: process.env.LLMV_DB_USER,
    password: process.env.LLMV_DB_PASS,
    connectionTimeoutMillis: 8000,
  });
  await c.connect();
  for (const [id, sql] of Object.entries(queries)) {
    try {
      const r = await c.query(sql);
      console.log(`\n=== ${id} (${r.rowCount} rows) ===`);
      console.log(JSON.stringify(r.rows, null, 0));
    } catch (e) {
      console.log(`\n=== ${id} ERROR ===`);
      console.log(e.message);
    }
  }
  await c.end();
})();
