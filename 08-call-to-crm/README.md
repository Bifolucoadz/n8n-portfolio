# Call to CRM (Tidewater Software)

A rep uploads a sales call recording. About a minute later the CRM has a call note (summary, BANT,
objections, competitors, next steps, risks, talk time), tasks for everything the rep promised, and any
safe deal updates. Changes that need judgement (closing a deal, big amount changes, skipping a stage)
and the follow-up email wait on a review page, where the rep ticks, edits and sends.

Demo for a fictional software company and three fictional prospects. Decisions are in [SPEC.md](SPEC.md).

## Links (n8n on this Mac)

- Upload form: http://localhost:5678/form/tidewater-call
- Review page: linked from the form result and the rep's email (`/webhook/tidewater/review?call=…&t=…`)

## Workflows

| # | Workflow | ID | What it does |
|---|----------|----|--------------|
| 1 | Upload Call | tdwUploadCall001 | Rep's form: deal, recording, notes. Shows the result. Published. |
| 2 | Process Call | tdwProcessCall02 | Transcribe → split speakers → analyse (GPT-5.4) → rules → CRM updates → save call → email the rep. Published. |
| 3 | CRM | tdwCrmAdapter003 | Deals, notes and tasks in HubSpot (live, nodes off until the credential exists) or the Tidewater tables (test). Published. |
| 4 | Review Page | tdwReviewPage004 | The rep's review page and the endpoint that applies approved changes and sends the email. Published. |
| 5 | Send Email | tdwSendEmail0005 | Gmail (live) or the Outbox table (test). Published. |
| 6 | Reset Demo | tdwResetDemo0006 | Puts the three demo deals back to where they start. Manual. |
| 7 | Make Demo Calls | tdwMakeCalls0007 | Voices the three scripted calls with OpenAI TTS into WAV files. Manual. |

## Running the demo

1. Run **Tidewater 6: Reset Demo**.
2. `python3 workflows/test/upload.py` uploads the three sample calls in `samples/` through the real form
   (or `upload.py calloway`), printing each review link.
3. Open a review link, tick or untick the waiting changes, edit the email, **Approve and send**.

## Status (2026-10-21)

Tested in test mode through the real form and review page:

| Test | Result |
|------|--------|
| Calloway Dental (discovery, 2:49) | All four BANT items found. $40,000 budget filled the empty amount (quote verified). Tasks for the case study and proposal outline due Friday. In one run the model proposed jumping to "presentation scheduled", skipping "qualified", so it waited for review; in another it proposed "qualified to buy", one step, which was applied with its quote. Processed in 39-81 s. |
| Pemberton Freight (demo follow-up, 2:26) | McLeod integration and the SOC 2 review captured as objections; the CFO's "closer to $50k" kept as an objection, not a deal change; Freightlink Labs logged as a competitor; 2 tasks due Thursday. 52-62 s. |
| Ostara Home Care (contract call, 1:39) | Pilot, discount and retention-clause asks captured; not marked closed won (nothing signed); 3 tasks. 38-47 s. |
| Speakers | Split into turns for all three; talk time 45-51% for the rep. |
| Review page | Approving the waiting stage change moved Calloway to "presentation scheduled", logged the email on the deal and sent it to the Outbox; the page then shows the review as done. |

Not tested live: HubSpot (no account), Gmail (credential expired).

## Going live

1. In HubSpot, create a private app with CRM deals/contacts/companies read and write scopes; in n8n
   create a **HubSpot account** credential (HubSpot App Token) and enable the HubSpot nodes in Tidewater 3.
2. Reconnect **Gmail account 2** in n8n.
3. In **Tidewater Settings**: `mode` = `live`, `rep_email`, `base_url` (public address for review links),
   `vocabulary` (product and competitor names), `hubspot_pipeline`.
4. Put the real deals in the form's dropdown (or switch it to a deal ID field).

## Files

- `prompts/`: call analyst and speaker split instructions with their JSON schemas.
- `site/review.html`: the review page (filled by Tidewater 4).
- `samples/*.wav`: the three demo calls (made by Tidewater 7).
- `workflows/src/*.ts` + `workflows/code/*.js` → `python3 workflows/build.py` → `workflows/*.ts`;
  `node workflows/deploy.js workflows/<file>.ts` validates and imports (IDs in `workflows/deploy.json`).
- `workflows/test/upload.py`: uploads the sample calls through the form.
