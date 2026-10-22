# Fiverr portfolio: Social Autopilot

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
AI Social Media Autopilot for LinkedIn and Telegram in n8n
```

## Description

1,078 characters (Fiverr needs at least 120).

```text
Posting every week means finding topics, writing for each platform, making images and remembering to post. Most small businesses give up within a month.

I built a content calendar in n8n that runs itself, set up for my own brand on LinkedIn and a Telegram channel:
• Add topics in a Google Sheet, or text them to a Telegram bot. Each gets the next free posting slot
• Two days ahead, AI writes a version for each platform and creates a matching image
• The preview arrives in Telegram with Approve, Rewrite, Post now and Reject buttons. Reply "shorter, end with a question" and it rewrites
• Approved posts go out on time and the post links are saved to the sheet
• Every Monday: what went out, gaps in the week ahead and 3 new topic ideas

Safe by design: nothing posts without your approval, a retry never posts twice, the AI only uses facts you give it, and errors alert you in Telegram. Test mode shows exactly what would go out first.

Results: AI drafting, image creation and test-mode publishing run live, and the scheduling and approval logic passes 28 scenario checks.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, OpenAI API, Telegram Bot API, LinkedIn API, Google Sheets, social media automation

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/workflow-05-draft-post.png`: Draft Post: AI writes each version and makes the image (cover)
2. `screenshots/workflow-04-handle-update.png`: Handle Telegram Update: buttons, replies and commands
3. `screenshots/workflow-06-publish-post.png`: Publish Post: LinkedIn and Telegram, test mode, results
4. `screenshots/workflow-02-clock.png`: Clock: decides what to draft, publish or remind
5. `screenshots/workflow-07-weekly-report.png`: Weekly Report: last week, gaps and new ideas
6. `screenshots/workflow-03-telegram-listener.png`: Telegram Listener
7. `screenshots/workflow-00-error-alerts.png`: Error Alerts

Workflow images are renders of the live n8n workflows, 2880×1732 px (5:3, the same ratio as the 1280×769 Fiverr recommends, so they scale down cleanly). Sticky notes are moved into a band above the nodes and a few nodes nudged apart so the text is readable; nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-21. Draft Post and Publish Post are shown in two rows for the screenshot (in n8n they are one long row). A sentence about the restricted Gmail account is left out of the Error Alerts note. Setup (1) and Check Connections (8) are left out.

## Notes for you (not for Fiverr)

- Telegram buttons and LinkedIn/channel posting have not run live yet (waiting on the bot token, channel and LinkedIn credential). Once they have, add a phone screenshot of a Telegram preview as the cover and put live numbers in the Results line.
- brand_name "Samuel Oladele" in the Settings tab is still a guess to confirm.
