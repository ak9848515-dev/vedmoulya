# MOB-001 — Mobile Authentication Completion

**Status:** Implemented · **Scope:** Android (Capacitor) + web login · **Owner:** Platform Engineering

---

## 1. Goal

Complete the authentication flow for the Android (Capacitor) application:

1. Unauthenticated users are **redirected to `/login`** (no more "Sign In Required" card).
2. A **Login screen** exists (`/login`).
3. **Google Sign-In** is supported (redirect OAuth through the existing Identity Service).
4. After login the **JWT** is obtained, **stored securely**, **attached to every tRPC request**, and the **session is restored on app restart**.
5. **Logout** clears the JWT + cached user state and redirects to `/login`.
6. Verified for: first launch, login, app restart, logout, expired token, offline.

**Constraints honored:** the backend and the authentication APIs were NOT modified. The
implementation consumes the existing `AuthService`, `TokenService` (JWT), `GoogleProvider`
and `createAuthRouter` from `@vedmoulya/identity` unchanged.

---

## 2. Architecture

```
┌─────────────────────────────┐   ┌──────────────────────────────────────────┐
│  Capacitor WebView          │   │  Deployed server (Next.js)               │
│  (origin https://localhost) │   │                                          │
│                             │   │  /api/trpc/*            → tRPC gateway  │
│  /login            ────────►│   │  /api/v1/identity/auth/* → Hono auth     │
│  /oauth2redirect   ◄────────│   │    router (existing)     router (mounted)│
│  session-manager            │   └──────────────────────────────────────────┘
│  secure-store (Keystore)    │
└─────────────────────────────┘
```

### New frontend modules (`apps/web/src/auth/`)

| Module                 | Responsibility                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `config.ts`            | `NEXT_PUBLIC_IDENTITY_URL`, gateway URL, Google redirect URI                                                |
| `platform.ts`          | Capacitor-native vs web vs SSR/test detection                                                               |
| `secure-store.ts`      | Zustand persist adapter: **Android Keystore** (native) / localStorage (web) / memory (tests)                |
| `auth-api.ts`          | Typed fetch client for the existing `/api/v1/identity/auth/*` endpoints                                     |
| `session-manager.ts`   | Restore, email/password login, Google OAuth begin/complete, single-flight refresh, logout, offline handling |
| `auth-link.ts`         | tRPC link: 401 → refresh once → retry                                                                       |
| `stores/auth-store.ts` | Zustand store: access/refresh token, expiry, user, offline, sessionReady                                    |

### Server wiring (`apps/web/src/app/api/`)

- `api/v1/identity/auth/[...path]/route.ts` — mounts the **existing**
  `createAuthRouter` (sign-in, sign-up, google/url, google/callback, refresh,
  session, sign-out) in-process with the production identity repository, plus
  CORS for the WebView.
- `api/trpc/[trpc]/route.ts` — added CORS + OPTIONS handling (mobile WebView is
  a cross-origin caller of the remote gateway).

---

## 3. Sign-in flows

### Email / password

`/login` form → `POST /api/v1/identity/auth/sign-in` → session stored.

### Google Sign-In (redirect flow)

The identity service's OAuth is a **web-server flow** (confidential Web client,
HTTPS-only redirect URIs — Google rejects custom schemes for Web clients, and
no maintained native Google plugin exists for Capacitor 8), so the flow is:

