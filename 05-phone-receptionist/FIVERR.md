# Fiverr portfolio: Phone Receptionist

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
AI Phone Receptionist (Voice Agent) with Vapi and n8n
```

## Description

1,193 characters (Fiverr needs at least 120).

```text
Clinics miss calls whenever the front desk is busy or closed, and every missed call can be a patient who books elsewhere. Staff also lose hours moving appointments by phone.

I built an AI receptionist that answers the phone, shown here for Fernhollow Dental, a fictional clinic:
• A natural voice (Vapi) answers questions about hours, insurance, prices and first visits
• Checks the clinic's Google Calendar and books, moves or cancels appointments during the call
• Gives each booking a confirmation code; callers can change it with the code or their phone number
• Sends emergencies to 911 or the first emergency slot, and takes messages for staff
• Logs every call with a summary, outcome and recording, plus a daily summary for the team

Safe by design: opening hours, notice periods and double-booking checks are code, not AI. The calendar is re-checked before every booking, and other patients' details are never read out.

Results: the scheduling rules pass 24 automated checks, covering busy times, lunch breaks, closed days, double bookings and finding a booking from a spoken confirmation code.

The same setup suits any business that books by phone: clinics, salons, home services.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, Vapi, voice AI agents, OpenAI API, Google Calendar, Google Sheets, AI receptionist

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/workflow-01-vapi-tools.png`: Vapi Tools: the webhooks the voice agent calls (cover)
2. `screenshots/workflow-02-run-tool.png`: Run Tool: availability, booking, changes and messages
3. `screenshots/workflow-00b-vapi-assistant.png`: Vapi Assistant: creates and updates the voice agent
4. `screenshots/workflow-03-call-events.png`: Call Events: logs each call with summary and outcome
5. `screenshots/workflow-05-daily-summary.png`: Daily Summary

Workflow images are renders of the live n8n workflows, 2880×1732 px (5:3, the same ratio as the 1280×769 Fiverr recommends, so they scale down cleanly). Sticky notes are moved into a band above the nodes and a few nodes nudged apart so the text is readable; nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-21. Setup (0a) and Log Row (4) are left out.

## Notes for you (not for Fiverr)

- Not live yet (2026-10-21): the Google credentials need reconnecting and the Vapi account and ngrok tunnel aren't set up, so there are no call screenshots or live numbers. After the first test calls, replace the Results line with live numbers (calls handled, booking time, reply speed) and add a screenshot of the Calls sheet or the Vapi call log. A short screen recording of a test call would be the strongest cover.
