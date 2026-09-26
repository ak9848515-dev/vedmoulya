// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local Workspace state (browser)
//
// ONE hook owns the authorized-workspace state: capability, grants, the current
// listing, the selected file and the assembled context. It reads only what the
// Local Agent returns and never derives an access decision itself.
//
// The workspace capability is INDEPENDENT of runtime generation: an unavailable
// workspace never affects Local AI generation, cloud providers or Gemini.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assembleWorkspaceContext,
  authorizeWorkspace,
  fetchWorkspaceCapabilities,
  fetchWorkspaceEntries,
  fetchWorkspaces,
  readWorkspaceFile,
  revokeWorkspace,
  type WorkspaceCapabilitiesDTO,
  type WorkspaceContextDTO,
  type WorkspaceFileContentDTO,
  type WorkspaceListingDTO,
  type WorkspaceSummaryDTO,
} from './local-workspace-client.js';

export interface LocalWorkspaceState {
  /** null until measured; false when the agent has no workspace capability. */
  available: boolean | null;
  capabilities: WorkspaceCapabilitiesDTO | null;
  workspaces: WorkspaceSummaryDTO[];
  active: WorkspaceSummaryDTO | null;
  listing: WorkspaceListingDTO | null;
  file: WorkspaceFileContentDTO | null;
  context: WorkspaceContextDTO | null;
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  authorize: (root: string) => Promise<void>;
  openWorkspace: (id: string) => Promise<void>;
  openDirectory: (path: string) => Promise<void>;
  readFile: (path: string) => Promise<void>;
  assembleContext: () => Promise<void>;
  revoke: (id: string) => Promise<void>;
}

const INITIAL = {
  available: null as boolean | null,
  capabilities: null as WorkspaceCapabilitiesDTO | null,
  workspaces: [] as WorkspaceSummaryDTO[],
  active: null as WorkspaceSummaryDTO | null,
  listing: null as WorkspaceListingDTO | null,
  file: null as WorkspaceFileContentDTO | null,
  context: null as WorkspaceContextDTO | null,
  busy: false,
  error: null as string | null,
};

export function useLocalWorkspace(agentUrl: string | null, enabled: boolean): LocalWorkspaceState {
  const [state, setState] = useState(INITIAL);

  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled || agentUrl === null) {
      setState((previous) => ({ ...previous, available: false }));
      return;
    }
    setState((previous) => ({ ...previous, busy: true, error: null }));
    const caps = await fetchWorkspaceCapabilities(agentUrl);
    if (!caps.ok || !caps.value.available) {
      setState((previous) => ({ ...previous, busy: false, available: false }));
      return;
    }
    const list = await fetchWorkspaces(agentUrl);
    setState((previous) => ({
      ...previous,
      busy: false,
      available: true,
      capabilities: caps.value.capabilities,
      workspaces: list.ok ? list.value : previous.workspaces,
      active: previous.active ?? (list.ok ? (list.value[0] ?? null) : null),
    }));
  }, [agentUrl, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const authorize = useCallback(
    async (root: string): Promise<void> => {
      if (!enabled || agentUrl === null) return;
      setState((previous) => ({ ...previous, busy: true, error: null }));
      const result = await authorizeWorkspace(agentUrl, root);
      if (!result.ok) {
        setState((previous) => ({
          ...previous,
          busy: false,
          error: result.error.message,
        }));
        return;
      }
      const summary = result.value;
      const entries = await fetchWorkspaceEntries(agentUrl, summary.id, { depth: 1 });
      setState((previous) => ({
        ...previous,
        busy: false,
        active: summary,
        workspaces: [...previous.workspaces, summary],
        listing: entries.ok ? entries.value : null,
        file: null,
        context: null,
      }));
    },
    [agentUrl, enabled],
  );

  const openWorkspace = useCallback(
    async (id: string): Promise<void> => {
      if (!enabled || agentUrl === null) return;
      const summary = state.workspaces.find((workspace) => workspace.id === id) ?? null;
      setState((previous) => ({ ...previous, busy: true, error: null, active: summary }));
      const entries = await fetchWorkspaceEntries(agentUrl, id, { depth: 1 });
      setState((previous) => ({
        ...previous,
        busy: false,
        listing: entries.ok ? entries.value : null,
        file: null,
        context: null,
      }));
    },
    [agentUrl, enabled, state.workspaces],
  );

  const openDirectory = useCallback(
    async (path: string): Promise<void> => {
      const active = state.active;
      if (!enabled || agentUrl === null || active === null) return;
      setState((previous) => ({ ...previous, busy: true, error: null }));
      const entries = await fetchWorkspaceEntries(agentUrl, active.id, { path, depth: 1 });
      setState((previous) => ({
        ...previous,
        busy: false,
        listing: entries.ok ? entries.value : previous.listing,
        error: entries.ok ? null : entries.error.message,
      }));
    },
    [agentUrl, enabled, state.active],
  );

  const readFile = useCallback(
    async (path: string): Promise<void> => {
      const active = state.active;
      if (!enabled || agentUrl === null || active === null) return;
      setState((previous) => ({ ...previous, busy: true, error: null }));
      const result = await readWorkspaceFile(agentUrl, active.id, path);
      setState((previous) => ({
        ...previous,
        busy: false,
        file: result.ok ? result.value : null,
        error: result.ok ? null : result.error.message,
      }));
    },
    [agentUrl, enabled, state.active],
  );

  const assembleContext = useCallback(async (): Promise<void> => {
    const active = state.active;
    if (!enabled || agentUrl === null || active === null) return;
    setState((previous) => ({ ...previous, busy: true, error: null }));
    const result = await assembleWorkspaceContext(agentUrl, active.id);
    setState((previous) => ({
      ...previous,
      busy: false,
      context: result.ok ? result.value : null,
      error: result.ok ? null : result.error.message,
    }));
  }, [agentUrl, enabled, state.active]);

  const revoke = useCallback(
    async (id: string): Promise<void> => {
      if (!enabled || agentUrl === null) return;
      setState((previous) => ({ ...previous, busy: true, error: null }));
      const result = await revokeWorkspace(agentUrl, id);
      setState((previous) => ({
        ...previous,
        busy: false,
        workspaces: previous.workspaces.filter((workspace) => workspace.id !== id),
        active: previous.active?.id === id ? null : previous.active,
        listing: previous.active?.id === id ? null : previous.listing,
        file: previous.active?.id === id ? null : previous.file,
        context: previous.active?.id === id ? null : previous.context,
        error: result.ok ? null : result.error.message,
      }));
    },
    [agentUrl, enabled],
  );

  return useMemo(
    () => ({
      ...state,
      refresh,
      authorize,
      openWorkspace,
      openDirectory,
      readFile,
      assembleContext,
      revoke,
    }),
    [state, refresh, authorize, openWorkspace, openDirectory, readFile, assembleContext, revoke],
  );
}
