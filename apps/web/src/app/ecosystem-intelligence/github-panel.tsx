// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem Intelligence: GitHub Connect panel
// EPIC-015 — Connect GitHub is SEPARATE from Google auth. The Google identity
// token is never reused as a GitHub credential. Least-privilege by default:
// public_metadata (public discovery needs NO repo access) is the baseline;
// repository read and write access require EXPLICIT review; write access
// requires a separate consent flag — never silent. Tokens/codes never cross
// the gateway — only sanitized views (state, scopes, login, timestamps).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import {
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Ban,
  Unplug,
  ExternalLink,
  Lock,
  Eye,
  Star,
  AlertTriangle,
} from 'lucide-react';
import type { GitHubPermissionScope } from '@vedmoulya/ecosystem-intelligence';
import {
  useGitHubGetConnection,
  useGitHubBeginConnect,
  useGitHubCompleteAuth,
  useGitHubVerify,
  useGitHubRevoke,
  useGitHubDisconnect,
  useGitHubListRepositories,
} from '../../lib/api-client.js';
import {
  GITHUB_STATE_COLORS,
  SCOPE_LABELS,
  formatDateTime,
  formatHuman,
} from './intelligence-ui.js';

const ALL_SCOPES: GitHubPermissionScope[] = [
  'public_metadata',
  'public_repos_read',
  'private_repos_read',
  'orgs_read',
  'repos_write',
];

