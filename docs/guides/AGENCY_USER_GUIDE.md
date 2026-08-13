# VedMoulya — Agency User Guide

**Version:** 1.0.1 · **Updated:** 2026-08-03 (SPRINT AC-002.5)
**Scope:** The AI Content Agency — how the agency team runs clients from lead to revenue.

---

## 1. Overview

The Content Agency is a complete client-operating business: acquire leads, win them,
provision clients, build brand profiles, generate content through an AI pipeline,
review and approve with the client, deliver, invoice and get paid.

Every screen lives under **Content Agency** in the left navigation
(`/content-agency`). The client operations modules live under
**Content Agency → Operations** (`/content-agency/ops`).

| Area       | Purpose                                                                           |
| ---------- | --------------------------------------------------------------------------------- |
| Dashboard  | KPIs, upcoming/recent content, AI usage                                           |
| Clients    | Client records (brand voice, audience, goals, memory)                             |
| Brands     | Brand profiles — tone, rules, keywords every generation follows                   |
| Projects   | Grouped content work per client                                                   |
| Calendar   | Month/week/day scheduling                                                         |
| Generator  | AI content pipeline (brief → research → draft → review passes)                    |
| Review     | Accept / reject / regenerate / schedule content                                   |
| Delivery   | Export approved assets (Markdown/HTML)                                            |
| Invoices   | Draft, send, collect (with due dates and overdue tracking)                        |
| Analytics  | Content, clients, revenue, AI usage                                               |
| Operations | CRM, proposals, contracts, quotations, payments, documents, portal, notifications |

---

## 2. Core Workflow — Run a Client

### 2.1 From lead to client

1. Open **Operations → Client CRM** and **Add lead**.
2. Log the discovery call, add contacts and tasks, set a follow-up.
3. Move the lead through the pipeline: `lead → qualified → proposal → negotiation → won`.
4. **Winning a lead automatically creates the Client record** — no duplicate entry.

### 2.2 Onboard the client

1. **Clients → New Client** (or edit the auto-created record): industry, brand voice,
   target audience, products, services, goals, website.
2. **Brands → New Brand Profile**: tone, writing style, do/don't rules, keywords,
   CTA style. Link it to the client. _Every AI generation follows this profile._
3. **Projects → New Project**: name the engagement (e.g. "Q3 Content Program").
4. (Recommended) **Documents → Upload** the client's brand guidelines / logos.

### 2.3 Produce content

1. **Generator**: pick client + brand, content type, title, brief, quality tier → **Generate**.
   The pipeline runs research → draft → brand alignment → grammar → SEO and returns a
   **quality score** with full traceability (provider, model, tokens, cost, trace ID).
2. Preview the draft, then **Regenerate** with feedback if needed (a new version is
   appended — nothing is lost).
3. **Send to Review Queue** (or keep refining).

### 2.4 Review & approval

1. **Review**: the queue shows everything in review with versions and quality score.
2. Open an item → **Accept** / **Reject** / add a comment / **Regenerate** / **Schedule**.
3. For client approval: **Operations → Client Portal → Grant access** (email + one-time
   token). Share the `/portal` link and token. The client signs in, reviews, and
   approves / requests changes — the agency is notified automatically.

### 2.5 Deliver

1. **Delivery**: approved/published assets appear here.
2. Export as **Markdown** or **HTML** (PDF/DOCX are roadmap — the dialog shows the
   Markdown source so you can paste into any tool).

### 2.6 Invoice & collect

1. **Invoices → New Invoice**: client, description, amount, **due date**.
2. Mark **sent** when issued (adds an invoice-due notification).
3. **Mark paid** records a payment and keeps the revenue dashboards in sync — or use
   **Operations → Payments → Record payment** for partial/real bank payments.
4. Overdue invoices are flagged on the invoices screen and in Operations.

---

## 3. Operations Modules

| Module            | What it does                                                                                        | Where               |
| ----------------- | --------------------------------------------------------------------------------------------------- | ------------------- |
| **CRM**           | Pipeline board, health scores, interactions, tasks, contacts, archived leads                        | `ops/crm`           |
| **Proposals**     | AI-drafted proposals (7-section structure), versions, send/accept/reject, MD/HTML export            | `ops/proposals`     |
| **Contracts**     | Versions, approvals, renewals, expiry tracking (30/60-day alerts)                                   | `ops/contracts`     |
| **Quotations**    | Packages + discount + tax with live totals, recurring flag, send/accept/reject                      | `ops/quotations`    |
| **Payments**      | Paid/outstanding/overdue, 6-month cash flow, record payments                                        | `ops/payments`      |
| **Documents**     | Brand guidelines, logos, references — versioned, searchable, 2 MB cap                               | `ops/documents`     |
| **Client Portal** | Issue/revoke secure access tokens (hashed at rest)                                                  | `ops/portal`        |
| **Notifications** | Proposal sent, approval pending, invoice due, project completed, client comments, contract expiring | `ops/notifications` |

**Business analytics** (`ops` hub): revenue, clients, projects, win rate, approval time,
AI usage, average delivery time.

---

## 4. Quality & AI Tips

- **Quality tier** (`economy / standard / premium`) trades cost/latency for quality.
- **Brand alignment is scored** on every generation (0–10) against the do/don't rules.
- **Regenerate with specific feedback** is the fastest path to a great draft — it
  reuses the original prompt and appends your direction as authoritative.
- **Quality score, provider, model, tokens, cost and trace ID** are stored on every
  asset for auditability and analytics.

---

## 5. Keyboard & Navigation

- Sub-navigation chips (Clients → Brands → … → Operations) are scrollable on mobile.
- The Operations hub card grid deep-links to every module.
- Notifications deep-link to the relevant screen (review, payments, contracts…).

---

**Related:** [Client Workflow Guide](./CLIENT_WORKFLOW_GUIDE.md) · [Administrator Guide](./ADMINISTRATOR_GUIDE.md) · [Business readiness templates](../business/SERVICE_PACKAGES.md)
