# Customer Support Bot: build spec

Portfolio project 2. A website chat assistant for **Copperline Auto Repair**, a fictional
independent mechanic shop in Boston. It answers questions from the shop's own information,
checks the calendar and books cars in, hands conversations to staff when it should, and emails the
owner a weekly report that includes the questions it couldn't answer.

It is a working demo of what the Lead Engine's outreach emails offer ("instant replies to new
enquiries, appointment booking, and AI assistants that answer common customer questions around
the clock").

## Environment

- n8n 2.30.7, local, http://localhost:5678 (start with `n8n start`).
- Claude Code builds the workflows through the n8n instance MCP server (`n8n`, user scope), with
  the same Workflow SDK conventions as project 1 (`workflows/*.ts` source, `workflows/json/` exports).
- Workflow names start with `Support Bot N:`.

## Accounts and credentials

Everything runs on **samuelgurru@gmail.com**, as in project 1. `TEST_INBOX` stays
oladelesamuel56@gmail.com.

| n8n credential | Status | Used for |
|----------------|--------|----------|
| `OpenAI account` | Exists | Agent model, embeddings, report summary, eval judge |
| `Google Sheets account` (D8rKxzgMrJwmFZoQ) | Exists | Log, bookings, tickets, eval dataset |
| `Gmail account` (9FKWoKxErtgj9Qg7) | Exists | Booking confirmations, hand-off emails, weekly report |
| `Google Drive account` | Exists (check which Google account it uses) | Watch and download the shop info doc |
| `Supabase account` (Supabase API) | **New** | Vector store |
| `Postgres account` (Postgres, Supabase session pooler) | **New** | Chat memory, replacing a doc's old chunks, reading transcripts |
| `Google Calendar account` | **New** | Availability and bookings |

## Supabase

- Free project. Run `supabase/setup.sql` once in the SQL editor. It creates:
  - `documents` (content, metadata jsonb, embedding vector(1536)) and the `match_documents`
    function that the n8n Supabase Vector Store node calls.
  - `n8n_chat_histories`, the table the Postgres Chat Memory node uses. It is created here instead
    of by n8n so that row level security is on from the start.
- Row level security is enabled on both tables with no policies, so the public `anon` key can read
  nothing. n8n connects with the secret (service role) key and the database password, which
  bypass RLS. Chat transcripts contain names, phone numbers and emails, so this matters.
- Postgres credential: use the **Session pooler** details from the project's Connect dialog
  (host `aws-*-<region>.pooler.supabase.com`, port 5432, user `postgres.<project-ref>`, database
  `postgres`, SSL on). The direct `db.<ref>.supabase.co` host is IPv6-only on the free plan.

## Google files (created by a one-off n8n run so samuelgurru@gmail.com owns them)

Created 2026-10-01 by `workflows/00-setup.ts` (Support Bot Setup, run once, then archived). The
same run confirmed the Supabase tables, `match_documents`, pgvector 0.8.2 and RLS on both tables,
and that the Calendar credential can read the bookings calendar.

### Shop info doc
- Name: `Copperline Auto Repair: Shop Info`. Content: `knowledge/copperline-shop-info.md`.
- ID: `1By8r-Hifea1hwlsW_M7oAkfqtUtnteXsqffg7B6w1Ow`
- URL: https://docs.google.com/document/d/1By8r-Hifea1hwlsW_M7oAkfqtUtnteXsqffg7B6w1Ow/edit
- The owner edits this doc; Knowledge Sync re-indexes it within 5 minutes.

### Sheet: `Copperline Support Bot`
- ID: `1_RHqBp7k3rWBY-4plb2oo2mIryQlHIUuNOZ-YhCpVS8`
- URL: https://docs.google.com/spreadsheets/d/1_RHqBp7k3rWBY-4plb2oo2mIryQlHIUuNOZ-YhCpVS8/edit
- Header rows bold and frozen. Sheet IDs (gid): Conversations 0, Bookings 1, Tickets 2, Unanswered 3, Eval 4.
| Tab | Columns |
|-----|---------|
| `Conversations` | `timestamp, session_id, user_message, bot_reply, tools_used` |
| `Bookings` | `booking_ref, created_at, appointment_start, appointment_end, service, customer_name, phone, email, vehicle, notes, calendar_event_id, session_id, status` |
| `Tickets` | `ticket_ref, created_at, session_id, customer_name, contact, reason, summary, urgency, status` |
| `Unanswered` | `timestamp, session_id, question` |
| `Eval` | `id, category, question, expected_answer, expected_tools, actual_answer, actual_tools` (rows from `eval/test-questions.csv`) |

