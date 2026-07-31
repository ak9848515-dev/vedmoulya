# 14 — Edge Cases

> **Document:** Edge Cases for VedMoulya Onboarding
> **Design System:** DES-001
> **Mission:** DES-002
> **Last Updated:** July 2026

---

## 01. Purpose

Every onboarding flow must gracefully handle unexpected states. This document catalogues every edge case — technical, behavioral, environmental, and psychological — with prescribed UX responses.

**Design Philosophy:** No user should ever feel stuck, confused, punished, or abandoned. Every edge case is a trust-building opportunity.

**Cross-Reference:** DES-001/D13 (Empty, Loading, Error States), PRD-002 (User Journey), CMP-002 (Constitution)

---

## 02. Edge Case Categories

```
                    ┌─────────────────────────┐
                    │    EDGE CASE MATRIX      │
                    ├─────────────────────────┤
                    │                  │ Active │ Background │
                    ├─────────────────┼────────┼────────────┤
                    │  Network         │  E01   │    E02     │
                    │  Device          │  E03   │    E04     │
                    │  Data            │  E05   │    E06     │
                    │  User Behavior   │  E07   │    E08     │
                    │  Security        │  E09   │    E10     │
                    │  Environment     │  E11   │    E12     │
                    │  Integration     │  E13   │    E14     │
                    └─────────────────┴────────┴────────────┘
```

**E01–E07:** Screens where the user is actively interacting.
**E02–E08:** Screens in background or during transitions.

---

## 03. Network Edge Cases

### E01: No Internet Connection (Active Screen)

**Trigger:** User taps "Continue" and network is unreachable.

**UX Response:**

- Do NOT show error immediately on screen load
- Cache the entire onboarding flow locally (preloaded on install)
- Only show network error when user attempts a server-requiring action
- Display inline banner below the progress bar, not a blocking modal

**Visual Specification:**

```
┌─────────────────────────────────────┐
│  ● ○ ○ ○ ○ ○ ○ ○  Personal Details │
│  ┌─────────────────────────────┐    │
│  │  Name                        │    │
│  │  [________________________] │    │
│  │                              │    │
│  │  Email                       │    │
│  │  [________________________] │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ ⚠️  No internet connection   │    │
│  │ We'll save your progress     │    │
│  │ and sync when you're back.   │    │
│  └─────────────────────────────┘    │
│                                      │
│  [     Continue (Saved Locally)   ] │
└─────────────────────────────────────┘
```

**Typography:**

- Banner text: Inter Regular, 14px, #5B6770
- Icon: JetBrains Mono, 16px, #E8A838 (Soft Matte Gold — caution)

**Behavior:**

- Continue button remains active — saves data locally
- After 3 network attempts, show "Saved offline — will sync automatically"
- When network returns: toast "Progress saved to your account" (auto-dismiss 4s)
- Never block the user from completing onboarding

**Psychology:** Remove anxiety. The user isn't punished for connectivity issues. Trust is maintained by preserving their effort.

---

### E02: Connection Lost During Server Operation

**Trigger:** User submits data and connection drops mid-request.

**UX Response:**

- Show "Saving..." state with indeterminate progress (see D11 — slow shimmer)
- After 5s timeout: show inline recovery message
- Do NOT show an error dialog — show a recovery prompt

**Visual Specification:**

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐    │
│  │  ○ ○ ○ ○ ○  Saving...      │    │
│  │  We're making sure nothing  │    │
│  │  gets lost.                 │    │
│  │  ━━━━━━━━━━━━━━━━░░░░░░░  │    │
│  └─────────────────────────────┘    │
│                                      │
│  After 5s:                           │
│  ┌─────────────────────────────┐    │
│  │ 🔄  Connection interrupted   │    │
│  │  Your data is safe locally.  │    │
│  │  [     Retry     ] [ Later ]│    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Animation:**

- Saving indicator: pulse 0.3s, opacity 0.6→1.0
- Recovery card: fade in 0.3s, ease-out

---

### E03: Slow Connection (3G / Low Bandwidth)

**Trigger:** Network speed < 500 Kbps detected.

**UX Response:**

