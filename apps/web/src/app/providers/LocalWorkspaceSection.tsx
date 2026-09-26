// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local Workspace section
//
// Shown inside the Local AI panel ONLY when the Local Agent is reachable. It
// lets the user explicitly authorize a folder on their computer, then browse and
// read it (bounded, read-only). Everything is workspace-relative: the browser
// never sees or supplies a filesystem root on a read.
//
// The runtime (Local AI) stays completely separate — this section never touches
// generation, cloud providers or Gemini.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { FolderLock, FolderOpen, FileText, ShieldCheck, Trash2 } from 'lucide-react';
import { useLocalWorkspace } from './use-local-workspace.js';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LocalWorkspaceSection({ agentUrl }: { agentUrl: string }): React.ReactElement {
  const workspace = useLocalWorkspace(agentUrl, true);
  const [path, setPath] = useState('');
  const { available, capabilities, active, listing, file, context } = workspace;

  const parentPath =
    listing !== null && listing.path.includes('/')
      ? listing.path.slice(0, listing.path.lastIndexOf('/'))
      : '';

  return (
    <section
      data-testid="local-workspace-section"
      className="mt-4 border-t border-[#E2E8F0] dark:border-[#334155] pt-4"
    >
      <div className="flex items-start gap-3">
        <FolderLock
          className="mt-0.5 h-4 w-4 shrink-0 text-[#2B5FD9] dark:text-[#60A5FA]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Local workspace
          </h3>
          <p className="mt-0.5 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
            Authorize a folder on this computer. VedMoulya can only list and read the folder you
            choose — it never writes, executes or follows symlinks.
          </p>
        </div>
      </div>

      {available === false ? (
        <p data-testid="local-workspace-unavailable" className="mt-3 text-[12px] text-[#64748B]">
          The Local Agent has no workspace capability available.
        </p>
      ) : null}

      {available === true ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="local-workspace-read-only"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Read-only
            </span>
            {capabilities !== null ? (
              <span
                data-testid="local-workspace-capabilities"
                className="text-[11px] text-[#64748B]"
              >
                list {String(capabilities.list)} · read {String(capabilities.read)} · write{' '}
                {String(capabilities.write)} · exec {String(capabilities.exec)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor="local-workspace-path" className="sr-only">
              Folder path
            </label>
            <input
              id="local-workspace-path"
              data-testid="local-workspace-path"
              type="text"
              value={path}
              onChange={(event) => {
                setPath(event.target.value);
              }}
              placeholder="An absolute folder path, e.g. /home/you/project"
              className="min-w-[16rem] flex-1 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3 py-2 text-[13px] text-[#111827] dark:text-[#F8FAFC]"
            />
            <button
              type="button"
              data-testid="local-workspace-authorize"
              disabled={workspace.busy || path.trim() === ''}
              onClick={() => {
                void workspace.authorize(path.trim());
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2B5FD9] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#1E4AA8] disabled:opacity-50"
            >
              <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Authorize folder
            </button>
          </div>

          {workspace.error !== null ? (
            <p
              data-testid="local-workspace-error"
              className="text-[12px] text-rose-700 dark:text-rose-300"
            >
              {workspace.error}
            </p>
          ) : null}

          {active !== null ? (
            <div
              data-testid="local-workspace-card"
              className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p
                    data-testid="local-workspace-label"
                    className="truncate text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]"
                  >
                    {active.label}
                  </p>
                  <p
                    data-testid="local-workspace-display-path"
                    className="truncate text-[11px] text-[#64748B] dark:text-[#94A3B8]"
                  >
                    {active.displayPath}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="local-workspace-revoke"
                  disabled={workspace.busy}
                  onClick={() => {
                    void workspace.revoke(active.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#334155] px-2 py-1 text-[12px] text-[#374151] dark:text-[#E2E8F0] hover:bg-white/60 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Revoke
                </button>
              </div>
              <p data-testid="local-workspace-limits" className="mt-1 text-[11px] text-[#94A3B8]">
                max {formatBytes(active.limits.maxFileBytes)} per file ·{' '}
                {active.limits.maxListEntries} entries · depth {active.limits.maxDepth}
              </p>
            </div>
          ) : null}

          {listing !== null ? (
            <div data-testid="local-workspace-entries">
              <div className="flex items-center gap-2 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                <span data-testid="local-workspace-current-path">
                  /{listing.path === '' ? '' : listing.path}
                </span>
                {listing.path !== '' ? (
                  <button
                    type="button"
                    data-testid="local-workspace-up"
                    onClick={() => {
                      void workspace.openDirectory(parentPath);
                    }}
                    className="underline"
                  >
                    up
                  </button>
                ) : null}
                {listing.truncated ? <span>· truncated</span> : null}
              </div>
              <ul className="mt-1 space-y-0.5">
                {listing.entries.map((entry) => (
                  <li key={entry.path}>
                    <button
                      type="button"
                      data-testid={`local-workspace-entry-${entry.name}`}
                      disabled={entry.kind === 'symlink' || entry.kind === 'other'}
                      onClick={() => {
                        if (entry.kind === 'directory') void workspace.openDirectory(entry.path);
                        else if (entry.kind === 'file') void workspace.readFile(entry.path);
                      }}
                      className="inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[12px] text-[#374151] dark:text-[#E2E8F0] hover:bg-white/60 disabled:opacity-50"
                    >
                      <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{entry.name}</span>
                      <span className="text-[10px] text-[#94A3B8]">{entry.kind}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {file !== null ? (
            <div
              data-testid="local-workspace-file"
              className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] p-3"
            >
              <p className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                {file.path}
              </p>
              {file.encoding === 'utf8' && file.content !== undefined ? (
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[12px] text-[#374151] dark:text-[#E2E8F0]">
                  {file.content}
                </pre>
              ) : (
                <p
                  data-testid="local-workspace-file-omitted"
                  className="mt-1 text-[12px] text-[#64748B]"
                >
                  Binary file — contents are not returned (metadata only).
                </p>
              )}
              {file.truncated ? (
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Showing the first {formatBytes(file.bytes)}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <button
              type="button"
              data-testid="local-workspace-context-button"
              disabled={workspace.busy || active === null}
              onClick={() => {
                void workspace.assembleContext();
              }}
              className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-3 py-2 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] disabled:opacity-50"
            >
              Assemble workspace context
            </button>
          </div>

          {context !== null ? (
            <div
              data-testid="local-workspace-context"
              className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] p-3"
            >
              <ul className="space-y-0.5">
                {context.files.map((entry) => (
                  <li key={entry.path} className="text-[12px] text-[#374151] dark:text-[#E2E8F0]">
                    {entry.path}{' '}
                    <span className="text-[#94A3B8]">({formatBytes(entry.bytes)})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-[#94A3B8]">
                {context.files.length} file(s) · {context.omittedCount} omitted
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
