// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ESLint Warning Analyzer
// Reads ESLint JSON output from stdin and groups warnings by rule and by file.
// Usage: npx eslint . -f json | node scripts/analyze-eslint-warnings.mjs
// ─────────────────────────────────────────────────────────────────────────────

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  const results = JSON.parse(input);
  const byRule = new Map();
  const byFile = new Map();
  let total = 0;

  for (const file of results) {
    const path = file.filePath.replaceAll('\\', '/');
    for (const msg of file.messages) {
      if (msg.severity !== 1) continue; // warnings only
      total++;
      const rule = msg.ruleId ?? '(unknown)';
      byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
      byFile.set(path, (byFile.get(path) ?? []).concat([`${msg.line}:${msg.column} ${rule}`]));
    }
  }

  console.log(`TOTAL WARNINGS: ${total}`);
  console.log('\n=== BY RULE ===');
  const rulesSorted = [...byRule.entries()].sort((a, b) => b[1] - a[1]);
  for (const [rule, count] of rulesSorted) {
    console.log(`${String(count).padStart(4)}  ${rule}`);
  }

  console.log('\n=== BY FILE ===');
  const filesSorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [file, msgs] of filesSorted) {
    console.log(`\n${msgs.length}  ${file}`);
    for (const m of msgs.slice(0, 5)) {
      console.log(`      ${m}`);
    }
    if (msgs.length > 5) console.log(`      ... and ${msgs.length - 5} more`);
  }
});
