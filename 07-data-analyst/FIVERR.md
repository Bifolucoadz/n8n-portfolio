# Fiverr portfolio: Ask Your Data

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
AI Data Analyst: Ask Your Database in Plain English with n8n
```

## Description

1,138 characters (Fiverr needs at least 120).

```text
Managers wait days for a simple number because every question goes through whoever knows SQL, and dashboards only answer the questions someone thought of last month.

I built an "ask your data" assistant in n8n, shown here for Ironleaf Fitness, a fictional chain of five gyms:
• Ask in plain English, like "Which branch lost the most members last month?", and get an answer, a chart and the rows in seconds
• Follow-up questions work ("Why did they leave?")
• Every answer shows the SQL it ran and the assumptions it made
• If a query fails, it reads the database error and fixes itself once
• Every Monday it emails the owner what changed last week, branch by branch, and what to check

Safe by design: the AI's SQL runs through a read-only Postgres function and role, so nothing can be changed or deleted, and slow queries stop after 10 seconds. Code, not AI, decides what counts as unusual in the weekly report.

Results: 19 of 19 test questions matched hand-written SQL, median 7.2 seconds. The weekly email caught both problems planted in last week's data: a spike in failed payments at one branch and a drop in check-ins at another.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, PostgreSQL, SQL, OpenAI API, data analysis, data visualization, business intelligence

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/analyst-01-churn-by-branch.png`: Churn by branch for 6 months: answer, chart, assumptions (cover)
2. `screenshots/analyst-02-follow-up.png`: A question and its follow-up
3. `screenshots/analyst-03-sql-shown.png`: Busiest hours, with the SQL it ran
4. `screenshots/email-01-weekly-changes.png`: Monday email: what changed last week, per branch
5. `screenshots/analyst-04-phone.png`: The assistant on a phone
6. `screenshots/workflow-01-answer-question.png`: Answer Question: write SQL, check, run read-only, fix once, explain
7. `screenshots/workflow-02-chat-api.png`: Chat API: the page, follow-up memory, question log
8. `screenshots/workflow-03-weekly-anomalies.png`: Weekly Anomalies: fixed SQL, flags in code, summary
9. `screenshots/workflow-04-evaluation.png`: Evaluation: 19 questions scored against hand-written SQL
10. `screenshots/workflow-00-database-setup.png`: Database Setup: demo data and the read-only function
11. `screenshots/workflow-05-send-email.png`: Send Email

Workflow images are renders of the live n8n workflows, 2880×1732 px (5:3, the same ratio as the 1280×769 Fiverr recommends, so they scale down cleanly). Sticky notes are moved into a band above the nodes and a few nodes nudged apart so the text is readable; nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-21. The assistant screens are the live page answering real questions on the demo database (2026-10-21). The email is the test-mode weekly report shown in a mail window. Email addresses and phone numbers are blurred because Fiverr doesn't allow contact details in images.

## Notes for you (not for Fiverr)

- The database is PostgreSQL on this Mac (Homebrew service), because the Supabase project was paused. The page runs on localhost; to let a client try it, host n8n and the database, or point the credential at a Supabase or cloud Postgres.
- The weekly email went to the Outbox table (Gmail credential expired). Reconnect Gmail to send it for real.
- Timings were measured while the Mac was under heavy load from other apps; on a normal machine they should be lower.
