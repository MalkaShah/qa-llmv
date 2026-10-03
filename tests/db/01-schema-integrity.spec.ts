import { test, expect } from '@playwright/test';
import { q, count, closePool, T } from './db-helpers';

/**
 * SUITE DB — FILE 01: Schema Integrity
 *
 * NOTE: This is a Django application. Django creates implicit primary keys and
 * enforces many relationships at the ORM layer, so these checks read pg_constraint
 * rather than information_schema declarations.
 */

test.afterAll(async () => { await closePool(); });

test('DB-010 — All LLMV tables have a primary key', async () => {
  const { rows } = await q(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE 'llmv_%'
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint con
        WHERE con.conrelid = c.oid AND con.contype = 'p'
      )
    ORDER BY c.relname
  `);
  expect(rows.map(r => r.table_name), 'Tables missing a primary key').toEqual([]);
});

test('DB-011 — Foreign keys are declared on core LLMV tables', async () => {
  const { rows } = await q(`
    SELECT c.relname AS table_name, COUNT(*)::int AS fk_count
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND con.contype = 'f'
      AND c.relname LIKE 'llmv_%'
    GROUP BY c.relname
    ORDER BY fk_count DESC
  `);
  console.log(`[INFO] LLMV tables with foreign keys: ${rows.length}`);
  expect(rows.length, 'No foreign keys declared on any LLMV table').toBeGreaterThan(0);
});

test('DB-012 — llmv_project has expected core columns', async () => {
  const { rows } = await q(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [T.PROJECT]
  );
  const cols = rows.map(r => r.column_name);
  for (const expected of [
    'id', 'brand_id', 'user_id', 'customer_id', 'country_code',
    'is_active', 'is_deleted', 'frequency_days', 'credit_cost_per_run',
    'has_insufficient_credits', 'selected_platforms',
  ]) {
    expect(cols, `llmv_project missing column: ${expected}`).toContain(expected);
  }
});

test('DB-013 — llmv_creditusagelog has expected billing columns', async () => {
  const { rows } = await q(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [T.CREDITS]
  );
  const cols = rows.map(r => r.column_name);
  for (const expected of [
    'id', 'customer_id', 'action', 'credits_consumed',
    'balance_after', 'project_id', 'snapshot_id', 'reservation_id',
  ]) {
    expect(cols, `llmv_creditusagelog missing column: ${expected}`).toContain(expected);
  }
});

test('DB-014 — Soft-delete flag exists on all soft-deletable tables', async () => {
  for (const table of [T.PROJECT, T.BRAND, T.TOPIC, T.QUERY, T.SNAPSHOT, T.RESPONSE]) {
    const n = await count(`
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_name = $1 AND column_name = 'is_deleted'
    `, [table]);
    expect(n, `${table} has no is_deleted column`).toBe(1);
  }
});

test('DB-015 — Timestamp columns exist on all core tables', async () => {
  for (const table of [T.PROJECT, T.TOPIC, T.QUERY, T.SNAPSHOT, T.CREDITS]) {
    const n = await count(`
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_name = $1 AND column_name IN ('created', 'modified')
    `, [table]);
    expect(n, `${table} is missing created/modified columns`).toBe(2);
  }
});

test('DB-016 — Indexes exist on high-traffic analytics tables', async () => {
  for (const table of [T.RESPONSE, T.SENTIMENT, T.CITATION, T.SNAPSHOT]) {
    const n = await count(
      `SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
      [table]
    );
    expect(n, `${table} has no indexes — queries will table-scan`).toBeGreaterThan(0);
  }
});

test('DB-017 — Created timestamp is NOT NULL on all LLMV tables', async () => {
  const { rows } = await q(`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name LIKE 'llmv_%'
      AND column_name = 'created'
      AND is_nullable = 'YES'
    ORDER BY table_name
  `);
  expect(rows.map(r => r.table_name), 'Tables allow NULL created timestamp').toEqual([]);
});

test('DB-018 — Platform status table lists at least one enabled platform', async () => {
  const enabled = await count(
    `SELECT COUNT(*) FROM ${T.PLATFORM} WHERE is_enabled = true`
  );
  expect(enabled, 'No platforms are enabled').toBeGreaterThan(0);
});

test('DB-019 — Platform inventory is documented', async () => {
  const { rows } = await q(
    `SELECT platform, is_enabled FROM ${T.PLATFORM} ORDER BY platform`
  );
  console.log('[INFO] Platforms:',
    rows.map(r => `${r.platform}=${r.is_enabled ? 'on' : 'off'}`).join(', '));
  expect(rows.length, 'Platform status table is empty').toBeGreaterThan(0);
});
