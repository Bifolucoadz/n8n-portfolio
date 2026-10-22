# Lead Generation Engine: build spec

Portfolio project 1. Finds local businesses on Google Maps with Apify, scores them with OpenAI,
writes them to Google Sheets, then emails them with Gmail and runs automatic follow-ups until
they reply or the sequence ends.

## Environment

- n8n 2.30.7, local, http://localhost:5678 (start with `n8n start`)
- Claude Code reaches n8n through the instance-level MCP server (`n8n`, user scope). Build the
  workflows with its workflow-builder tools (create/validate/update).
- n8n credentials to use (by name): an OpenAI credential (all AI steps; switched from Anthropic on
  2026-10-01), `Google Sheets account`,
  `Gmail account` (the sender; the user chose this already connected account),
  `Google Drive account`.
- Still missing: Apify API token as a Header Auth credential (`Authorization: Bearer <token>`).
  Build the HTTP Request node so it only needs that credential attached.
- No Apify node is installed; call the Apify REST API with the HTTP Request node.

## Google Sheet

- Name: Lead Generation Engine
- ID: `1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k`
- URL: https://docs.google.com/spreadsheets/d/1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k/edit
- Tab: `Leads` (gid 0), header row bold and frozen.
- Owner: samuelgurru@gmail.com, the same account as the n8n Sheets and Gmail credentials.
  (Replaced the first sheet, 19WIPwcf78y4P8B0s7kwfdjWgQ5ig9vMSYS9XCKY4vyo in
  oladelesamuel56@gmail.com, which n8n could not access. That one is no longer used.)
- Columns (row 1), key column `place_id`:
  `place_id, business_name, category, address, city, phone, website, email, rating, reviews,
  maps_url, lead_score, score_reason, personal_line, status, emails_sent, last_email_at,
  next_followup_at, thread_id, last_message_id, reply_type, reply_summary, replied_at, added_at`
- `status` values: `new`, `no_email`, `contacted`, `replied`, `unsubscribed`, `bounced`, `finished`

## Workflows

All three share one config (a Set node, or a `Config` tab later):
`TEST_MODE` (default true), `TEST_INBOX` (the user's own address), `SENDER_NAME`, `OFFER`
(what the emails pitch), `NICHE`, `LOCATION`, `MAX_PLACES` (default 20), `DAILY_SEND_CAP`
(default 20), `FOLLOWUP_DAYS` (default [3, 7], so 3 emails total), `MIN_SCORE` (default 6).

### 1. Lead Scraper (manual or Form trigger, optional weekly schedule)
1. Inputs: niche, location, max places.
2. HTTP Request: `POST https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items`
   with body `{"searchStringsArray": [niche], "locationQuery": location,
   "maxCrawledPlacesPerSearch": MAX_PLACES, "language": "en", "skipClosedPlaces": true,
   "scrapeContacts": true}`. run-sync times out after 300 s; for big runs switch to
   start run, poll, then fetch dataset items.
   Expected output fields (check against a real run): `placeId, title, categoryName, address,
   city, phone, website, emails[], totalScore, reviewsCount, url`.
3. Read existing sheet rows and drop places whose `place_id` is already there.
4. AI (OpenAI GPT-5.4 mini): score 1 to 10 for fit with `OFFER`, one-sentence reason, and a
   one-line personal opener based on the listing (rating, reviews, category, website). Return JSON.
5. Append rows: `status = new` if an email was found, otherwise `no_email`. `emails_sent = 0`,
   `added_at = now`.

### 2. Outreach and Follow-up (Schedule: weekdays, every hour 9:00 to 17:00)
1. Read rows. Pick:
   - first email: `status = new`, `lead_score >= MIN_SCORE`, has email
   - follow-up: `status = contacted`, `next_followup_at <= now`, `emails_sent < 3`
2. Stop at `DAILY_SEND_CAP` emails sent today.
3. AI (OpenAI GPT-5.4) writes the email for the step (1 = intro with `personal_line` and `OFFER`;
   2 = short bump; 3 = break-up email). Plain text, under 120 words, with an opt-out line
   ("Reply 'stop' and I won't email again").
4. Gmail: step 1 sends a new message; steps 2 and 3 reply in the same thread using
   `last_message_id` so the conversation stays in one thread.
   In `TEST_MODE`, send everything to `TEST_INBOX` with `[TEST to <real email>]` in the subject.
5. Update row: `emails_sent + 1`, `last_email_at`, `thread_id`, `last_message_id`,
   `next_followup_at` = now + next gap, or `status = finished` after the third email.

### 3. Reply Detector (Gmail Trigger, poll every 5 min)
1. New inbox message. Match the sender (or the thread ID) to a sheet row.
2. Mailer-daemon or delivery failure: `status = bounced`.
3. AI (OpenAI GPT-5.4 mini) sorts the reply into `interested`, `not_interested`, `out_of_office`,
   `unsubscribe` or `other`, plus a one-line summary.
4. `out_of_office`: leave the sequence running. `unsubscribe`: `status = unsubscribed`.
   Anything else: `status = replied`, `replied_at`, `reply_type`, `reply_summary`.
5. `interested`: notify the user (email to self).

### Error handling
- One Error Trigger workflow that emails the user the failed workflow, node and message.
- HTTP and Gmail nodes retry on failure (3 tries, 5 s wait).
- Sticky notes in each workflow explaining each section, because the screenshots go in the portfolio.

## Decisions (2026-10-01)
- Target: business type and city are entered on the Lead Scraper form for each run, not fixed.
  For the first test run, ask the user which type and city to use.
- Pitch: the user's own AI automation services, so the engine also finds real clients.
  Default `OFFER` (the user can edit it in the Config node):
  "I build AI automations for small businesses: instant replies to new enquiries, automatic
  follow-ups so leads don't go cold, appointment booking, and AI assistants that answer common
  customer questions around the clock. Built on n8n and usually live within two weeks."
  Call to action: ask for a 15-minute call. `SENDER_NAME` default: "Samuel" (confirm with user).
- Sender: the `Gmail account` credential, samuelgurru@gmail.com. Summaries and alerts also go to
  samuelgurru@gmail.com. `TEST_INBOX`: oladelesamuel56@gmail.com, because it must differ from the
  sender (2026-10-01: user switched everything else to samuelgurru).
- Reply Detector must ignore messages sent from the user's own address, since test-mode emails
  land in the same inbox.
- AI provider: OpenAI instead of Anthropic (2026-10-01, user request). GPT-5.4 mini for scoring and
  reply sorting, GPT-5.4 for writing emails, reasoning effort low.
