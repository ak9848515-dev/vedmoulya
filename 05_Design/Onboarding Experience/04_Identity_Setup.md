# Identity Setup

**DES-002 — Document 04/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D03-D07, CMP-002, PRD-002, ARC-001

---

## Purpose

The Identity Setup screen is where the user **becomes real** to the platform. By sharing their name and basic context, they cross the threshold from anonymous visitor to recognized individual.

---

## Psychology

| Factor             | Design                                                                          |
| ------------------ | ------------------------------------------------------------------------------- |
| **Emotion**        | Being seen + Safety + Autonomy                                                  |
| **Cognitive Load** | Low — 3-5 simple fields, clear progression                                      |
| **Trust Signal**   | Asking permission, explaining WHY each field matters                            |
| **Key Insight**    | The moment a user types their name, they psychologically invest in the platform |
| **Risk**           | Too many fields → abandonment. Every field must justify its existence.          |

---

## Screen Specification

```text
IDENTITY SETUP SCREEN

┌───────────────────────────────────────────────────────────────┐
│  ● ● ○ ○ ○ ○ ○ ○ ○ ○ ○ ○    [Identity] — step indicator      │
│                                                               │
│                                                               │
│           Satoshi 700 Bold — 28px (M) / 36px (D)             │
│           #111827 — line-height 1.2                           │
│                                                               │
│           Tell us about yourself                              │
│                                                               │
│           space-2                                             │
│                                                               │
│           Inter 400 Regular — 15px — #4B5563                 │
│                                                               │
│           This helps us personalize your experience.          │
│           You can change anything later.                      │
│                                                               │
│           space-8                                             │
│                                                               │
│           ┌─ Full name ────────────────────────────────────┐ │
│           │                                                │ │
│           │ Inter 400 Regular — 16px (input)               │ │
│           │ bg: #FFFFFF, border: #D1D5DB                   │ │
│           │ radius: 24px, height: 56px, padding: 0 20px   │ │
│           │ focus: border #2B5FD9 + ring (3px, 30% opac.) │ │
│           │ placeholder: "Your name" — #9CA3AF            │ │
│           └────────────────────────────────────────────────┘ │
│                                                               │
│           space-6                                             │
│                                                               │
│           ┌─ Email ────────────────────────────────────────┐ │
│           │                                                │ │
│           │ Same styling as name field                     │ │
│           │ type: email, auto-fill supported               │ │
│           │ placeholder: "your@email.com"                  │ │
│           │ Validation: email format check on blur         │ │
│           └────────────────────────────────────────────────┘ │
│                                                               │
│           space-6                                             │
│                                                               │
│           ┌─ Create a password ────────────────────────────┐ │
│           │                                                │ │
│           │ Same styling + show/hide toggle (18px icon)    │ │
│           │ type: password, auto-complete: new-password    │ │
│           │ Strength indicator: dots (4 dots, color-coded) │ │
│           │ 8+ chars, 1 uppercase, 1 number minimum       │ │
│           └────────────────────────────────────────────────┘ │
│                                                               │
│           space-8                                             │
│                                                               │
│           ┌────────────────────────────────────────────┐     │
│           │     Continue                  14px btn     │     │
│           │  Primary-600, height: 56px                 │     │
│           │  Disabled until all fields valid            │     │
│           └────────────────────────────────────────────┘     │
│                                                               │
│           space-4                                             │
│                                                               │
│           [Sign up with Google] [Sign up with Apple]          │
│           Secondary buttons — 56px height                     │
│           18px icon + "Continue with Google/Apple"            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Social Login

```text
GOOGLE LOGIN:
  Button: Secondary style (white bg, border)
  Icon: Google logo (18px) on left
  Text: "Continue with Google" — Inter 500 Med, 15px
  Behavior: Opens OAuth popup, returns to flow

APPLE LOGIN:
  Button: Black bg, white text (per Apple HIG)
  Icon: Apple logo (18px) on left
  Text: "Continue with Apple" — Inter 500 Med, 15px
  Behavior: Returns name + email (verified), skips identity form

SOCIAL LOGIN EDGE CASE:
  If user has existing account: "Welcome back, [name]" → dashboard
  If email exists with different method: merge flow
  If cancelled: return to form, no error
```

---

## Validation

```text
REAL-TIME VALIDATION:
  Name:     Required, 2+ chars, no special chars
            Check on blur — "Please enter your full name"
  Email:    Required, valid format
            Check on blur — "Enter a valid email address"
            Duplicate check on blur (async) — "This email is registered. Sign in?"
  Password: Required, 8+ chars
            Strength indicator updates as user types
            Weak: 1 dot #EF4444 | Fair: 2 dots #F59E0B
            Strong: 3 dots #0EA5A9 | Very strong: 4 dots #10B981

ALL VALID: Continue button becomes active (200ms transition)
```

---

## States

```text
DEFAULT:      Empty form, Continue disabled
FILLING:      Real-time validation, strength indicator updates
VALID:        Continue button active (Primary-600, hover: Primary-500)
SUBMITTING:   Button shows spinner, fields disabled
ERROR:        Inline error below specific field
              "We couldn't create your account. Try again."
DUPLICATE:    "This email is already registered. Sign in instead?"
OFFLINE:      "You're offline. We'll save your info and continue when connected."
```

---

## Animation

```text
ENTRY:
  0ms — Heading fades in (400ms, ease-out)
  200ms — Name field slides up (400ms, ease-out, stagger 100ms)
  300ms — Email field slides up
  400ms — Password field slides up
  500ms — Continue button fades in (300ms, ease-out)

FIELD FOCUS:
  Border: #D1D5DB → #2B5FD9 (200ms, ease-out)
  Label (floating): translateY up + scale(0.85) (200ms, ease-out)

PASSWORD STRENGTH:
  Dots animate sequentially (200ms each, 50ms stagger)
  Color transition: gray → semantic color (200ms, ease)

SUCCESS: Scale out (200ms, ease-in) before next screen
```

---

## Cross-Reference

| Reference   | Usage                                                  |
| ----------- | ------------------------------------------------------ |
| DES-001/D07 | Input system — text input, password, validation        |
| DES-001/D06 | Form spacing — 24px field gap, 8px label gap           |
| DES-001/D03 | Primary-600 focus ring, semantic colors for validation |
| DES-001/D04 | Typography — 16px input text, 13px labels              |
| CMP-002     | Password requirements, data handling, consent          |
| PRD-002     | Identity dimension of User DNA                         |
