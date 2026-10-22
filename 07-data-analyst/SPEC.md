# Ask Your Data: build spec

Portfolio project 7. A data assistant for **Ironleaf Fitness**, a fictional chain of five gyms in Greater
Manchester (Ancoats, Didsbury, Salford Quays, Stockport, Altrincham). A manager types a question in plain
English; the assistant writes SQL, runs it read-only on the gym database and answers with a sentence, a
chart, the rows and the SQL it ran. Every Monday it also emails the owner what changed last week.

Everything is invented: the gyms, members, payments and check-ins come from `sql/setup.sql`, dated
relative to the day it runs. The data has stories to find: a rival gym near Salford Quays (cancellations
"moved to a competitor"), the new Altrincham branch growing, a Standard plan price rise, the January rush,
and last full week Stockport check-ins fell while Didsbury had a spike in failed payments.

## Decisions (2026-10-21)

- Standalone project (one of four new portfolio projects the user asked for).
- Database: PostgreSQL. The Supabase project used for project 4 was paused and unreachable, so
  PostgreSQL 17 was installed locally with Homebrew (`brew services` keeps it running). n8n connects with
  the credential **Ironleaf Postgres (local)** as role `ironleaf_app`.
- Read-only by construction, not by prompt:
  - the model's SQL only reaches the data through `ironleaf.run_readonly(q)`, a STABLE SECURITY DEFINER
    function owned by `ironleaf_reader` (SELECT on the schema, nothing else); Postgres refuses writes
    inside a STABLE function; at most 500 rows come back;
  - `ironleaf_app` has `statement_timeout = 10s` set on the role (a `SET` on the function didn't stop
    long queries);
  - before that, code (`workflows/code/lib-check.js`) rejects anything that isn't one SELECT/WITH, has
    comments or semicolons, or names write/admin keywords, so the user gets a clear message;
  - the SQL travels base64-encoded into the query parameter, so quoting can't break out.
- Questions: `gpt-5.4` writes a plan with a strict JSON schema (`prompts/sql-plan.json`): can_answer,
  clarification, sql, explanation, assumptions, chart. The prompt holds the schema and business
  definitions (active member, churn, revenue, last week, last N days, last N months). Questions the data
  can't answer get "can't answer" and what data would be needed.
- One automatic fix: if Postgres returns an error, `gpt-5.4` gets the error and writes one corrected
  query. A second failure is shown to the user as a plain message.
- Answer: `gpt-5.4-mini` writes 1-3 sentences from the rows only (up to 40 rows) and an optional caveat.
- Follow-ups: the chat sends its session ID; the last 3 questions and their SQL from **Ironleaf Questions**
  go into the prompt ("Why did they leave?" after "Which branch lost the most members?").
- The page (`site/analyst.html`, served by Ironleaf 2) draws the chart with Chart.js. Long rows (period,
  branch, value) become one line per branch. Months show as "May 2026", hours as "07:00".
- Weekly report: fixed SQL (`sql/weekly.sql`) gives last week and the 8 weeks before per branch for
  check-ins, new members, cancellations, failed payments and revenue. Code flags a number when it is at
  least 2 standard deviations and 15% away from the usual. `gpt-5.4` only puts the flags into words with
  something to check for each. Red and green follow good and bad (more failed payments is red).
- Evaluation: 19 questions a manager would ask, each with reference SQL written by hand from the same
  definitions. Ironleaf 4 runs them through the real assistant and passes a question when every value
  in the reference result appears in the assistant's result (numbers within rounding, text ignoring
  case, dates by day; column names and order don't matter).
- Email: Gmail in live mode, the Ironleaf Outbox table in test mode. Times are UK
  (Europe/London).

## Database

Schema `ironleaf` in database `ironleaf` (local PostgreSQL 17):

| Table | What |
|-------|------|
| branches | id, name, area, opened_on, capacity |
| plans | Off-Peak, Standard, Premium, Student with monthly prices |
| members | branch, plan, source, joined_on, cancelled_on, cancel_reason |
| payments | monthly direct debits for 18 months (paid, failed, refunded) |
| visits | gym check-ins for 18 months |
| classes | five classes a day per branch for 6 months |
| bookings | class bookings (attended, no_show, cancelled) |

Roles, created once by hand (see README):

| Role | Can do |
|------|--------|
| ironleaf_app | Log in (n8n), run `run_readonly`, 10 s statement timeout |
| ironleaf_reader | No login. Owns `run_readonly`; SELECT on the schema |

## Data tables (n8n)

| Table | ID | What |
|-------|----|------|
| Ironleaf Questions | aJd2CJkonUN6vRaa | every question: session, SQL, ok, rows, answer, error, attempts, ms |
| Ironleaf Outbox | jeTJyVYufE4q3cuM | test-mode emails |
| Ironleaf Reports | B5yiB01JQHOCKTZ2 | saved weekly reports |
| Ironleaf Eval | Ttb7o3Bj7C1j5SrL | evaluation runs: expected and actual numbers per question |
| Ironleaf Settings | eLHuDVWvuDw7XkhB | mode, company, owner name and email, base_url |

## Workflows

| # | Name | ID | Trigger |
|---|------|----|---------|
| 0 | Database Setup | ilfDbSetup000000 | Manual (runs `sql/setup.sql`) |
| 1 | Answer Question | ilfAnswerQues001 | Called (question, session history) |
| 2 | Chat API | ilfChatApi000002 | Webhooks GET `ironleaf/chat` (page), POST `ironleaf/ask` |
| 3 | Weekly Anomalies | ilfWeeklyAnom003 | Mondays 7:00 + manual |
| 4 | Evaluation | ilfEvaluation004 | Manual |
| 5 | Send Email | ilfSendEmail0005 | Called |

## Build changes (2026-10-21)

- Every generated member was on Standard: Postgres evaluated the `LATERAL` random once. Plans are now
  assigned with an `UPDATE` after the insert.
- `build.py` didn't expand an `@include` inside an included file; it now loops until none are left.
- The weekly query timed out under load; rewritten with joins instead of correlated subqueries.
- Q16 ("last 90 days") was off by a day: the prompt now defines "the last N days" as the N days ending
  yesterday.
- After the screenshot run: a chart split by branch drew all branches as one line (the page now draws a
  line per branch); answers said "2026-07-01" (the answer prompt now asks for "July 2026", "7am" and
  thousands separators); "last 6 months" included the half-finished current month (now the last 6 full
  months, unless the question says otherwise, and the Q08 reference uses the same rule); the weekly email
  coloured a rise in failed payments green and cut its subject mid-word.
