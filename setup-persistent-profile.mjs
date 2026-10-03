/**
 * setup-persistent-profile.mjs
 * Run ONCE manually to log in and save the browser profile.
 * After this, all tests use the saved profile automatically.
 * 
 * Run: node setup-persistent-profile.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const readline = require('readline');

const PROFILE_PATH = 'C:/Users/HUAWEI/playwright-profile';

console.log('Opening browser with persistent profile...');
console.log('Profile path:', PROFILE_PATH);

const context = await chromium.launchPersistentContext(PROFILE_PATH, {
  headless: false,
  viewport: { width: 1280, height: 720 },
});

const page = await context.newPage();
await page.goto('https://dashboard.searchatlas.com/login');

console.log('\n>>> Log in manually in the browser window.');
console.log('>>> Once you see the dashboard, come back here and press ENTER.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await new Promise(resolve => rl.question('Press ENTER once logged in: ', resolve));
rl.close();

// Also save storageState for the API suite token
await context.storageState({ path: 'auth-state.json' });
console.log('✓ auth-state.json saved');
console.log('✓ Persistent profile saved to:', PROFILE_PATH);
console.log('\nYou only need to run this once. Tests will now use the saved profile.');

await context.close();
