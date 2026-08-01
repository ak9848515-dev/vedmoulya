const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  const data = JSON.parse(Buffer.concat(chunks).toString());
  const byRule = {};
  const byFile = {};
  let total = 0;

  data.forEach((f) => {
    if (!f.filePath.endsWith('.ts')) return;
    const parts = f.filePath.replace(/\\/g, '/').split('/');
    const fileName = parts[parts.length - 1];

    f.messages.forEach((m) => {
      total++;
      if (m.severity === 2) {
        byFile[fileName] = (byFile[fileName] || 0) + 1;
        const rule = m.ruleId || '(parsing)';
        byRule[rule] = (byRule[rule] || 0) + 1;
      }
    });
  });

  console.warn('=== Total TS errors:', total, '===');
  console.warn('\nBy Rule:');
  Object.entries(byRule)
    .sort((a, b) => b[1] - a[1])
    .forEach(([rule, count]) => {
      console.warn(`  ${rule}: ${count}`);
    });

  console.warn('\nTop 20 Files:');
  Object.entries(byFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([file, count]) => {
      console.warn(`  ${file}: ${count}`);
    });
});