### Calendar
- A dedicated calendar, `Copperline Bookings`, in samuelgurru@gmail.com, timezone America/New_York.
  Its calendar ID goes in Config as `CALENDAR_ID`.
- Customers are **not** added as attendees, so Google never emails them; the workflow sends its own
  confirmation (which test mode can redirect).

## Config (a Set node in each workflow that needs it)

| Key | Default | Notes |
|-----|---------|-------|
| `TEST_MODE` | `true` | Customer emails go to `TEST_INBOX` with `[TEST to <real email>]` in the subject |
| `TEST_INBOX` | `oladelesamuel56@gmail.com` | |
| `OWNER_EMAIL` | `samuelgurru@gmail.com` | Hand-offs, weekly report |
| `SHOP_NAME` / `SHOP_PHONE` | `Copperline Auto Repair` / `(617) 555-0142` | |
| `TIMEZONE` | `America/New_York` | |
| `CALENDAR_ID` | `e535dd2bcfe011be160cf20a61416d5b25d758750392d5f3973e473dafe47b34@group.calendar.google.com` | Copperline Bookings |
| `BAYS` | `2` | Booked jobs that can overlap; the other bays are for walk-ins |
| `SLOT_STEP_MIN` | `30` | Start times on the hour and half hour |
| `BOOKING_HOURS` | Mon-Fri 08:00-18:00, Sat 08:00-14:00 | A job must finish by closing time |
| `HOLIDAYS` | `2026-11-26, 2026-12-25, 2027-01-01, 2027-05-31, 2027-07-05, 2027-09-06, 2027-11-25, 2027-12-25` | No bookings |
| `MIN_NOTICE_HOURS` | `2` | |
| `DAYS_AHEAD` | `14` | |
| `MAX_BOOKINGS_PER_SESSION` | `2` | Stops one chat from filling the calendar |
| `MAX_HANDOFFS_PER_SESSION` | `3` | Stops one chat from flooding the owner's inbox |
| `SERVICES` | see below | Key, label and duration in minutes |

`SERVICES`: `oil_change` Oil change 45, `tire_rotation` Tire rotation 30, `brakes` Brake service
120, `diagnostic` Diagnostic (check-engine light, noises, leaks) 60, `state_inspection`
Massachusetts state inspection 30, `ac_service` AC service 90, `alignment` Wheel alignment 60,
`battery` Battery test or replacement 30, `fluid_service` Fluid service 60, `pre_purchase`
Pre-purchase inspection 90, `other` Other repair (drop-off) 60.

## Workflows

| # | Workflow | Trigger |
|---|----------|---------|
| 0 | Lead Engine 0: Error Alerts (reused, already published) | Error Trigger |
| 1 | Support Bot 1: Knowledge Sync | Google Drive (doc updated, poll 5 min) + manual |
| 2 | Support Bot 2: Chat Agent | Chat Trigger (embedded website chat) + Evaluation Trigger |
| 3 | Support Bot 3: Check Availability | Called by workflow 2 (tool) and workflow 4 |
| 4 | Support Bot 4: Book Appointment | Called by workflow 2 (tool) |
| 5 | Support Bot 5: Hand Off to Staff | Called by workflow 2 (tool) |
| 6 | Support Bot 6: Weekly Report | Schedule, Mondays 08:00 America/New_York |
| 7 | Support Bot 7: Log Chat Turn | Called by workflow 2 without waiting (added during the build) |

### 1. Knowledge Sync
1. Google Drive Trigger on the shop info doc (file updated, poll every 5 minutes), plus a Manual
   Trigger for a full rebuild.
2. Download the doc as text (Markdown if the Drive node offers it).
3. **Guard:** if the text is under 500 characters, stop with an error instead of indexing it. An
   accidentally emptied doc must not wipe the bot's knowledge.
