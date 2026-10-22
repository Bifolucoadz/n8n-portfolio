# Call to CRM: build spec

Portfolio project 8. A sales-call autopilot for **Tidewater Software**, a fictional company that builds
custom software. A rep uploads a call recording for a deal. The system transcribes it, works out who
said what, and extracts the summary, BANT, objections, competitors, next steps, a deal-stage
recommendation and a follow-up email draft. Safe updates go straight into the CRM; risky ones and the
email wait on a review page.

Everything is invented: Tidewater, the prospects (Calloway Dental Group, Pemberton Freight, Ostara Home
Care), their people and emails (.example domains). The three demo calls are voiced with OpenAI
text-to-speech from scripts in `workflows/code/lib-calls.js`.

## Decisions (2026-10-21)

- Standalone project (one of four new portfolio projects the user asked for).
- CRM: HubSpot is the target (deal stages from HubSpot's default pipeline). No HubSpot account yet, so
  test mode uses data tables shaped like HubSpot objects; the live path calls the HubSpot CRM v3 API
  with a private-app token (credential "HubSpot account", nodes disabled until it exists).
- Intake: an n8n form (`/form/tidewater-call`) where the rep picks the deal and uploads the recording
  (MP3, M4A, WAV, WEBM, MP4, up to 25 MB, the OpenAI limit). The page waits about a minute and shows the
  result. A Drive-folder intake was left out (Google credentials had expired).
- Transcription: `gpt-4o-transcribe` with a vocabulary prompt (CRM names plus `vocabulary` in Settings).
  `gpt-4o-transcribe-diarize` was tried first: on the demo recordings it put the whole call under one
  speaker and took about 100 seconds, so speakers are now split by `gpt-5.4-mini` from the transcript
  (word for word), and code checks the split covers at least 95% of the words in order, otherwise it uses
  the plain transcript. Talk time is counted in words.
- Analysis: `gpt-5.4`, strict JSON schema (prompts/call-analysis.json).
- Rules in code (Decide), not AI:
  - every quote behind a change is checked against the transcript;
  - the call note and the rep's own tasks are always added;
  - a stage moves by itself only one step forward with medium/high confidence and a verified quote;
    closed won/lost, skipped stages, backward moves and unverified quotes wait;
  - amount and close date fill empty fields; changing an existing amount by more than `amount_change_pct`
    (20%) or an existing close date waits;
  - the follow-up email always waits.
- Review page: `/webhook/tidewater/review?call=…&t=…` (private token per call); the rep ticks the waiting
  changes, edits the email and sends. A call can be reviewed once.
- Email: Gmail in live mode, the Tidewater Outbox table in test mode.

## Data tables

| Table | ID | Columns |
|-------|----|---------|
| Tidewater Deals | 6fad2EyLoty9oElv | deal_id, name, company_id, stage, amount, close_date, owner, next_step, updated_at |
| Tidewater Companies | h1O24r8zgxQeqODi | company_id, name, domain, industry, size |
| Tidewater Contacts | 0jlx2ckch1Gj6Qtr | contact_id, company_id, name, email, title |
| Tidewater Activity | VUrS7HRsgmNpXROv | activity_id, deal_id, kind (call, task, email, note, meeting), title, body, owner, due, status, source, created_at |
| Tidewater Calls | 0hHsTxLEuk6Su6C7 | call_id, deal_id, rep, filename, duration_s, transcript_json, analysis_json, applied_json, pending_json, email_to, email_subject, email_body, status, token, created_at, reviewed_at, process_ms |
| Tidewater Outbox | VGQHvXZw7QIaNJgY | to, subject, body, kind, call_id, at |
| Tidewater Settings | IFuurjqqfST0GLCi | key, value (mode, company, base_url, rep_name, rep_email, amount_change_pct, default_task_days, vocabulary, hubspot_pipeline) |

## Workflows

| # | Name | ID | Trigger |
|---|------|----|---------|
| 1 | Upload Call | tdwUploadCall001 | Form `/form/tidewater-call` |
| 2 | Process Call | tdwProcessCall02 | Called by 1 (passthrough, with the recording) |
| 3 | CRM | tdwCrmAdapter003 | Called (get_deal, update_deal, add_note, create_task) |
| 4 | Review Page | tdwReviewPage004 | Webhooks GET/POST `tidewater/review` |
| 5 | Send Email | tdwSendEmail0005 | Called |
| 6 | Reset Demo | tdwResetDemo0006 | Manual |
| 7 | Make Demo Calls | tdwMakeCalls0007 | Manual (OpenAI TTS → `~/.n8n-files/tidewater/*.wav`) |

## Build changes (2026-10-21)

- Demo calls were first MP3s joined back to back; diarisation couldn't separate speakers. They are now WAV
  with short pauses between speakers (still one speaker from diarisation, hence the LLM split above).
- The n8n SDK parser treats an apostrophe in a `//` comment in workflow code as the start of a string;
  removed it ("The rep's decision").
- The transcriber heard "McCloud" for McLeod; fixed with the vocabulary prompt.
- Tasks for events ("pencil in a kickoff for November 10") were given the event date as due date; the
  prompt now says due is when the action must be done.
- n8n shows a form's completion HTML as the whole page, so result pages carry their own styling.
- Due dates show as "Fri, Oct 23" on the result and review pages instead of 2026-10-23.
