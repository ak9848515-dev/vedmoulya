const c = [];
process.stdin.on('data', d => c.push(d));
process.stdin.on('end', () => {
  const d = Buffer.concat(c).toString();
  try {
    const j = JSON.parse(d);
    const fileMap = {};
    j.forEach(f => {
      if (!f.filePath.endsWith('.ts')) return;
      const parts = f.filePath.replace(/\\/g, '/').split('/');
      const short = parts[parts.length - 1];
      const errors = f.messages.filter(m => m.severity === 2);
      if (errors.length > 0) {
        fileMap[short] = errors.map(e => ({
          line: e.line,
          col: e.column,
          rule: e.ruleId,
          msg: e.message.slice(0, 80)
        }));
      }
    });
    Object.keys(fileMap).sort().forEach(file => {
      console.warn(file + ':');
      fileMap[file].forEach(e => {
        console.warn('  L' + e.line + ':' + e.col + '  ' + e.rule + '  ' + e.msg);
      });
      console.warn('');
    });
    const total = Object.values(fileMap).flat().length;
    console.warn('Total errors: ' + total);
  } catch (e) {
    console.warn('Parse error:', e.message);
  }
});