4. Insert into the Supabase vector store: Default Data Loader with metadata `file_id`,
   `file_name`, `version` (this run's timestamp); Recursive Character Text Splitter, about 1000
   characters with 80 overlap (was 1000/150; see build changes); OpenAI `text-embedding-3-small`.
5. Postgres: delete this file's chunks whose `version` is not this run's. Inserting first and
   deleting second means the bot never has an empty index, even if a step fails.

### 2. Chat Agent
1. **Chat Trigger**: public, Hosted Chat mode (the same URL serves the hosted page and the demo
   site's chat page), allowed origins `*` for now. Initial message: "Hi, I'm Copperline's assistant. I can answer questions about the
   shop, check times and book your car in. How can I help?"
2. **Normalize input**: `chatInput` trimmed and cut to 1000 characters, `sessionId`,
   `dry_run = false`, `source = chat`. The Evaluation Trigger path sets `dry_run = true`,
   `source = eval` and a fresh `sessionId` per row, then joins here.
3. **AI Agent**: OpenAI `gpt-5.4-mini`, reasoning effort low, system prompt in
   `prompts/system-prompt.md` (today's date and the next 14 days are filled in by expression),
   max 8 iterations, return intermediate steps.
   - Memory: Postgres Chat Memory, table `n8n_chat_histories`, key `sessionId`, last 12 messages.
   - Tools:
     - `search_shop_info`: Supabase Vector Store as a tool, top 6 chunks.
     - `check_availability` (workflow 3): `service`, `date_from`, `date_to`.
     - `book_appointment` (workflow 4): `service`, `start`, `customer_name`, `phone`, `email`,
       `vehicle`, `notes`.
     - `handoff_to_staff` (workflow 5): `customer_name`, `contact`, `reason`, `summary`, `urgency`.
     - `log_unanswered_question`: Google Sheets tool, appends to `Unanswered`.
   - `session_id` and `dry_run` are passed to every tool by expression, never by the model.
4. **Reply without waiting on the log**: the turn is handed to workflow 7 with "wait for
   sub-workflow" off, then the reply goes back (Chat Trigger in Hosted Chat mode, response mode
   "last node"). Chat turns only; eval runs skip it.
5. **Fallback**: if the agent errors, reply "Sorry, I'm having trouble right now. Please call us on
   (617) 555-0142." The error still reaches workflow 0.
6. **Evaluation** (same workflow): Evaluation Trigger reads the `Eval` tab; Set Outputs writes
   `actual_answer` and `actual_tools`; metrics are Correctness (AI-judged by `gpt-5.4` against
   `expected_answer`) and Tools Used (against `expected_tools`).

### 3. Check Availability
1. Inputs: `service`, `date_from`, `date_to` (optional, at most 7 days after `date_from`),
   `dry_run`.
2. Look up the service's duration; unknown keys fall back to `other`.
3. Google Calendar: get events in the window on `CALENDAR_ID`.
4. Code: candidate starts every `SLOT_STEP_MIN` inside `BOOKING_HOURS`, skipping `HOLIDAYS`, times
   before now + `MIN_NOTICE_HOURS`, beyond `DAYS_AHEAD`, and any start where `BAYS` events already
   overlap the job.
5. Return up to 3 starts per day (morning, midday, afternoon) for up to 4 days, each with an ISO
   time and a label ("Tue Oct 6, 10:30 am"), or a message saying nothing is free in that range.

### 4. Book Appointment
1. Inputs: the tool fields plus `session_id` and `dry_run`.
2. Validate: email format, phone has at least 10 digits, name and vehicle present, `start` in the
   future. Return a clear error to the agent if not.
3. Session limit: count `Bookings` rows with this `session_id`; refuse after
   `MAX_BOOKINGS_PER_SESSION`.
4. Re-check the slot by calling workflow 3 for that day; refuse if `start` is no longer free.
5. `dry_run`: return success with ref `DRYRUN-xxxxx` and stop here.
6. Create the calendar event: title `<Service>: <name> (<vehicle>)`, description with phone,
   email, notes, booking ref and session ID.
7. Append to `Bookings` (`status = booked`).
8. Gmail confirmation from a **fixed template** (no AI-written text), so the chat can't be used to
   send arbitrary emails. Test mode redirects it.
9. Return `success`, `booking_ref` (`CA-` plus 5 characters) and the time label.

### 5. Hand Off to Staff
1. Inputs: the tool fields plus `session_id` and `dry_run`.
2. Session limit: refuse after `MAX_HANDOFFS_PER_SESSION` tickets for this session.
3. `dry_run`: return a `DRYRUN` ticket ref and stop.
4. Append to `Tickets` (`status = open`).
5. Postgres: read this session's transcript from `n8n_chat_histories`.
6. Email `OWNER_EMAIL`: subject `[Copperline chat] <reason>: <name>`, with the summary, contact
   details, urgency and the full transcript.
7. Return the ticket ref (`T-` plus 5 characters).

### 6. Weekly Report
1. Mondays 08:00 America/New_York.
2. Read the four log tabs and keep the last 7 days, ignoring session IDs that start with `eval-`
   (the eval run can write to `Unanswered`).
3. Totals: conversations (distinct sessions), messages, bookings by service, hand-offs by reason.
4. `gpt-5.4-mini` groups the unanswered questions into themes, with counts and a suggested line
   to add to the shop info doc for each.
5. HTML email to `OWNER_EMAIL`.

## Safety and limits

- The agent only answers shop and car-service questions from `search_shop_info`, never guesses a
  price, and never diagnoses or estimates a repair; it offers a diagnostic instead.
- Danger signs (failing brakes, overheating, smoke, fuel smell, flashing check-engine light,
  steering failure) get a "don't drive it, call the tow line or 911" reply before anything else.
- Prompt injection: tools can only book within the calendar rules, email the owner, or send a
  fixed-template confirmation, and per-session limits cap all of them. Messages are cut to 1000
  characters and the agent stops after 8 iterations.
- Retries: Sheets, Gmail, Calendar and Postgres nodes retry 3 times with a 5 s wait in background
  paths. In the chat path the model retries twice with a 2 s wait, so a customer isn't left waiting.
- Error workflow: every workflow names workflow 0. The weekly report and hand-off emails go to the
  same inbox as the alerts.
- Sticky notes explain each section, for the portfolio screenshots.

## Demo site

Two static pages in `site/`, served with `python3 -m http.server 8080`. Because n8n is local, the
chat only works on this machine; record a video for the portfolio.

- `index.html`: a one-page Copperline landing page, marked as a demo of a fictional business. Its
  "Chat with us" and "Chat or book now" buttons open the chat page.
- `chat.html`: the chat front end, a full-page app with no build step and no libraries
  (`chat/app.css`, `chat/app.js`, `chat/emoji.js`). It posts `{ action: 'sendMessage', sessionId,
  chatInput }` to the Chat Trigger URL set in the page's `window.COPPERLINE` config and reads
  `output` from the reply. The conversation and session ID live in `localStorage`.

What the chat page does, and where each idea came from (research on 2026-10-01):

| Feature | Pattern it follows |
|---------|--------------------|
| Welcome screen with four starter cards and "Or try" chips, so nobody faces an empty box | Suggested prompts and capability cards (ChatGPT, Claude, Notion AI) |
| While waiting, a checklist of stages ("Reading your message", "Checking Copperline's info") and a rev counter that revs | Multi-stage progress for waits over 5 s (Copilot, Hyatt) |
| Reply words fade in one after another | Streaming as reassurance; the full text is in the page at once for screen readers |
| Drop-off times from `check_availability` become a card of tappable times, grouped by day | Generative UI and structured choices (Klarna, Drift) |
| Booking reference (`CA-XXXXX`) shows a claim-ticket card; hand-off ticket (`T-XXXXX`) a "Passed to our team" card | Confirmation cards (Calendly) |
| Tow line in a reply shows a red one-tap call card | Safety first, from the system prompt |
| Emoji picker with search, categories (including Car and road), recently used and keyboard support; `:shortcode` suggestions while typing; big emoji when a message is only emoji | Emoji in chat (Cleo, Bloom) |
| Copy and emoji reactions on replies (stored in the browser only) | Message actions (Mailchimp, Webflow) |
| A failed message stays in the thread marked "Not sent" with Try again and the shop's number | Recovery path before the happy path |
| Sidebar: live open/closed status from the hours in Boston time, today's hours, phone and tow line, and "In this chat" links to booking and ticket references | Context drawer |
| Light and dark themes (follows the device, toggle in the header), drawer sidebar on phones, reduced-motion support | |

The page's signature is the instrument cluster: the rev-counter emblem sweeps its needle on load,
like a dashboard at ignition.

## Build order

1. Supabase setup, Calendar credential and calendar, Google Doc and Sheet.
2. Workflow 1, then check the chunks in Supabase.
3. Workflow 2 with only `search_shop_info` and memory; run the eval on the knowledge and safety
   rows.
4. Workflow 5, then workflows 3 and 4; run the full eval.
5. Logging, fallback, workflow 6.
6. Demo site, test-mode run of a full booking and a hand-off, publish.

## Later

- Change or cancel a booking by reference and email (for now this is a hand-off).
- WhatsApp as a second channel into the same agent.
- Hosted n8n or a tunnel so prospects can try the live chat.

## Decisions (2026-10-01)
- Business: a fictional mechanic shop (user chose it over a dental clinic). Name Copperline Auto
  Repair, 84 Foundry Lane, Allston, MA 02134; phone numbers use the reserved 555-01xx range; email
  uses the `.example` domain. If asked, the bot says the shop is fictional.
- Channel: website chat first.
- Storage: Supabase (free) for vectors and chat memory. Calendar: Google Calendar on
  samuelgurru@gmail.com. The user agreed to set up both.
- AI: OpenAI, as in project 1. `gpt-5.4-mini` for the agent and report, `gpt-5.4` as the eval
  judge, `text-embedding-3-small` for embeddings.
- Build: Claude Code creates the workflows in n8n through the MCP server.

## Changes during the build (2026-10-01)
- **Chat reply path.** n8n's Chat reply node only works with Hosted Chat, and it then waits for the
  customer's next message inside the same execution, which would swallow that message. The trigger
  now uses Hosted Chat with response mode "last node" and ends on a Set node (`Final Reply`).
- **Background logging (workflow 7).** Each Google Sheets append took 5 to 10 s from this machine,
  which made replies take up to 25 s. The Conversations write moved to workflow 7, called without
  waiting; the other appends use the faster "use append" option.
- **Sheet tabs by numeric ID.** The Sheets node rejects `gid=1` in list mode; tabs are referenced
  by ID (`0` Conversations, `1` Bookings, `2` Tickets, `3` Unanswered, `4` Eval).
- **Sub-workflows must be published.** In n8n 2.x a published workflow can only call published
  sub-workflows ("Workflow is not active"), so workflows 3, 4, 5 and 7 are published, and every
  change needs a re-publish.
- **Smaller chunks.** With 1000-character chunks, "motorcycles" sat in a chunk with two other
  sections and wasn't retrieved. 500/80 chunks (28 in total) fixed it; top K went from 5 to 6.
- **Prompt.** Vehicle and service questions are in scope even when the answer is no; the bot
  speaks for the shop as "we".
- **Doc import.** Google's Markdown export escapes symbols (`\$99.99`); Knowledge Sync strips the
  backslashes before indexing.
- **Chat front end.** The stock `@n8n/chat` widget only takes colour overrides. It was first
  replaced by a custom floating widget, then, the same day and at the user's request, by the
  full-page chat at `site/chat.html`. The widget files were removed and the landing page now links to
  the chat page. Both were built in a Playwright screenshot loop against a mocked webhook, then tested
  live through the real Chat Trigger. The last live test sent "Do you have loaner cars? 🚗" (typed as
  `:car`) and got the right answer in 13.8 s (session `check-desk-live`).
- **Hosting on Vercel (2026-10-01).** `site/` is deployed as Vercel project `copperline-auto-repair`
  (https://copperline-auto-repair.vercel.app). A public HTTPS page can't call `http://localhost:5678`
  (Chrome blocks it as local network access, and for visitors localhost is their own computer), so
  the hosted page posts to a same-origin function, `site/api/chat.js`, which forwards only chat
  messages to `N8N_CHAT_URL`. That env var points at a Cloudflare quick tunnel to n8n on the Mac,
  chosen by the user over ngrok or moving n8n to the cloud. The tunnel address changes on each start,
  so `hosting/start-tunnel.sh` opens the tunnel, updates the env var, redeploys and keeps the Mac
  awake. Tested live: "Do you work on hybrids? ⚡" answered in 12.3 s through Vercel and the tunnel.
