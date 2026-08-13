// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Application Preview Service
// EPIC-008 — Phase 13. Renders a generated application's UI in a sandboxed
// iframe. The gateway bundles the persisted generated source files
// (src/ui/app.ts + transitive relative imports) with esbuild into ONE
// self-contained HTML document: an inline CSP (no network, no navigation, no
// subframes), and the client enforces sandbox="allow-scripts" WITHOUT
// allow-same-origin — the preview runs in an opaque origin and can never
// reach the parent application or the user's storage.
//
// Pure derivation from the persisted project files: no AI, no writes, no
// side effects. Deterministic (generated files are fixed templates, so the
// same project always produces the same bundle).
// ─────────────────────────────────────────────────────────────────────────────

import { build, type Plugin } from 'esbuild';
import type { FactoryDetailDTO } from '@vedmoulya/app-factory';

export interface PreviewResult {
  /** Whether the application ships a renderable UI entry point. */
  hasUi: boolean;
  /** Human-readable explanation for the empty/error states. */
  reason?: string;
  /** Self-contained HTML document for the sandboxed iframe (success state). */
  html?: string;
}

const UI_ENTRY_PATTERN = /^src\/ui\/app\.(ts|tsx)$/;

export class PreviewService {
  async buildPreview(detail: FactoryDetailDTO): Promise<PreviewResult> {
    const files = new Map(detail.files.map((f) => [f.path, f.content]));
    const entry = [...files.keys()].find((p) => UI_ENTRY_PATTERN.test(p));

    // Empty state — the application ships no UI entry point (e.g. a pure
    // logic/service application). Not an error: preview is optional.
    if (!entry) {
      return {
        hasUi: false,
        reason: 'This application does not include a user-interface entry point (src/ui/app.ts).',
      };
    }

    try {
      // The entry is resolved through the virtual plugin (never stdin):
      // stdin resolves its imports against resolveDir, which cannot express
      // the entry's own directory — a synthetic entry point keeps the
      // importer path exact so relative resolution is unambiguous.
      const result = await build({
        entryPoints: ['$entry'],
        bundle: true,
        write: false,
        format: 'iife',
        globalName: 'VedApp',
        platform: 'browser',
        target: ['es2020'],
        legalComments: 'none',
        logLevel: 'silent',
        plugins: [virtualWorkspacePlugin(files, entry)],
      });
      const bundle = result.outputFiles[0]?.text ?? '';
      if (!bundle) {
        return { hasUi: true, reason: 'The UI bundle came back empty — no code was emitted.' };
      }
      return { hasUi: true, html: wrapHtml(detail.name, bundle) };
    } catch (err) {
      // Error state — surfaced with an actionable explanation, never a raw
      // stack trace, and never a fabricated "it works".
      return {
        hasUi: true,
        reason: `The UI entry could not be bundled: ${err instanceof Error ? err.message : 'unknown error'}.`,
      };
    }
  }
}

/**
 * Resolves the generated project's relative imports against the in-memory
 * workspace (never the real filesystem — the workspace is the only source of
 * truth for a preview). Mirrors TypeScript's .js → .ts resolution so the
 * generated `import './x.js'` style works.
 */
function virtualWorkspacePlugin(files: Map<string, string>, entry: string): Plugin {
  const resolve = (spec: string, dir: string): string | undefined => {
    const base = spec.replace(/\.(js|jsx|ts|tsx)$/, '');
    const candidates = [
      spec,
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      `${base}/index.ts`,
      `${base}/index.js`,
    ];
    for (const candidate of candidates) {
      const path = joinVirtual(dir, candidate);
      if (files.has(path)) return path;
    }
    return undefined;
  };

  return {
    name: 'vedmoulya-virtual-workspace',
    setup(b): void {
      // Map the synthetic entry point to the virtual workspace namespace.
      b.onResolve({ filter: /^\$entry$/ }, () => ({ path: entry, namespace: 'vf' }));
      // Resolve every relative import against the importing module's virtual
      // directory (importer is exact for namespace 'vf' modules).
      b.onResolve({ filter: /.*/ }, (args) => {
        const resolved = resolve(args.path, dirname(args.importer));
        if (!resolved) {
          return {
            errors: [
              {
                text: `Could not resolve "${args.path}" — the generated workspace has no such file.`,
              },
            ],
          };
        }
        return { path: resolved, namespace: 'vf' };
      });
      b.onLoad({ filter: /.*/, namespace: 'vf' }, (args) => {
        const content = files.get(args.path);
        if (content === undefined) {
          return { errors: [{ text: `Workspace file "${args.path}" not found.` }] };
        }
        const loader = args.path.endsWith('.tsx') ? 'tsx' : args.path.endsWith('.ts') ? 'ts' : 'js';
        return { contents: content, loader };
      });
    },
  };
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

/** Join a virtual directory + import spec, resolving '.' and '..' segments. */
function joinVirtual(dir: string, spec: string): string {
  const parts = [...(dir ? dir.split('/') : []), ...spec.split('/')];
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join('/');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapHtml(name: string, bundle: string): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    // Defense-in-depth: even if the iframe sandbox flags were stripped, the
    // preview can never reach a network, navigate, or load subresources.
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; media-src 'none'; object-src 'none'; worker-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none';\" />",
    `<title>${escapeHtml(name)} — Preview</title>`,
    '</head>',
    '<body>',
    '<div id="root"></div>',
    '<script>',
    bundle,
    'try { window.VedApp.render(document.getElementById("root")); }',
    'catch (e) { var el = document.getElementById("root"); el.textContent = "The preview failed to start: " + (e && e.message ? e.message : String(e)); }',
    '</script>',
    '</body>',
    '</html>',
  ].join('\n');
}
