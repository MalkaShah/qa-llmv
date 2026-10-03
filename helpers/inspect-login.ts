/**
 * inspect-login.ts
 * Run once to find the real login form selectors.
 * Run: npx ts-node helpers/inspect-login.ts
 */
import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.db') });

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto(`${process.env.LLMV_BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // Print all input fields on the page
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(el => ({
      type:        el.type,
      name:        el.name,
      id:          el.id,
      placeholder: el.placeholder,
      ariaLabel:   el.getAttribute('aria-label'),
      className:   el.className.slice(0, 60),
    }));
  });

  // Print all buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(el => ({
      text:      el.innerText.trim().slice(0, 60),
      type:      el.type,
      id:        el.id,
      className: el.className.slice(0, 60),
    }));
  });

  console.log('\n=== INPUT FIELDS ===');
  console.log(JSON.stringify(inputs, null, 2));

  console.log('\n=== BUTTONS ===');
  console.log(JSON.stringify(buttons, null, 2));

  await browser.close();
})();
