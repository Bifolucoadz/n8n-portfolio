# Lead Generation Engine

Finds local businesses on Google Maps, scores them with OpenAI, keeps them in a Google Sheet,
emails them in a three-step sequence and stops the moment someone replies.

Built in n8n 2.30 as four workflows that share one Google Sheet, plus a manual repair utility.

| # | Workflow | Trigger | What it does |
|---|----------|---------|--------------|
| 0 | Lead Engine 0: Error Alerts | Error Trigger | Emails the failed workflow, node, error and execution link. Published. |
| 1 | Lead Engine 1: Lead Scraper | Form (business type, area, max places) | Apify Google Maps scrape → skip places already in the sheet → OpenAI GPT-5.4 mini scores fit 1-10 and writes a personal opener → append rows → summary email. |
| 2 | Lead Engine 2: Outreach and Follow-ups | Weekdays, hourly 9:00-17:00 (Africa/Lagos) | Picks due follow-ups, then the best new leads, within a daily cap → OpenAI GPT-5.4 writes the email for the step → Gmail sends (follow-ups as replies in the same thread) → sheet updated → 30-90 s pause. |
| 3 | Lead Engine 3: Reply Detector | Gmail, every 5 min | Matches inbox messages to leads by thread or sender → bounces and "stop" by rule, the rest classified by OpenAI GPT-5.4 mini → sheet updated → alert email for interested replies. |
| 4 | Lead Engine 4: Rescore Unscored Leads | Manual | Scores sheet rows left with an empty `lead_score` (when the AI step failed during a scrape) and writes the score, reason and opener back. |

`workflows/json/` holds importable exports. `workflows/*.ts` holds the n8n Workflow SDK source each
workflow was first created from (layout changes since then are only in the JSON).

## Lead lifecycle

```
new / no_email ──(email 1)──> contacted ──(email 2, day 3)──> contacted ──(email 3, day 7)──> finished
                                  │
                                  ├─ reply: interested / not_interested / other ──> replied
                                  ├─ reply: "stop" or unsubscribe ───────────────> unsubscribed
                                  ├─ bounce ──────────────────────────────────────> bounced
                                  └─ out-of-office ──> status unchanged, sequence carries on
```

## Reliability and safety

- **Test mode** (`TEST_MODE = true` in Outreach Config): every email goes to `TEST_INBOX` with
  `[TEST to real@address]` in the subject.
- **Sending limits:** `MAX_PER_RUN` (3) per hourly run and `DAILY_SEND_CAP` (20) per day, with a
  random pause between sends. An address already in a sequence is never started twice.
- **Opt-out:** the sign-off and "Reply 'stop' and I won't email again." are appended by the
  workflow, not written by the AI, so they are always present. "Stop" replies are caught by a rule
  before any AI call.
- **AI failures do not lose data:** an unscored lead is still saved (and never emailed); an
  unclassifiable reply is filed as `other`, which still ends the sequence.
- **Retries:** HTTP, Gmail, Sheets and AI nodes retry 3 times with a 5 s wait.
- **Error alerts:** workflows 1-3 name workflow 0 as their error workflow (production runs only).
- **Privacy:** only messages that match a lead are sent to the AI.

## Accounts

Everything runs on **samuelgurru@gmail.com**: the n8n Gmail and Sheets credentials, the lead sheet,
the run summaries, the interested-reply alerts and the error alerts.

The one exception is `TEST_INBOX` (oladelesamuel56@gmail.com), which plays the part of the lead in
test mode. It has to be a different mailbox from the sender: Gmail drops your own address when
replying, so follow-ups to yourself would have no recipient, and the Reply Detector ignores mail
from the sending account, so you could not test replies.

## Setup status (2026-10-01)

| Item | Status |
|------|--------|
| Apify, Google Sheets, Gmail credentials | Attached to every node. Sheets and Gmail are signed in as samuelgurru@gmail.com. |
| Lead sheet | [Lead Generation Engine](https://docs.google.com/spreadsheets/d/1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k/edit), tab `Leads`, owned by samuelgurru@gmail.com. Live read from n8n verified. |
| AI provider | OpenAI (switched from Anthropic on 2026-10-01): `gpt-5.4-mini` for scoring and reply sorting, `gpt-5.4` for emails. Credential `OpenAI account` attached; both model IDs confirmed on the account. |
| Logic tests | Passed with simulated data for workflows 1-3. |
| Live runs | **Scraper:** 10 dental clinics in Boston. Apify fields match, 7 of 10 had an email. Scoring failed on that run (parser schema bug, now fixed) and the rows were saved unscored as designed; workflow 4 then scored all 10 live. **Outreach and replies:** not run live yet. |
| Published | Workflows 0 and 1. Publish 2 and 3 after their test-mode run. |

## Test plan

1. Create an OpenAI credential in n8n and attach it to the model node in workflows 1, 2 and 3.
2. **Scraper:** open workflow 1, click *Execute workflow*, fill the form with a small run
   (e.g. 5 places). Check the sheet rows and the summary email in samuelgurru@gmail.com.
3. **Outreach:** in workflow 2 set `FOLLOWUP_DAYS` to `[0, 0]` for the test so follow-ups are
   due straight away, then run it manually three times. You should get emails 1, 2 and 3 in
   oladelesamuel56@gmail.com, all in one thread. Put `FOLLOWUP_DAYS` back to `[3, 7]`.
4. **Replies:** reply to one test thread from oladelesamuel56@gmail.com ("Sounds good, what does it
   cost?") and run workflow 3. The row should become `replied / interested` and an alert should
   arrive in samuelgurru@gmail.com. Reply "stop" on another thread to check `unsubscribed`.
5. Reset the test rows (status back to `new`, clear `emails_sent` through `replied_at`).

## Going live

1. Set `TEST_MODE` to `false` in workflow 2.
2. Set the workflow 2 timezone to where the leads are (workflow settings).
3. Publish workflows 1, 2 and 3. The form's Production URL is then the one to use.
4. Keep `DAILY_SEND_CAP` low (10-20) for the first two weeks while the Gmail account warms up.

## Before publishing this folder

The JSON exports contain the sheet ID, credential IDs and both email addresses. Replace them with
placeholders before pushing to a public repo.
