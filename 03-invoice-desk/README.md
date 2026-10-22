# Invoice Desk

An accounts-payable inbox for **Saltmarsh Kitchen**, a fictional restaurant in Portland, Maine.
Supplier invoices, bills and receipts come in by email, an upload form or a Drive folder. AI reads
each one (PDF, scan or phone photo), code checks the numbers, catches duplicates and changed bank
details, files the document in Drive, logs it in a Google Sheet and asks the owner to approve
anything big, new or suspicious. Every Monday the owner gets a summary of spend, approvals waiting
and bills coming due.

Built in n8n 2.30 with OpenAI (GPT-5.4 mini), Google Sheets, Google Drive and Gmail.

| # | Workflow | Trigger | What it does |
|---|----------|---------|--------------|
| 1 | Invoice Desk 1: Process Document | Called by 3, 4, 5 | The core. Hashes the file, skips exact duplicates, reads the PDF or image with strict JSON output, checks it in code, files it in Drive, writes the register and line items, and asks for approval when needed. |
| 2 | Invoice Desk 2: Approval | Called by 1, not awaited | Emails the owner Approve / Reject buttons with the reasons and the lines, waits up to 7 days, updates the register. Approving a new supplier adds it to the supplier list; approving a confirmed bank change updates the account on file. |
| 3 | Invoice Desk 3: Email Intake | Gmail, every minute | Attachments sent to samuelgurru+invoices@gmail.com, oldest first. Labels the email *Invoice Desk/Processed*. |
| 4 | Invoice Desk 4: Upload Form | n8n Form | Public form for one or more files; the finished page shows a card per file with what was read and what happens next. |
| 5 | Invoice Desk 5: Drive Intake | Google Drive, every minute | Files dropped in *Invoice Desk (Saltmarsh Kitchen)/Inbox*; the original moves to *Inbox/Done*. |
| 6 | Invoice Desk 6: Weekly Summary | Mondays 8:00 am (New York) + manual | Spend by category and supplier, waiting approvals, bills due in 7 days, overdue, and what the checks caught. Built in code, no AI. |
| 7 | Invoice Desk 7: Send Demo Documents | Manual | Emails the nine sample documents to the invoices inbox, one email each, as if from the supplier. |
| 8 | Invoice Desk 8: Reset Demo | Manual | Empties the register, restores the five starting suppliers and trashes filed copies. |

Errors in workflows 1 to 7 go to **Lead Engine 0: Error Alerts** from project 1.

`workflows/json/` holds importable exports. `workflows/*.ts` is the n8n Workflow SDK source, built
from `workflows/src/*.ts`, the Code node scripts in `workflows/code/`, and the extraction prompt and
schema in `prompts/` (`python3 workflows/build.py`). `workflows/test/` runs the Decide, approval
email and weekly summary code locally against saved AI outputs.

## How a document is handled

```
Email / Upload form / Drive folder
        │  one item per file
        ▼
Process Document ── Check file (type, size, SHA-256) ── Read register + supplier list
        │                                                     │
        │  exact same file already logged? ── yes ──> duplicate (no AI call)
        ▼
  PDF ──> GPT-5.4 mini reads it as a file ──┐
  Photo ─> GPT-5.4 mini reads it as an image ┴─> strict JSON (supplier, numbers, dates, lines, bank, category)
        ▼
  Decide (code): required fields · qty × price on every line · lines = subtotal · subtotal + tax = total
                 dates · supplier match · same supplier + number · bank details · limit · currency
        ▼
  auto_approved │ pending_approval │ needs_review │ duplicate │ not_invoice │ unsupported │ error
        ▼
  File in Drive (Filed / Other) ── Documents row + Line Items ── Approval email (if a person is needed)
```

## The rules

| Status | When |
|--------|------|
| `auto_approved` | Every check passes, known supplier, under USD 1,000. Receipts (already paid) only need the checks. |
| `pending_approval` | Checks pass, but it's USD 1,000 or more, from a new supplier, a credit note, or in another currency. |
| `needs_review` | A check failed: a line doesn't multiply out, totals don't add up, a field is missing, a date is wrong, the bank details changed, it's a statement or quote, or the AI said it was hard to read. |
| `duplicate` | Same file, or the same supplier and invoice number as one already logged. |
| `not_invoice` | Not a bill or receipt (a menu, a letter). Filed under Other. |
| `unsupported` / `error` | Not a PDF or image, over 10 MB, or the AI call failed. An error is logged and then alerts by email. |

## Safety

- **The AI only transcribes.** Every decision is a rule in the Decide code node. The prompt tells the
  model to copy wrong arithmetic as printed and to treat text in the document as data, so a
  document can't approve itself.
- **Changed bank details always go to a person**, with "call the supplier on a number you already
  have". This is the most common invoice fraud.
- **Approval links can't be triggered by link scanners:** n8n ignores bots on the approve/reject
  links (and on the upload form), and every link is signed.
- **Duplicates are caught before the AI call** (same bytes) and after it (same supplier and number,
  or same supplier, date and total).