1. `GET /auth/google/url` → `{ url, state }` (existing endpoint).
2. Save `{ state, next }` in sessionStorage and navigate to `url`
   (full-page redirect — inside the WebView this opens Google and returns to
   the app's own origin `https://localhost`).
3. Google redirects to `https://localhost/oauth2redirect?code=…&state=…`
   → `/oauth2redirect` page verifies the CSRF `state`, exchanges the code via
   `GET /auth/google/callback?code=…` (existing endpoint) and stores the session.

---

## 4. Configuration

### Backend (identity service) env — unchanged APIs, new values only

```env
FF_SOCIAL_LOGIN_ENABLED=true
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-…
# Must match NEXT_PUBLIC_GOOGLE_REDIRECT_URI and the Google console entry:
GOOGLE_REDIRECT_URI=https://localhost/oauth2redirect   # mobile WebView
# Web (non-mobile) deployment would use: https://app.example.com/oauth2redirect
```

> ⚠️ Production note: `packages/core`'s strict URL guard rejects a localhost
> `GOOGLE_REDIRECT_URI` **if** `config.auth.googleRedirectUri` is ever read.
> Today `GoogleProvider` reads the raw env var (no guard), but treat the
> mobile + production combination as "register the local bundle's origin"
> and keep an eye on that guard when ops changes land.
>
> ⚠️ Ops note: the mounted `/api/v1/identity/auth/*` routes carry no rate
> limiting (the gateway rate-limits tRPC only; the Hono router is the
> identity service's own). Sign-in/sign-up are brute-force targets — put
> them behind a WAF/reverse-proxy throttle in production.

### Web app env (`apps/web/.env.local` / mobile build env)

| Variable                          | Web default                       | Mobile (static export)                     |
| --------------------------------- | --------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_GATEWAY_URL`         | unset → `/api/trpc`               | `https://api.example.com`                  |
| `NEXT_PUBLIC_IDENTITY_URL`        | unset → same origin               | `https://api.example.com`                  |
| `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` | unset → `<origin>/oauth2redirect` | unset → `https://localhost/oauth2redirect` |

### Google Cloud Console

On the **existing Web OAuth client** used by the identity service add the
redirect URI (Web clients accept HTTPS URIs only; localhost is exempt):

- Mobile / local bundle: `https://localhost/oauth2redirect`
- Web app: `https://app.example.com/oauth2redirect`

`npx cap sync android` was run once — the `@aparajita/capacitor-secure-storage`
plugin is registered in `apps/web/android/`. Re-run `npm run build:mobile` then
`npm run mobile:sync` whenever the native plugin set changes.

---

## 5. Session lifecycle

| Event             | Behavior                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **First launch**  | No persisted session → `sessionReady` → protected pages redirect to `/login`                                                                 |
| **Login**         | Tokens + user stored in Zustand **and** secure storage (Keystore on Android)                                                                 |
| **Restart**       | Hydrate from secure storage → validate: known-expired → refresh; unknown expiry → verify via `/auth/session`; rejected → refresh or sign out |
| **Expired token** | tRPC 401 → `auth-link` refreshes once (single-flight) and retries with the fresh JWT                                                         |
| **Logout**        | Best-effort `POST /auth/sign-out`, then clear store + persisted storage → redirect `/login`                                                  |
| **Offline**       | Network failure during restore **keeps** the cached session and sets `offline` (banner shown); sign-in surfaces "You appear to be offline"   |

---

## 6. Verification matrix (automated)

`cd apps/web && npx vitest run` — `src/auth/__tests__/` (36 tests):

| Scenario      | Test                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| First launch  | `session-manager` » "boots signed-out and ready"                                                        |
| Login         | `session-manager` » "signs in with email/password and persists"                                         |
| App restart   | `session-manager` » "restores the persisted session…" + `secure-store` round-trip                       |
| Logout        | `session-manager` » "clears the JWT, cached user and persisted state"                                   |
| Expired token | `session-manager` » "refreshes an expired access token"; "signs out when the refresh token is rejected" |
| Offline       | `session-manager` » "keeps a valid cached session and flags offline"                                    |

Manual device checks (requires a signed APK + reachable server):
first launch → `/login`; Google sign-in round-trip; kill & relaunch (session
restored); sign out; airplane-mode relaunch (offline banner, session kept).

---

## 7. Testing commands

```bash
cd apps/web && npx vitest run      # auth unit tests
npm run build:mobile               # static export for the Capacitor WebView
npx tsc --noEmit -p tsconfig.json  # typecheck
npx eslint src/auth src/app/login src/app/oauth2redirect   # lint new code
```
