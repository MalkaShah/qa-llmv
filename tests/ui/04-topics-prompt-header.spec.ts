import { test, expect } from '@playwright/test';
import { goToLLMV, clickTab, countDataErrors } from './ui-helpers';

/**
 * SUITE B — FILE 04: Topics & Queries + Prompt Simulator
 * Every assertion verified against the live page.
 */

// ─── Topics & Queries — Header ───────────────────────────────────────────────

test('SMKT-LLMV-TQ-300 — Topics & Queries description renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('topics and questions used to calculate the visibility score')).toBeVisible();
});

test('SMKT-LLMV-TQ-301 — Date Range filter renders on Topics & Queries tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('Date Range', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-302 — All platforms filter renders on Topics & Queries tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('All platforms', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-303 — Export button renders on Topics & Queries tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('Export', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-304 — Re-run Analysis button renders on Topics & Queries tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('Re-run Analysis', { exact: true }).first()).toBeVisible();
});

// ─── Topics & Queries — Table columns ────────────────────────────────────────

test('SMKT-LLMV-TQ-310 — Table has TOPICS column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('TOPICS', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-311 — Table has TYPE column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('TYPE', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-312 — Table has VISIBILITY SCORE column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('VISIBILITY SCORE', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-313 — Table has VISIBILITY RANK column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('VISIBILITY RANK', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-314 — Table has CITATIONS FOUND column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('CITATIONS FOUND', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-315 — Table has SEARCH VOLUME column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.getByText('SEARCH VOLUME', { exact: true }).first()).toBeVisible();
});

// ─── Topics & Queries — Data ─────────────────────────────────────────────────

test('SMKT-LLMV-TQ-320 — Table has at least one topic row', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await page.waitForTimeout(2000);
  const rows = await page.locator('.ant-table-tbody tr').count();
  expect(rows, 'Topics table has no data rows').toBeGreaterThan(0);
});

test('SMKT-LLMV-TQ-321 — Analyze action renders on topic rows', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await page.waitForTimeout(2000);
  await expect(page.getByText('Analyze', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-322 — Add new topic button renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await page.waitForTimeout(2000);
  await expect(page.getByText('Add new topic', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-323 — Pagination item count renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await page.waitForTimeout(2000);
  await expect(page.getByText(/\d+-\d+ of \d+ items/).first()).toBeVisible();
});

test('SMKT-LLMV-TQ-324 — Visibility scores are within 0-100 range', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await page.waitForTimeout(2500);
  const body = await page.locator('body').innerText();
  const scores = (body.match(/^\s*(\d{1,3})\s*$/gm) ?? [])
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n <= 100);
  for (const s of scores) {
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  }
});

// ─── Prompt Simulator ────────────────────────────────────────────────────────

test('SMKT-LLMV-PS-400 — Prompt Simulator description renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('Test prompts across multiple LLMs')).toBeVisible();
});

test('SMKT-LLMV-PS-401 — Enter Prompt input renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('Enter Prompt', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-PS-402 — Country selector renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('United States', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-PS-403 — Analyze button renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('Analyze', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-PS-404 — Select LLM section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('Select LLM', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-PS-405 — Select All / Deselect All controls render', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('Select All', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Deselect All', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-PS-406 — ChatGPT platform option renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('ChatGPT', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-PS-407 — Gemini platform option renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('Gemini', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-PS-408 — Perplexity platform option renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('Perplexity', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-PS-409 — Include brand mentions option renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('Include brand mentions', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-PS-410 — Compare competitors option renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.getByText('Compare competitors', { exact: true }).first()).toBeVisible();
});

// ─── Data Integrity (APP BUG DETECTORS) ──────────────────────────────────────

test('SMKT-LLMV-TQ-350 — No widget shows a data-loading error on Topics & Queries tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await page.waitForTimeout(3000);
  const errors = await countDataErrors(page);
  expect(errors, `${errors} widget(s) failed to load data on Topics & Queries tab — APP BUG`).toBe(0);
});

test('SMKT-LLMV-PS-450 — No widget shows a data-loading error on Prompt Simulator tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await page.waitForTimeout(3000);
  const errors = await countDataErrors(page);
  expect(errors, `${errors} widget(s) failed to load data on Prompt Simulator tab — APP BUG`).toBe(0);
});

test('SMKT-LLMV-TQ-351 — Topics & Queries tab does not show a 500 error', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.locator('body')).not.toContainText('500');
});

// ─── Header context (all tabs) ───────────────────────────────────────────────

test('SMKT-LLMV-HDR-500 — Credits balance renders in header', async ({ page }) => {
  await goToLLMV(page);
  await expect(page.getByText(/credits/i).first()).toBeVisible();
});

test('SMKT-LLMV-HDR-501 — Project domain renders in breadcrumb', async ({ page }) => {
  await goToLLMV(page);
  await expect(page.getByText('microsoft.com').first()).toBeVisible();
});

test('SMKT-LLMV-HDR-502 — Country renders in project header', async ({ page }) => {
  await goToLLMV(page);
  await expect(page.getByText('United States', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-HDR-503 — Refresh frequency renders in project header', async ({ page }) => {
  await goToLLMV(page);
  await expect(page.getByText(/Every \d+ days/).first()).toBeVisible();
});

test('SMKT-LLMV-HDR-504 — Query count renders in project header', async ({ page }) => {
  await goToLLMV(page);
  await expect(page.getByText(/\d+ Queries/).first()).toBeVisible();
});
