import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.db') });

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 1,

  reporter: [
    ['line'],
    ['./reporters/qa-reporter.ts'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    headless: true,
    storageState: 'auth-state.json',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    },
  },

  projects: [
    { name: 'api', testDir: './tests/api', fullyParallel: false, workers: 1 },
    { name: 'ui',  testDir: './tests/ui',  fullyParallel: true,  workers: 4 },

    // Suite DB — read-only SQL, no browser. Longer timeout for large-table scans.
    {
      name: 'db',
      testDir: './tests/db',
      fullyParallel: false,
      workers: 1,
      retries: 0,
      timeout: 180_000,
      use: { storageState: undefined },
    },

    { name: 'e2e', testDir: './tests/e2e', fullyParallel: false, workers: 1 },
  ],
});
