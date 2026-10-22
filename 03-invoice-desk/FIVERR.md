# Fiverr portfolio: Invoice Desk

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
AI Invoice Processing and Approval Automation in n8n
```

## Description

1,156 characters (Fiverr needs at least 120).

```text
Typing supplier invoices into a spreadsheet takes hours each week, and that's how overcharges, duplicate bills and fake "we've changed banks" emails slip through.

I built an accounts-payable inbox in n8n, shown here for Saltmarsh Kitchen, a fictional restaurant:
• Invoices arrive by email, an upload form or a Google Drive folder
• AI reads each one (PDF, scan or phone photo): supplier, dates, totals and every line
• Code re-checks every line and total, catches duplicates and flags changed bank details
• Each document is renamed, filed in Drive and logged in a Google Sheet
• Big, new or suspicious bills are emailed to the owner with Approve and Reject buttons
• Every Monday: spend by category, approvals waiting and bills coming due

Safe by design: the AI only reads. Every decision is a fixed rule, so a document can't approve itself. Bank changes always go to a person, and only the last 4 digits of an account are stored.

Results: all 9 sample documents were read and sorted correctly, including a tilted receipt photo and an image-only scan. It caught a $45 overcharge, a changed bank account and 2 duplicates, at 15-19 seconds per document.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, OpenAI API, Google Sheets, Google Drive, Gmail, document processing, invoice automation

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/workflow-01-process-document.png`: Process Document: check the file, AI reads it, code decides, file, log, ask (cover)
2. `screenshots/workflow-02-approval.png`: Approval: Approve / Reject email and register update
3. `screenshots/workflow-03-email-intake.png`: Email Intake: attachments from the invoices inbox
4. `screenshots/workflow-04-upload-form.png`: Upload Form: drop files, get a results page
5. `screenshots/workflow-05-drive-intake.png`: Drive Intake: files dropped in a Drive folder
6. `screenshots/workflow-06-weekly-summary.png`: Weekly Summary: Monday email built in code

Workflow images are renders of the live n8n workflows, 2880×1732 px (5:3, the same ratio as the 1280×769 Fiverr recommends, so they scale down cleanly). Sticky notes are moved into a band above the nodes and a few nodes nudged apart so the text is readable; nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-21. Process Document is shown in two rows for the screenshot (in n8n it is one long row). In Email Intake the sticky note named your Gmail address; the render says "the business's invoices address" instead, because Fiverr flags contact details. The two demo utilities (7 Send Demo Documents, 8 Reset Demo) are left out.

## Notes for you (not for Fiverr)

- A screenshot of the register sheet or an approval email would show the result, not just the plumbing. Blur supplier bank digits and your address if you add one.
