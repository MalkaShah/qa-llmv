/**
 * find-manage-queries.mjs
 * Opens the Manage Queries panel and dumps its form fields.
 * Run: node find-manage-queries.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = 'https://dashboard.searchatlas.com/site-explorer/llm-visibility/843571?domain=microsoft.com&country_code=us';

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ storageState: 'auth-state.json' });
const page = await ctx.newPage();

await page.goto(URL);
await page.waitForSelector('.ant-tabs-tab-btn', { timeout: 20000 });
await page.waitForTimeout(4000);

const killModal = async () => {
  await page.evaluate(() => {
    document.querySelectorAll('div').forEach(el => {
      const c = typeof el.className === 'string' ? el.className : '';
      if ((c.includes('z-[1050]') || c.includes('z-[1060]')) && el.innerText?.includes('AI Visibility')) el.remove();
    });
  });
};
await killModal();

// The control is a DIV — click it directly via the DOM so we hit the right node.
const clicked = await page.evaluate(() => {
  for (const el of Array.from(document.querySelectorAll('div'))) {
    if ((el.innerText ?? '').trim() === 'Manage Queries' && el.children.length === 0) {
      // Click the styled parent that carries the button classes
      const target = el.closest('div[class*="bg-brand-primary"]') ?? el.parentElement ?? el;
      target.click();
      return String(target.className).slice(0, 60);
    }
  }
  return null;
});
console.log('Clicked element class:', clicked);

await page.waitForTimeout(5000);
await killModal();

const panel = await page.evaluate(() => ({
  url: window.location.href,
  text: document.body.innerText.slice(-3000),
  inputs: Array.from(document.querySelectorAll('input, textarea')).map(el => ({
    tag: el.tagName,
    type: el.type,
    placeholder: el.placeholder,
    name: el.name,
    cls: String(el.className).slice(0, 60),
  })),
  buttons: Array.from(document.querySelectorAll('button, [role="button"]'))
    .map(x => x.innerText.trim()).filter(Boolean).slice(0, 40),
  clickableDivs: Array.from(document.querySelectorAll('div[class*="bg-brand"], div[class*="cursor-pointer"]'))
    .map(x => x.innerText.trim().slice(0, 40)).filter(Boolean).slice(0, 25),
}));

console.log('\n=== PANEL STATE ===');
console.log(JSON.stringify(panel, null, 2));

await b.close();
