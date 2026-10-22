# Invoice Desk: build spec

Portfolio project 3. An accounts-payable inbox for **Saltmarsh Kitchen**, a fictional 60-seat
restaurant in Portland, Maine. Supplier invoices, bills and receipts arrive by email, by an upload
form or in a Drive folder. AI reads each one (PDF, scan or phone photo), the workflow checks the
numbers, catches duplicates and changed bank details, files the document in Drive, logs it in a
Google Sheet and asks the owner to approve anything big, new or suspicious. Every Monday the owner
gets a summary of spend, approvals waiting and bills coming due.

It reaches a different buyer from projects 1 and 2 (finance and operations, bookkeepers and
accounting firms) and shows document AI with checks and a human approval step.

## Environment

- n8n 2.30.7, local, http://localhost:5678, built through the n8n MCP server, same conventions as
  projects 1 and 2 (`workflows/src/*.ts` + `workflows/code/*.js` → `workflows/*.ts` via
  `workflows/build.py`; `workflows/json/` exports).
- Workflow names start with `Invoice Desk N:`. Tags `portfolio`, `invoice-desk`.
- Error workflow: `Lead Engine 0: Error Alerts` (`IMDuCtka4p13GBto`), as in project 2.

## Accounts and credentials

Everything runs on **samuelgurru@gmail.com**, as in projects 1 and 2. No new credentials.

| n8n credential | Used for |
|----------------|----------|
| `OpenAI account` (GQdth43VUJxkSsw9) | Reading documents |
| `Gmail account` (9FKWoKxErtgj9Qg7) | Intake inbox, approval emails, weekly summary, sending demo samples |
| `Google Sheets account` (D8rKxzgMrJwmFZoQ) | Register (documents, line items, suppliers) |
| `Google Drive account` (sN9bbP0t0u0A88QU) | Drop folder, filed documents |

## The business (fictional)

- Saltmarsh Kitchen LLC, 18 Wharfside Lane, Portland, ME 04101, (207) 555-0136,
  accounts@saltmarsh-kitchen.example. Owner and approver: the owner mailbox (samuelgurru@gmail.com).
- Suppliers are invented, with `.example` domains and 555-01xx phone numbers. Five are in the
  supplier list from the start; samples include one new supplier.

## Intake

| Channel | How |
|---------|-----|
| Email | Anything sent to `samuelgurru+invoices@gmail.com` with an attachment. Gmail Trigger polls every minute; each PDF or image attachment is processed; the email gets the label `Invoice Desk/Processed`. Inline images under 15 KB (signature logos) are skipped. |
| Upload form | n8n Form: drop one or more files, optional name and note. The finished page shows what was read from each file and what happens next. |
| Drive folder | Files dropped in `Invoice Desk/Inbox` are processed and the original moved to `Inbox/Done`. |

Accepted: PDF, JPG, PNG, WEBP up to 10 MB. Anything else is logged as `unsupported`.

## Processing (one document per run of workflow 1)

1. **Check the file**: type, size, SHA-256 of the bytes.
2. **Exact duplicate?** Same hash as a document already in the register → `duplicate`, no AI call,
   not filed again.
3. **Read it**: OpenAI Responses API through the OpenAI node, PDF as a file input, image as an image
   input, `gpt-5.4-mini` (reasoning low), JSON Schema output in strict mode (`prompts/extraction.md`).
   The document's text is data, never instructions; the model has no tools and decides nothing.
4. **Check it** (code, not AI):
   - Required fields: supplier, date, total, currency; invoice number for invoices.
   - Arithmetic: line items add up to the subtotal; subtotal + tax + shipping − discount = total
     (tolerance 2 cents or 0.5%).
   - Dates: not in the future, not over a year old; due date not before the invoice date. Past due
     is noted.
   - Supplier: matched to the supplier list by normalised name, alias, email domain or tax ID.
     Unknown supplier → `new supplier`.
   - Duplicate invoice: same supplier and invoice number already logged (a re-sent copy) →
     `duplicate`.
   - Bank details: an account ending different from the supplier list, or a "we've changed banks"
     notice → `bank details changed`, never auto-approved (the most common invoice fraud).
   - Model confidence `low` or issues reported (unreadable, cut off, several invoices in one file).
5. **Decide the status**:

