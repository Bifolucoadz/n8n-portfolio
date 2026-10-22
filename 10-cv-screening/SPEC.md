# CV Screening: build spec

Portfolio project 10. An application and screening pipeline for **Northgate Talent**, a fictional
recruitment agency in Leeds hiring for three client roles. Candidates apply on a form with a PDF CV.
AI reads the CV, removes who the candidate is, and rates them against the job's criteria with evidence;
code turns the ratings into a score and a band. A recruiter decides on a dashboard: invite (the
candidate books a time from their email), hold or reject (a polite fixed email).

Everything is invented: agency, clients, jobs, people, emails (example.com) and phone numbers (Ofcom's
07700 900xxx drama range).

## Decisions (2026-10-21)

- Standalone project (user asked for four new portfolio projects: analyst, call-to-CRM, Shopify, CV screening).
- Intake: an n8n Form (`/form/northgate-apply`), PDF only, 5 MB max. The applicant sees a thank-you page
  straight away; screening runs in the background (Execute Sub-workflow, not awaited). Applicants never
  see a score.
- Two AI steps with strict JSON schemas:
  - **Read CV**: `gpt-5.4-mini` reads the PDF as a file and transcribes it (prompts/cv-reader.md).
    It flags text aimed at the AI (prompt injection) instead of obeying it.
  - **Score Candidate**: `gpt-5.4` rates each criterion met / partial / not met / unclear with evidence
    (prompts/screener.md). It sees an **anonymised** profile: names, contact details, schools,
    places and years removed in code first (Anonymise node).
- The score is worked out in code (Decide): must-haves 3 points, nice-to-haves 1, met = full, partial = half.
  Bands: shortlist (≥ 70 and no must-have gap), worth a look (≥ 50), unlikely (< 50), knockout.
  Knockouts come from form answers only (needs sponsorship for a role that can't sponsor). A CV with
  hidden instructions can't be shortlisted automatically.
- Nobody is rejected by the system. Bands only order the recruiter's list; invite, hold and reject are
  the recruiter's clicks. Rejection emails are a fixed template.
- Recruiter UI: a page served by n8n (`/webhook/northgate/dashboard?key=…`) with a key from Settings,
  blind-review toggle (names hidden until invited), evidence per criterion, flags, history, CV viewer.
  n8n serves webhook HTML in a sandbox (opaque origin, no localStorage), so the action endpoint allows
  CORS `*` and storage access is wrapped.
- Scheduling: invites offer up to 5 interview times, one per working day, rotating through the hours in
  Settings, avoiding the interviewer's busy periods. Each time is re-checked when the candidate clicks,
  so two candidates can't book the same time. All interviews go in the recruiter's calendar.
- Test mode (`mode = test` in Northgate Settings): emails go to the **Northgate Outbox** table and the
  calendar is the **Northgate Calendar** table. Live mode uses Gmail (`Gmail account 2`) and Google
  Calendar; both Google credentials had expired on 2026-10-21.
- Storage: n8n data tables (Supabase was paused). CVs are kept as base64 in **Northgate Files** for the
  dashboard's CV viewer (a production build would use Drive or the client's ATS).
- Error alerts: the shared Social Autopilot 0 workflow (Telegram).

## Data tables

| Table | ID | Columns |
|-------|----|---------|
| Northgate Jobs | qycslNJXs6wOwRxE | job_id, title, client, location, work_mode, salary_min, salary_max, sponsorship, summary, rubric_json, status, interviewer, interviewer_email |
| Northgate Candidates | Gf6MbtbZDBcTRWhX | candidate_id, job_id, job_title, name, email, phone, linkedin, right_to_work, notice_period, salary_expectation, cv_filename, profile_json, screening_json, score, band, flags_json, status, summary, token, slots_json, interview_at, applied_at, screened_at, updated_at, screen_ms |
| Northgate Files | nKofBkG4S6UPt1xd | candidate_id, filename, mime, base64 |
| Northgate Events | v5LAsWSJxw2Uj4Ig | candidate_id, event, detail, actor, at (audit trail) |
| Northgate Outbox | ygMH59WjeBt0Og19 | to, subject, body, kind, candidate_id, at (test-mode emails) |
| Northgate Calendar | CF6YJExhwMKsGY9P | start, end, title, kind (busy / interview), candidate_id |
| Northgate Settings | LXDSXYJhXdqQV8KO | key, value |

Candidate status: `new` → `invited` → `interview_booked`; or `hold`, `rejected`.

## Workflows

| # | Name | ID | Trigger |
|---|------|----|---------|
| 1 | Apply Form | ngtApplyForm0001 | Form `/form/northgate-apply` |
| 2 | Screen Application | ngtScreenApp0002 | Called by 1 (passthrough, with the CV) |
| 3 | Send Email | ngtSendEmail0003 | Called (Gmail live, Outbox test) |
| 4 | Recruiter Dashboard | ngtDashboard0004 | Webhooks `northgate/dashboard`, `northgate/action`, `northgate/cv` |
| 5 | Candidate Action | ngtCandAction005 | Called by 4 (invite, hold, reject) |
| 6 | Book Interview | ngtBookIntvw0006 | Webhook `northgate/book` (link in the invite) |
| 7 | Weekly Report | ngtWeeklyRpt0007 | Mondays 8:00 Europe/London + manual |
| 8 | Reset Demo | ngtResetDemo0008 | Manual |
| 9 | Calendar | ngtCalendar00009 | Called (busy times, book) |

## Build changes (2026-10-21)

- Screening first failed with "File not found": the CV binary belonged to the form's run, which ends
  straight away. Keep CV now copies it into the screening run with `prepareBinaryData`.
- Internal sub-workflows (Send Email, Calendar) use passthrough triggers so callers need no input mapping.
- Two code nodes referred to `Read Settings` where the node in that branch is `Read Settings (Action)` /
  `(CV)`; fixed.
- The dashboard strips the quote marks the model puts around evidence.
