/**
 * ui-helpers.ts
 * Shared helpers for all Suite B (UI) specs.
 * All selectors verified against the live page DOM — no guesses.
 */

export const LLMV_URL =
  'https://dashboard.searchatlas.com/site-explorer/llm-visibility/843571?domain=microsoft.com&country_code=us';

/** Text shown when a widget fails to load its data. */
export const DATA_ERROR = 'Something unexpected happened while loading your data';

/**
 * Removes the "AI Visibility is now more flexible" modal overlay that blocks clicks.
 * Only removes the specific overlay — never touches page content.
 */
export async function dismissModal(page: any) {
  try {
    await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      for (const el of divs) {
        const cls = typeof el.className === 'string' ? el.className : '';
        const isOverlay = cls.includes('z-[1050]') || cls.includes('z-[1060]');
        const txt = (el as HTMLElement).innerText ?? '';
        const isModal =
          txt.includes('AI Visibility is now more flexible') ||
          txt.includes('AI Visibility now uses AI Visibility Credits');
        if (isOverlay && isModal) {
          el.remove();
          return;
        }
      }
    });
    await page.waitForTimeout(300);
  } catch {
    // no modal present
  }
}

/** Clicks an Ant Design tab by its exact visible text. */
export async function clickTab(page: any, name: string) {
  await dismissModal(page);
  await page.locator('.ant-tabs-tab-btn', { hasText: name }).first().click();
  await page.waitForTimeout(2500);
}

/** Navigates to the LLMV project page and waits for tabs to render. */
export async function goToLLMV(page: any) {
  await page.goto(LLMV_URL);
  await page.waitForSelector('.ant-tabs-tab-btn', { timeout: 20000 });
  await page.waitForTimeout(2500);
  await dismissModal(page);
}

/**
 * Returns how many widgets on the current tab failed to load data.
 * Any count > 0 is an APP BUG.
 */
export async function countDataErrors(page: any): Promise<number> {
  return page.locator(`text=${DATA_ERROR}`).count();
}