| Status | When | What happens |
|--------|------|--------------|
| `auto_approved` | All checks pass, known supplier, total under `APPROVAL_LIMIT` ($1,000), base currency. Receipts (already paid) only need the checks. | Logged and filed. |
| `pending_approval` | Checks pass but the total is at or over the limit, the supplier is new, or the currency isn't USD. | Approval email with Approve / Reject. |
| `needs_review` | A check failed or the bank details changed. | Review email (same buttons) listing what to check. |
| `duplicate` | Same file, or same supplier + invoice number. | Logged with a pointer to the original, not filed again, no email. |
| `not_invoice` | The model says it isn't an invoice, bill, receipt or credit note. | Logged and filed under Other. |
| `unsupported` / `error` | Wrong file type, too large, or the AI call failed. | Logged; errors also reach the error workflow. |
| `approved` / `rejected` | Set when the owner clicks a button. | Approving a new supplier adds it to the supplier list. |

6. **File it** in Drive as `YYYY-MM-DD Supplier - Number - USD 1,234.56.pdf` (folders `Filed` and
   `Other`).
7. **Log it**: one row in `Documents`, one row per line in `Line Items` (or one summary line if the
   document has no itemised lines). Written RAW so text starting with `=` stays text.
8. **Ask for approval** (workflow 2, not awaited): Gmail "send and wait" with Approve / Reject,
   waits up to 7 days, then updates the row (`approved` / `rejected`, `decided_at`). No decision
   after 7 days leaves it pending and the weekly summary lists it.
9. **Return** a short result (status, supplier, total, flags, Drive link) to the intake workflow.

## Google Sheet: `Invoice Desk: Saltmarsh Kitchen`

| Tab | Columns |
|-----|---------|
| `Documents` | `doc_id, received_at, source, sender, original_filename, file_hash, doc_type, supplier, supplier_status, invoice_number, invoice_date, due_date, currency, subtotal, tax, total, category, status, flags, payment_status, decided_by, decided_at, drive_link, duplicate_of, line_count, confidence, bank_last4, summary` |
| `Line Items` | `doc_id, line_no, supplier, invoice_number, invoice_date, description, quantity, unit_price, amount, category` |
| `Suppliers` | `supplier, aliases, email_domain, tax_id, default_category, bank_last4, status, added_at, added_by` |

`payment_status` starts `unpaid` for invoices and `paid` for receipts; the bookkeeper changes it to
`paid`. The weekly summary uses it for bills coming due and overdue.

## Config (Set node `Config` in each workflow that needs it)

| Key | Default |
|-----|---------|
| `APPROVAL_LIMIT` | `1000` |
| `BASE_CURRENCY` | `USD` |
| `APPROVER_EMAIL` / `OWNER_EMAIL` | `samuelgurru@gmail.com` |
| `INTAKE_ADDRESS` | `samuelgurru+invoices@gmail.com` |
| `MODEL` | `gpt-5.4-mini` |
| `MAX_FILE_MB` | `10` |
| `TIMEZONE` | `America/New_York` |
| `WAIT_DAYS` (workflow 2) | `7` |
| `MINUTES_SAVED_PER_DOC` (workflow 6) | `6` |
| `CATEGORIES` | Food & beverage, Cleaning & paper, Linen & uniforms, Utilities, Rent & occupancy, Repairs & maintenance, Equipment, Software & subscriptions, Professional services, Marketing, Other |

## Workflows

| # | Workflow | Trigger |
|---|----------|---------|
| 0 | Invoice Desk 0: Setup (run once, then archived) | Manual |
| 1 | Invoice Desk 1: Process Document | Called by 3, 4, 5 |
| 2 | Invoice Desk 2: Approval | Called by 1, not awaited |
| 3 | Invoice Desk 3: Email Intake | Gmail Trigger, every minute |
| 4 | Invoice Desk 4: Upload Form | Form Trigger |
| 5 | Invoice Desk 5: Drive Intake | Google Drive Trigger, every minute |
| 6 | Invoice Desk 6: Weekly Summary | Mondays 8:00 America/New_York + manual |
| 7 | Invoice Desk 7: Send Demo Documents | Manual: emails the sample set to the intake address |
| 8 | Invoice Desk 8: Reset Demo | Manual: empties the register, restores the suppliers, trashes filed copies (added during the build) |

### Weekly summary (deterministic, no AI)

Last 7 days: documents processed by status and channel, spend by category and top suppliers
(approved and auto-approved), waiting for approval (with age), needs review, duplicates and bank
changes caught, bills due in the next 7 days, overdue unpaid bills, and time saved (documents ×
`MINUTES_SAVED_PER_DOC`, default 6). HTML built and escaped in code.

## Sample documents (`samples/`)

Generated by `samples/make_samples.py` (HTML rendered to PDF and images with Playwright), all
billed to Saltmarsh Kitchen:

