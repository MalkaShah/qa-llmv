/**
 * merge-reports.mjs
 * Combines the existing qa-report-<suite>.md files into qa-report-master.md
 * without rerunning any tests.
 *
 * Run: node merge-reports.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');

const SUITES = ['api', 'ui', 'db', 'e2e', 'all'];
const MASTER = 'qa-report-master.md';

const out = [];
out.push('# MalkaQA — LLMV Master Report');
out.push('');
out.push(`_Merged from existing suite reports on ${new Date().toISOString().replace('T', ' ').slice(0, 16)}._`);
out.push('_Full detail for each suite lives in `qa-report-<suite>.md`._');
out.push('');

const overall = { passed: 0, app: 0, test: 0, flaky: 0, infra: 0, skipped: 0, logged: 0, total: 0 };
const rows = [];
const sections = [];
let found = 0;

/**
 * Reads a value from a two-column markdown table.
 * Handles rows like:  | Passed | 86 |   and   | **Total** | **94** |
 * Emoji prefixes in the label cell are tolerated.
 */
function tableValue(text, label) {
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map(c => c.replace(/\*\*/g, '').trim());
    if (cells.length < 3) continue;
    if (cells[1].toLowerCase().includes(label.toLowerCase())) {
      const digits = cells[2].replace(/[^\d]/g, '');
      if (digits !== '') return Number(digits);
    }
  }
  return 0;
}

for (const suite of SUITES) {
  const file = `qa-report-${suite}.md`;
  if (!fs.existsSync(file)) continue;
  found++;

  const text = fs.readFileSync(file, 'utf8');

  const stats = {
    passed:  tableValue(text, 'Passed'),
    app:     tableValue(text, 'App bugs'),
    test:    tableValue(text, 'Test bugs'),
    flaky:   tableValue(text, 'Flaky'),
    infra:   tableValue(text, 'Infra'),
    skipped: tableValue(text, 'Skipped'),
    logged:  tableValue(text, 'Logged defects'),
    total:   tableValue(text, 'Total'),
  };

  const dur = text.match(/\*\*Duration:\*\*\s*([\d.]+)\s*min/)?.[1] ?? '-';
  const genRaw = text.match(/\*\*Generated:\*\*\s*(\S+)/)?.[1] ?? '';
  const gen = genRaw ? genRaw.slice(0, 16).replace('T', ' ') : '-';

  for (const k of Object.keys(overall)) overall[k] += stats[k];

  rows.push(
    `| **${suite.toUpperCase()}** | ${stats.passed} | ${stats.app} | ${stats.test} | ` +
    `${stats.flaky} | ${stats.infra} | ${stats.skipped} | ${stats.logged} | ${stats.total} | ${dur} min |`
  );

  // Locate detail sections so bug headings are attributed to the right bucket
  const idx = {
    app:    text.indexOf('App Bugs'),
    test:   text.indexOf('Test Bugs'),
    infra:  text.indexOf('Infra Issues'),
    flaky:  text.indexOf('Flaky Tests'),
    logged: text.indexOf('Logged Defects'),
    rerun:  text.indexOf('Rerun Commands'),
  };

  const headings = [];
  const headingRe = /^## (.+?) — (.+)$/gm;
  let m;
  while ((m = headingRe.exec(text)) !== null) {
    headings.push({ id: m[1].trim(), title: m[2].trim(), pos: m.index });
  }

  const boundaryAfter = (start) => {
    const later = [idx.test, idx.infra, idx.flaky, idx.logged, idx.rerun]
      .filter(v => v > start);
    return later.length ? Math.min(...later) : text.length;
  };

  const between = (start) => {
    if (start === -1) return [];
    const end = boundaryAfter(start);
    return headings.filter(h => h.pos > start && h.pos < end);
  };

  const appBugs  = between(idx.app);
  const testBugs = between(idx.test);

  // Logged defects sit in a two-column table under their heading
  const logged = [];
  if (idx.logged !== -1) {
    const end = idx.rerun === -1 ? text.length : idx.rerun;
    for (const line of text.slice(idx.logged, end).split('\n')) {
      const lm = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|$/);
      if (lm && lm[1] !== '-') logged.push({ id: lm[1].trim(), desc: lm[2].trim() });
    }
  }

  const sec = [];
  sec.push('---');
  sec.push('');
  sec.push(`## ${suite.toUpperCase()} — ${gen}`);
  sec.push('');
  sec.push(`Duration: ${dur} min · Detail: \`${file}\``);
  sec.push('');

  if (appBugs.length) {
    sec.push('**App bugs**');
    sec.push('');
    for (const b of appBugs) sec.push(`- \`${b.id}\` ${b.title}`);
    sec.push('');
  }
  if (testBugs.length) {
    sec.push('**Test bugs**');
    sec.push('');
    for (const b of testBugs) sec.push(`- \`${b.id}\` ${b.title}`);
    sec.push('');
  }
  if (logged.length) {
    sec.push('**Logged defects**');
    sec.push('');
    for (const l of logged) sec.push(`- \`${l.id}\` ${l.desc}`);
    sec.push('');
  }
  if (!appBugs.length && !testBugs.length && !logged.length) {
    sec.push('_Clean run — no failures or logged defects._');
    sec.push('');
  }

  sections.push(sec.join('\n'));
}

if (!found) {
  console.log('No qa-report-*.md files found. Run a suite first.');
  process.exit(0);
}

out.push('## Combined Summary');
out.push('');
out.push('| Suite | Passed | App bugs | Test bugs | Flaky | Infra | Skipped | Logged | Total | Duration |');
out.push('|---|---|---|---|---|---|---|---|---|---|');
out.push(...rows);
out.push(
  `| **TOTAL** | **${overall.passed}** | **${overall.app}** | **${overall.test}** | ` +
  `**${overall.flaky}** | **${overall.infra}** | **${overall.skipped}** | ` +
  `**${overall.logged}** | **${overall.total}** | - |`
);
out.push('');
out.push(...sections);

fs.writeFileSync(MASTER, out.join('\n'));

console.log(`Merged ${found} suite report(s) into ${MASTER}\n`);
console.log('  Passed    :', overall.passed);
console.log('  App bugs  :', overall.app);
console.log('  Test bugs :', overall.test);
console.log('  Flaky     :', overall.flaky);
console.log('  Infra     :', overall.infra);
console.log('  Skipped   :', overall.skipped);
console.log('  Logged    :', overall.logged);
console.log('  Total     :', overall.total);
