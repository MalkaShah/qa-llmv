require('dotenv').config({path:'.env.db'});
const { Client } = require('pg');

const T_PROJECTS = 'llmv_project';
const T_QUERIES = 'llmv_query';
const T_TOPICS = 'llmv_topic';
const T_SENTIMENT = 'llmv_responsesentimentanalysis';
const T_VIS_TREND = 'llmv_analysissnapshot';
const T_PS_PROMPTS = 'ps_promptanalysis';
const T_PLATFORMS = 'llmv_platformstatus';
const T_CITATIONS = 'llmv_responsecitationanalysis';

const queries = {
  'DB-010 (projects cols)': `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='${T_PROJECTS}' ORDER BY ordinal_position;`,
  'DB-011 (queries source col)': `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='${T_QUERIES}' ORDER BY ordinal_position;`,
  'DB-012 (sentiment project_id)': `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='${T_SENTIMENT}' ORDER BY ordinal_position;`,
  'DB-013 (vis_trend date col + index)': `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '${T_VIS_TREND}';`,
  'DB-014a (ps_prompts target_domain nullability)': `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='${T_PS_PROMPTS}' AND column_name IN ('target_domain','user_id','customer_id','country_code');`,
  'DB-014b (target_domain NULL ratio - actual investigation)': `SELECT COUNT(*) AS total, COUNT(target_domain) AS non_null, COUNT(*) - COUNT(target_domain) AS null_count FROM ${T_PS_PROMPTS};`,
  'DB-016 (FK constraints -> projects)': `SELECT tc.table_name AS child_table, kcu.column_name AS fk_column, ccu.table_name AS parent_table, rc.update_rule, rc.delete_rule FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = '${T_PROJECTS}' ORDER BY child_table;`,
  'DB-017 (platform table FK -> projects, or lack thereof)': `SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS references_table FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = '${T_PLATFORMS}' ORDER BY kcu.column_name;`,
  'DB-017b (project.selected_platforms sample - actual FIND-007 storage)': `SELECT id, project_name, selected_platforms FROM ${T_PROJECTS} WHERE is_active = true ORDER BY modified DESC LIMIT 5;`,
  'DB-018 (citations table FK chain)': `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name = '${T_CITATIONS}' ORDER BY ordinal_position;`,
};

(async () => {
  const c = new Client({
    host: process.env.LLMV_DB_HOST, port: parseInt(process.env.LLMV_DB_PORT),
    database: process.env.LLMV_DB_NAME, user: process.env.LLMV_DB_USER, password: process.env.LLMV_DB_PASS,
    connectionTimeoutMillis: 8000,
  });
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
