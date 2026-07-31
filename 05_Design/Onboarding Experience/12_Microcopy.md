# Microcopy — Onboarding Experience

**DES-002 — Document 12/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D02, DES-001/D12, CMP-001, CMP-002

---

## Purpose

This document defines the **complete microcopy** for every onboarding screen — every label, button, error message, tooltip, and system message. All copy must follow the VedMoulya brand voice: warm, clear, human, never robotic.

---

## Voice Guidelines (Onboarding-Specific)

```text
ONBOARDING VOICE:

  Tone:   Warm, welcoming, reassuring (per DES-001/D02)
  Frame:  "This is YOUR journey. We're here to help."
  Rule:   Every sentence should feel like a wise mentor speaking.
          Never: salesy, urgent, pushy, corporate.

  DO:     "Let's start with what matters to you."
  DON'T:  "Get started now and unlock your potential!"

  DO:     "You can change anything later."
  DON'T:  "Don't worry, you can always update your profile."

  DO:     "Pick one focus for now. You can explore others later."
  DON'T:  "CHOOSE YOUR PRIMARY FOCUS ★ REQUIRED"
```

---

## Screen-by-Screen Microcopy

### Splash (D02)

```text
NO TEXT — Logo + wordmark only
Screen reader: "VedMoulya. The Personal Growth Operating System."
```

### Welcome (D03)

```text
HEADING:    "Welcome to your growth platform"
BODY:       "Most platforms track what you do. VedMoulya helps you grow who you are. This is your space to learn, build, earn, and become who you want to be."
PRIMARY:    "Create your free account"
SECONDARY:  "Already have an account? Sign in"
TERTIARY:   "Explore First" — "See what VedMoulya can do before creating an account."
LEGAL:      "By continuing, you agree to our Terms of Service and Privacy Policy"

ERROR:      "Something went wrong. Please try again."
OFFLINE:    "You're offline. Your progress will save when connected."
```

### Identity Setup (D04)

```text
HEADING:    "Tell us about yourself"
BODY:       "This helps us personalize your experience. You can change anything later."

NAME:
  LABEL:    "Full name"
  PLACEH:   "Your name"
  ERROR:    "Please enter your full name"

EMAIL:
  LABEL:    "Email"
  PLACEH:   "your@email.com"
  ERROR:    "Enter a valid email address"
  EXISTS:   "This email is registered. Sign in instead?"

PASSWORD:
  LABEL:    "Create a password"
  PLACEH:   "••••••••"
  ERROR:    "Password must be 8+ characters with 1 uppercase letter and 1 number"
  STRENGTH:
    WEAK:   "Add a few more characters"
    FAIR:   "Getting there — add a number"
    STRONG: "Strong password"
    VSTRONG:"Very strong"

CONTINUE:   "Create account" (was disabled, now active)

GOOGLE:     "Continue with Google"
APPLE:      "Continue with Apple"

SUCCESS:    "Welcome, [Name]!" (brief toast before next screen)
ERROR:      "We couldn't create your account. This email may already be registered."
```

### Purpose Selection (D05)

```text
HEADING:    "What brings you here?"
BODY:       "Pick the focus that matters most to you right now. You can explore others later."
SKIP:       "Skip — I'll decide later"

CARDS:
  CAREER:   "Career" / "Advance your career"
  LEARN:   "Learning" / "Learn new skills"
  BUSINESS: "Business" / "Build your business"
  HEALTH:   "Health" / "Improve wellbeing"
  FINANCE:  "Finance" / "Manage your finances"
  EXEC:     "Execution" / "Get things done"
  MARKET:   "Marketplace" / "Offer your services"

CONTINUE:   "Continue"
SKIP:       "Skip for now"

ERROR:      "Pick one to continue, or skip for now."
```

### Dream & Goals (D06)

```text
HEADING:    "What kind of life do you want to build?"
BODY:       "Describe your vision — it can be anything. This helps us understand what matters to you."
PLACEH:     "e.g., build a business that lets me work from anywhere while helping others learn technology"

QUICK GOALS:
  HEADING:  "Quick goals (optional)"
  CHIPS:    "Learn a new skill", "Start a business", "Get a promotion", "Change careers",
            "Build a portfolio", "Improve my finances", "Grow my network", "Start freelancing"
  CUSTOM:   "+ Add your own goal"

CONTINUE:   "Continue"
SKIP:       "Skip for now"
```

