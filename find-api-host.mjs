/**
 * find-api-host.mjs
 * Intercepts all network requests made by the dashboard to find the real API host.
 * Run: node find-api-host.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.db' });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: 'auth-state.json'
});

const apiCalls = new Set();

// Intercept ALL network requests
context.on('request', req => {
  const url = req.url();
  const method = req.method();
  // Only capture XHR/fetch calls, not static assets
  if (!url.includes('.js') && !url.includes('.css') && !url.includes('.png') &&
      !url.includes('.ico') && !url.includes('analytics') && !url.includes('hotjar') &&
      !url.includes('google') && method !== 'OPTIONS') {
    apiCalls.add(`${method} ${url}`);
  }
});

const page = await context.newPage();

console.log('Loading dashboard...');
await page.goto(`${process.env.LLMV_BASE_URL}/llm-visibility`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Also try navigating to home to catch initial auth/user calls
await page.goto(`${process.env.LLMV_BASE_URL}/home`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

console.log('\n=== All API calls intercepted ===');
const sorted = [...apiCalls].sort();
for (const call of sorted) {
  console.log(call);
}

// Extract unique hosts
const hosts = new Set();
for (const call of apiCalls) {
  try {
    const url = new URL(call.split(' ')[1]);
    hosts.add(url.origin);
  } catch(e) {}
}

console.log('\n=== Unique API hosts ===');
for (const h of hosts) console.log(h);

await browser.close();