export function GitHubConnectPanel({ userId }: { userId: string }): React.JSX.Element {
  const connection = useGitHubGetConnection(userId);
  const beginConnect = useGitHubBeginConnect();
  const completeAuth = useGitHubCompleteAuth();
  const verify = useGitHubVerify();
  const revoke = useGitHubRevoke();
  const disconnect = useGitHubDisconnect();
  const repos = useGitHubListRepositories(userId);

  const [pendingScopes, setPendingScopes] = useState<GitHubPermissionScope[]>(['public_metadata']);
  const [repoAccessExplicit, setRepoAccessExplicit] = useState(false);
  const [writeConsent, setWriteConsent] = useState(false);
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [authState, setAuthState] = useState('');
  const [error, setError] = useState<string | null>(null);

  const view = connection.data;

  function toggleScope(scope: GitHubPermissionScope): void {
    setPendingScopes((prev) => {
      const has = prev.includes(scope);
      const next = has ? prev.filter((s) => s !== scope) : [...prev, scope];
      // public_metadata is the baseline — never removable.
      return next.length === 0 ? ['public_metadata'] : next;
    });
  }

  async function handleBeginConnect(): Promise<void> {
    setError(null);
    try {
      const res = await beginConnect.mutateAsync({
        userId,
        scopes: pendingScopes,
        repoAccessExplicit,
        writeConsent,
      });
      const data = (
        res as {
          data?: {
            authorizationUrl: string;
            state: string;
            grantedScopes: string[];
            rejectedScopes: string[];
          };
        }
      ).data;
      if (!data) throw new Error('empty');
      setAuthorizationUrl(data.authorizationUrl);
      setAuthState(data.state);
      if (data.rejectedScopes.length > 0) {
        setError(
          `The following scopes were rejected by the least-privilege policy: ${data.rejectedScopes.join(', ')}. Enable the explicit consent toggles below to request them.`,
        );
      }
      void connection.refetch();
    } catch {
      setError('The GitHub authorization flow could not be started right now.');
    }
  }

  async function handleCompleteAuth(): Promise<void> {
    setError(null);
    if (!authCode.trim()) {
      setError('Enter the authorization code you received from GitHub.');
      return;
    }
    try {
      const res = await completeAuth.mutateAsync({
        userId,
        code: authCode.trim(),
        state: authState,
      });
      const data = (res as { data?: { state: string } }).data;
      if (data?.state === 'CONNECTED') {
        setAuthorizationUrl(null);
        setAuthCode('');
        setAuthState('');
      }
      void connection.refetch();
      void repos.refetch();
    } catch {
      setError('The authorization code could not be exchanged right now.');
    }
  }

  async function handleVerify(): Promise<void> {
    setError(null);
    try {
      const res = await verify.mutateAsync({ userId });
      const data = (res as { data?: { valid: boolean } }).data;
      if (data && !data.valid) {
        setError('The GitHub connection could not be verified — it may have expired.');
      }
      void connection.refetch();
    } catch {
      setError('Verification could not be completed right now.');
    }
  }

  async function handleRevoke(): Promise<void> {
    setError(null);
    try {
      await revoke.mutateAsync({ userId });
      void connection.refetch();
      void repos.refetch();
    } catch {
      setError('Revoking GitHub access could not be completed right now.');
    }
  }

  async function handleDisconnect(): Promise<void> {
    setError(null);
    try {
      await disconnect.mutateAsync({ userId });
      setAuthorizationUrl(null);
      void connection.refetch();
      void repos.refetch();
    } catch {
      setError('Disconnecting GitHub could not be completed right now.');
    }
  }

  if (connection.isLoading || !view) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading GitHub connection…" size="lg" />
      </div>
    );
  }

  const connected = view.state === 'CONNECTED';

  return (
    <div className="space-y-4">
      {/* ── Connection status ─────────────────────────────────────────── */}
      <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${connected ? 'bg-[#F0FDF4] dark:bg-[#14532D]/40' : 'bg-[#F1F5F9] dark:bg-[#334155]'}`}
            >
              <GitBranch
                className={`h-5 w-5 ${connected ? 'text-[#22C55E]' : 'text-[#64748B] dark:text-[#CBD5E1]'}`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  GitHub Connection
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${GITHUB_STATE_COLORS[view.state] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                >
                  {formatHuman(view.state)}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                {view.accountLogin
                  ? `Connected as @${view.accountLogin}`
                  : 'Not connected — Google login is separate; GitHub authorizes its own scopes.'}
              </p>
            </div>
          </div>
          {connected && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  void handleVerify();
                }}
                disabled={verify.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9] dark:text-[#6B8FEF] text-[11px] font-semibold hover:bg-[#DBEAFE] dark:hover:bg-[#1E3A8A]/60 transition-colors disabled:opacity-50"
              >
                {verify.isPending ? (
                  <Loading label="" size="sm" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}{' '}
                Verify
              </button>
              <button
                onClick={() => {
                  void handleRevoke();
                }}
                disabled={revoke.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors disabled:opacity-50"
              >
                <Ban className="h-3 w-3" /> Revoke
              </button>
              <button
                onClick={() => {
                  void handleDisconnect();
                }}
                disabled={disconnect.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors disabled:opacity-50"
              >
                <Unplug className="h-3 w-3" /> Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Connection meta */}
        {view.connectedAt && (
          <p className="mt-3 text-[11px] text-[#94A3B8]">
            Connected {formatDateTime(view.connectedAt)}
            {view.lastVerifiedAt ? ` · last verified ${formatDateTime(view.lastVerifiedAt)}` : ''}
          </p>
        )}

        {/* Permission boundary chips */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">
            Permissions
          </span>
          {view.canDiscoverPublic && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-medium">
              <Eye className="h-3 w-3 inline mr-1" />
              Public discovery
            </span>
          )}
          {view.canReadPrivateRepos && (
            <span className="px-2 py-0.5 rounded-full bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF] text-[10px] font-medium">
              <Lock className="h-3 w-3 inline mr-1" />
              Private repo read
            </span>
          )}
          {view.canWriteRepos && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-medium">
              <ShieldAlert className="h-3 w-3 inline mr-1" />
              Write access (explicit)
            </span>
          )}
          {!connected && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-medium">
              No access granted
            </span>
          )}
        </div>

        {/* Granted scopes (explicit review — never broader than requested) */}
        {connected && view.grantedScopes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#F1F5F9] dark:border-[#334155]">
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">
              Granted scopes — exactly what you reviewed
            </p>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {view.grantedScopes.map((scope) => (
                <span
                  key={scope}
                  className="px-2 py-0.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-[10px] font-medium text-[#374151] dark:text-[#E2E8F0]"
                >
                  {SCOPE_LABELS[scope] ?? scope}
                </span>
              ))}
            </div>
          </div>
        )}

        {view.requiresVerification && (
          <p className="mt-3 text-[12px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> This connection is expired — verify it to
            restore access.
          </p>
        )}

        {error && (
          <p className="mt-3 text-[12px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </p>
        )}
      </Card>

      {/* ── Permission review (least-privilege connect flow) ───────────── */}
      {!connected && (
        <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#2B5FD9]" />
            <h3 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Connect GitHub — review requested permissions
            </h3>
          </div>
          <p className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
            Least-privilege by default: public discovery needs no repository access. Repository read
            and write access require explicit review below — write access additionally requires a
            separate consent. Tokens are exchanged server-side and never shown here.
          </p>

          <div className="mt-4 space-y-2">
            {ALL_SCOPES.map((scope) => {
              const isWrite = scope === 'repos_write';
              const needsExplicit =
                scope === 'private_repos_read' ||
                scope === 'public_repos_read' ||
                scope === 'orgs_read';
              return (
                <label
                  key={scope}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    pendingScopes.includes(scope)
                      ? 'border-[#2B5FD9]/40 bg-[#EFF4FE] dark:bg-[#1E3A8A]/30'
                      : 'border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={pendingScopes.includes(scope)}
                    disabled={scope === 'public_metadata'}
                    onChange={() => {
                      toggleScope(scope);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2B5FD9] focus:ring-[#2B5FD9]/40"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                        {SCOPE_LABELS[scope] ?? scope}
                      </span>
                      {scope === 'public_metadata' && (
                        <Badge variant="success" size="sm">
                          baseline
                        </Badge>
                      )}
                      {isWrite && (
                        <Badge variant="danger" size="sm">
                          write — separate consent
                        </Badge>
                      )}
                      {needsExplicit && !isWrite && (
                        <Badge variant="warning" size="sm">
                          explicit
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {scope === 'public_metadata' &&
                        'Public repository discovery — always on, no repo access needed.'}
                      {scope === 'public_repos_read' &&
                        'Read metadata of public repositories you can access.'}
                      {scope === 'private_repos_read' &&
                        'Read metadata of your private repositories — requires the explicit toggle below.'}
                      {scope === 'orgs_read' && 'Read organization metadata.'}
                      {scope === 'repos_write' &&
                        'Write to repositories. Requires the separate write-consent toggle below — never requested silently.'}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {/* Explicit consent toggles */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] cursor-pointer">
              <input
                type="checkbox"
                checked={repoAccessExplicit}
                onChange={(e) => {
                  setRepoAccessExplicit(e.target.checked);
                }}
                className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2B5FD9] focus:ring-[#2B5FD9]/40"
              />
              <span>
                <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  I explicitly authorize repository read access
                </span>
                <span className="mt-0.5 block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Required to request public/private repository scopes.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] cursor-pointer">
              <input
                type="checkbox"
                checked={writeConsent}
                onChange={(e) => {
                  setWriteConsent(e.target.checked);
                }}
                className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2B5FD9] focus:ring-[#2B5FD9]/40"
              />
              <span>
                <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  Separate consent for write access
                </span>
                <span className="mt-0.5 block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Write access is never obtained silently — future write operations also require
                  separate approval.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                void handleBeginConnect();
              }}
              disabled={beginConnect.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0D9488] text-white text-[13px] font-semibold hover:bg-[#0F766E] transition-colors disabled:opacity-50"
            >
              {beginConnect.isPending ? (
                <Loading label="" size="sm" />
              ) : (
                <GitBranch className="h-4 w-4" />
              )}
              Begin GitHub Authorization
            </button>
            <span className="text-[11px] text-[#94A3B8]">
              Review the scopes → GitHub shows its own permission screen → you approve → we store
              only an opaque server-side token ref.
            </span>
          </div>

          {/* Authorization URL + code exchange */}
          {authorizationUrl && (
            <div className="mt-4 p-3 rounded-lg border border-[#0D9488]/30 dark:border-[#0D9488]/40 bg-teal-50/50 dark:bg-[#042F2E]/40">
              <p className="text-[12px] font-semibold text-[#0F766E] dark:text-[#2DD4BF] flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Authorization started
              </p>
              <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Open the GitHub authorization URL in a new tab (deterministic in hermetic
                environments — a live GitHub App exchange is an operator step):
              </p>
              <a
                href={authorizationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0D9488] hover:underline break-all"
              >
                {authorizationUrl}
              </a>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input
                  value={authCode}
                  onChange={(e) => {
                    setAuthCode(e.target.value);
                  }}
                  placeholder="Authorization code from GitHub"
                  className="flex-1 px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[12px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/40"
                />
                <button
                  onClick={() => {
                    void handleCompleteAuth();
                  }}
                  disabled={completeAuth.isPending}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D9488] text-white text-[12px] font-semibold hover:bg-[#0F766E] transition-colors disabled:opacity-50"
                >
                  {completeAuth.isPending ? (
                    <Loading label="" size="sm" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}{' '}
                  Complete authorization
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Repositories ──────────────────────────────────────────────── */}
      {connected && (
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-1.5">
              <GitBranch className="h-4 w-4 text-[#2B5FD9]" /> Accessible repositories
            </h3>
            <button
              onClick={() => {
                void repos.refetch();
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-[#94A3B8]">
            {view.canReadPrivateRepos
              ? 'Public + private repositories (explicit private read authorization).'
              : 'Public repositories only — private access requires explicit authorization.'}
          </p>
          {repos.isLoading ? (
            <div className="mt-3 flex items-center justify-center py-8">
              <Loading label="Loading repositories…" />
            </div>
          ) : repos.data && repos.data.repos.length > 0 ? (
            <div className="mt-3 space-y-2">
              {repos.data.repos.slice(0, 12).map((repo) => (
                <div
                  key={repo.fullName}
                  className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] font-mono truncate">
                      {repo.fullName}
                    </p>
                    <span className="flex items-center gap-1 text-[10px] text-[#94A3B8] shrink-0">
                      {repo.stars !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3" />
                          {String(repo.stars)}
                        </span>
                      )}
                      {repo.language && (
                        <span className="px-1.5 py-px rounded bg-[#F1F5F9] dark:bg-[#334155] text-[9px] font-medium">
                          {repo.language}
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-px rounded text-[9px] font-medium ${
                          repo.visibility === 'private'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {repo.visibility}
                      </span>
                    </span>
                  </div>
                  {repo.description && (
                    <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] line-clamp-2">
                      {repo.description}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {repo.license && (
                      <span className="px-1.5 py-px rounded bg-[#F1F5F9] dark:bg-[#334155] text-[9px] font-medium text-[#64748B] dark:text-[#CBD5E1]">
                        {repo.license}
                      </span>
                    )}
                    {repo.allowedActions.map((action) => (
                      <span
                        key={action}
                        className="px-1.5 py-px rounded bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[9px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF]"
                      >
                        can {action}
                      </span>
                    ))}
                    {repo.archived && (
                      <span className="px-1.5 py-px rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[9px] font-medium">
                        archived
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<GitBranch className="h-6 w-6" />}
              title="No repositories yet"
              description="Repository facts appear here from the AI World discovery store — public repos are platform-wide facts; private repos only under an explicit grant."
            />
          )}
        </Card>
      )}

      {/* ── Not connected hint ────────────────────────────────────────── */}
      {!connected && (
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
          <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] flex items-start gap-2">
            <Lock className="h-4 w-4 text-[#94A3B8] shrink-0 mt-0.5" />
            GitHub connection unlocks repository intelligence: discover open-source capabilities,
            evaluate security and licensing, and build controlled acquisition plans. Discovery of
            public repositories never requires private repository permissions.
          </p>
        </Card>
      )}
    </div>
  );
}
