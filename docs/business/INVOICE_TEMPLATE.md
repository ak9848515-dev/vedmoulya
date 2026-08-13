# Invoice Template

**Version:** 1.0.1 · **Updated:** 2026-08-03 (SPRINT AC-002.5, Task 7)
**Purpose:** Enter these values into **Invoices → New Invoice**. **Always set the due
date** so overdue tracking works.

---

# INVOICE

**Invoice #:** {INV-YYYY-####}
**Date:** {YYYY-MM-DD} · **Due:** {YYYY-MM-DD} (21 days)

**From:** VedMoulya AI Content Agency
**To:** {Client Company} · {Client contact email}

| Description                             | Qty | Unit price | Amount        |
| --------------------------------------- | --- | ---------- | ------------- |
| Monthly content retainer — {Month Year} | 1   | $3,000.00  | $3,000.00     |
| {Add-on line}                           | 1   | $400.00    | $400.00       |
| **Subtotal**                            |     |            | **$3,400.00** |
| Tax ({rate}%)                           |     |            | $170.00       |
| **Total due**                           |     |            | **$3,570.00** |

**Payment methods:** Bank transfer · card · PayPal
**Payment terms:** Net 30 — please pay by the due date above.

---

## Status flow in the app

`draft → sent → paid`

- **Mark sent** when issued (adds an invoice-due notification for the client).
- **Mark paid** after funds arrive — this records the payment and updates revenue,
  cash-flow and business analytics automatically.
- Overdue invoices are flagged on the invoices screen and in **Operations**.