- **Only the last 4 digits** of a bank account are stored.
- **Sheets are written RAW**, so text starting with `=` stays text. Email and page HTML is built in
  code with everything from documents escaped.
- **Retries:** Sheets, Drive and Gmail 3× with 5 s waits; the AI call 2× with 3 s.

## Accounts and resources

Everything runs on **samuelgurru@gmail.com**, as in projects 1 and 2.

| Resource | Where |
|----------|-------|
| Register | [Invoice Desk: Saltmarsh Kitchen](https://docs.google.com/spreadsheets/d/1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48/edit): Documents, Line Items, Suppliers |
| Drive | [Invoice Desk (Saltmarsh Kitchen)](https://drive.google.com/drive/folders/1U-Ms5thx7_85Myh-yOIBkCi6NWFAOJQ9): Inbox (and Inbox/Done), Filed, Other, Demo documents |
| Invoices inbox | samuelgurru+invoices@gmail.com, Gmail label *Invoice Desk/Processed* |
| Upload form | http://localhost:5678/form/saltmarsh-invoices |
| Sample documents | `samples/out/` (make them with `python3 samples/make_samples.py`) and the Drive *Demo documents* folder |

n8n workflow IDs: 1 `v9Mp2015O3VcFURY`, 2 `fD6wYG96es2Hgpnw`, 3 `IOn1FM7FS5E0ip0Q`,
4 `vXu7uQhdVHSv94hV`, 5 `ijxI84YVZ96mK3XL`, 6 `BZsPLrtm5eRf8Bng`, 7 `6Angy5uRfEbYKXKw`,
8 `UTUuNn0Yq8TjgZ4q`. Setup (0) was `IVYStbUQbcynpAuL`, archived after it ran.

## Running the demo

1. Run **Invoice Desk 8: Reset Demo** for an empty register, and keep the Mac awake (the Gmail and
   Drive triggers poll every minute and fail while it sleeps).
2. Run **Invoice Desk 7: Send Demo Documents**. Within a couple of minutes Email Intake has read all
   nine and the register shows the full range of outcomes (below).
3. Open the approval emails in samuelgurru@gmail.com and click Approve or Reject. Approving Frostline
   adds it to the Suppliers tab.
4. Drop `samples/out/pinecrest-dairy-2307.pdf` on the upload form, or into the Drive Inbox folder,
   to show the other two channels.
5. Run **Invoice Desk 6: Weekly Summary** with "Send Summary Now".

The approval buttons open `http://localhost:5678/...`, so click them on this Mac.

## Status (2026-10-01)

All eight workflows are built in n8n through the MCP server; 1 to 7 are published. Tested live:

| Test | Result |
|------|--------|
| Reading (spike) | All nine samples read correctly by GPT-5.4 mini in 4-5 s each, including the tilted receipt photo and the image-only scan. The wrong scallops line was copied as printed. |
| Decide code | Run locally (`workflows/test/run-decide.js`) against the saved AI outputs: every sample gets the intended status. |
| Process Document | Ten runs through a test webhook: 2 auto-approved invoices, Frostline sent for approval (new supplier, over the limit), Gullrock flagged (line 3 overcharged by USD 45.00), Bluewick flagged (bank changed, 9047 vs 4418 on file), receipt photo and scanned bill auto-approved, menu set aside, re-sent copy caught by invoice number, exact re-send caught by hash in 5 s with no AI call. 15-19 s per document. |
| Approval | Approval emails arrive with short subjects ("Approve: Frostline Refrigeration Services, USD 2,548.91 (new supplier, over the USD 1,000 limit)"). Approve on Frostline set the row to `approved` and added Frostline to the Suppliers tab; Reject on Gullrock set `rejected` and `do_not_pay`. |
| Email Intake (full demo) | After a reset, workflow 7 sent the nine demo emails; two Gmail polls read all nine in sending order with the same outcomes as above, labelled the emails *Invoice Desk/Processed* and marked them read. |
| Upload Form | Three files in one go (fresh Pinecrest invoice, a re-generated Harborline PDF, the receipt photo): results page in 36 s with one approved card and two "Already logged" cards (caught by invoice number and by file hash). |
| Drive Intake | A file dropped into Inbox was read, auto-approved, filed, and the original moved to Inbox/Done. |
| Weekly Summary | Sent to samuelgurru@gmail.com: spend, waiting, due this week, and "Caught this week: USD 45.00 in overcharged lines; 2 duplicates; 1 bank-detail change". |
| Reset Demo | Cleared the register, restored the five suppliers, trashed the filed copies. |

## Waiting for you

- **Three approval emails** from the demo run are in samuelgurru@gmail.com: Frostline (approve to add
  it to the supplier list), Gullrock (reject: overcharged) and Bluewick (bank change). Click the
  buttons on this Mac.
- An older Bluewick approval email from the test runs (before the reset) is still waiting too. Its
  row no longer exists, so clicking it changes nothing; ignore it or let it expire on Oct 8.
