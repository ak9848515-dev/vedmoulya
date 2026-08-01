// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: GoogleProvider
// Covers authorization URL, code exchange, profile fetch, and refresh flows.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleProvider } from '../src/auth/GoogleProvider.js';

describe('GoogleProvider', () => {
  let provider: GoogleProvider;

  beforeEach(() => {
    provider = new GoogleProvider();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('returns a Google OAuth2 authorization URL with all params', () => {
      const url = provider.getAuthorizationUrl('state-1');
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid+email+profile');
      expect(url).toContain('state=state-1');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('client_id=');
    });
  });

  describe('handleCallback', () => {
    it('returns a profile on a successful exchange', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'access-123' }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'google-1',
              email: 'g@example.com',
              verified_email: true,
              name: 'G User',
              given_name: 'G',
              family_name: 'User',
              picture: 'pic',
              locale: 'en',
            }),
            { status: 200 },
          ),
        );
      vi.stubGlobal('fetch', fetchMock);

      const result = await provider.handleCallback('code-1');
      expect(result.success).toBe(true);
      expect(result.profile?.id).toBe('google-1');
      expect(result.profile?.email).toBe('g@example.com');
      expect(result.profile?.verifiedEmail).toBe(true);
      expect(result.profile?.name).toBe('G User');
      expect(result.profile?.givenName).toBe('G');
      expect(result.profile?.familyName).toBe('User');
      expect(result.profile?.picture).toBe('pic');
      expect(result.profile?.locale).toBe('en');
    });

    it('returns an error when the token exchange fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 401 })));

      const result = await provider.handleCallback('bad-code');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to exchange authorization code');
    });

    it('returns an error when no access token is returned', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })),
      );

      const result = await provider.handleCallback('code-2');
      expect(result.success).toBe(false);
      expect(result.error).toBe('No access token received');
    });

    it('returns an error when the profile fetch fails', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'access-123' }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response('nope', { status: 500 }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await provider.handleCallback('code-3');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch user profile');
    });

    it('catches network errors and returns a generic failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

      const result = await provider.handleCallback('code-4');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Google authentication failed');
    });
  });

  describe('refreshAccessToken', () => {
    it('returns refreshed tokens on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ access_token: 'new-token', expires_in: 3600 }), {
            status: 200,
          }),
        ),
      );

      const result = await provider.refreshAccessToken('refresh-1');
      expect(result?.accessToken).toBe('new-token');
      expect(result?.expiresIn).toBe(3600);
    });

    it('returns null when the refresh fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })));

      const result = await provider.refreshAccessToken('refresh-2');
      expect(result).toBeNull();
    });

    it('returns null on network errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

      const result = await provider.refreshAccessToken('refresh-3');
      expect(result).toBeNull();
    });
  });
});
