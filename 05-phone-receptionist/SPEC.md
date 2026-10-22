# Phone Receptionist: build spec

Portfolio project 5. An AI phone receptionist for **Fernhollow Dental**, a fictional family dental
clinic in Austin, Texas. It answers calls 24/7, answers questions about the clinic, books, moves and
cancels appointments in the clinic's calendar, handles dental emergencies safely, takes messages for
staff, and logs every call with a summary.

Everything is invented: clinic, address, phone numbers, dentists and prices.

## Decisions (2026-10-21)

- Voice platform: **Vapi** (user's pick). Vapi does speech-to-text, the model turn and the voice;
  n8n holds the clinic's rules and data as tool webhooks. The same tools serve phone calls, browser
  calls and Vapi's text chat API (used for testing).
- Public address: a free **ngrok static domain** in front of n8n on the Mac (user's pick), started by
  `hosting/start-public.sh` at the portfolio root, shared with project 6. Works while the Mac is awake.
- Model: `gpt-5.4-mini` through Vapi (billed from Vapi credit), reasoning effort `low` (to be tuned
  for latency once live calls are timed). Voice: a Vapi built-in voice. Transcriber: Deepgram `nova-3`, `en-US`, with key terms
  (Fernhollow, Invisalign, the dentists' names).
- Calendar: a dedicated Google Calendar on samuelgurru (its Calendar credential still works).
  Appointments are calendar events; the description holds the confirmation code and caller details.
- Call log and messages: a Google Sheet, written after the call or in the background, never on the
  voice path (Sheets appends take 5-10 s from this Mac).
- Staff alerts: Telegram (existing bot, outbound only). No Gmail (samuelgurru is restricted), no SMS
  (no Twilio account).
- Security: Vapi sends a secret header (`x-fernhollow-key`) with every tool and event request. Setup
  generates it and stores it in the n8n data table; the webhooks reject requests without it.
- Logic in code, not in the model: free slots, opening hours, notice periods and double-booking checks
  are computed in n8n. The model only chooses which tool to call and what to say.

## Clinic facts (fictional, in the prompt)

| | |
|---|---|
| Name | Fernhollow Dental, family and cosmetic dentistry |
| Address | 4180 Oakridge Parkway, Suite 200, Austin, TX 78745 |
| Phone | (512) 555-0148 |
| Hours | Mon-Thu 8:00 am-5:00 pm, Fri 8:00 am-2:00 pm, closed weekends; lunch 12:00-1:00 pm |
| Dentists | Dr. Maya Chen (general and family), Dr. Luis Ortega (cosmetic, Invisalign) |
| Insurance | Delta Dental, Cigna, Aetna, MetLife, Guardian (PPO plans). No Medicaid/CHIP. |
| Self-pay | New patient exam with X-rays $129, cleaning $95, emergency exam $79, whitening consultation free |
| Policies | Arrive 15 minutes early, bring photo ID and insurance card, 24 hours' notice to cancel |

## Appointment types

| Key | Label | Minutes | Notes |
|-----|-------|---------|-------|
| `new_patient` | New patient exam and X-rays | 60 | |
| `cleaning` | Cleaning and check-up | 60 | existing patients |
| `emergency` | Emergency exam (tooth pain, broken tooth) | 30 | same day allowed, 1 hour notice |
| `consultation` | Cosmetic or Invisalign consultation | 30 | Dr. Ortega |

Bookable up to 30 days ahead, 2 hours' notice (1 hour for emergencies), start times every 30 minutes,
one chair per type of appointment is not modelled: one appointment at a time (the demo calendar).

## Tools (Vapi function tools → n8n)

| Tool | Arguments | Does |
|------|-----------|------|
| `check_availability` | `appointment_type`, `date_from`, `date_to`, `time_of_day` | Free start times, spread across the days, as speakable text plus exact `start` values |
| `book_appointment` | `appointment_type`, `start`, `patient_name`, `phone`, `is_new_patient`, `insurance`, `reason` | Re-checks the slot, creates the event, returns a confirmation code `FD-XXXX` |
| `find_appointment` | `phone` or `confirmation_code` | Upcoming appointments for that caller |
| `cancel_appointment` | `confirmation_code`, `reason` | Deletes the event (24-hour policy is mentioned, not enforced) |
| `reschedule_appointment` | `confirmation_code`, `new_start` | Re-checks the new slot and moves the event |
| `take_message` | `caller_name`, `phone`, `message`, `urgent` | Telegram alert to staff now, row in the Messages tab in the background |

Plus Vapi's built-in `endCall` tool.

Emergencies: trouble breathing or swallowing, swelling spreading to the eye or neck, uncontrolled
bleeding, or a head injury → the receptionist tells the caller to call 911 now and does not book.
Severe tooth pain, a broken or knocked-out tooth → offer the first emergency slot today and the
standard first-aid line for a knocked-out tooth (keep it moist in milk, come in within the hour).

## Workflows

| # | Workflow | Trigger |
|---|----------|---------|
| 0 | Receptionist 0: Setup | Manual: calendar, sheet, secret, Vapi assistant (create or update), free phone number |
| 1 | Receptionist 1: Vapi Tools | Webhook `POST /webhook/fernhollow/tools` |
| 2 | Receptionist 2: Run Tool | Sub-workflow, once per tool call |
| 3 | Receptionist 3: Call Events | Webhook `POST /webhook/fernhollow/events` (end-of-call reports) |
| 4 | Receptionist 4: Log Row | Sub-workflow, background Sheet append |
| 5 | Receptionist 5: Daily Summary | Weekdays 17:30 America/Chicago + manual |

Errors go to **Social Autopilot 0: Error Alerts** (Telegram).

### 1. Vapi Tools
Webhook (response node) → check the secret → unpack `message.toolCallList` (one item per call, with
the caller's number from `message.call.customer.number`) → MedInfo-style sub-workflow call per item →
pack `{ results: [{ toolCallId, result }] }` → respond 200. `result` is always a flat string (Vapi's
rule). A wrong secret gets a 401 and nothing runs.

### 2. Run Tool
Config (hours, types, time zone, calendar ID) → Switch on the tool name → one branch per tool. Every
branch ends in a `{ toolCallId, result }` item. Calendar reads use `singleEvents` and the day window;
writes re-check the exact slot first. Failures return a spoken fallback ("I couldn't reach the
calendar, I'll take a message instead") rather than an error.

### 3. Call Events
Responds 200 at once. For `end-of-call-report`: caller number, start/end, duration, ended reason,
cost, Vapi's summary, structured data (`outcome`, `appointment_type`, `confirmation_code`,
`follow_up_needed`, `caller_name`), recording URL → Calls tab. `follow_up_needed` → Telegram.

### 5. Daily Summary
Today's rows from the Calls and Messages tabs plus tomorrow's appointments from the calendar →
calls, bookings, cancellations, open messages, average call length and cost → Telegram.

## Data

- Google Calendar **Fernhollow Dental (demo)**.
- Google Sheet **Fernhollow Dental Front Desk**: `Calls` (call_id, started_at, caller, duration_s,
  outcome, appointment, confirmation_code, summary, follow_up, recording_url, ended_reason, cost_usd),
  `Messages` (at, caller_name, phone, message, urgent, status).
- n8n data table **Receptionist Settings** (key, value): `webhook_secret`, `calendar_id`,
  `sheet_id`, `assistant_id`, `phone_number_id`, `public_base_url`, `staff_chat_id`.

## Testing

- Tool webhooks: simulated Vapi `tool-calls` payloads posted to the local webhook (no Vapi needed).
- End to end: Vapi chat API (`POST /chat` with the assistant ID) runs scripted conversations that hit
  the tools through ngrok; then a browser call from the Vapi dashboard or the demo page.

## Build notes (2026-10-21)

- Workflows are built from `workflows/src/*.ts` (`python3 workflows/build.py`), checked with the n8n
  SDK and imported with `node workflows/deploy.js <file>` (fixed IDs, MCP access on, clinic time
  zone, error workflow). The shared scheduling code is `workflows/code/lib-slots.js`, included into
  each Code node at build time.
- Setup stopped at the first Google call: the samuelgurru Google credentials expire after 7 days
  while the OAuth app is in Testing mode, and Social Autopilot never recorded a Telegram chat.
