import { test, expect } from '@playwright/test';
import { goToLLMV, clickTab, countDataErrors } from './ui-helpers';

/**
 * SUITE B — FILE 02: Visibility Tab
 * Every assertion verified against the live page.
 */

// ─── Header & Filters ────────────────────────────────────────────────────────

test('SMKT-LLMV-VIS-100 — Visibility tab description renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('measures how often AI models mention your brand')).toBeVisible();
});

test('SMKT-LLMV-VIS-101 — Date Range filter renders on Visibility tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('Date Range', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-102 — All platforms filter renders on Visibility tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('All platforms', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-103 — Manage Competitors button renders on Visibility tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('Manage Competitors', { exact: true }).first()).toBeVisible();
});

// ─── Visibility Score section ────────────────────────────────────────────────

test('SMKT-LLMV-VIS-110 — Visibility Score section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('Visibility Score', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-111 — Compare competitors toggle renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('Compare competitors', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-112 — Visibility Score Rank table renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('Visibility Score Rank').first()).toBeVisible();
});

test('SMKT-LLMV-VIS-113 — Visibility Score Rank table has BRAND column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('BRAND', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-114 — Visibility Score Rank table has ranked brands', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await page.waitForTimeout(2000);
  await expect(page.getByText('1. microsoft.com').first()).toBeVisible();
});

// ─── Share of Voice section ──────────────────────────────────────────────────

test('SMKT-LLMV-VIS-120 — Share Of Voice section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('Share Of Voice').first()).toBeVisible();
});

test('SMKT-LLMV-VIS-121 — Share of Voice Rank table renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('Share of Voice Rank').first()).toBeVisible();
});

test('SMKT-LLMV-VIS-122 — Share of Voice Rank table has SHARE OF VOICE column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('SHARE OF VOICE', { exact: true }).first()).toBeVisible();
});

// ─── Competitor Comparison table ─────────────────────────────────────────────

test('SMKT-LLMV-VIS-130 — Competitor Comparison table renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('Competitor Comparison').first()).toBeVisible();
});

test('SMKT-LLMV-VIS-131 — Export CSV button renders on Competitor Comparison', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('Export CSV', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-132 — Competitor Comparison has DOMAIN column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('DOMAIN', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-133 — Competitor Comparison has CITATIONS column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('CITATIONS', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-134 — Competitor Comparison has RANK column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('RANK', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-135 — Competitor Comparison has VS BRAND column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('VS BRAND', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-136 — Last updated timestamp renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();
});

// ─── Citations section ───────────────────────────────────────────────────────

test('SMKT-LLMV-VIS-140 — Citations by Platform section renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('Citations by Platform').first()).toBeVisible();
});

test('SMKT-LLMV-VIS-141 — CITATIONS SOURCES table renders', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText(/CITATIONS SOURCES/i).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-142 — Citations table has COUNT column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('COUNT', { exact: true }).first()).toBeVisible();
});

test('SMKT-LLMV-VIS-143 — Citations table has SHARE column', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.getByText('SHARE', { exact: true }).first()).toBeVisible();
});

// ─── Data Integrity (APP BUG DETECTORS) ──────────────────────────────────────

test('SMKT-LLMV-VIS-150 — No widget shows a data-loading error on Visibility tab', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await page.waitForTimeout(3000);
  const errors = await countDataErrors(page);
  expect(errors, `${errors} widget(s) failed to load data on Visibility tab — APP BUG`).toBe(0);
});

test('SMKT-LLMV-VIS-151 — Visibility tab does not show a 500 error', async ({ page }) => {
  await goToLLMV(page);
  await clickTab(page, 'Visibility');
  await expect(page.locator('body')).not.toContainText('500');
});
