# Fiverr portfolio: Lead Generation Engine

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
AI Lead Generation and Cold Email System in n8n
```

## Description

1,086 characters (Fiverr needs at least 120).

```text
Finding prospects, writing cold emails and chasing follow-ups can eat a whole week, and the one reply that matters gets buried.

I built a lead engine in n8n that does the whole job:
• Type a business type and a city into a form. It pulls matching businesses from Google Maps, with emails from their websites
• AI scores each lead 1-10 for fit and writes a personal first line
• Leads land in a Google Sheet that works as a simple CRM
• A 3-email sequence goes out, with follow-ups on day 3 and day 7 in the same thread
• Every 5 minutes it sorts new replies (interested, not interested, out of office, unsubscribe) and stops the sequence when someone answers
• You get an alert for every interested reply

It protects your sender reputation: daily caps, random gaps between emails, an opt-out line, bounce handling, and a test mode that sends everything to your own inbox first.

Results: a live search for dentists in Boston found 10 clinics, 7 with an email address, each scored with a personal opener. In test mode the emails and day-3 follow-ups went out on schedule in one thread.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, OpenAI API, Apify, Google Sheets, Gmail, lead generation, email automation

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/workflow-01-lead-scraper.png`: Lead Scraper: form, Google Maps scrape, AI scoring, sheet, summary email (cover)
2. `screenshots/workflow-02-outreach-followups.png`: Outreach and Follow-ups: picks who to email, AI writes it, sends, paces
3. `screenshots/workflow-03-reply-detector.png`: Reply Detector: matches replies to leads, rules plus AI sorting, alerts
4. `screenshots/workflow-04-rescore-unscored.png`: Rescore: fills in any lead the AI step missed
5. `screenshots/workflow-00-error-alerts.png`: Error Alerts: shared failure handler

Workflow images are renders of the live n8n workflows, 2880×1732 px (5:3, the same ratio as the 1280×769 Fiverr recommends, so they scale down cleanly). Sticky notes are moved into a band above the nodes and a few nodes nudged apart so the text is readable; nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-21.

## Notes for you (not for Fiverr)

- The old writeup said reply handling was tested end to end. The reply sorting was only tested with sample replies (no test thread in your inbox has a reply), so the Results line now only claims what the inbox shows: test-mode emails and day-3 follow-ups in one thread. To claim more, reply to a test thread, let Lead Engine 3 run and add the outcome.
- For client work, send from a mailbox on a separate domain with SPF, DKIM and DMARC, not a personal @gmail.com (that is what got samuelgurru restricted on 2026-10-03).
