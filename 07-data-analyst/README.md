# Ask Your Data (Ironleaf Fitness)

A manager asks a question about the business in plain English ("Which branch lost the most members last
month?") and gets an answer in a few seconds: a sentence, a chart, the rows and the SQL that produced
them. Follow-up questions work. The database can only be read, never changed. Every Monday the owner also
gets an email about anything unusual last week, branch by branch.

Demo for a fictional chain of five gyms in Greater Manchester. Decisions are in [SPEC.md](SPEC.md).

## Links (n8n on this Mac)

- Data assistant: http://localhost:5678/webhook/ironleaf/chat

## Workflows

| # | Workflow | ID | What it does |
|---|----------|----|--------------|
| 0 | Database Setup | ilfDbSetup000000 | Builds the demo database (schema `ironleaf`) and the read-only query function. Manual. |
| 1 | Answer Question | ilfAnswerQues001 | GPT-5.4 writes the SQL, code checks it, Postgres runs it read-only, one automatic fix on error, GPT-5.4 mini explains the rows. Published. |
| 2 | Chat API | ilfChatApi000002 | The assistant page and its API; keeps the last questions per chat for follow-ups and logs every question. Published. |
| 3 | Weekly Anomalies | ilfWeeklyAnom003 | Mondays 7:00: last week vs the 8 weeks before, per branch; flags unusual numbers; emails the owner. Published. |
| 4 | Evaluation | ilfEvaluation004 | Runs 19 test questions through the assistant and scores them against hand-written SQL. Manual. |
| 5 | Send Email | ilfSendEmail0005 | Gmail (live) or the Outbox table (test). Published. |

## Running the demo

1. PostgreSQL 17 runs on this Mac as a Homebrew service (`brew services list`). If the database is new,
   run **Ironleaf 0: Database Setup** (it rebuilds the data relative to today).
2. Open the data assistant and click an example question, or type your own.
3. Run **Ironleaf 3** with "Run Now" and read the email in the **Ironleaf Outbox** table.
4. Run **Ironleaf 4** to score the assistant; results are in **Ironleaf Eval**.

## Status (2026-10-21)

Tested on the local database:

| Test | Result |
|------|--------|
| Evaluation, 19 questions | 19 of 19 correct, median 7.2 s per question (run E1021-2300). The first run scored 18: "last 90 days" was a day off until the prompt defined it. |
| Follow-ups | "Which branch lost the most members last month?" → Salford Quays, 38 cancellations; "Why did they leave?" → reasons at Salford Quays last month, 21 of 38 "moved to a competitor". |
| Charts | Churn by branch for 6 months as one line per branch; busiest hours as a bar chart; members per plan; single numbers as a big figure. |
| Weekly email | For 12-18 Oct it caught both planted problems, Didsbury failed payments 16 vs a usual 1.8 and Stockport check-ins down 36%, and also flagged Altrincham check-ins up 22% and Salford Quays cancellations down 49%. 6-7 s. |
| Safety | Only SELECT reaches the database, through a read-only function; a query is stopped after 10 seconds. |

Not tested live: Gmail (credential expired). Timings are from a Mac under heavy load from other apps.

## Setup on another machine

1. Install PostgreSQL (Homebrew: `brew install postgresql@17 && brew services start postgresql@17`).
2. As a superuser, create the roles and database (choose your own password):

   ```sql
   CREATE ROLE ironleaf_app LOGIN PASSWORD '...';
   CREATE ROLE ironleaf_reader NOLOGIN;
   GRANT ironleaf_reader TO ironleaf_app;
   CREATE DATABASE ironleaf OWNER ironleaf_app;
   ALTER ROLE ironleaf_app SET statement_timeout = '10s';
   ```

3. In n8n, create a Postgres credential **Ironleaf Postgres (local)** for `ironleaf_app` on database
   `ironleaf`, then run **Ironleaf 0**.
4. For a real business, point the credential at a read replica, give `ironleaf_reader` SELECT on the
   tables the assistant may see, and rewrite the schema and definitions in `prompts/sql-writer.md`.
5. Reconnect **Gmail account 2**; in **Ironleaf Settings** set `mode` = `live`, `owner_email` and
   `base_url` (the public address of the assistant, for the link in the email).

## Files

- `sql/setup.sql`: the demo database, the read-only function and grants. `sql/weekly.sql`: the weekly numbers.
- `prompts/`: SQL writer, answer writer and anomaly writer instructions with their JSON schemas.
- `site/analyst.html`: the assistant page (served by Ironleaf 2).
- `workflows/src/*.ts` + `workflows/code/*.js` → `python3 workflows/build.py` → `workflows/*.ts`;
  `node workflows/deploy.js workflows/<file>.ts` validates and imports (IDs in `workflows/deploy.json`).
- `workflows/code/04-questions.js`: the 19 test questions and their reference SQL.
