import { chromium } from '@playwright/test';
import * as path from 'path';
import * as readline from 'readline';

(async () => {
  console.log('Opening browser — log in manually, then press ENTER here.');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto('https://dashboard.searchatlas.com/login');

  // Wait for you to log in manually
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(resolve => rl.question('\nPress ENTER once you are logged into the dashboard: ', resolve));
  rl.close();

  // Save session
  await context.storageState({ path: 'auth-state.json' });
  console.log('✓ auth-state.json saved');

  await browser.close();
})();