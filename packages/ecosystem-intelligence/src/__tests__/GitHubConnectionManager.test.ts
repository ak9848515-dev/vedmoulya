import { describe, it, expect } from 'vitest';
import {
  GitHubConnectionManager,
  effectiveGrantedScopes,
  isWriteScope,
} from '../domain/GitHubConnectionManager.js';
import { FIXED_NOW } from './fixtures.js';

const clock = { now: () => FIXED_NOW };
const manager = new GitHubConnectionManager(clock);

describe('GitHubConnectionManager — state machine', () => {
  it('starts DISCONNECTED with no scopes', () => {
    const view = manager.permissionView(manager.disconnected('user-1'));
    expect(view.state).toBe('DISCONNECTED');
    expect(view.grantedScopes).toEqual([]);
    expect(view.canDiscoverPublic).toBe(false);
  });

  it('public metadata is the minimal default — no repo access needed for discovery', () => {
    const { requested } = manager.beginAuthorization(undefined, 'user-1', []);
    expect(requested).toEqual(['public_metadata']);
  });

  it('AUTHORIZING → CONNECTED only grants scopes the user explicitly requested', () => {
    const { connection } = manager.beginAuthorization(undefined, 'user-1', [
      'public_metadata',
      'public_repos_read',
    ]);
    expect(connection.state).toBe('AUTHORIZING');
    const completed = manager.completeAuthorization(connection, 'user-1', 'moulya', [
      'public_metadata',
      'public_repos_read',
      'private_repos_read', // provider offered more — must be refused
    ]);
    expect(completed.state).toBe('CONNECTED');
    expect(completed.grantedScopes).toEqual(['public_metadata', 'public_repos_read']);
    expect(completed.grantedScopes).not.toContain('private_repos_read');
    expect(completed.accountLogin).toBe('moulya');
    expect(completed.lastVerifiedAt).toBe(FIXED_NOW);
  });

  it('never broadens a grant beyond what the user reviewed', () => {
    const granted = effectiveGrantedScopes(
      ['public_metadata'],
      ['public_metadata', 'private_repos_read'],
    );
    expect(granted).toEqual(['public_metadata']);
  });

  it('private repo read requires explicit authorization — never implied by public grant', () => {
    const withPrivate = manager.beginAuthorization(undefined, 'user-1', [
      'public_metadata',
      'private_repos_read',
    ]);
    const completed = manager.completeAuthorization(withPrivate.connection, 'user-1', 'moulya', [
      'public_metadata',
      'private_repos_read',
    ]);
    const view = manager.permissionView(completed);
    expect(view.canReadPrivateRepos).toBe(true);
    expect(view.canWriteRepos).toBe(false);

    const publicOnly = manager.completeAuthorization(withPrivate.connection, 'user-1', 'moulya', [
      'public_metadata',
    ]);
    expect(manager.permissionView(publicOnly).canReadPrivateRepos).toBe(false);
  });

  it('write access is a separate, never-silent permission', () => {
    const { requested, connection } = manager.beginAuthorization(undefined, 'user-1', [
      'public_metadata',
      'repos_write',
    ]);
    expect(isWriteScope('repos_write')).toBe(true);
    const completed = manager.completeAuthorization(connection, 'user-1', 'moulya', [...requested]);
    expect(completed.grantedScopes).toContain('repos_write');
    // The permission view exposes it explicitly.
    expect(manager.permissionView(completed).canWriteRepos).toBe(true);
  });

  it('verify refreshes lastVerifiedAt and detects expired connections', () => {
    const { connection } = manager.beginAuthorization(undefined, 'user-1', ['public_metadata']);
    const connected = manager.completeAuthorization(connection, 'user-1', 'moulya', [
      'public_metadata',
    ]);
    const verified = manager.verify(connected, true, 'moulya');
    expect(verified.state).toBe('CONNECTED');
    const expired = manager.verify(connected, false);
    expect(expired.state).toBe('EXPIRED');
    expect(manager.permissionView(expired).requiresVerification).toBe(true);
  });

  it('revoke clears granted scopes; disconnect fully resets the connection', () => {
    const { connection } = manager.beginAuthorization(undefined, 'user-1', ['public_metadata']);
    const connected = manager.completeAuthorization(connection, 'user-1', 'moulya', [
      'public_metadata',
    ]);
    const revoked = manager.revoke(connected);
    expect(revoked.state).toBe('REVOKED');
    expect(revoked.grantedScopes).toEqual([]);
    const disconnected = manager.disconnect(revoked);
    expect(disconnected.state).toBe('DISCONNECTED');
    expect(disconnected.tokenRef).toBeUndefined();
  });

  it('scope validation requires explicit intent for repo access and separate consent for write', () => {
    const withoutConsent = manager.validateScopeRequest(
      ['public_metadata', 'private_repos_read', 'repos_write'],
      { repoAccessExplicit: false, writeConsent: false },
    );
    expect(withoutConsent.accepted).toEqual(['public_metadata']);
    expect(withoutConsent.rejected).toEqual(['private_repos_read', 'repos_write']);

    const withExplicit = manager.validateScopeRequest(
      ['public_metadata', 'private_repos_read', 'repos_write'],
      { repoAccessExplicit: true, writeConsent: false },
    );
    expect(withExplicit.accepted).toEqual(['public_metadata', 'private_repos_read']);
    expect(withExplicit.rejected).toEqual(['repos_write']);

    const full = manager.validateScopeRequest(
      ['public_metadata', 'private_repos_read', 'repos_write'],
      { repoAccessExplicit: true, writeConsent: true },
    );
    expect(full.accepted).toEqual(['public_metadata', 'private_repos_read', 'repos_write']);
    expect(full.rejected).toEqual([]);
  });

  it('permission view never exposes tokens or refs', () => {
    const { connection } = manager.beginAuthorization(undefined, 'user-1', ['public_metadata']);
    const connected = manager.completeAuthorization(connection, 'user-1', 'moulya', [
      'public_metadata',
    ]);
    const view = manager.permissionView(connected);
    expect(JSON.stringify(view)).not.toContain('token');
    expect(JSON.stringify(view)).not.toContain('sk-');
  });
});
