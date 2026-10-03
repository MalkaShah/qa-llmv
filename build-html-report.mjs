/**
 * build-html-report.mjs
 * Reads every qa-report-<suite>.md produced by the test runs and renders a
 * single interactive HTML bug report.
 *
 * Run: node build-html-report.mjs
 * Output: qa-report.html
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');

const SUITES = [
  { key: 'api', label: 'API',      blurb: 'Endpoint contracts, auth, credits, quota' },
  { key: 'ui',  label: 'UI',       blurb: 'Tabs, filters, tables, rendering' },
  { key: 'db',  label: 'Database', blurb: 'Integrity, billing, tenant isolation' },
  { key: 'e2e', label: 'E2E',      blurb: 'Cross-layer consistency and workflows' },
];

// ── Parse ────────────────────────────────────────────────────────────────────

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

/** Pulls a labelled block out of a bug section, e.g. "### Description". */
function blockAfter(section, heading) {
  const re = new RegExp(`###\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n###|$)`, 'i');
  const m = section.match(re);
  return m ? m[1].trim() : '';
}

function parseSuite(key) {
  const file = `qa-report-${key}.md`;
  if (!fs.existsSync(file)) return null;
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

  const duration  = text.match(/\*\*Duration:\*\*\s*([\d.]+)\s*min/)?.[1] ?? '-';
  const generated = (text.match(/\*\*Generated:\*\*\s*(\S+)/)?.[1] ?? '')
    .slice(0, 16).replace('T', ' ') || '-';

  // Section boundaries
  const marks = [
    { name: 'app',    idx: text.indexOf('App Bugs') },
    { name: 'test',   idx: text.indexOf('Test Bugs') },
    { name: 'infra',  idx: text.indexOf('Infra Issues') },
    { name: 'flaky',  idx: text.indexOf('Flaky Tests') },
    { name: 'logged', idx: text.indexOf('Logged Defects') },
    { name: 'rerun',  idx: text.indexOf('Rerun Commands') },
  ].filter(m => m.idx !== -1).sort((a, b) => a.idx - b.idx);

  const endOf = (name) => {
    const i = marks.findIndex(m => m.name === name);
    if (i === -1) return -1;
    return i + 1 < marks.length ? marks[i + 1].idx : text.length;
  };
  const startOf = (name) => marks.find(m => m.name === name)?.idx ?? -1;

  const bugsIn = (name, bucket) => {
    const start = startOf(name);
    if (start === -1) return [];
    const slice = text.slice(start, endOf(name));
    const out = [];
    const parts = slice.split(/\n## /).slice(1);
    for (const part of parts) {
      const headline = part.split('\n')[0];
      const [id, ...titleBits] = headline.split(' — ');
      const body = '## ' + part;
      out.push({
        id: id.trim(),
        title: titleBits.join(' — ').trim() || id.trim(),
        bucket,
        suite: key,
        severity: body.match(/\*\*Severity:\*\*\s*(\S+)/)?.[1] ?? (bucket === 'app' ? 'P1' : 'P2'),
        tab: body.match(/\*\*Tab:\*\*\s*(.+)/)?.[1]?.trim() ?? '',
        file: body.match(/\*\*Spec file:\*\*\s*`?([^`\n]+)`?/)?.[1]?.trim() ?? '',
        reason: body.match(/\*\*Classification:\*\*\s*(.+)/)?.[1]?.trim() ?? '',
        description: blockAfter(body, 'Description'),
        steps: blockAfter(body, 'Steps to Reproduce'),
        expected: blockAfter(body, 'Expected Result'),
        actual: blockAfter(body, 'Actual Result'),
        criteria: blockAfter(body, 'Acceptance Criteria'),
      });
    }
    return out;
  };

  // Logged defects live in a two-column table
  const logged = [];
  const lStart = startOf('logged');
  if (lStart !== -1) {
    for (const line of text.slice(lStart, endOf('logged')).split('\n')) {
      const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|$/);
      if (m && m[1] !== '-' && !m[2].includes('---')) {
        logged.push({ id: m[1].trim(), desc: m[2].trim() });
      }
    }
  }

  // Flaky lives in a table too
  const flaky = [];
  const fStart = startOf('flaky');
  if (fStart !== -1) {
    for (const line of text.slice(fStart, endOf('flaky')).split('\n')) {
      const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|/);
      if (m && m[1] !== '-' && !m[2].includes('---')) {
        flaky.push({ id: m[1].trim(), title: m[2].trim() });
      }
    }
  }

  return {
    key, stats, duration, generated,
    bugs: [...bugsIn('app', 'app'), ...bugsIn('test', 'test'), ...bugsIn('infra', 'infra')],
    logged, flaky,
  };
}

// ── Collect ──────────────────────────────────────────────────────────────────

const suites = [];
const allBugs = [];
const allLogged = [];
const allFlaky = [];
const totals = { passed: 0, app: 0, test: 0, flaky: 0, infra: 0, skipped: 0, logged: 0, total: 0 };

for (const s of SUITES) {
  const parsed = parseSuite(s.key);
  if (!parsed) continue;
  suites.push({ ...s, ...parsed });
  for (const k of Object.keys(totals)) totals[k] += parsed.stats[k];
  allBugs.push(...parsed.bugs);
  allLogged.push(...parsed.logged.map(l => ({ ...l, suite: s.key })));
  allFlaky.push(...parsed.flaky.map(f => ({ ...f, suite: s.key })));
}

if (!suites.length) {
  console.log('No qa-report-*.md files found. Run the suites first.');
  process.exit(0);
}

// Severity ordering
const sevRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
allBugs.sort((a, b) =>
  (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) || a.id.localeCompare(b.id)
);

const sevCount = { P0: 0, P1: 0, P2: 0 };
for (const b of allBugs) if (sevCount[b.severity] !== undefined) sevCount[b.severity]++;

// ── Render ───────────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Minimal markdown → HTML for the blocks inside a bug card. */
function mdToHtml(md) {
  if (!md) return '<p class="muted">Not recorded.</p>';
  const lines = md.split('\n');
  const out = [];
  let inCode = false, inList = false, inOl = false;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');

    if (line.trim().startsWith('```')) {
      if (inCode) { out.push('</code></pre>'); inCode = false; }
      else {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inOl)   { out.push('</ol>'); inOl = false; }
        const lang = line.trim().slice(3).trim();
        out.push(`<pre class="code${lang ? ' lang-' + esc(lang) : ''}"><code>`);
        inCode = true;
      }
      continue;
    }
    if (inCode) { out.push(esc(line)); continue; }

    const inline = (t) => esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

    const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);

    if (ol) {
      if (inList) { out.push('</ul>'); inList = false; }
      if (!inOl)  { out.push('<ol>'); inOl = true; }
      out.push(`<li>${inline(ol[2])}</li>`);
      continue;
    }
    if (ul) {
      if (inOl)    { out.push('</ol>'); inOl = false; }
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    if (inOl)   { out.push('</ol>'); inOl = false; }

    if (line.trim() === '') continue;
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inCode) out.push('</code></pre>');
  if (inList) out.push('</ul>');
  if (inOl)   out.push('</ol>');
  return out.join('\n');
}

const suiteLabel = (k) => SUITES.find(s => s.key === k)?.label ?? k.toUpperCase();

const bugCard = (b, n) => `
<article class="bug" data-sev="${esc(b.severity)}" data-suite="${esc(b.suite)}" data-bucket="${esc(b.bucket)}">
  <button class="bug-head" aria-expanded="false">
    <span class="chev" aria-hidden="true">▸</span>
    <span class="sev sev-${esc(b.severity)}">${esc(b.severity)}</span>
    <span class="bug-id">${esc(b.id)}</span>
    <span class="bug-title">${esc(b.title)}</span>
    <span class="suite-tag">${esc(suiteLabel(b.suite))}</span>
  </button>
  <div class="bug-body" hidden>
    <div class="meta">
      ${b.reason ? `<span><b>Classification</b> ${esc(b.reason)}</span>` : ''}
      ${b.tab ? `<span><b>Layer</b> ${esc(b.tab)}</span>` : ''}
      ${b.file ? `<span><b>Spec</b> <code>${esc(b.file)}</code></span>` : ''}
      <span><b>Priority</b> ${esc(b.severity)}</span>
    </div>

    <h4>Description</h4>
    ${mdToHtml(b.description)}

    <h4>Steps to Reproduce</h4>
    ${mdToHtml(b.steps)}

    <div class="two-col">
      <div><h4>Expected Result</h4>${mdToHtml(b.expected)}</div>
      <div><h4>Actual Result</h4>${mdToHtml(b.actual)}</div>
    </div>

    <h4>Impact</h4>
    ${mdToHtml(impactFor(b))}

    <h4>Acceptance Criteria</h4>
    ${mdToHtml(b.criteria)}

    <h4>Rerun this case</h4>
    <pre class="code"><code>npx playwright test --workers=1 -g "${esc(b.id)}"</code></pre>
  </div>
</article>`;

/** Derives an impact statement when the source report didn't carry one. */
function impactFor(b) {
  const t = (b.title + ' ' + b.description).toLowerCase();
  if (b.severity === 'P0' && /charg|credit|billing|ledger|balance/.test(t)) {
    return 'Customers are billed incorrectly. This carries direct revenue and trust exposure, and cannot be prevented by frontend validation.';
  }
  if (/cross-tenant|another customer|foreign/.test(t)) {
    return 'One customer can reach another customer\'s data. This is a security and compliance exposure.';
  }
  if (/hides|unreachable|fewer/.test(t)) {
    return 'Customers cannot see or manage records they own, with no visible explanation in the product.';
  }
  if (/stuck|inactive|orphan|never analysed|no platform metrics/.test(t)) {
    return 'Compute and credits are consumed without producing value for the customer.';
  }
  if (b.bucket === 'test') {
    return 'No customer impact. The test itself is incorrect and needs fixing so the suite stays trustworthy.';
  }
  if (b.bucket === 'infra') {
    return 'No customer impact. An environment problem is blocking the test run.';
  }
  return 'Customers may see incorrect or missing information in the product.';
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LLM Visibility — QA Bug Report</title>
<style>
  :root {
    --bg:#0f1115; --panel:#161a21; --panel-2:#1c212a; --line:#262c37;
    --ink:#e6e9ef; --muted:#98a1b3; --accent:#7c8cff;
    --p0:#ff5c5c; --p1:#ffa43a; --p2:#5ec8ff; --ok:#4ade80;
  }
  * { box-sizing:border-box; }
  body {
    margin:0; background:var(--bg); color:var(--ink);
    font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  }
  .wrap { max-width:1100px; margin:0 auto; padding:32px 20px 80px; }
  header h1 { margin:0 0 6px; font-size:26px; letter-spacing:-.2px; }
  header .sub { color:var(--muted); font-size:14px; }

  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin:28px 0; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; }
  .card .n { font-size:28px; font-weight:600; line-height:1.1; }
  .card .l { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.6px; margin-top:4px; }
  .card.p0 .n { color:var(--p0); } .card.p1 .n { color:var(--p1); }
  .card.p2 .n { color:var(--p2); } .card.ok .n { color:var(--ok); }

  h2 { font-size:18px; margin:36px 0 14px; padding-bottom:8px; border-bottom:1px solid var(--line); }

  table { width:100%; border-collapse:collapse; font-size:14px; background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  th,td { padding:10px 14px; text-align:left; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:.5px; }
  tr:last-child td { border-bottom:none; }

  .filters { display:flex; gap:8px; flex-wrap:wrap; margin:18px 0 14px; }
  .filters button {
    background:var(--panel); color:var(--muted); border:1px solid var(--line);
    padding:6px 14px; border-radius:20px; font-size:13px; cursor:pointer; font-family:inherit;
  }
  .filters button:hover { color:var(--ink); border-color:var(--accent); }
  .filters button.on { background:var(--accent); border-color:var(--accent); color:#0f1115; font-weight:500; }

  .bug { background:var(--panel); border:1px solid var(--line); border-radius:10px; margin-bottom:10px; overflow:hidden; }
  .bug-head {
    width:100%; display:flex; align-items:center; gap:12px; padding:14px 16px;
    background:none; border:none; color:var(--ink); font:inherit; text-align:left; cursor:pointer;
  }
  .bug-head:hover { background:var(--panel-2); }
  .chev { color:var(--muted); font-size:12px; transition:transform .15s; flex:none; }
  .bug-head[aria-expanded="true"] .chev { transform:rotate(90deg); }
  .sev { font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px; flex:none; }
  .sev-P0 { background:rgba(255,92,92,.15); color:var(--p0); }
  .sev-P1 { background:rgba(255,164,58,.15); color:var(--p1); }
  .sev-P2 { background:rgba(94,200,255,.15); color:var(--p2); }
  .bug-id { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:13px; color:var(--accent); flex:none; }
  .bug-title { flex:1; font-size:14px; }
  .suite-tag { font-size:11px; color:var(--muted); border:1px solid var(--line); padding:2px 8px; border-radius:4px; flex:none; }

  .bug-body { padding:4px 18px 20px 46px; border-top:1px solid var(--line); }
  .bug-body h4 { font-size:12px; text-transform:uppercase; letter-spacing:.6px; color:var(--muted); margin:20px 0 6px; }
  .bug-body p { margin:6px 0; }
  .bug-body ul,.bug-body ol { margin:6px 0; padding-left:22px; }
  .bug-body li { margin:3px 0; }
  .meta { display:flex; gap:18px; flex-wrap:wrap; font-size:13px; color:var(--muted); margin:14px 0 4px; }
  .meta b { color:var(--ink); font-weight:500; margin-right:5px; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:22px; }
  @media (max-width:700px){ .two-col { grid-template-columns:1fr; } }

  code { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:13px; background:var(--panel-2); padding:1px 5px; border-radius:3px; }
  pre.code { background:#0b0d11; border:1px solid var(--line); border-radius:8px; padding:12px 14px; overflow-x:auto; margin:8px 0; }
  pre.code code { background:none; padding:0; font-size:12.5px; line-height:1.55; color:#c8d3e6; }
  .muted { color:var(--muted); }
  footer { margin-top:48px; padding-top:18px; border-top:1px solid var(--line); color:var(--muted); font-size:13px; }
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>LLM Visibility — QA Bug Report</h1>
  <div class="sub">
    Production · <code>dashboard.searchatlas.com</code> ·
    ${suites.length} suite${suites.length === 1 ? '' : 's'} ·
    generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)}
  </div>
</header>

<div class="cards">
  <div class="card ok"><div class="n">${totals.passed}</div><div class="l">Passed</div></div>
  <div class="card p0"><div class="n">${sevCount.P0}</div><div class="l">P0 — Critical</div></div>
  <div class="card p1"><div class="n">${sevCount.P1}</div><div class="l">P1 — High</div></div>
  <div class="card p2"><div class="n">${sevCount.P2}</div><div class="l">P2 — Medium</div></div>
  <div class="card"><div class="n">${allLogged.length}</div><div class="l">Logged defects</div></div>
  <div class="card"><div class="n">${totals.total}</div><div class="l">Total cases</div></div>
</div>

<h2>Suite Results</h2>
<table>
  <thead><tr>
    <th>Suite</th><th>Scope</th><th>Passed</th><th>Bugs</th>
    <th>Test bugs</th><th>Skipped</th><th>Total</th><th>Duration</th>
  </tr></thead>
  <tbody>
  ${suites.map(s => `<tr>
    <td><strong>${esc(s.label)}</strong></td>
    <td class="muted">${esc(s.blurb)}</td>
    <td>${s.stats.passed}</td>
    <td>${s.stats.app}</td>
    <td>${s.stats.test}</td>
    <td>${s.stats.skipped}</td>
    <td>${s.stats.total}</td>
    <td class="muted">${esc(s.duration)} min</td>
  </tr>`).join('')}
  </tbody>
</table>

<h2>Bugs — click any row to expand</h2>

<div class="filters" id="filters">
  <button class="on" data-f="all">All (${allBugs.length})</button>
  <button data-f="P0">P0 (${sevCount.P0})</button>
  <button data-f="P1">P1 (${sevCount.P1})</button>
  <button data-f="P2">P2 (${sevCount.P2})</button>
  ${suites.map(s => `<button data-f="suite:${s.key}">${esc(s.label)} (${s.bugs.length})</button>`).join('')}
</div>

<div id="buglist">
  ${allBugs.length
    ? allBugs.map((b, i) => bugCard(b, i)).join('')
    : '<p class="muted">No bugs recorded in the parsed reports.</p>'}
</div>

${allLogged.length ? `
<h2>Logged Defects</h2>
<p class="muted">These tests pass. Each tolerates current behaviour but records a real contract deviation.</p>
<table>
  <thead><tr><th>ID</th><th>Description</th><th>Suite</th></tr></thead>
  <tbody>
  ${allLogged.map(l => `<tr>
    <td><code>${esc(l.id)}</code></td>
    <td>${esc(l.desc)}</td>
    <td class="muted">${esc(suiteLabel(l.suite))}</td>
  </tr>`).join('')}
  </tbody>
</table>` : ''}

${allFlaky.length ? `
<h2>Flaky Tests</h2>
<p class="muted">Failed on the first attempt, passed on retry. A performance signal rather than a defect.</p>
<table>
  <thead><tr><th>ID</th><th>Test</th><th>Suite</th></tr></thead>
  <tbody>
  ${allFlaky.map(f => `<tr>
    <td><code>${esc(f.id)}</code></td>
    <td>${esc(f.title)}</td>
    <td class="muted">${esc(suiteLabel(f.suite))}</td>
  </tr>`).join('')}
  </tbody>
</table>` : ''}

<footer>
  Generated from <code>qa-report-&lt;suite&gt;.md</code>.
  All database queries in this report are read-only and safe to run against production.
</footer>

</div>

<script>
  document.querySelectorAll('.bug-head').forEach(function (head) {
    head.addEventListener('click', function () {
      var open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', String(!open));
      head.nextElementSibling.hidden = open;
    });
  });

  document.getElementById('filters').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    document.querySelectorAll('#filters button').forEach(function (b) { b.classList.remove('on'); });
    btn.classList.add('on');

    var f = btn.dataset.f;
    document.querySelectorAll('.bug').forEach(function (card) {
      var show =
        f === 'all' ? true :
        f.indexOf('suite:') === 0 ? card.dataset.suite === f.slice(6) :
        card.dataset.sev === f;
      card.style.display = show ? '' : 'none';
    });
  });
</script>
</body>
</html>`;

fs.writeFileSync('qa-report.html', html);

console.log('Built qa-report.html\n');
console.log('  Suites parsed :', suites.map(s => s.label).join(', '));
console.log('  Passed        :', totals.passed);
console.log('  P0 bugs       :', sevCount.P0);
console.log('  P1 bugs       :', sevCount.P1);
console.log('  P2 bugs       :', sevCount.P2);
console.log('  Logged        :', allLogged.length);
console.log('  Total cases   :', totals.total);
console.log('\nOpen it with:  start qa-report.html');
