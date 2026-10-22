# Phone Receptionist

An AI receptionist that answers the phone for **Fernhollow Dental**, a fictional family dental clinic
in Austin, Texas. "Nora" answers questions about the clinic, books, moves and cancels appointments
in the clinic's Google Calendar, sends emergencies to 911 or the first emergency slot, takes messages
for staff, and every call is logged with a summary and recording.

Portfolio project 5. Vapi runs the voice (speech-to-text, GPT-5.4 mini, the Clara voice); n8n holds
all the clinic's rules as tool webhooks. Decisions and details are in [SPEC.md](SPEC.md).

## How it works

```
Caller ──phone or browser──> Vapi (Deepgram nova-3 → GPT-5.4 mini → Clara voice)
                               │ tool calls (x-fernhollow-key header)
                               ▼
              1 Vapi Tools ──> 2 Run Tool ──> Google Calendar "Fernhollow Dental (demo)"
              check_availability · book · find · cancel · reschedule · take_message
                                                  └──> Telegram alert + 4 Log Row (Messages tab)
                               │ end-of-call report
                               ▼
              3 Call Events ──> Calls tab (summary, outcome, recording, cost) ──> Telegram if follow-up
              5 Daily Summary (weekdays 5:30 pm) ──> Telegram
```

| # | Workflow | ID | Trigger | Status |
|---|----------|----|---------|--------|
| 0a | Receptionist 0a: Setup | `rcpFernSetup0a00` | Manual, once | Built; stopped at Google (credential needs reconnecting) |
| 0b | Receptionist 0b: Vapi Assistant | `rcpFernVapi0b000` | Manual | Built; needs the `Vapi API` credential and `public_base_url` |
| 1 | Receptionist 1: Vapi Tools | `rcpFernTools0100` | Webhook `POST /webhook/fernhollow/tools` | Built, not published |
| 2 | Receptionist 2: Run Tool | `rcpFernRunTool02` | Sub-workflow | Built, not published |
| 3 | Receptionist 3: Call Events | `rcpFernEvents030` | Webhook `POST /webhook/fernhollow/events` | Built, not published |
| 4 | Receptionist 4: Log Row | `pL4bVosX1Dga62wJ` | Sub-workflow | Built, not published |
| 5 | Receptionist 5: Daily Summary | `rcpFernDaily0500` | Weekdays 17:30 America/Chicago + manual | Built, not published |

Settings live in the n8n data table **Receptionist Settings** (`qh2lP825xnkmt4z2`). Errors go to
Social Autopilot 0: Error Alerts (Telegram).

## Tested so far (2026-10-21)

- `workflows/test/logic.test.js`: 24 checks on the scheduling code with a fake calendar: secret
  check, opening hours, lunch, 60-minute slots not starting at 4:30, closed weekends falling through
  to Monday, double-booking refused, booking validation, finding appointments by phone or a spoken
  code ("seven K two Q"), cancel and reschedule (a move ignores the appointment itself), messages.
- Not yet run live: Google Calendar and Sheets calls (credentials expired), and Vapi.

## Setup still to do

1. **Google:** in n8n, reconnect *Google Calendar account* and *Google Sheets account*. (Publish the
   Google Cloud OAuth consent screen to *In production* so they stop expiring every 7 days.)
2. **Telegram:** send `/start` to the Social Autopilot bot so staff alerts have a chat.
3. Claude runs **0a Setup** (calendar, Front Desk sheet, secret).
4. **ngrok:** `brew install ngrok`, `ngrok config add-authtoken <token>`, put
   `NGROK_DOMAIN=...` in `hosting/.env`, run `hosting/start-public.sh` (restarts n8n with the public
   address; reconnect Claude's n8n MCP with `/mcp` afterwards).
5. **Vapi:** create the n8n credential **Vapi API** (Header Auth, `Authorization` = `Bearer <private key>`).
6. Claude sets `public_base_url`, runs **0b** (creates the assistant and a free 512 number),
   publishes 4, 2, 1, 3 and 5, and tests with Vapi's chat API, then a browser call.
