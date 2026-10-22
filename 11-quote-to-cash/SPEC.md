# Quote to Cash: build spec

Portfolio project 11. The full sales cycle for **Mossgrove Landscapes**, a fictional landscaping firm in
Bristol: an estimator's site visit becomes a priced quote, the client accepts and signs it online, pays a
deposit, the job is booked into a crew's calendar, and the final invoice, payment and review request follow
on their own. Everything runs on one Google Sheet.

Everything is invented: company, people, addresses, emails (`.example` / example.com) and phone numbers
(Ofcom's drama ranges: 0117 496 0xxx, 07700 900xxx).

## Decisions (2026-10-22)

- User asked for three new projects (quote-to-cash, competitor radar, business MCP server) with Google
  Sheets as storage instead of n8n data tables, plus screenshots and Fiverr write-ups.
- **AI never prices.** GPT-5.4 reads the estimator's notes, voice memo transcript (gpt-4o-transcribe) and up to
  three photos, and returns price-book codes, quantities, labels, optional extras, custom items, assumptions
  and questions (strict JSON schema, prompts/quote-builder.md). Code prices every line from the **Price Book**
  tab (minimum quantities, VAT, 25% deposit, days of work) and adds checks for the owner (unpriced custom
  items, low confidence, large jobs, unknown codes).
- The estimator's form is behind basic auth (credential "Mossgrove estimator login"; user and password in
  `workflows/config.json`). It waits for the draft (about 30 s) and shows it with a link to the dashboard.
- **Owner in the loop**: nothing reaches the client until the owner presses Send on the dashboard. Edits are
  repriced on save; a sent quote that is edited gets a new version number.
- **Client page** (`/webhook/mossgrove/quote?t=<token>`): random 24-character token per quote. Optional
  extras update the total live. **Accept and sign** = typed full name + checkbox; what they sign (lines,
  extras, totals, name, time) is serialised and fingerprinted with SHA-256 (Crypto node) and stored with IP
  and browser in `sign_meta_json`. The first view emails the owner (a good moment to call).
- **PDFs** (quote, invoice, receipt) are drawn by a small PDF writer in a Code node (Helvetica, WinAnsi,
  links), so there is no template service and the PDF always matches the sheet.
- **Payments**: test mode shows a practice checkout (test card 4242…); live mode creates a Stripe Checkout
  session. Stripe's webhook is not trusted on its own: the session is fetched back from Stripe and the amount
  compared. The two Stripe nodes are disabled until a Stripe credential exists. The owner can also record a
  bank transfer from the dashboard.
- **Booking**: when the deposit is paid, the job goes to the first crew with enough consecutive working days
  free after the lead time (Settings `lead_days`), from the **Schedule** tab.
- **Follow-ups** every morning: quote reminders on day 3 and 7 (wording depends on whether it was opened),
  expiry after `validity_days`, deposit reminder after 3 days, overdue invoice reminder, review request 2 days
  after the final payment, and an owner summary.
- **Plans, not scattered writes**: each workflow decides everything in code and hands a plan to
  **Mossgrove 7: Save Changes**, which writes the whole plan in ONE Sheets API `batchUpdate` (appendCells for
  new rows, updateCells for changed quote fields) after one read of the sheet IDs and quote rows. Values are
  written as string/number cells, so client text can't become a formula, and the write is all-or-nothing.
- Reads use one Sheets API `values:batchGet` call per request (all needed tabs at once) to stay fast and
  under the per-minute quota.
- Test mode (`mode = test` in Settings): emails go to the **Outbox** tab, payments are simulated. Live mode
  uses Gmail (`Gmail account 2`, with the PDF attached) and Stripe.
- Error alerts: the shared Social Autopilot 0 workflow (Telegram).

## Sheet tabs

