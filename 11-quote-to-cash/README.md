# Quote to Cash (Mossgrove Landscapes)

From site visit to paid invoice for a landscaping firm. The estimator fills in a form in the garden (typed
notes or a voice memo, plus photos). GPT-5.4 picks items and quantities from the price book and code prices
them. The owner checks the draft on a dashboard and sends it. The client opens a quote page, ticks optional
extras, and signs with their typed name; what they sign is fingerprinted with SHA-256. They pay a 25% deposit,
and the job is booked into the first crew with enough free days. When the job is done, the final invoice,
payment, receipt and review request follow. Quotes, invoices and receipts are PDFs drawn by the workflow
itself. Every morning, quotes are chased and the owner gets a summary. All data lives in one Google Sheet.

Demo for a fictional firm in Bristol. Decisions and data design are in [SPEC.md](SPEC.md).

## Links (n8n on this Mac)

- Site visit form: http://localhost:5678/form/mossgrove-site-visit (login: `estimator` / `ESTIMATOR_PASSWORD` in `workflows/config.json`)
- Owner dashboard: http://localhost:5678/webhook/mossgrove/dashboard?key=3NrLL9oxXcxzwtQqg94Czsxu
- Test inbox (emails test mode kept): http://localhost:5678/webhook/mossgrove/outbox?key=3NrLL9oxXcxzwtQqg94Czsxu
- Client pages: the **Client page** button on the dashboard (or `/webhook/mossgrove/quote?t=<token>`; sample
  quotes use `demo-q-1005-mg7k2p` style tokens)
- Google Sheet: https://docs.google.com/spreadsheets/d/1754F1Rep-Rg9J3x6Dnga0fjTeSR4zfaLOS_zD7Zp1J4/edit
  (the dashboard key is `dashboard_key` in the Settings tab)

## Workflows

| # | Workflow | ID | What it does |
|---|----------|----|--------------|
| 0 | Create Spreadsheet | mgvCreateSheet00 | Run once: creates the sheet and its tabs. Manual. |
| 1 | Site Visit to Draft Quote | mgvSiteVisit0001 | Form → transcribe → GPT-5.4 picks items → priced in code → saved → draft page. Published. |
| 2 | Owner Dashboard | mgvDashboard0002 | Dashboard, owner actions (save, send, withdraw, record payment, job done), test inbox. Published. |
| 3 | Client Quote Page | mgvClientPage003 | Quote page, accept and sign (SHA-256), question, decline, view tracking. Published. |
| 4 | Payments and Booking | mgvPayments00004 | Test checkout or Stripe, records payments, books the crew, receipts. Published (Stripe nodes off). |
| 5 | PDF Documents | mgvDocuments0005 | Quote, invoice and receipt PDFs (web link and email attachments). Published. |
| 6 | Daily Follow-ups | mgvFollowUps0006 | 7:30 every day: reminders, expiry, review requests, owner summary. Published. |
| 7 | Save Changes | mgvSaveChange007 | Writes a plan to the sheet in one batch request; Gmail in live mode. Published. |
| 8 | Reset Demo | mgvResetDemo0008 | Settings, price book, 9 sample quotes at every stage, history, crew calendars. Manual. |

## Running the demo

1. Run **Mossgrove 8: Reset Demo**.
2. `python3 workflows/test/site-visit.py` fills in the real form three times (one voice memo, two typed);
   each draft is ready in about 25-35 seconds. Or use the form yourself (`samples/voice-memo.m4a`).
3. Open the dashboard, price any custom item, **Save and send**. Open the **Client page**, tick an extra,
   accept and sign, pay the deposit with the test card, then **Job done** on the dashboard and pay the balance.
   `python3 workflows/test/journey.py SHOTS_DIR Q-1010` does all of this in a browser and saves screenshots.
4. Run **Mossgrove 6** (Run Now) for the reminders and morning summary. Emails are in the test inbox.

## Status (2026-10-22)

Tested in test mode on the live workflows:

| Test | Result |
|------|--------|
| Site visits through the real form | 3 drafts, 25-32 s from pressing the button to the draft page. The voice memo was transcribed word for word. |
| AI drafts | Right price-book items with standard groundwork added (dig-out, sub-base, skips, fence removal); unclear work put aside to price (shed removal, hot tub base); a measurement given as "roughly 7 m" used and recorded as an assumption; questions raised for the owner. |
| Full journey, twice | Price custom item → send → client adds an extra and signs → deposit (test card) → booked for a crew (first free slot, 7 working days) → final invoice → balance → receipt; quote, invoice and receipt PDFs downloaded. |
| Speed | Each step 4-8 s in the browser after Save Changes moved to one Sheets batch request (it was about 20 s with one Google Sheets node per tab). |
| Daily follow-ups | 2 quote reminders (wording differs for opened and unopened), 1 deposit reminder, owner morning summary. |
| Refusals (local and live) | Send with an unpriced item, "job done" on a quote that isn't booked, accepting twice, a wrong dashboard key (403). |

Fixed during testing: Price Quote pointed at a renamed node; two forms sent at the same second could get the
same quote number (the number is now read just before saving); the batch write needed each tab's ID; the PDF
showed the AI's internal note on custom items.

## Going live

1. Reconnect **Gmail account 2** in n8n and set `mode` to `live` in Settings, with `owner_email` and the
   company details. Emails then go out with the PDF attached.
2. Card payments: create a Stripe credential, enable **Create Stripe Session** and **Get Stripe Session** in
   Mossgrove 4, and point a Stripe webhook (`checkout.session.completed`) at `/webhook/mossgrove/stripe-webhook`.
3. Set `base_url` to a public address (e.g. the ngrok domain from `hosting/`) so links in emails and PDFs work
   for clients. Replace the price book with the firm's own.

## Files

- `prompts/`: the estimating assistant's instructions and JSON schema.
- `site/`: dashboard, client quote page, checkout page and test inbox (filled with data by the workflows).
- `workflows/src/*.ts` + `workflows/code/*.js` → `python3 workflows/build.py` → `workflows/*.ts`;
  `node workflows/deploy.js workflows/<file>.ts` validates and imports (IDs in `workflows/deploy.json`,
  sheet ID and keys in `workflows/config.json`). `workflows/json/*.local.json` is what was imported.
- `workflows/test/`: form, journey and screenshot helpers. `samples/`: sample visits and the voice memo.
