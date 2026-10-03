import { test, expect } from '@playwright/test';
import { goToLLMV, clickTab, countDataErrors, DATA_ERROR } from './ui-helpers';

/**
 * SUITE B — FILE 01: Navigation & Summary Tab
 * Every assertion below is verified against the live page.
 * A failure here means the app changed or broke — treat as an APP BUG.
 */

// ─── 1. Navigation — Tabs ────────────────────────────────────────────────────

test('SMKT-LLMV-NAV-001 — All five main tabs render on page load', async ({ page }) => {
  await goToLLMV(page);
  for (const tab of ['Summary', 'Visibility', 'Sentiment', 'Topics & Queries', 'Prompt Simulator']) {
    await expect(page.locator('.ant-tabs-tab-btn', { hasText: tab }).first()).toBeVisible();
  }
});

test('SMKT-LLMV-NAV-002 — Summary tab activates on click', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.locator('.ant-tabs-tab-active', { hasText: 'Summary' }).first()).toBeVisible();
});

test('SMKT-LLMV-NAV-003 — Visibility tab activates on click', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.locator('.ant-tabs-tab-active', { hasText: 'Visibility' }).first()).toBeVisible();
});

test('SMKT-LLMV-NAV-004 — Sentiment tab activates on click', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Sentiment');
  await expect(page.locator('.ant-tabs-tab-active', { hasText: 'Sentiment' }).first()).toBeVisible();
});

test('SMKT-LLMV-NAV-005 — Topics & Queries tab activates on click', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Topics & Queries');
  await expect(page.locator('.ant-tabs-tab-active', { hasText: 'Topics & Queries' }).first()).toBeVisible();
});

test('SMKT-LLMV-NAV-006 — Prompt Simulator tab activates on click', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Prompt Simulator');
  await expect(page.locator('.ant-tabs-tab-active', { hasText: 'Prompt Simulator' }).first()).toBeVisible();
});

// ─── 2. Summary — Header & Filters ───────────────────────────────────────────

test('SMKT-LLMV-SUMMARY-010 — Summary description text renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('This is the summary of your brand visibility')).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-011 — Date Range filter renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Date Range', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-012 — Topics filter renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Topics', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-013 — All platforms filter renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('All platforms', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-014 — Manage Competitors button renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Manage Competitors', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-015 — Manage Queries button renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Manage Queries', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-016 — Re-run Analysis button renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Re-run Analysis', { exact: true }).first()).toBeVisible();
});

// ─── 3. Summary — Metric Cards ───────────────────────────────────────────────

test('SMKT-LLMV-SUMMARY-020 — Executive Snapshot section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Executive Snapshot', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-021 — Executive Snapshot contains generated text', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  const snapshot = page.getByText('Executive Snapshot', { exact: true }).first();
  await expect(snapshot).toBeVisible();
  // Snapshot must be followed by a non-empty AI-generated sentence
  const bodyText = await page.locator('body').innerText();
  const idx = bodyText.indexOf('Executive Snapshot');
  const after = bodyText.slice(idx + 18, idx + 250).trim();
  expect(after.length).toBeGreaterThan(20);
});

test('SMKT-LLMV-SUMMARY-022 — OVERALL VISIBILITY SCORE card renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('OVERALL VISIBILITY SCORE').first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-023 — OVERALL SENTIMENT card renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('OVERALL SENTIMENT').first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-024 — AVG CITATIONS / SCAN card renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('AVG CITATIONS / SCAN').first()).toBeVisible();
});

// ─── 4. Summary — Insight Sections ───────────────────────────────────────────

test('SMKT-LLMV-SUMMARY-030 — Trend Insight section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Trend Insight', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-031 — Visibility Trend chart renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Visibility Trend').first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-032 — Competitor Insight section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Competitor Insight', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-033 — Visibility vs Competitors chart renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Visibility vs Competitors').first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-034 — Competitor domains listed under chart', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('microsoft.com').first()).toBeVisible();
  await expect(page.getByText('google.com').first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-035 — Platform Insight section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Platform Insight', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-036 — Sentiment Insight section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Sentiment Insight', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-037 — Topics Insight section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText('Topics Insight', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-SUMMARY-038 — VISIBILITY PERFORMING TOPICS section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.getByText(/VISIBILITY PERFORMING TOPICS/i).first()).toBeVisible();
});

// ─── 5. Summary — Data Integrity (APP BUG DETECTORS) ─────────────────────────

test('SMKT-LLMV-SUMMARY-040 — No widget shows a data-loading error on Summary tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await page.waitForTimeout(3000);
  const errors = await countDataErrors(page);
  expect(errors, `${errors} widget(s) failed to load data on Summary tab — APP BUG`).toBe(0);
});

test('SMKT-LLMV-SUMMARY-041 — Summary page does not show a 500 error', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.locator('body')).not.toContainText('500');
});

test('SMKT-LLMV-SUMMARY-042 — Summary page does not show a generic failure message', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Summary');
  await expect(page.locator('body')).not.toContainText('Something went wrong. Try again later');
});