| Tab | Columns |
|-----|---------|
| Settings | key, value, note |
| Price Book | code, category, item, unit, unit_price, labour_days, min_qty, notes, active |
| Quotes | quote_id, token, status, client details, job_title, summary, visit_notes, transcript, lines/extras/custom/assumptions/questions/flags (JSON), subtotal, vat, total, deposit, labour_days, version, estimator, created_at, build_ms, sent_at, valid_until, viewed_at, view_count, accepted_at, signed_name, sign_meta_json, chosen_extras_json, accepted totals, deposit_due, deposit_paid_at, job_start, job_end, crew, completed_at, invoice_id, balance_due, balance_paid_at, review_sent_at, declined_at, decline_reason, reminders_sent, last_reminder_at, messages_json, updated_at |
| Events | at, quote_id, event, detail, actor (audit trail) |
| Payments | payment_id, quote_id, kind (deposit/balance), amount, status, provider, provider_ref, created_at, paid_at |
| Schedule | entry_id, quote_id, title, start, end, crew, kind, notes |
| Outbox | at, to, subject, kind, quote_id, links, html (test-mode emails) |

Quote status: `draft` → `sent` → `accepted` → `scheduled` (deposit paid) → `completed` (final invoice) →
`paid`; or `declined`, `expired`, `cancelled`.

## Workflows

| # | Name | ID | Trigger |
|---|------|----|---------|
| 0 | Create Spreadsheet | mgvCreateSheet00 | Manual (once) |
| 1 | Site Visit to Draft Quote | mgvSiteVisit0001 | Form `/form/mossgrove-site-visit` (basic auth) |
| 2 | Owner Dashboard | mgvDashboard0002 | Webhooks `mossgrove/dashboard`, `mossgrove/owner` |
| 3 | Client Quote Page | mgvClientPage003 | Webhooks `mossgrove/quote`, `mossgrove/quote-action` |
| 4 | Payments and Booking | mgvPayments00004 | Webhooks `mossgrove/pay`, `mossgrove/pay-test`, `mossgrove/stripe-webhook` |
| 5 | PDF Documents | mgvDocuments0005 | Webhook `mossgrove/pdf`; called by 7 |
| 6 | Daily Follow-ups | mgvFollowUps0006 | Every day 7:30 Europe/London + manual |
| 7 | Save Changes | mgvSaveChange007 | Called (plan) |
| 8 | Reset Demo | mgvResetDemo0008 | Manual |

## Build changes (2026-10-22)

- Save Changes first used one Google Sheets node per tab (append/update): about 4 s each because the node
  reads the sheet before writing, so a deposit took ~20 s. Replaced by one batchUpdate: 4-8 s per step in the
  browser.
- The batch read asked only for `Quotes!A:A`, and Google then returns only that tab, so the other tabs had no
  sheet ID ("No grid with id: 0"); it now asks for one cell of every tab it writes.
- Price Quote referred to `Draft Quote` after the node was renamed `Draft Quote (GPT-5.4)`; a reference
  checker over all three projects found no other case.
- Quote numbers: three forms sent at once got the same number. The number is now taken from a fresh read of
  the Quotes column just before saving (Read Quote Numbers).
- The PDF printed the AI's internal note on custom items; client documents now show only the description.
- Added a test inbox page (`/webhook/mossgrove/outbox?key=…`) so test-mode emails can be read like an inbox.

## Build notes

- Code lives in `workflows/code/*.js` with shared `lib-mgv.js`, `lib-pdf.js`, `lib-docs.js`, `lib-dash.js`,
  `lib-pay.js`; pages in `site/`; prompt and schema in `prompts/`. `python3 workflows/build.py` fills the
  placeholders (including `@@SHEET_ID@@` and credential IDs from `workflows/config.json`) and
  `node workflows/deploy.js workflows/<file>.ts` validates and imports.
- Long code nodes are emitted as parenthesised groups of 100 lines: one long `+` chain is "nesting too deep"
  for the SDK parser.
- All code nodes were run locally against the seeded demo data before deployment (scratchpad harness):
  pricing, every owner action, accept/question/decline, test payment and booking, follow-ups, and all
  three PDFs.