| File | Shows |
|------|-------|
| Harborline Produce invoice | Clean, known supplier, under the limit → auto-approved |
| Pinecrest Dairy invoice | Clean, with tax → auto-approved |
| Frostline Refrigeration invoice ($2,450) | New supplier, over the limit → approval |
| Gullrock Seafood invoice | Lines don't add up to the total → needs review |
| Bluewick Linen invoice | "Our bank details have changed" → needs review (fraud check) |
| Ledgestone Hardware receipt (phone photo, tilted) | Receipt from a photo → auto-approved |
| Tidewater Electric bill (image-only scan) | Scanned PDF, due soon → auto-approved, in "due this week" |
| Saltmarsh menu | Not an invoice → `not_invoice` |
| Harborline invoice sent again | Duplicate → caught |

## Safety

- The AI only extracts. Statuses, approvals and supplier changes are decided by code rules and the
  owner's click. Text in a document can't approve it.
- New suppliers and changed bank details always go to a person.
- Only the last 4 digits of a bank account are stored.
- Sheets written RAW; email HTML escaped in code.
- Retries: Sheets, Drive and Gmail 3× with 5 s waits; the OpenAI call 2×.
- Duplicate checks run before the AI call, so re-sent files cost nothing.

## Later

- Push approved bills to QuickBooks Online or Xero.
- Several client businesses for a bookkeeping firm (route by bill-to name).
- A polished upload page and dashboard, like project 2's chat page.
- Reply to the sender when a document can't be read.

## Decisions (2026-10-01)

- Project chosen by the user from six standalone ideas: invoice and document processing.
- Business: a fictional restaurant, because restaurants get many supplier invoices and receipts and
  bookkeepers serve a lot of them. Chosen by Claude as a default; easy to change.
- Storage: Google Sheets as the register (bookkeepers live in spreadsheets), Drive for files.
- AI: OpenAI as in projects 1 and 2, through the OpenAI node's Responses API with strict JSON
  Schema output, so no free-text parsing.
- Intake address: a Gmail plus-address on the existing account, so no new mailbox or credential.
- Weekly summary built in code without AI: finance numbers should be exact.

## Changes during the build (2026-10-01)

- **OpenAI node, not raw HTTP.** The OpenAI node's Responses operation takes a PDF as a `file` input
  and a photo as an `image` input straight from binary, and enforces the JSON Schema in strict mode.
  Two quirks: the schema must be passed as a JSON *string* ("Failed to parse schema" otherwise), and
  the simplified output is `output[].content[].text`, already parsed into an object.
- **Hashing.** The Code node can read file bytes (`this.helpers.getBinaryDataBuffer`) but `require('crypto')`
  is blocked, so the SHA-256 comes from the Crypto node. The Crypto node drops the binary, so the
  Precheck code re-attaches it from Check File.
- **Model check before building.** All nine samples were read correctly by `gpt-5.4-mini` (reasoning
  low) in 4-5 s each, including the tilted receipt photo and the image-only scan. The model copied
  the wrong scallops line (10 × 26.50 = 310.00) as printed, as the prompt asks.
- **Unit prices keep full precision.** Rounding them to cents turned the electricity rate $0.1385 into
  $0.14 and flagged a correct bill; quantities and unit prices are now kept as read, amounts are
  rounded to cents, and the tolerance is 2 cents or 0.5%.
- **Short reasons for subjects.** Each flag carries a short label, so approval subjects read
  "Approve: Frostline Refrigeration Services, USD 2,548.91 (new supplier, over the USD 1,000 limit)".
- **n8n's approval email template centres text**, so every cell and paragraph in the approval email
  sets `text-align:left`.
- **Bots are ignored on approval links and the form.** A `curl` click returns an empty 200 and
  nothing resumes; a browser user agent works. The form uses `ignoreBots` too, so headless tests need
  a normal user agent. This keeps email link scanners from approving invoices.
- **Duplicates and payment status.** A duplicate's register row now has an empty `payment_status`
  (it was copying `unpaid`).
- **Demo helpers.** Workflow 7 sends the sample set as nine emails, 3 s apart, from each "supplier";
  Email Intake sorts by date so the original is always read before the re-sent copy. Workflow 8
  resets the demo in one click.
- **Setup ran in two goes.** The first run created the sheet and folders but could not fetch the
  sample files (`localhost` resolved to IPv6 while the file server listened on 127.0.0.1); a
  temporary workflow uploaded the samples and created the Gmail labels.
- **An extra sample** (`pinecrest-dairy-2307.pdf`, not in the email demo) is there to show the upload
  form and Drive folder with a fresh, auto-approved invoice after the email demo.
