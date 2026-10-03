/**
 * inspect-login.mjs
 * Run: node helpers/inspect-login.mjs
 */
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.db') });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page    = await context.newPage();

await page.goto(`${process.env.LLMV_BASE_URL}/login`);
await page.waitForLoadState('networkidle');

const inputs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('input')).map(el => ({
    type:        el.type,
    name:        el.name,
    id:          el.id,
    placeholder: el.placeholder,
    ariaLabel:   el.getAttribute('aria-label'),
  }))
);

const buttons = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button')).map(el => ({
    text: el.innerText.trim().slice(0, 80),
    type: el.type,
    id:   el.id,
  }))
);

console.log('\n=== INPUTS ===');
console.log(JSON.stringify(inputs, null, 2));
console.log('\n=== BUTTONS ===');
console.log(JSON.stringify(buttons, null, 2));

await browser.close();
