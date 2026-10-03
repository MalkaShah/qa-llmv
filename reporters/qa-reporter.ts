/**
 * qa-reporter.ts
 * Custom Playwright reporter for MalkaQA LLMV suites.
 *
 * Classifies every failure and produces a filable bug report with
 * description, reproduction steps, expected vs actual, and severity.
 *
 * Outputs:
 *   - console summary
 *   - qa-report.md   (shareable, ticket-ready)
 */
import type {
  Reporter, FullConfig, Suite, TestCase, TestResult, FullResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';

type Bucket = 'APP BUG' | 'TEST BUG' | 'FLAKY' | 'INFRA';
type Severity = 'P0' | 'P1' | 'P2';

interface Entry {
  id: string;
  title: string;
  cleanTitle: string;
  file: string;
  tab: string;
  bucket: Bucket;
  severity: Severity;
  reason: string;
  description: string;
  steps: string[];
  expected: string;
  actual: string;
  screenshot: string;
  retries: number;
}

const BASE_URL =
  'https://dashboard.searchatlas.com/site-explorer/llm-visibility/843571?domain=microsoft.com&country_code=us';

export default class QAReporter implements Reporter {
  private results = new Map<string, { test: TestCase; last: TestResult; attempts: TestResult[] }>();
  private warnings: string[] = [];
  private passed = 0;
  private skipped = 0;
  private started = Date.now();
  private total = 0;

  onBegin(_c: FullConfig, suite: Suite) {
    this.total = suite.allTests().length;
    console.log(`\n═══ MalkaQA — running ${this.total} tests ═══\n`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // console.log goes to stdout, console.warn goes to stderr — capture both
    for (const line of [...result.stdout, ...result.stderr]) {
      const s = String(line);
      if (s.includes('[BUG') || s.includes('[REGRESSION')) {
        // A single chunk can contain multiple lines
        for (const part of s.split('\n')) {
          if (part.includes('[BUG') || part.includes('[REGRESSION')) {
            this.warnings.push(part.trim());
          }
        }
      }
    }

    const key = test.id;
    const prev = this.results.get(key);
    if (prev) {
      prev.attempts.push(result);
      prev.last = result;
    } else {
      this.results.set(key, { test, last: result, attempts: [result] });
    }
  }

  // ── Classification ─────────────────────────────────────────────────────────

  private classify(msg: string, passedOnRetry: boolean): { bucket: Bucket; reason: string; severity: Severity } {
    if (passedOnRetry) {
      return { bucket: 'FLAKY', reason: 'Passed on retry — slow page load', severity: 'P2' };
    }
    if (msg.includes('APP BUG') || msg.includes('failed to load data')) {
      return { bucket: 'APP BUG', reason: 'Widget failed to load its data', severity: 'P0' };
    }
    if (/500/.test(msg) && msg.includes('toContainText')) {
      return { bucket: 'APP BUG', reason: 'Server 500 error rendered on page', severity: 'P0' };
    }
    if (msg.includes('Something went wrong')) {
      return { bucket: 'APP BUG', reason: 'Generic failure message rendered', severity: 'P0' };
    }
    if (msg.includes('auth-state.json') || msg.includes('Invalid token') || msg.includes('401')) {
      return { bucket: 'INFRA', reason: 'Auth token expired', severity: 'P1' };
    }
    if (msg.includes('Target page, context or browser has been closed')) {
      return { bucket: 'INFRA', reason: 'Browser closed unexpectedly', severity: 'P1' };
    }
    if (msg.includes('net::ERR') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      return { bucket: 'INFRA', reason: 'Network error', severity: 'P1' };
    }
    if (msg.includes('statement timeout') || msg.includes('Test timeout of')) {
      return { bucket: 'TEST BUG', reason: 'Query too slow — needs narrowing, result unknown', severity: 'P2' };
    }
    if (msg.includes("waiting for locator('.ant-tabs-tab-btn')")) {
      return { bucket: 'APP BUG', reason: 'Page did not render within 20s', severity: 'P1' };
    }
    if (msg.includes('intercepts pointer events')) {
      return { bucket: 'TEST BUG', reason: 'Click blocked by overlay', severity: 'P2' };
    }
    if (msg.includes('strict mode violation')) {
      return { bucket: 'TEST BUG', reason: 'Ambiguous selector', severity: 'P2' };
    }
    if (msg.includes('element(s) not found') || msg.includes('toBeVisible')) {
      return { bucket: 'APP BUG', reason: 'Expected element missing from page', severity: 'P1' };
    }
    return { bucket: 'APP BUG', reason: 'Assertion failed', severity: 'P1' };
  }

  private isDbTest(title: string, file: string): boolean {
    return /^DB-/.test(title) || file.includes('db');
  }

  private tabOf(title: string): string {
    if (/^DB-/.test(title))  return 'Database';
    if (/^E2E-/.test(title)) return 'Cross-layer';
    if (/^LLMV-API-/.test(title)) return 'API';
    if (/SUMMARY|NAV/.test(title)) return 'Summary';
    if (/VIS-/.test(title)) return 'Visibility';
    if (/SENT-/.test(title)) return 'Sentiment';
    if (/TQ-/.test(title)) return 'Topics & Queries';
    if (/PS-/.test(title)) return 'Prompt Simulator';
    if (/HDR-/.test(title)) return 'Page header';
    return 'LLMV page';
  }

  private extractLocator(msg: string): string {
    const m = msg.match(/Locator:\s*(.+)/);
    return m ? m[1].trim() : '';
  }

  private buildSteps(entry: Partial<Entry>, msg: string): string[] {
    // Cross-layer E2E tests reproduce via API + SQL
    if (entry.tab === 'Cross-layer') {
      return [
        'Ensure LLMV_TOKEN in .env.db is current (node set-token.mjs <TOKEN>)',
        'Connect to Twingate (postgres-llmv must resolve)',
        `Run: npx playwright test tests/e2e --project=e2e -g "${entry.id}"`,
        `Or reproduce manually: call the API endpoint and the SQL query defined in \`${entry.file ?? 'the spec file'}\` for ${entry.id} and compare the two results`,
      ];
    }

    // API tests reproduce via the API alone
    if (entry.tab === 'API') {
      return [
        'Ensure LLMV_TOKEN in .env.db is current (node set-token.mjs <TOKEN>)',
        `Call the endpoint defined in \`${entry.file ?? 'the spec file'}\` for case ${entry.id}`,
        'Compare the response status and body against the expected value below',
      ];
    }

    // Database tests reproduce via SQL, not the browser
    if (entry.tab === 'Database') {
      return [
        'Connect to Twingate (postgres-llmv must resolve)',
        'Connect to the llmv_db database with the read-only account',
        `Run the query defined in \`${entry.file ?? 'the spec file'}\` for case ${entry.id}`,
        'Compare the returned row count against the expected value below',
      ];
    }

    const steps = [
      `Log in to the SearchAtlas dashboard as the QA account`,
      `Navigate to: ${BASE_URL}`,
      `Dismiss the "AI Visibility is now more flexible" modal if it appears`,
    ];
    if (entry.tab && entry.tab !== 'Page header' && entry.tab !== 'LLMV page') {
      steps.push(`Click the "${entry.tab}" tab`);
    }
    steps.push(`Wait for the page content to finish loading (approx. 3 seconds)`);

    if (entry.reason?.includes('failed to load')) {
      steps.push(`Scroll through the tab and look for widgets showing an error state`);
    } else if (entry.reason?.includes('missing from page')) {
      const loc = this.extractLocator(msg);
      steps.push(`Look for the element${loc ? `: ${loc}` : ''}`);
    } else if (entry.reason?.includes('did not render')) {
      steps.push(`Observe whether the tab bar renders at all`);
    }
    return steps;
  }

  private buildDescription(entry: Partial<Entry>, msg: string): string {
    const t = entry.tab ?? 'the page';

    if (t === 'Cross-layer') {
      const detail = msg.split('\n').find(l => l.includes('Error:'))?.replace('Error:', '').trim() ?? '';
      return `An end-to-end consistency check found that two layers disagree. ${detail} When the API and the database report different values, the user is shown a figure the stored data does not support.`;
    }

    if (t === 'API') {
      const detail = msg.split('\n').find(l => l.includes('Error:'))?.replace('Error:', '').trim() ?? '';
      return `An API contract check failed. ${detail}`;
    }

    if (t === 'Database') {
      if (msg.includes('timeout')) {
        return `The verification query for this case did not complete within the timeout. This is usually a query-performance problem on a large table rather than a data defect — the check needs narrowing before the result can be trusted.`;
      }
      const n = msg.match(/Received:\s*(\d+)/)?.[1];
      const detail = msg.split('\n').find(l => l.includes('Error:'))?.replace('Error:', '').trim() ?? '';
      return `A data-integrity check against \`llmv_db\` returned ${n ?? 'one or more'} offending row(s). ${detail}`;
    }

    if (entry.reason?.includes('failed to load')) {
      const n = msg.match(/(\d+) widget\(s\)/)?.[1] ?? 'One or more';
      return `${n} widget(s) on the **${t}** tab display "Something unexpected happened while loading your data" instead of rendering their content. The underlying data request is failing, so the user sees an error card where a chart or metric should be.`;
    }
    if (entry.reason?.includes('missing from page')) {
      const loc = this.extractLocator(msg);
      return `An element expected on the **${t}** tab is not present in the DOM after the page finishes loading. ${loc ? `Missing: \`${loc}\`. ` : ''}This is typically a downstream symptom of a failed data request — when the API call fails, the component and its label never render.`;
    }
    if (entry.reason?.includes('did not render')) {
      return `The **${t}** page did not render its tab bar within the 20-second timeout. The page either never finished loading or the route returned an unexpected response.`;
    }
    if (entry.reason?.includes('500')) {
      return `A server 500 error is being rendered on the **${t}** tab. The backend returned an unhandled error to the frontend.`;
    }
    if (entry.bucket === 'FLAKY') {
      return `This test failed on the first attempt and passed on retry. **${t}** responds inconsistently — sometimes exceeding the wait threshold. Not a hard defect, but a performance signal worth monitoring.`;
    }

    // Fall back to the assertion message the spec author wrote — it always
    // explains the impact, because every expect() in this project carries one.
    const assertion = msg
      .split('\n')
      .map(l => l.trim())
      .find(l => l.startsWith('Error:') && l.length > 12)
      ?.replace(/^Error:\s*/, '');

    if (assertion) {
      return `${assertion} (checked against **${t}**)`;
    }

    const firstLine = msg.split('\n').map(l => l.trim()).find(Boolean) ?? '';
    return firstLine
      ? `An assertion failed while checking **${t}**: ${firstLine}`
      : `An assertion failed while checking **${t}**. See the actual result below.`;
  }

  private buildExpected(entry: Partial<Entry>): string {
    if (entry.tab === 'Database') {
      return 'The query returns zero offending rows.';
    }
    if (entry.tab === 'Cross-layer') {
      return 'Both layers report the same value.';
    }
    if (entry.tab === 'API') {
      return 'The endpoint returns the documented status and payload.';
    }
    if (entry.reason?.includes('failed to load')) {
      return 'All widgets render their data. No error cards are shown.';
    }
    if (entry.reason?.includes('missing from page')) {
      return `The element is visible on the ${entry.tab} tab.`;
    }
    if (entry.reason?.includes('did not render')) {
      return 'The tab bar renders within 20 seconds of page load.';
    }
    return 'The assertion passes.';
  }

  private buildActual(msg: string): string {
    const clean = msg.replace(/\u001b\[[0-9;]*m/g, '').split('\n');
    const relevant = clean.filter(l =>
      l.includes('Error:') || l.includes('Expected:') || l.includes('Received:') ||
      l.includes('Locator:') || l.includes('Timeout:')
    );
    return relevant.slice(0, 5).join('\n').trim() || clean.slice(0, 3).join(' ').trim();
  }

  // ── Report ─────────────────────────────────────────────────────────────────

  onEnd(_result: FullResult) {
    const dur = ((Date.now() - this.started) / 1000 / 60).toFixed(1);
    const entries: Entry[] = [];

    for (const { test, last, attempts } of this.results.values()) {
      if (last.status === 'skipped') { this.skipped++; continue; }

      const anyFailed = attempts.some(a => a.status === 'failed' || a.status === 'timedOut');
      const finallyPassed = last.status === 'passed';

      if (finallyPassed && !anyFailed) { this.passed++; continue; }

      const failedAttempt = attempts.find(a => a.status === 'failed' || a.status === 'timedOut');
      const msg = (failedAttempt?.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '');
      const { bucket, reason, severity } = this.classify(msg, finallyPassed);

      const id = this.idOf(test.title);
      const cleanTitle = id
        ? test.title.slice(id.length).replace(/^\s*[—–-]\s*/, '').trim()
        : test.title;
      const tab = this.tabOf(test.title);

      const partial: Partial<Entry> = {
        id, tab, bucket, reason, severity,
        file: test.location.file.split(/[\\/]/).pop() ?? '',
      };
      const screenshot = failedAttempt?.attachments.find(a => a.name === 'screenshot')?.path ?? '';

      entries.push({
        id, title: test.title, cleanTitle,
        file: test.location.file.split(/[\\/]/).pop() ?? '',
        tab, bucket, severity, reason,
        description: this.buildDescription(partial, msg),
        steps: this.buildSteps(partial, msg),
        expected: this.buildExpected(partial),
        actual: this.buildActual(msg),
        screenshot,
        retries: attempts.length - 1,
      });

      if (finallyPassed) this.passed++;
    }

    const by = (b: Bucket) => entries.filter(e => e.bucket === b);
    const appBugs = by('APP BUG').sort((a, b) => a.severity.localeCompare(b.severity));
    const testBugs = by('TEST BUG');
    const flaky = by('FLAKY');
    const infra = by('INFRA');

    // ── Console ──
    const loggedDefects = [...new Set(this.warnings)];

    console.log('\n═══════════════════════════════════════════════');
    console.log('  MalkaQA — TEST REPORT');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Total          : ${this.total}`);
    console.log(`  Passed         : ${this.passed}`);
    console.log(`  App bugs       : ${appBugs.length}`);
    console.log(`  Test bugs      : ${testBugs.length}`);
    console.log(`  Flaky          : ${flaky.length}`);
    console.log(`  Infra          : ${infra.length}`);
    console.log(`  Skipped        : ${this.skipped}`);
    console.log(`  Logged defects : ${loggedDefects.length}`);
    console.log(`  Duration       : ${dur} min`);
    console.log('═══════════════════════════════════════════════\n');

    const section = (name: string, list: Entry[], icon: string) => {
      if (!list.length) return;
      console.log(`${icon}  ${name} (${list.length})`);
      for (const e of list) {
        console.log(`   [${e.severity}] ${e.id}  ${e.cleanTitle}`);
        console.log(`         ↳ ${e.reason}`);
      }
      console.log('');
    };

    section('APP BUGS',  appBugs,  '🔴');
    section('TEST BUGS', testBugs, '🟡');
    section('INFRA',     infra,    '⚙️ ');
    section('FLAKY',     flaky,    '🔁');

    if (loggedDefects.length) {
      console.log(`📋  LOGGED DEFECTS — test passed, defect detected (${loggedDefects.length})`);
      for (const w of loggedDefects) {
        const m = w.match(/\[(BUG|REGRESSION)\s+([^\]]+)\]\s*(.*)/);
        if (m) {
          console.log(`   ${m[2].trim()}  ${m[3].trim()}`);
        } else {
          console.log(`   ${w}`);
        }
      }
      console.log('');
    }

    const grep = (l: Entry[]) => {
      const ids = [...new Set(l.map(e => e.id).filter(Boolean))];
      return ids.length ? ids.join('|') : null;
    };
    const gFlaky = grep(flaky), gApp = grep(appBugs), gTest = grep(testBugs);
    if (gFlaky) {
      console.log('🔁  RERUN FLAKY:');
      console.log(`   npx playwright test --workers=1 -g "${gFlaky}"\n`);
    }
    if (gApp) {
      console.log('🔴  RERUN APP BUGS (verify after fix):');
      console.log(`   npx playwright test --workers=1 -g "${gApp}"\n`);
    }
    if (gTest) {
      console.log('🟡  RERUN TEST BUGS (after fixing specs):');
      console.log(`   npx playwright test --workers=1 -g "${gTest}"\n`);
    }
    if (infra.length) {
      console.log('⚙️   FIX INFRA FIRST:');
      console.log('   node set-token.mjs <FRESH_TOKEN>');
      console.log('   npx playwright test --workers=1\n');
    }

    // ── Markdown ──
    const projectNames = [...new Set(
      [...this.results.values()].map(r => r.test.parent.project()?.name ?? 'suite')
    )];
    const suiteLabel = projectNames.map(p => p.toUpperCase()).join(' + ');

    const md: string[] = [];
    md.push(`# MalkaQA — LLMV Test Report (${suiteLabel})`);
    md.push('');
    md.push(`**Suite:** ${suiteLabel}  `);
    md.push(`**Generated:** ${new Date().toISOString()}  `);
    md.push(`**Duration:** ${dur} min  `);
    md.push(`**Environment:** production (\`dashboard.searchatlas.com\`)  `);
    md.push(`**Fixture project:** microsoft.com / US (id 843571)`);
    md.push('');
    md.push('## Summary');
    md.push('');
    md.push('| Result | Count |');
    md.push('|---|---|');
    md.push(`| ✅ Passed | ${this.passed} |`);
    md.push(`| 🔴 App bugs | ${appBugs.length} |`);
    md.push(`| 🟡 Test bugs | ${testBugs.length} |`);
    md.push(`| 🔁 Flaky | ${flaky.length} |`);
    md.push(`| ⚙️ Infra | ${infra.length} |`);
    md.push(`| ⏭️ Skipped | ${this.skipped} |`);
    md.push(`| 📋 Logged defects | ${loggedDefects.length} |`);
    md.push(`| **Total** | **${this.total}** |`);
    md.push('');

    const detailSection = (name: string, list: Entry[], note: string) => {
      if (!list.length) return;
      md.push(`---`);
      md.push('');
      md.push(`# ${name}`);
      md.push('');
      md.push(`_${note}_`);
      md.push('');
      for (const e of list) {
        md.push(e.id ? `## ${e.id} — ${e.cleanTitle}` : `## ${e.cleanTitle}`);
        md.push('');
        md.push(`**Severity:** ${e.severity}  `);
        md.push(`**Tab:** ${e.tab}  `);
        md.push(`**Spec file:** \`${e.file}\`  `);
        md.push(`**Classification:** ${e.reason}`);
        md.push('');
        md.push('### Description');
        md.push('');
        md.push(e.description);
        md.push('');
        md.push('### Steps to Reproduce');
        md.push('');
        e.steps.forEach((s, i) => md.push(`${i + 1}. ${s}`));
        md.push('');
        md.push('### Expected Result');
        md.push('');
        md.push(e.expected);
        md.push('');
        md.push('### Actual Result');
        md.push('');
        md.push('```');
        md.push(e.actual);
        md.push('```');
        md.push('');
        if (e.screenshot) {
          md.push(`**Screenshot:** \`${e.screenshot}\``);
          md.push('');
        }
        md.push('### Acceptance Criteria');
        md.push('');
        md.push(`- ${e.expected}`);
        md.push(`- \`${e.id}\` passes on a clean run with no retries`);
        md.push(`- No regression in other tests on the ${e.tab} tab`);
        md.push('');
      }
    };

    detailSection('🔴 App Bugs', appBugs, 'The application is broken. File these as defects.');
    detailSection('🟡 Test Bugs', testBugs, 'The test is incorrect. Fix the spec, not the app.');
    detailSection('⚙️ Infra Issues', infra, 'Environment problem. Not a product defect.');

    if (flaky.length) {
      md.push('---');
      md.push('');
      md.push('# 🔁 Flaky Tests');
      md.push('');
      md.push('_Failed on first attempt, passed on retry. Performance signal, not a hard defect._');
      md.push('');
      md.push('| Case ID | Test | Tab | Retries |');
      md.push('|---|---|---|---|');
      for (const e of flaky) {
        md.push(`| \`${e.id}\` | ${e.cleanTitle.replace(/\|/g, '\\|')} | ${e.tab} | ${e.retries} |`);
      }
      md.push('');
    }

    if (loggedDefects.length) {
      md.push('---');
      md.push('');
      md.push('# 📋 Logged Defects');
      md.push('');
      md.push('_These tests passed, but a known defect was detected and logged during the run._');
      md.push('_The test tolerates the current behaviour; the defect still needs a fix._');
      md.push('');
      md.push('| Defect ID | Description |');
      md.push('|---|---|');
      for (const w of loggedDefects) {
        const m = w.match(/\[(BUG|REGRESSION)\s+([^\]]+)\]\s*(.*)/);
        if (m) {
          md.push(`| \`${m[2].trim()}\` | ${m[3].trim().replace(/\|/g, '\\|')} |`);
        } else {
          md.push(`| — | ${w.replace(/\|/g, '\\|')} |`);
        }
      }
      md.push('');
    }

    md.push('---');
    md.push('');
    md.push('# Rerun Commands');
    md.push('');
    if (gFlaky) {
      md.push('**Flaky tests:**');
      md.push('```bash');
      md.push(`npx playwright test --workers=1 -g "${gFlaky}"`);
      md.push('```');
      md.push('');
    }
    if (gApp) {
      md.push('**App bugs (verify after fix ships):**');
      md.push('```bash');
      md.push(`npx playwright test --workers=1 -g "${gApp}"`);
      md.push('```');
      md.push('');
    }
    if (gTest) {
      md.push('**Test bugs (after fixing specs):**');
      md.push('```bash');
      md.push(`npx playwright test --workers=1 -g "${gTest}"`);
      md.push('```');
      md.push('');
    }
    md.push('**Full suite:**');
    md.push('```bash');
    md.push('npx playwright test --workers=1');
    md.push('```');
    md.push('');

    const suiteName = projectNames.length === 1 ? projectNames[0] : 'all';
    const outFile = `qa-report-${suiteName}.md`;

    fs.writeFileSync(outFile, md.join('\n'));
    console.log(`📄  Detailed report written to: ${outFile}`);

    // ── Append this run to the master report ──────────────────────────────────
    const MASTER = 'qa-report-master.md';
    const stamp  = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const master: string[] = [];

    // Create the master file with a header the first time.
    if (!fs.existsSync(MASTER)) {
      master.push('# MalkaQA — LLMV Master Report');
      master.push('');
      master.push('_Every suite run appends a summary here. Newest entries at the bottom._');
      master.push('_Full detail for each run lives in `qa-report-<suite>.md`._');
      master.push('');
    }

    master.push('---');
    master.push('');
    master.push(`## ${suiteLabel} — ${stamp}`);
    master.push('');
    master.push(`Duration: ${dur} min · Detail: \`${outFile}\``);
    master.push('');
    master.push('| Passed | App bugs | Test bugs | Flaky | Infra | Skipped | Logged | Total |');
    master.push('|---|---|---|---|---|---|---|---|');
    master.push(
      `| ${this.passed} | ${appBugs.length} | ${testBugs.length} | ${flaky.length} ` +
      `| ${infra.length} | ${this.skipped} | ${loggedDefects.length} | ${this.total} |`
    );
    master.push('');

    if (appBugs.length) {
      master.push('**App bugs**');
      master.push('');
      for (const e of appBugs) {
        master.push(`- \`${e.id || '—'}\` [${e.severity}] ${e.cleanTitle.replace(/\|/g, '\\|')} — ${e.reason}`);
      }
      master.push('');
    }

    if (testBugs.length) {
      master.push('**Test bugs**');
      master.push('');
      for (const e of testBugs) {
        master.push(`- \`${e.id || '—'}\` ${e.cleanTitle.replace(/\|/g, '\\|')} — ${e.reason}`);
      }
      master.push('');
    }

    if (infra.length) {
      master.push('**Infra**');
      master.push('');
      for (const e of infra) {
        master.push(`- \`${e.id || '—'}\` ${e.cleanTitle.replace(/\|/g, '\\|')} — ${e.reason}`);
      }
      master.push('');
    }

    if (loggedDefects.length) {
      master.push('**Logged defects**');
      master.push('');
      for (const w of loggedDefects) {
        const m = w.match(/\[(BUG|REGRESSION)\s+([^\]]+)\]\s*(.*)/);
        master.push(m ? `- \`${m[2].trim()}\` ${m[3].trim()}` : `- ${w}`);
      }
      master.push('');
    }

    if (!appBugs.length && !testBugs.length && !infra.length && !loggedDefects.length) {
      master.push('_Clean run — no failures or logged defects._');
      master.push('');
    }

    fs.appendFileSync(MASTER, master.join('\n'));
    console.log(`📚  Summary appended to: ${MASTER}\n`);
  }
}
