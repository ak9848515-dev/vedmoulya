// Prints the exact source line + column context for eslint errors in the given files.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const src = readFileSync(file, 'utf8').split(/\r?\n/);
const report = JSON.parse(readFileSync('.eslint-report.json', 'utf8'));
const entry = report.find((f) => f.filePath.replaceAll('\\', '/').endsWith(file.replace(/^.*?packages/, 'packages')));
if (!entry) {
  console.log('no report entry for', file);
  process.exit(1);
}
for (const m of entry.messages) {
  if (m.severity === 0) continue;
  const line = src[m.line - 1] ?? '';
  console.log(`L${m.line}:${m.column} [${m.severity === 2 ? 'E' : 'W'}] ${m.ruleId}: ${m.message.split('\n')[0]}`);
  console.log(`    ${line}`);
  console.log(`    ${' '.repeat(Math.max(0, (m.column ?? 1) - 1))}^`);
}
