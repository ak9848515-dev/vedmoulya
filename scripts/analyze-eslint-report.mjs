// Reads .eslint-report.json and prints a detailed breakdown for fixing.
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('.eslint-report.json', 'utf8'));

const fatal = [];
const byFile = {};
const byRule = {};

for (const file of report) {
  const path = file.filePath.replaceAll('\\', '/');
  const msgs = file.messages;
  if (msgs.length === 0) continue;
  byFile[path] = msgs.length;
  for (const m of msgs) {
    const rule = m.ruleId ?? '(fatal)';
    if (m.fatal) fatal.push(`${path}:${m.line}:${m.column} -> ${m.message.split('\n')[0]}`);
    byRule[rule] = (byRule[rule] ?? 0) + 1;
  }
}

console.log(`\n=== FATAL / PARSE ERRORS (${fatal.length}) ===`);
for (const f of fatal) console.log(f);

console.log(`\n=== RULE BREAKDOWN (sorted) ===`);
for (const [rule, count] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(4)}  ${rule}`);
}

console.log(`\n=== TOP 50 FILES BY ISSUE COUNT ===`);
for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 50)) {
  console.log(`${String(n).padStart(4)}  ${f}`);
}
