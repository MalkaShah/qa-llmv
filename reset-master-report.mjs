/**
 * reset-master-report.mjs
 * Archives the current master report and starts a fresh one.
 * Run before a new full test cycle: node reset-master-report.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');

const MASTER = 'qa-report-master.md';

if (!fs.existsSync(MASTER)) {
  console.log('No master report to reset — one will be created on the next run.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const archive = `qa-report-master-${stamp}.md`;

fs.renameSync(MASTER, archive);
console.log(`Archived previous master report to: ${archive}`);
console.log('A fresh master report will be created on the next test run.');
