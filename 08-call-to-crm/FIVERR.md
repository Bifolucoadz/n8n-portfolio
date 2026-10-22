# Fiverr portfolio: Call to CRM

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
AI Sales Call Notes to HubSpot CRM Automation in n8n
```

## Description

1,186 characters (Fiverr needs at least 120).

```text
Sales reps spend hours typing call notes into the CRM, promised follow-ups slip, and deal stages go stale because nobody updates them after the call.

I built a call-to-CRM autopilot in n8n, shown here for Tidewater Software, a fictional software company:
• The rep uploads a call recording and picks the deal; about a minute later the CRM is updated
• Transcribes the call, works out who said what and the talk-time split
• Writes the call note: summary, BANT, objections, competitors, risks and next steps
• Creates a task for everything the rep promised, with due dates
• Drafts the follow-up email for the rep to edit and send from a review page

Safe by design: every deal change must be backed by a quote found word for word in the transcript. Safe updates go straight in; closing a deal, big amount changes and skipped stages wait for the rep, and no email goes out without them.

Results (test mode, CRM tables shaped like HubSpot): three scripted calls processed in 38-81 seconds each. All four BANT items were found on the discovery call. A CFO's "closer to $50k" was logged as an objection, not a deal change, and a contract call wasn't marked won because nothing was signed.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, HubSpot, OpenAI API, speech to text, CRM automation, sales automation, AI

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/review-00-overview.png`: Review page: summary, BANT and what was done in the CRM (cover)
2. `screenshots/page-01-result.png`: What the rep sees a minute after uploading
3. `screenshots/review-01-call.png`: The full review page with the follow-up email draft
4. `screenshots/review-02-sent.png`: After "Approve and send"
5. `screenshots/form-01-upload.png`: The upload form
6. `screenshots/workflow-02-process-call.png`: Process Call: transcribe, split speakers, analyse, rules, CRM
7. `screenshots/workflow-03-crm.png`: CRM: HubSpot (live) or test tables behind one shape
8. `screenshots/workflow-04-review-page.png`: Review Page: the rep approves changes and sends
9. `screenshots/workflow-01-upload-call.png`: Upload Call: the form and result page
10. `screenshots/workflow-05-send-email.png`: Send Email
11. `screenshots/workflow-07-make-demo-calls.png`: Make Demo Calls: voices the scripted calls
12. `screenshots/workflow-06-reset-demo.png`: Reset Demo

Workflow images are renders of the live n8n workflows, 2880×1732 px (5:3, the same ratio as the 1280×769 Fiverr recommends, so they scale down cleanly). Sticky notes are moved into a band above the nodes and a few nodes nudged apart so the text is readable; nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-21. The pages are the live form, result and review page from a test-mode run with a scripted, AI-voiced demo call (2026-10-21). Email addresses and phone numbers are blurred because Fiverr doesn't allow contact details in images.

## Notes for you (not for Fiverr)

- HubSpot is not connected yet (no account); the CRM steps ran against data tables shaped like HubSpot deals, notes and tasks. With a HubSpot private-app token the same flow writes to HubSpot, and the Results line can say so.
- The demo calls are scripted and voiced with OpenAI text-to-speech, so they are cleaner than real calls. A real recording from a client would be the best proof.
- Whether a stage change waits depends on what the model proposes: in one run Calloway jumped two stages and waited for review; in the screenshot run it moved one step and went straight in. Both follow the rules.