- Preload all onboarding assets during splash screen
- Show "Optimizing for your connection" on loading screens
- Compress images to 80% quality automatically
- Prioritize text content over illustrations

**Visual Specification:**

- Replace animated illustrations with static fallback (SVG placeholder)
- Show quality indicator: small dot in progress bar area
  - Green dot: fast connection
  - Yellow dot: moderate
  - Orange dot: slow

**Psychology:** Transparency builds trust. Hiding connection issues breeds frustration when things load slowly without explanation.

---

## 04. Device Edge Cases

### E04: Low Storage Space

**Trigger:** Device storage < 500 MB available.

**UX Response:**

- Detect before permission requests screen (D09)
- Show gentle warning with clear action
- Explain what data will be stored locally
- Allow user to skip local storage (cloud-only mode)

**Visual Specification:**

```
┌─────────────────────────────────────┐
│  💾  Your device is running low     │
│  on storage.                        │
│                                     │
│  We'll store less data on your      │
│  device and keep most in the cloud. │
│                                     │
│  [  Use Cloud Mode  ] [  Continue  ]│
│                                     │
│  (You can change this anytime       │
│   in Settings)                      │
└─────────────────────────────────────┘
```

**Typography:**

- Title: Satoshi Medium, 18px, #1A1D24
- Body: Inter Regular, 15px, #5B6770
- Link: Inter Regular, 13px, #2B5FD9

---

### E05: Low Battery (Mobile)

**Trigger:** Battery < 15% and user is mid-onboarding.

**UX Response:**

- Show non-blocking banner: "Low battery — your progress is saved"
- Offer "Save & Continue Later" as prominent option
- On the next button, add small battery indicator
- Do NOT force save — user may want to finish

**Psychology:** Respect the user's device health. Show you care about their full experience, not just data collection.

---

### E06: Screen Size / Foldable / Ultra-Wide

**Trigger:** Device detected outside standard breakpoints.

**UX Response:**

- Foldable hinge: content avoids hinge area (margin increased to 32px on each side)
- Ultra-wide: center content max-width 480px, use sides for ambient decorative gradients
- Tablet landscape: show side-by-side content where appropriate (e.g., DNA assessment + visual)
- Always test onboarding on [these device silhouettes] (reference: DES-001/D14)

**Specification by Device:**

| Device                   | Layout                | Max Content Width   | Illustration Placement      |
| ------------------------ | --------------------- | ------------------- | --------------------------- |
| Foldable (folded)        | Mobile single-column  | 100% - 32px margins | Top, 50% height             |
| Foldable (unfolded)      | 2-column grid         | 480px (centered)    | Right side, 40% width       |
| Ultra-wide 21:9          | Centered with ambient | 480px               | Right, with gradient bridge |
| Foldable (tabletop mode) | Bottom sheet style    | 100% - 32px margins | Half-screen background      |

**Psychology:** Foldable users chose that form factor for flexibility. Honor it by making every posture feel native.

---

## 05. Data Edge Cases

### E07: User Already Has an Account

**Trigger:** Email detected as existing user during sign-up flow.

**UX Response:**

- Do NOT say "Account already exists" (creates anxiety)
- Show: "Welcome back! It looks like you've already started your journey with us."
- Offer: "Continue where you left off" or "Start fresh as a new user"
- If user was mid-onboarding previously: resume from that exact step

**Visual Specification:**

```
┌─────────────────────────────────────┐
│                                     │
│          👋  Welcome Back!          │
│                                     │
│  You've already begun your          │
│  journey with us.                   │
│                                     │
│  You were on:  "Your Goals"         │
│                                     │
│  [  Continue Journey  ]             │
│                                     │
│  [  Start Fresh  ]                  │
│                                     │
└─────────────────────────────────────┘
```

**Animation:** Card entrance slide-up 0.5s, spring(0.3, 0.8, 0, 1)

---

### E08: Data Validation Failure

**Trigger:** User enters invalid data (email format, short name, etc.)

**UX Response:**

