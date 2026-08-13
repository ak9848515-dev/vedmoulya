// One-off lint fixer for AC-002 ops/portal pages (EPIC-003).
// Applies the project's established conventions:
//   - onRetry={() => { void x.refetch(); }}   (no-misused-promises)
//   - onOpenChange={(o) => { if (!o) fn(); }} (no-confusing-void-expression)
//   - removes unused imports
//   - String() for numbers in template literals (restrict-template-expressions)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const files = [
  'apps/web/src/app/content-agency/ops/crm/page.tsx',
  'apps/web/src/app/content-agency/ops/documents/page.tsx',
  'apps/web/src/app/content-agency/ops/notifications/page.tsx',
  'apps/web/src/app/content-agency/ops/page.tsx',
  'apps/web/src/app/content-agency/ops/payments/page.tsx',
  'apps/web/src/app/content-agency/ops/portal/page.tsx',
  'apps/web/src/app/content-agency/ops/proposals/page.tsx',
  'apps/web/src/app/content-agency/ops/quotations/page.tsx',
  'apps/web/src/app/portal/content/page.tsx',
  'apps/web/src/app/portal/deliverables/page.tsx',
  'apps/web/src/app/portal/invoices/page.tsx',
  'apps/web/src/app/portal/page.tsx',
];

// 1) onRetry={() => x.refetch()}  →  onRetry={() => { void x.refetch(); }}
function fixOnRetry(src) {
  return src.replace(/onRetry=\{\(\) => ([A-Za-z0-9_]+)\.refetch\(\)\}/g, 'onRetry={() => { void $1.refetch(); }}');
}

// 2) onOpenChange={(open) => !open && fn()}  →  block body (handles props.onClose(), setX(null), etc.)
function fixOnOpenChange(src) {
  return src.replace(
    /onOpenChange=\{\(open\) => !open && ([A-Za-z0-9_.]+)\(([^)]*)\)\}/g,
    'onOpenChange={(open) => { if (!open) $1($2); }}',
  );
}

const fixes = {
  // crm
  'apps/web/src/app/content-agency/ops/crm/page.tsx': [        [/^ {2}Card,\n/m, ''],        [/ {2}useUpdateLead,\n/m, ''],
    ["{stage === 'all' ? 'All' : STAGE_LABEL[stage as Stage] ?? 'Archived'}",
     "{stage === 'all' ? 'All' : STAGE_LABEL[stage as Stage] ?? 'Archived'}"], // keep (runtime guard for 'archived')
  ],
};

let changed = 0;
for (const file of files) {
  const path = join(ROOT, file);
  let src = readFileSync(path, 'utf8');
  const before = src;
  src = fixOnRetry(src);
  src = fixOnOpenChange(src);
  const fileFixes = fixes[file];
  if (fileFixes) {
    for (const [from, to] of fileFixes) {
      if (typeof from === 'string') {
        src = src.split(from).join(to);
      } else {
        src = src.replace(from, to);
      }
    }
  }
  if (src !== before) {
    writeFileSync(path, src);
    changed++;
    console.log('FIXED ' + file);
  }
}
console.log(`\n${changed} files updated.`);