### AI Introduction (D08)

```text
HEADING:    "Meet your AI Coach"

AI MESSAGE:
  "Hi, I'm your AI Coach.\n\nThink of me as a thoughtful partner who's here to help you grow. I've been learning about your goals and I can already see some exciting possibilities. I'll always be transparent about how I work and what I recommend. You're always in control."

CTA:        "Talk to your Coach"
SKIP:       "Continue to dashboard"
```

### Personalized Setup (D09)

```text
HEADING:    "Connect your world"
BODY:       "Choose what helps you. Each connection makes VedMoulya more helpful. You can change anytime."

NOTIF:      "Notifications" / "Stay updated on your goals and progress."
CAL:        "Calendar (recommended)" / "We'll help you schedule time for your goals."
EMAIL:      "Email" / "Import learning opportunities and resources."
KNOWLEDGE:  "Knowledge Import" / "Bring in your existing notes, bookmarks, and resources."

NOTIF DETAIL:
  TITLE:    "How VedMoulya notifies you"
  BODY:     "• We only notify you about what matters to your goals\n• No spam. No daily reminders.\n• You choose what to hear about.\n• You can pause anytime."
  OPTS:     "Weekly progress summary", "When a milestone is reached",
            "When we find a new opportunity", "When it's time to review goals"

CONNECT:    "Connect"
CONNECTED:  "Connected"
SKIP:       "Skip for now"
CONTINUE:   "Continue"

CALENDAR_SUCCESS: "Calendar connected. We'll help you find time for what matters."
EMAIL_SUCCESS:   "Email connected. We'll surface relevant opportunities."
```

### First Dashboard (D10)

```text
GREETING:   "Welcome, [Name]"
SUBTITLE:   "Your space is ready. Here's what matters today."
FOCUS:      "Your primary focus: [Purpose]"

AI WELCOME: "Based on your goal to [dream/goal], I suggest starting with [first action]."
            "●●●●● High confidence"
AI CTA:     "Let's start"
AI SKIP:    "Explore on my own"

CONGRATS:
  HEADING:  "You've taken your first step"
  BODY:     "Your growth journey has begun. Everything from here is personalized to help you achieve what matters."
  CTA:      "Start your journey"
```

---

## Error Messages

```text
GENERIC PATTERN:
  "What happened + What was preserved + What to do next"

NETWORK ERROR:
  "You're offline. Don't worry — your progress is saved. We'll continue when you're back online."

SERVER ERROR:
  "Something unexpected happened. Your data is safe. Let's try again."

VALIDATION ERROR:
  [Specific field error] + [What to fix]

TIMEOUT:
  "This is taking longer than expected. [Retry] or [Skip for now]"

AUTH ERROR:
  "We couldn't sign you in. Check your email and password, or try a different sign-in method."

SESSION EXPIRED:
  "Your session expired for security. No data was lost."
```

---

## Success Messages

```text
ACCOUNT CREATED: "Welcome, [Name]!" (brief, 3s toast)
GOAL ADDED:     "[Goal] — added to your goals"
DNA COMPLETE:   "Great — your profile is filling in"
CONNECTION:     "[Service] connected"
DASHBOARD:      "Your space is ready"
```

---

## Empty States

```text
NO GOALS YET (Dashboard):
  "No goals yet. When you're ready, we can start with one small step."
  [Create your first goal]

NO AI HISTORY:
  "You haven't spoken with your AI Coach yet. They're here whenever you need them."
  [Say hello]

NO KNOWLEDGE:
  "Your knowledge space is empty. Import your notes or start fresh."
  [Import knowledge] [Start fresh]

NO PROGRESS:
  "Start your journey to see your progress here."
  [Take your first step]
```

---

## Cross-Reference

| Reference   | Usage                                           |
| ----------- | ----------------------------------------------- |
| DES-001/D02 | Brand voice — warm-casual, no hype, clear       |
| DES-001/D12 | AI Experience — Wise Mentor tone, transparent   |
| CMP-001     | "Truth before hype" — no exaggerated claims     |
| CMP-002     | Consent copy — transparent, granular, revocable |
