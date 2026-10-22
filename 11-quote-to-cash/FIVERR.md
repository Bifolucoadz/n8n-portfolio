# Fiverr portfolio: Quote to Cash

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
AI Quote-to-Cash System for Trades Businesses in n8n
```

## Description

1,056 characters (Fiverr needs at least 120).

```text
Trades businesses lose jobs to slow quotes, then spend evenings chasing deposits and invoices.

I built a quote-to-cash system in n8n, shown here for Mossgrove Landscapes, a fictional landscaping firm:
• The estimator fills in a form on site, with typed notes or a voice memo
• AI picks the items and quantities from the firm's price list; every price is worked out in code
• The owner checks the draft on a dashboard and sends it
• The client opens an online quote, adds optional extras and signs with their name
• They pay a deposit by card and the job is booked into the first free crew slot
• Branded quote, invoice and receipt PDFs, reminders, the final invoice and a review request follow on their own

Everything runs on one Google Sheet the owner can read and edit. Each signature is fingerprinted (SHA-256), so the signed quote can't be changed afterwards.

Results (test mode): a voice memo became a priced draft quote in about 30 seconds. The whole cycle, from sending the quote to the paid receipt, ran end to end twice, a few seconds per step.
```

## Other fields

- Duration: 2-3 weeks
- Skills and tools: n8n, OpenAI API, Google Sheets, Stripe, PDF generation, AI automation, e-signature

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/client-01-quote.png`: The client's online quote (cover)
2. `screenshots/dashboard-01-ai-draft.png`: Owner dashboard: an AI draft with its checks
3. `screenshots/form-01-site-visit.png`: The estimator's site-visit form with a voice memo
4. `screenshots/form-02-draft-ready.png`: About 30 seconds later: the priced draft
5. `screenshots/client-02-sign.png`: Client adds an extra and signs
6. `screenshots/pdf-01-quote.png`: The quote PDF, drawn by the workflow
7. `screenshots/client-03-deposit-checkout.png`: Deposit checkout (test mode)
8. `screenshots/client-04-booked.png`: Booked in: start date from the crew calendar
9. `screenshots/dashboard-04-crew-calendar.png`: Both crews' calendars on the dashboard
10. `screenshots/client-05-final-invoice.png`: Job done: final invoice and payment link
11. `screenshots/pdf-02-invoice-and-receipt.png`: Invoice and receipt PDFs
12. `screenshots/email-02-morning-summary.png`: The owner's morning summary
13. `screenshots/dashboard-02-edit-and-price.png`: Owner edits a draft; lines are repriced from the price book
14. `screenshots/dashboard-03-paid-job.png`: A paid job with its signature, payments and history
15. `screenshots/client-06-phone.png`: The quote on a phone
16. `screenshots/email-01-quote-sent.png`: The quote email to the client
17. `screenshots/email-03-booked.png`: Booking confirmation email
18. `screenshots/workflow-01-site-visit.png`: Site Visit to Draft Quote: transcribe, AI picks items, code prices them
19. `screenshots/workflow-03-client-page.png`: Client Quote Page: accept and sign with a SHA-256 fingerprint
20. `screenshots/workflow-04-payments.png`: Payments and Booking: test checkout or Stripe, then book a crew
21. `screenshots/workflow-02-dashboard.png`: Owner Dashboard and its actions
22. `screenshots/workflow-05-documents.png`: PDF Documents
23. `screenshots/workflow-06-follow-ups.png`: Daily Follow-ups
24. `screenshots/workflow-07-save-changes.png`: Save Changes: one batch write to Google Sheets
25. `screenshots/workflow-08-reset-demo.png`: Reset Demo
26. `screenshots/workflow-00-create-sheet.png`: Create Spreadsheet

Workflow images are renders of the live n8n workflows, 2880×1728 px (5:3, the ratio of the 1280×769 Fiverr recommends). Site Visit is shown in two rows so it stays readable; nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-22. The pages, PDFs and emails are live screens in test mode with the demo data and three site visits sent through the real form; the emails are shown in the test inbox. Email addresses and phone numbers are blurred because Fiverr doesn't allow contact details in images.

## Notes for you (not for Fiverr)

- Test mode: emails went to the Outbox tab and card payments used the practice checkout. Gmail (with the PDF attached) and Stripe are built but not tested live; they need the Gmail credential reconnected and a Stripe test key.
- The voice memo is text-to-speech (macOS "Daniel"); a real estimator's memo would make an even better demo.
