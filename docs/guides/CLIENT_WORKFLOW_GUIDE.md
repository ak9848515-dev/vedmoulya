# VedMoulya — Client Workflow Guide

**Version:** 1.0.1 · **Updated:** 2026-08-03 (SPRINT AC-002.5)
**Scope:** What your clients see and do in the secure portal — from invitation to invoice.

---

## 1. Getting Access

Your agency sends you two things:

1. **Portal link** — e.g. `https://app.example.com/portal`
2. **One-time access token** — a long random string, shared securely (email / password manager).

> Tokens are stored **hashed (SHA-256)** on the server and can be revoked by the
> agency at any time. Your token is the credential — treat it like a password.

## 2. Signing In

1. Open the portal link and paste your access token.
2. If the token is accepted you land on the **Client Dashboard**; the token is stored
   securely on your device for future visits (you can **Sign out** anytime).

## 3. What You Can Do

| Area             | What you can do                                                        |
| ---------------- | ---------------------------------------------------------------------- |
| **Dashboard**    | Projects, content stats, invoices, notifications at a glance           |
| **Content**      | Review every asset the agency generated for you                        |
| **Review**       | **Approve**, **request changes** (reject), or **comment** on any piece |
| **Deliverables** | Download approved content (Markdown / HTML)                            |
| **Invoices**     | View your invoices and their status (draft / sent / paid)              |

### Approving content

1. Open **Content** and select an asset.
2. Read the draft (versions are shown when there is history).
3. Choose **Approve**, **Request changes** (with a note), or leave a **Comment**.
4. The agency is notified instantly — approved assets move to their delivery queue.

### Downloading deliverables

- Open **Deliverables**, pick the asset and export format (Markdown or HTML).

## 4. Notifications

Updates — new proposals/quotations, approval requests, invoices — appear in your
dashboard feed. You only see notifications for **your** account.

## 5. Troubleshooting

| Symptom              | Fix                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------- |
| Token rejected       | Check you pasted the full token (no spaces). Ask the agency to re-issue access.     |
| No content visible   | Your agency hasn't generated content for you yet, or it hasn't been sent to review. |
| Can't see an invoice | Invoices appear once the agency issues them to your account.                        |
| Access revoked       | Contact your agency — they can grant a new token.                                   |

---

**Related:** [Agency User Guide](./AGENCY_USER_GUIDE.md) · [Administrator Guide](./ADMINISTRATOR_GUIDE.md)
