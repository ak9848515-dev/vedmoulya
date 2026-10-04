#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Configuration Inventory (S1)
//
// Discovers every environment variable the repository ACTUALLY READS, and emits
// a machine-readable inventory. Read-only: it never prints a variable's VALUE,
// so a secret can never leak through this tool.
//
// Only real reads are counted:
//   process.env.NAME            (dot access and destructuring)
//   process.env['NAME'] / ["NAME"]
//   import.meta.env.NAME
//   env('NAME') / env("NAME")    (conventional accessor call sites)
//
// NOT counted: comments, docs, .env.example/.md, test fixtures.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  '.cache',
  'storybook-static',
  '.vercel',
]);
const CODE_EXT = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/;

// A variable is treated as a secret by NAME shape only. Never by value.
const SECRET_NAME = /(KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|SALT|CERT)/i;

// Directories that are NOT production code: their reads are test/CI classified.
const TEST_PATH = /(^|\/)(__tests__|tests?|e2e|fixtures?)\//;
const SPEC_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const CI_PATH = /(^|\/)(scripts|ci|\.github)\//;

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\n')
  .filter(Boolean);

const files = tracked.filter((f) => {
  if (!CODE_EXT.test(f)) return false;
  if (f.startsWith('.env')) return false;
  if (/\.(md|json|ya?ml)$/.test(f)) return false;
  return true;
});

// Host/OS-provided variables that are NOT VedMoulya configuration.
const HOST_VARS = new Set([
  'SystemRoot',
  'SystemDrive',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'PATH',
  'OS',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMFILES',
  'WINDIR',
  'COMSPEC',
  'PROCESSOR_ARCHITECTURE',
  'NUMBER_OF_PROCESSORS',
  'HOMEDRIVE',
  'HOMEPATH',
  'USERNAME',
  'COMPUTERNAME',
  'LANG',
  'LC_ALL',
  'SHELL',
  'PWD',
  'OLDPWD',
  'SHLVL',
  'TZ',
]);

/** Strip comments and string-literal noise so we only match real code reads. */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const found = new Map(); // name -> { files:Set, kinds:Set }

function record(name, file, kind) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return; // env convention only
  let entry = found.get(name);
  if (!entry) {
    entry = { name, reads: new Map(), kinds: new Set() };
    found.set(name, entry);
  }
  entry.kinds.add(kind);
  if (!entry.reads.has(file)) entry.reads.set(file, 0);
  entry.reads.set(file, entry.reads.get(file) + 1);
}

// The trailing (?![A-Za-z0-9_]) is REQUIRED: without it `process.env.SystemRoot`
// (a Windows OS variable) is captured as the bogus name `S`.
const PATTERNS = [
  // process.env.NAME  /  process.env.NAME?.  /  process.env['NAME']
  { kind: 'process.env', re: /process\.env\.([A-Z][A-Z0-9_]*)(?![A-Za-z0-9_])/g },
  { kind: 'process.env', re: /process\.env\[['"`]([A-Z][A-Z0-9_]*)['"`]\]/g },
  // destructuring: const { NAME } = process.env
  {
    kind: 'process.env',
    re: /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*process\.env/g,
    destructure: true,
  },
  // import.meta.env.NAME  (Vite / Next inlined)
  { kind: 'import.meta.env', re: /import\.meta\.env\.([A-Z][A-Z0-9_]*)(?![A-Za-z0-9_])/g },
  { kind: 'import.meta.env', re: /import\.meta\.env\[['"`]([A-Z][A-Z0-9_]*)['"`]\]/g },
  // conventional accessor: env('NAME')
  { kind: 'env()', re: /\benv\(\s*['"`]([A-Z][A-Z0-9_]*)['"`]\s*\)/g },
  // config getter: getEnv('NAME')
  { kind: 'env()', re: /\bgetEnv(?:Var)?\(\s*['"`]([A-Z][A-Z0-9_]*)['"`]\s*\)/g },
];

for (const file of files) {
  let raw;
  try {
    raw = readFileSync(join(ROOT, file), 'utf8');
  } catch {
    continue;
  }
  const src = codeOnly(raw);

  for (const { kind, re, destructure } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (destructure) {
        for (const part of m[1].split(',')) {
          const name = part.split(':').pop().trim();
          record(name, file, kind);
        }
      } else {
        record(m[1], file, kind);
      }
    }
  }
}

const isTest = (file) => TEST_PATH.test(file) || SPEC_FILE.test(file);
const isCi = (file) => CI_PATH.test(file) && !isTest(file);
const isApp = (file) => /^(apps|packages|services)\//.test(file) && !isTest(file) && !isCi(file);

const inventory = [...found.values()]
  .map((e) => {
    const readFiles = [...e.reads.keys()].sort();
    const prodReads = readFiles.filter(isApp);
    const testReads = readFiles.filter((f) => isTest(f));
    const ciReads = readFiles.filter(isCi);
    return {
      name: e.name,
      secret: SECRET_NAME.test(e.name),
      kinds: [...e.kinds].sort(),
      readInProductionCode: prodReads.length,
      readInTests: testReads.length,
      readInCiOrScripts: ciReads.length,
      totalReads: [...e.reads.values()].reduce((a, b) => a + b, 0),
      locations: readFiles.map((f) => ({
        file: f,
        count: e.reads.get(f),
        scope: isApp(f) ? 'production' : isTest(f) ? 'test' : 'ci',
      })),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const summary = {
  generatedFrom: 'git ls-files',
  codeFilesScanned: files.length,
  totalDistinctVariables: inventory.length,
  productionCodeVariables: inventory.filter((v) => v.readInProductionCode > 0).length,
  testOnlyVariables: inventory.filter((v) => v.readInProductionCode === 0 && v.readInTests > 0)
    .length,
  ciOnlyVariables: inventory.filter(
    (v) => v.readInProductionCode === 0 && v.readInTests === 0 && v.readInCiOrScripts > 0,
  ).length,
  secretShapedVariables: inventory.filter((v) => v.secret).length,
};

const out = { summary, variables: inventory };
const target = process.argv[2] ?? 'config-inventory.json';
writeFileSync(target, JSON.stringify(out, null, 2) + '\n', 'utf8');

// Human-readable summary to stdout (VALUES ARE NEVER PRINTED).
const line = (s) => process.stdout.write(s + '\n');
line('CONFIG INVENTORY');
line('  code files scanned        : ' + summary.codeFilesScanned);
line('  distinct variables       : ' + summary.totalDistinctVariables);
line('  read in production code  : ' + summary.productionCodeVariables);
line('  test-only                : ' + summary.testOnlyVariables);
line('  ci/script-only           : ' + summary.ciOnlyVariables);
line('  secret-shaped names      : ' + summary.secretShapedVariables);
line('  written to               : ' + target);
line('');
line('TOP PRODUCTION VARIABLES BY READ COUNT');
for (const v of inventory
  .filter((x) => x.readInProductionCode > 0)
  .sort((a, b) => b.totalReads - a.totalReads)
  .slice(0, 25)) {
  line(
    '  ' +
      v.name.padEnd(42) +
      'prod=' +
      String(v.readInProductionCode).padEnd(3) +
      'reads=' +
      String(v.totalReads).padEnd(4) +
      (v.secret ? ' SECRET' : ''),
  );
}
