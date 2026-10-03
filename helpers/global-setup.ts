/**
 * global-setup.ts
 * Verifies the persistent Chrome profile exists before any suite runs.
 * DB suite uses pg directly — no browser check needed.
 */
import * as fs from 'fs';
import * as path from 'path';

const PROFILE_PATH = 'C:/Users/HUAWEI/playwright-profile';

export default async function globalSetup() {
  // DB suite — no browser needed, skip check
  const project = process.env.PW_TEST_PROJECT ?? '';
  if (project === 'db') {
    console.log('✓ DB suite — pg client only, no browser check needed');
    return;
  }

  // All other suites — verify persistent profile exists
  if (!fs.existsSync(PROFILE_PATH)) {
    throw new Error(
      '\n\n❌  Persistent Chrome profile not found at: ' + PROFILE_PATH + '\n' +
      '    Run first:  node setup-persistent-profile.mjs\n' +
      '    Log in manually when the browser opens, then press ENTER.\n'
    );
  }

  // Verify token exists for API suite
  if (!process.env.LLMV_TOKEN) {
    throw new Error(
      '\n\n❌  LLMV_TOKEN not set in .env.db\n' +
      '    Get the token from Chrome DevTools → Application → Cookies → token\n'
    );
  }

  console.log('✓ Persistent Chrome profile found');
  console.log('✓ LLMV_TOKEN set');
  console.log('✓ Ready to run suites');
}
