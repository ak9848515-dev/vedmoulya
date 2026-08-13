import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const coverage = JSON.parse(readFileSync(join(process.cwd(), 'coverage', 'coverage-final.json'), 'utf8'));
for (const [file, data] of Object.entries(coverage)) {
  const total = Object.keys(data.branchMap).length;
  let covered = 0;
  for (const branch of Object.values(data.b)) {
    if (branch.some((count) => count > 0)) covered += 1;
  }
  const pct = total === 0 ? 100 : Math.round((covered / total) * 100);
  if (pct < 85) {
    const short = file.replaceAll('\\', '/').split('/').slice(-3).join('/');
    console.log(`${String(pct).padEnd(6)} ${short}`);
  }
}
