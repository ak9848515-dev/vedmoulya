# Typography System

> **Document:** DES-010A-D08 — Experience Bible  
> **Status:** 🔒 **LOCKED** — Part of Experience Bible v1.0

---

## Purpose

Typography System defines the immutable typography of VedMoulya — font families, type scale, weights, responsive sizing, and critical rules.

---

## Font Families (FROZEN)

| Role         | Font               | Source                           |
| ------------ | ------------------ | -------------------------------- |
| **Headings** | **Satoshi**        | Fontshare — Geometric sans-serif |
| **Body**     | **Inter**          | rsms — Humanist sans-serif       |
| **Code**     | **JetBrains Mono** | JetBrains — Developer monospace  |

**Do not recommend alternatives. These fonts are frozen.**

---

## Type Scale (Desktop)

| Token   | Size | Weight       | Line-Height | Letter-Spacing |
| ------- | ---- | ------------ | ----------- | -------------- |
| Display | 56px | 700 Bold     | 68px        | -0.02em        |
| Hero    | 48px | 700 Bold     | 58px        | -0.02em        |
| H1      | 40px | 600 SemiBold | 50px        | -0.015em       |
| H2      | 32px | 600 SemiBold | 42px        | -0.01em        |
| H3      | 28px | 600 SemiBold | 38px        | 0em            |
| H4      | 24px | 500 Medium   | 34px        | 0em            |
| Section | 20px | 600 SemiBold | 28px        | 0em            |
| Body    | 16px | 400 Regular  | 26px        | 0em            |
| Caption | 14px | 500 Medium   | 20px        | 0.02em         |
| Tiny    | 12px | 400 Regular  | 16px        | 0em            |

---

## Critical Typography Rules

| Rule                         | Enforcement                             |
| ---------------------------- | --------------------------------------- |
| **Body never below 16px**    | Enforced absolutely at every breakpoint |
| **Headings use Satoshi**     | All heading levels H1-H4                |
| **Body uses Inter**          | All body text, captions, labels         |
| **Code uses JetBrains Mono** | All code blocks, technical content      |
| **One H1 per page**          | Page title                              |
| **Line length: 60-75 chars** | Optimal readability                     |
| **Line height: min 1.5×**    | Body text accessibility                 |

---

## Type Scale (Mobile)

| Token   | Size | Line-Height |
| ------- | ---- | ----------- |
| Display | 36px | 44px        |
| Hero    | 32px | 40px        |
| H1      | 28px | 36px        |
| H2      | 24px | 32px        |
| Body    | 16px | 24px        |

---

## Quality Review

| Dimension           | Assessment                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Why**             | Typography is the voice of the product — inconsistent type erodes brand trust                   |
| **Psychology**      | Readability research — 16px min body, 60-75 char lines optimize reading speed and comprehension |
| **Accessibility**   | 16px body minimum, 1.5× line height, high contrast — WCAG 2.1 AA requirements                   |
| **Engineering**     | CSS clamp() for fluid typography; font-display: swap for performance                            |
| **Performance**     | Self-hosted fonts with subsetting for optimal loading                                           |
| **Scalability**     | 10-token type scale covers all use cases without expansion                                      |
| **DES Consistency** | Elevates DES-001/D04 Typography System with stricter governance                                 |

---

## Design Freeze Status

**DES-010A-D08: Typography System — LOCKED effective July 27, 2026.**