- Validate on blur, not on keypress (reduces cognitive load)
- Show inline error below the field, not at top of screen
- Use positive framing: "Almost there! Email needs an @ symbol" not "Invalid email"
- Never use red borders alone — add icon + text
- Allow submission with validation warning (don't block — let them fix later in profile)

**Visual Specification:**

```
┌─────────────────────────────────────┐
│  Email                               │
│  ┌─────────────────────────────┐    │
│  │ hello@example               │    │
│  └─────────────────────────────┘    │
│  ✻  Looks like this is missing     │
│     a domain (like .com). We'll     │
│     help you fix it.               │
└─────────────────────────────────────┘
```

**Colors:**

- Error icon: #D94C3A (Danger)
- Error text: Inter Regular, 13px, #D94C3A
- Input border: 1.5px #D94C3A
- Background tint: rgba(217, 76, 58, 0.04)

---

### E09: Duplicate Entry (Purpose, Goals, etc.)

**Trigger:** User selects a purpose or goal already selected.

**UX Response:**

- Gently pulse the already-selected item (subtle glow)
- Show brief tooltip: "Already added! You can focus on one thing at a time."
- Allow deselection by tapping again
- Never show error — this is a guidance opportunity

**Animation:**

- Pulse: scale 1.0→1.03→1.0, 0.5s, ease-in-out

---

## 06. User Behavior Edge Cases

### E10: User Taps Back Repeatedly

**Trigger:** User taps back button 3+ times within 2 seconds.

**UX Response:**

- First two taps: normal back navigation
- Third tap: pause and show brief prompt
- "Need help? You can always come back to this step."

**Psychology:** Rapid back-tapping signals confusion or anxiety. Address it with empathy, not friction.

---

### E11: User Idles Mid-Onboarding

**Trigger:** No interaction for 5+ minutes on any screen.

**UX Response:**

- After 2 minutes: dim screen slightly (opacity 0.98)
- After 5 minutes: show gentle re-engagement card
- After 15 minutes: auto-save and return to lock screen / background
- State is preserved exactly where they left off

**Visual Specification (5-minute prompt):**

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐    │
│  │  Still thinking?            │    │
│  │                             │    │
│  │  Take your time. Your       │    │
│  │  progress is saved.         │    │
│  │                             │    │
│  │  [  Continue  ] [  Later  ]│    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Typography:**

- Inter Regular, 15px, #5B6770
- Buttons: Satoshi Medium, 15px

---

### E12: User Appears to Be Stuck

**Trigger:** User lingers on a selection screen > 3 minutes without selecting or > 1 minute after scrolling.

**UX Response:**

- Gentle nudge after 1 minute: Soft fade-in of suggestion hint
- After 2 minutes: Show "Need a recommendation? I can suggest options based on what I know so far."
- Offer AI guidance without pressure — always keep "Skip" available

**Psychology:** Offering help before frustration builds is the hallmark of a wise mentor. Waiting until the user is frustrated is too late.

---

### E13: User Quickly Taps Through (Rusher)

**Trigger:** User completes each screen in < 3 seconds without reading content.

**UX Response:**

- Do NOT slow them down — respect their pace
- After screen 3 of rushing, show brief verification: "You're moving quickly! Want to make sure everything feels right?"
- If they continue rushing: optimize future onboarding for speed (fewer options, quicker paths)
- Never add forced delays or minimum time requirements

**Psychology:** Rushing may indicate impatience, but could also indicate a power user. Don't punish speed — adapt to it.

---

### E14: User Abandons Mid-Flow (Returns Later)

**Trigger:** User closes app during onboarding, returns later.

**UX Response:**

- Resume exactly where they left off (not restart)
- Show "Welcome back! You were setting up your [last completed step]."
- Brief summary of what's been completed: "✓ Identity ✓ Purpose"
- No data lost — everything saved in progress

**Visual Specification:**

```
┌─────────────────────────────────────┐
│  Welcome Back!                      │
│                                     │
│  ✓  Identity Setup                  │
│  ✓  Purpose Selection               │
│  ○  Your Goals                      │  ← Resuming here
│                                     │
│  [    Continue    ]                 │
│                                     │
│  "You've made great progress        │
│   already. Let's keep going."       │
└─────────────────────────────────────┘
```

---

## 07. Security Edge Cases

### E15: Biometric Authentication Fails

**Trigger:** Face ID / Touch ID fails 3 times during identity setup.

**UX Response:**

- After 1st fail: "Try again. Your face or fingerprint didn't match."
- After 2nd fail: "Still not matching. You can set up a passcode instead."
- After 3rd fail: Offer fallback to email-password authentication
- Never show lockout warnings — those come from OS, not app

---

### E16: Suspicious Activity Detected

**Trigger:** Unusual pattern detected (rapid sign-up attempts, VPN detected, etc.)

**UX Response:**

- Show additional verification step
- Frame as security, not accusation: "Let's make sure it's really you"
- Offer email verification code
- Never show "Suspicious activity" text — use "Extra security step"

---

## 08. Integration Edge Cases

### E17: Calendar Permission Denied

**Trigger:** User denies calendar permission during integration setup (D09).

**UX Response:**

- Accept gracefully: "No problem! You can connect your calendar anytime from Settings."
- Continue onboarding without calendar
- Never show error or warning — this is a valid user choice

---

### E18: Google/Apple Sign-In Fails

**Trigger:** OAuth flow fails (timeout, cancelled, network error).

**UX Response:**

- Show calm recovery: "That didn't go through. No worries — here are other options."
- Offer: Retry, Email sign-up, or Explore First
- Preserve all previously entered data

**Visual Specification:**

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐    │
│  │  Didn't go through.         │    │
│  │  Let's try a different way. │    │
│  │                             │    │
│  │  [  Try Again  ]           │    │
│  │  [  Sign Up with Email  ]  │    │
│  │  [  Continue as Guest  ]   │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

### E19: Email Verification Link Expired

**Trigger:** User clicks verification link > 24 hours old.

**UX Response:**

- Show: "This link has expired. Want us to send a new one?"
- One-tap re-send
- Preserve all onboarding progress

---

## 09. Environment Edge Cases

### E20: System Font Size Changed (Accessibility)

**Trigger:** User has increased system font size beyond normal range.

**UX Response:**

- Respect system Dynamic Type / font scaling settings
- Ensure all containers expand gracefully
- Cards become taller, not wider
- Grid shifts from 2-column to 1-column at > 150% scaling
- Test at every accessibility font size level

---

### E21: Dark Mode Inconsistency

**Trigger:** User switches between light/dark mode mid-onboarding.

**UX Response:**

- Transition smoothly (0.5s cross-fade)
- Maintain same layout — only colors change
- Preserve scroll position and input focus
- Flash prevention: prefetch dark mode assets

---

### E22: Reduced Motion Enabled

**Trigger:** System accessibility "Reduce Motion" is enabled.

**UX Response:**

- Disable all animations, transitions, and micro-interactions
- Cross-fade duration reduced to 0.1s (instant)
- No parallax, no spring animations, no shimmer
- Replace animated illustrations with static versions
- Keep progress indicators as static dots (no pulse)

**Accessibility Reference:** DES-002/D13 (Accessibility), section 06

---

### E23: Orientation Change Mid-Flow

**Trigger:** User rotates device during onboarding.

**UX Response:**

- Smooth layout reflow (0.3s transition)
- Maintain scroll position (adjusted for new viewport)
- Keep input focus
- Preserve all entered data
- Test: portrait→landscape→portrait cycle

---

## 10. Time-Based Edge Cases

### E24: Midnight / Timezone Change

**Trigger:** Onboarding crosses midnight or user changes timezone.

**UX Response:**

- Show dates/times relative to user's current timezone
- If crossing midnight: brief toast "Good morning! It's a new day — your progress is still here."
- Never show "Today" vs "Yesterday" confusion

---

### E25: Daylight Saving Time Transition

**Trigger:** DST starts or ends during onboarding.

**UX Response:**

- Calendar/time inputs unaffected (stored as UTC)
- Show note only if user sets a time-related goal during the overlap period
- Background handling — no UI impact needed

---

## 11. Data Loss Prevention

### E26: Unsaved Data on Close

**Trigger:** User attempts to close app with unsaved onboarding data.

**UX Response:**

- Auto-save every 15 seconds of inactivity
- On close attempt (mobile: home button / app switch):
  - Data is saved before suspension
- No confirmation dialog needed — saving is automatic

**Psychology:** Confirmation dialogs feel like punishment. Silent saving is trust.

---

### E27: Session Expiry

**Trigger:** Onboarding session token expires (rare — > 24 hours idle).

**UX Response:**

- When user returns: "Let's pick up where you left off"
- Require re-authentication (email + magic link or password)
- Preserve all onboarding data — only session expired, not data

---

## 12. Multi-Device Edge Cases

### E28: User Starts on Mobile, Continues on Desktop

**Trigger:** Partial onboarding completed on mobile, user logs in on desktop.

**UX Response:**

- Sync progress immediately
- Show "You started this on [Mobile Device] — we've brought your progress here."
- Same resume behavior as E14

---

### E29: Concurrent Sessions

**Trigger:** User has onboarding open on two devices simultaneously.

**UX Response:**

- Last write wins for data
- Show toast on both devices: "You're set up on another device. Your progress is synced."
- After 30 seconds of conflicting edits: show sync resolution screen

---

## 13. Error Recovery Matrix

| Error Type            | User Impact          | Recovery Strategy             | Fallback                        |
| --------------------- | -------------------- | ----------------------------- | ------------------------------- |
| Network timeout (10s) | Cannot save          | Retry 3x, then save locally   | Offline queue                   |
| OAuth provider down   | Cannot sign in       | Suggest alternate method      | Email sign-up                   |
| Server 500 error      | Cannot proceed       | Retry 3x with backoff         | "Try again later" + email alert |
| Asset load failure    | Missing illustration | Show text-only version        | SVG fallback                    |
| Local storage full    | Cannot save progress | Prompt cloud mode             | Suggest Settings                |
| Biometric unavailable | Security downgrade   | Offer passcode                | Email auth                      |
| Calendar sync error   | Integration failed   | Skip integration, retry later | Manual entry                    |

**Error Recovery Principles:**

1. **Never lose data** — local cache is law
2. **Never block the user** — always offer an alternative path
3. **Never show technical errors** — translate to human language
4. **Always log silently** — for engineering debugging, not user-facing

---

## 14. Testing Matrix

| Edge Case               | Automation Test          | Manual Test | Priority |
| ----------------------- | ------------------------ | ----------- | -------- |
| E01 — No network        | ✓ Simulate airplane mode | ✓           | P0       |
| E04 — Low storage       | ✓ Mock storage API       | —           | P0       |
| E07 — Existing user     | ✓ Mock account state     | ✓           | P0       |
| E10 — Rapid back-tap    | ✓ UI automation          | ✓           | P1       |
| E11 — Idle timeout      | ✓ Timer mock             | —           | P1       |
| E14 — Abandon & return  | ✓ State persistence      | ✓           | P0       |
| E17 — Permission denied | ✓ Mock permission API    | ✓           | P1       |
| E20 — Font scaling      | ✓ Accessibility API      | ✓           | P1       |
| E22 — Reduced motion    | ✓ Accessibility API      | ✓           | P2       |
| E23 — Orientation       | ✓ Device rotation        | ✓           | P2       |
| E28 — Multi-device      | ✓ Sync simulation        | ✓           | P1       |

---

## 15. Cross-References

| Reference   | Document                     | Relevance                              |
| ----------- | ---------------------------- | -------------------------------------- |
| CMP-002     | Constitution                 | Human-first design during failure      |
| PRD-002     | Product Requirements         | Onboarding success metrics             |
| ARC-003     | System Architecture          | Offline-first architecture             |
| DES-001/D13 | Empty, Loading, Error States | Visual specifications for all states   |
| DES-001/D10 | Accessibility                | WCAG compliance                        |
| DES-002/D13 | Onboarding Accessibility     | Accessibility-specific edge cases      |
| DES-002/D11 | Onboarding Animations        | Animation fallbacks for reduced motion |
| ENG-001     | Domain Model                 | Data persistence entities              |

---

**Document Status:** ✅ Complete
**Review Cycle:** Design Review — Onboarding Specialist
**Next Update:** After DES-002 implementation feedback
