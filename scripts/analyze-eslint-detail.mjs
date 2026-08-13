// Prints per-file detailed messages for real source files (skips generated dirs).
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('.eslint-report.json', 'utf8'));
const skip = ['android/app/src/main/assets', 'apps/web/out', '_next/static'];

const files = report
  .filter((f) => !skip.some((s) => f.filePath.replaceAll('\\', '/').includes(s)))
  .filter((f) => f.messages.some((m) => m.severity > 0));

for (const f of files) {
  const path = f.filePath.replaceAll('\\', '/');
  console.log(`\n===== ${path} (${f.messages.length}) =====`);
  for (const m of f.messages) {
    console.log(`  L${m.line}:${m.column} [${m.severity === 2 ? 'E' : 'W'}] ${m.ruleId ?? 'fatal'}: ${m.message.split('\n')[0]}`);
    if (m.suggestions && m.suggestions.length > 0) {
      console.log(`      fix: ${m.suggestions[0].desc.split('\n')[0]}`);
    }
  }
}
