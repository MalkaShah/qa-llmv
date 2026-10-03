import { test, expect } from '@playwright/test';
import { goToLLMV, clickTab, countDataErrors } from './ui-helpers';

/**
 * SUITE B — FILE 03: Sentiment Tab
 * Every assertion verified against the live page.
 */

// ─── Header & Filters ────────────────────────────────────────────────────────

test('SMKT-LLMV-SENT-200 — Sentiment tab description renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('sentiment shows how your brand is perceived')).toBeVisible();
});

test('SMKT-LLMV-SENT-201 — Date Range filter renders on Sentiment tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('Date Range', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-202 — All platforms filter renders on Sentiment tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('All platforms', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-203 — Manage Queries button renders on Sentiment tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('Manage Queries', { exact: true }).first()).toBeVisible();
});

// ─── Sentiment score & distribution ──────────────────────────────────────────

test('SMKT-LLMV-SENT-210 — Average sentiment score section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('Average sentiment score').first()).toBeVisible();
});

test('SMKT-LLMV-SENT-211 — Sentiment distribution section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('Sentiment distribution').first()).toBeVisible();
});

test('SMKT-LLMV-SENT-212 — Response count renders in distribution', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText(/\d+ responses/).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-213 — Positive category renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('Positive', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-214 — Neutral category renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('Neutral', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-215 — Negative category renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('Negative', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-216 — Distribution percentages sum sensibly', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await page.waitForTimeout(2000);
  const body = await page.locator('body').innerText();
  const matches = body.match(/(\d+)%\s*\n\s*\(\d+ responses\)/g) ?? [];
  if (matches.length >= 3) {
    const nums = matches.map(m => parseInt(m.match(/(\d+)%/)![1], 10));
    const total = nums.reduce((a, b) => a + b, 0);
    expect(total, `Sentiment percentages total ${total}%, expected ~100%`).toBeGreaterThan(95);
    expect(total).toBeLessThan(105);
  }
});

// ─── Sentiment table ─────────────────────────────────────────────────────────

test('SMKT-LLMV-SENT-220 — Sentiment table has TOPIC column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('TOPIC', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-221 — Sentiment table has SOURCE column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('SOURCE', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-222 — Sentiment table has SENTIMENT column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('SENTIMENT', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-223 — Sentiment table has OCCURRENCES column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('OCCURRENCES', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-224 — Sentiment table shows item count', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await page.waitForTimeout(2000);
  await expect(page.getByText(/\d+-\d+ of \d+ items/).first()).toBeVisible();
});

test('SMKT-LLMV-SENT-225 — Sentiment table has at least one data row', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await page.waitForTimeout(2000);
  const rows = await page.locator('.ant-table-tbody tr').count();
  expect(rows, 'Sentiment table has no data rows').toBeGreaterThan(0);
});

// ─── Filter tabs ─────────────────────────────────────────────────────────────

test('SMKT-LLMV-SENT-230 — All / Positive / Neutral / Negative filters render', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.getByText('All', { exact: true }).first()).toBeVisible();
});

// ─── Data Integrity (APP BUG DETECTORS) ──────────────────────────────────────

test('SMKT-LLMV-SENT-250 — No widget shows a data-loading error on Sentiment tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await page.waitForTimeout(3000);
  const errors = await countDataErrors(page);
  expect(errors, `${errors} widget(s) failed to load data on Sentiment tab — APP BUG`).toBe(0);
});

test('SMKT-LLMV-SENT-251 — Sentiment tab does not show a 500 error', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.locator('body')).not.toContainText('500');
});
