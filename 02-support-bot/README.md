# Customer Support Bot

A website chat assistant for **Copperline Auto Repair**, a fictional mechanic shop in Boston. It
answers questions from the shop's own Google Doc, checks a live Google Calendar and books cars in,
hands conversations to staff when it should, and emails the owner a weekly report that includes
the questions it couldn't answer.

Built in n8n 2.30 as seven workflows, with OpenAI, Supabase (vectors and chat memory), Google
Calendar, Google Sheets and Gmail. It is the working demo of what the Lead Engine's outreach emails
offer.

| # | Workflow | Trigger | What it does |
|---|----------|---------|--------------|
| 1 | Support Bot 1: Knowledge Sync | Google Drive (doc updated, every 5 min) + manual | Exports the shop info Google Doc as Markdown, refuses a near-empty doc, embeds it in Supabase, then removes the previous version's chunks. |
| 2 | Support Bot 2: Chat Agent | Chat Trigger (hosted page + the demo site's chat page) + Evaluation Trigger | GPT-5.4 mini agent with Supabase chat memory and five tools. Replies, hands the turn to workflow 7 for logging, and falls back to the shop phone number if it fails. |
| 3 | Support Bot 3: Check Availability | Called by workflow 2 and 4 | Free drop-off times from the bookings calendar: booking hours, holidays, 2 hours' notice, 14 days ahead, 2 bays. An all-day event closes a day. |
| 4 | Support Bot 4: Book Appointment | Called by workflow 2 | Validates details, caps bookings per chat, re-checks the slot, creates the calendar event, logs it and sends a fixed-template confirmation. |
| 5 | Support Bot 5: Hand Off to Staff | Called by workflow 2 | Needs a phone or email, caps tickets per chat, logs a ticket and emails the team the summary and full transcript. |
| 6 | Support Bot 6: Weekly Report | Mondays 8:00 am (Boston) + manual | Chats, bookings, hand-offs and errors for the week, plus unanswered questions grouped into themes with a line to paste into the doc. |
| 7 | Support Bot 7: Log Chat Turn | Called by workflow 2, not awaited | Appends the turn to the Conversations tab in the background, so Sheets never slows a reply. |

Errors in every workflow go to **Lead Engine 0: Error Alerts** from project 1.

`workflows/json/` holds importable exports. `workflows/*.ts` is the n8n Workflow SDK source, built
from `workflows/src/*.ts` plus the Code node scripts in `workflows/code/` and the system prompt in
`prompts/system-prompt.md` (`python3 workflows/build.py`).

## How a chat turn works

```
Website Chat ──> Chat Input (trim to 1,000 chars) ──> Copperline Assistant ──> Eval run? ──no──> Reply Text ──> Log Turn (background) ──> Final Reply
                                                        │  memory: Supabase (last 12 messages)          │
                                                        │  search_shop_info ── Supabase vectors         └─yes─> Record answer ──> Score correctness ──> Score tool use
                                                        │  check_availability ── workflow 3
                                                        │  book_appointment ── workflow 4 ── re-checks with workflow 3
                                                        │  handoff_to_staff ── workflow 5
                                                        └  log_unanswered_question ── Unanswered tab
```

## Reliability and safety

- **Answers only from the shop info.** The agent must call `search_shop_info` before answering about
  the shop, never guesses a price or diagnoses, and logs what it can't answer for the weekly report.
- **Safety first.** Failing brakes, overheating, smoke, fuel smell, a flashing check-engine light or
  steering failure get "stop driving, call the tow line or 911" before anything else.
- **Bookings can't double up.** The slot is re-checked against the calendar right before booking.
- **Limits per chat:** 2 bookings and 3 hand-offs, so one chat can't fill the calendar or flood the
  inbox. Messages are cut to 1,000 characters and the agent stops after 8 steps.
- **No AI-written emails to customers.** Confirmations use a fixed template; links are stripped and
  field lengths capped. The weekly report's AI text is escaped before it goes into HTML.
- **Sheets are written RAW**, so customer text starting with `=` is stored as text, not a formula.
- **Model-proof plumbing:** `session_id` and `dry_run` are set by expression, never by the model.
- **Knowledge index never goes empty:** new chunks are inserted before old ones are deleted, and a
  doc under 500 characters is refused.
- **Private data:** chat memory and vectors live in Supabase tables with row level security on and
  no policies, so the public `anon` key can read nothing.
- **Test mode** (`TEST_MODE` in workflow 4's Config): every confirmation goes to `TEST_INBOX`
  (oladelesamuel56@gmail.com) with `[TEST to real@address]` in the subject.

## Accounts and resources

Everything runs on **samuelgurru@gmail.com**, as in project 1.

| Resource | Where |
|----------|-------|
| Shop info doc | [Copperline Auto Repair: Shop Info](https://docs.google.com/document/d/1By8r-Hifea1hwlsW_M7oAkfqtUtnteXsqffg7B6w1Ow/edit) |
| Log sheet | [Copperline Support Bot](https://docs.google.com/spreadsheets/d/1_RHqBp7k3rWBY-4plb2oo2mIryQlHIUuNOZ-YhCpVS8/edit): Conversations, Bookings, Tickets, Unanswered, Eval |
| Bookings calendar | Copperline Bookings (America/New_York) |
| Vectors and memory | Supabase project, tables `documents` and `n8n_chat_histories` (`supabase/setup.sql`) |
| Hosted chat page | http://localhost:5678/webhook/1bd58ed4-607a-469c-b6e7-60d9691a4aef/chat |
| Demo site | Landing page `site/index.html` and full-page chat `site/chat.html` (code in `site/chat/`): run `python3 -m http.server 8080` in `site/`, open http://localhost:8080/chat.html |
| Hosted demo | https://copperline-auto-repair.vercel.app (chat: [/chat.html](https://copperline-auto-repair.vercel.app/chat.html)), Vercel project `copperline-auto-repair` on samuel-8951. The chat answers only while `hosting/start-tunnel.sh` is running (see below) |

n8n workflow IDs: 1 `qflC4MXxlxqI8LfQ`, 2 `ugVyD8yKcwwOLFhU`, 3 `b4jIqNyj0KBxac3L`, 4
`2oE6WCVdI69jWl8P`, 5 `uZjf1zfpDpHZGRhw`, 6 `2eNnO12cmyE08MwR`, 7 `8QWa34F3qiHQupqo`.

## Status (2026-10-01)

All seven workflows are built, published and tested live in test mode.

| Test | Result |
|------|--------|
| Knowledge Sync | Doc indexed (28 chunks of about 500 characters). Re-runs replace the old chunks; Google's Markdown escapes (`\$99.99`) are stripped. |
| Check Availability | Logic tested locally against overlapping bookings, an all-day closure, Sunday, past the 14-day window and exact-time re-checks; then live. |
| Full booking in chat | 3-turn conversation booked an oil change: calendar event, Bookings row and test-mode confirmation email all created (ref CA-KCI2C). |
| Hand-off in chat | Complaint created ticket T-7Z6ZS and emailed the team with the transcript. |
| Unanswered question | "Do you do window tinting?" got an honest "not sure", an offer of a person, and a row in Unanswered. |
| Weekly report | Sent to samuelgurru@gmail.com; test sessions excluded; unanswered questions grouped into a theme. |
| Test questions | 30 of the 33 eval questions run through the live chat (the 3 hand-off ones skipped so they wouldn't email the team): all knowledge, safety, scope, availability and unanswered answers correct after two fixes (see below). Average reply 6.6 s, 3 to 17 s. |

Fixes made during testing: motorcycles were declined as off-topic instead of looked up (prompt now
says vehicle questions are in scope, and chunks went from 1,000 to 500 characters so each section
is found on its own); the bot sometimes said "they" for the shop (now speaks as "we").

**Not run yet:** the formal n8n evaluation with the GPT-5.4 judge. Open workflow 2, go to the
**Evaluations** tab and click **Run evaluation**. It uses `dry_run`, so nothing is booked or sent.

## Test data to clear before recording a demo

- Calendar: Sat Oct 3, 9:00 am, "Oil change: Jane Doe".
- Sheet: rows in Conversations, Bookings (CA-KCI2C), Tickets (T-7Z6ZS) and Unanswered.
- Supabase `n8n_chat_histories`: `test-*` and `check-*` sessions (including `check-widget-live`, `check-desk-live`, `check-vercel-live` and `check-vercel-proxy`).
- The chat page keeps the conversation in the browser's `localStorage`: click **New conversation**
  before recording so it opens on the welcome screen.
- n8n Executions: one manual run of workflow 2 stuck in "waiting" from an early version that used
  a Chat reply node. It does nothing; delete it from the Executions list.

## Hosted demo on Vercel

`site/` is deployed to Vercel as a static site plus one function, `site/api/chat.js`, which forwards
chat messages to n8n. n8n still runs on this Mac, so it's reached through a Cloudflare quick tunnel:

```
Browser ──> copperline-auto-repair.vercel.app/api/chat ──> https://<random>.trycloudflare.com ──> n8n on localhost:5678
```

- **Put the chat online:** start n8n, then run `./hosting/start-tunnel.sh` and leave it running. It
  opens the tunnel, sets the Vercel env var `N8N_CHAT_URL` to the new address, redeploys (about 30 s)
  and keeps the Mac awake. Ctrl+C takes the chat offline. Logs: `hosting/start.log`, `hosting/tunnel.log`.
- **The tunnel address changes on every start**, which is why the script redeploys each time. A
  restart, a reboot or the Mac sleeping drops the chat; visitors then see "Not sent: the assistant is
  offline right now" with the shop's phone number.
- **Redeploy the pages only:** `cd site && npx vercel@latest deploy --prod --token <VERCEL_TOKEN> --scope samuel-8951s-projects`.
- **Exposure:** anyone with the tunnel address can reach this n8n instance, including its login page.
  Webhooks are public by design. Close the tunnel when you're not demoing.
- Opened directly on this Mac (`localhost`), the chat page skips the proxy and calls n8n itself.

## Going live

1. Set `TEST_MODE` to `false` in workflow 4's Config.
2. Put n8n somewhere public (n8n Cloud, a VPS, or a tunnel), then change `webhookUrl` in
   `site/chat.html` and `allowedOrigins` on the Website Chat trigger to the real site.
3. Replace the shop info doc with the real business's details; Knowledge Sync picks it up.
4. Keep the per-chat limits; consider a Gmail sending cap if traffic grows.

## Known limits

- Replies take 4 to 12 seconds from this machine: two model calls plus Supabase and OpenAI round
  trips from Lagos. Hosting n8n near Supabase and OpenAI would cut that.
- Customers can't change or cancel bookings in chat yet; those requests become hand-offs.
- Bay usage is counted conservatively: any booking overlapping a job counts against it.

## Before publishing this folder

The JSON exports and `.ts` sources contain the sheet, doc and calendar IDs, credential IDs and
both email addresses. Replace them with placeholders before pushing to a public repo.
