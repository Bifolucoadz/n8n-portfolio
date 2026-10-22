# Business MCP Server: build spec

Portfolio project 13. Two MCP servers built in n8n that let the staff of **Brindle Studio**, a fictional
14-person design and web studio in Manchester, ask Claude (or ChatGPT, Cursor, any MCP client) about their own
business and update it: "What's overdue for Brightwater Dental?", "Who has room this week?", "Log 2 hours for
Amira on the annual report", "Which invoices are overdue?", "Draft Northwind's invoice for September". The
data lives in one Google Sheet.

Everything is invented: studio, team, clients and their contacts (emails on `.example` domains).

## Decisions (2026-10-22)

- User asked for three new projects with Google Sheets as storage; this is idea 3 ("Business MCP Server").
- **Two servers, two tokens**: `/mcp/brindle` (team: 9 tools, no money) and `/mcp/brindle-finance` (directors
  and finance: 4 money tools). Each MCP Server Trigger (v2, Streamable HTTP) uses bearer auth with its own
  credential ("Brindle MCP: team token" / "finance token"; tokens in `workflows/config.json`). Finance tools
  also refuse calls that arrive with `server = team`, so access doesn't depend on one setting.
- **One tools workflow**: every tool is a Call n8n Workflow Tool node that passes its name, the server and
  its `$fromAI` inputs to **Brindle 3: Tools**. Optional inputs have defaults, which makes them optional in
  the tool schema Claude sees (n8n uses zod `.default()`).
- **Answers come from code, not the model**: Load Data reads all tabs in one Sheets `values:batchGet`, and
  `lib-bms.js` works out every number (hours used, budget %, retainer use, capacity, margins, invoice
  totals). Claude only chooses the tool and words the answer.
- **Names, not IDs**: clients, projects and people are found by ID, exact name, prefix or all words; an
  ambiguous name returns the options ("More than one project matches 'Harbour & Co': … Say which one").
- **Checked writes**: `log_time` refuses inactive projects, hours outside 0.25-12 or not in quarter hours, day
  totals over 12, future dates and dates older than 30 days (locked), and tasks from another project.
  `draft_invoice` always previews first; `confirm=true` creates a draft (never sends) and marks the time as
  billed. Writes use `cellFormat: RAW`.
- **Audit**: every call, allowed or refused, is appended to the **Audit** tab by Brindle 4, run without
  waiting so it doesn't slow the answer.
- Identity: the demo uses one token per server and a `person` input, logged in Audit. Per-person access would
  use n8n's OAuth option on the MCP trigger or one token per person.
- Demo data: Brindle 5 generates eight weeks of timesheets with a fixed random seed and dates relative to
  today; budgets are set from the hours logged so the Harbour & Co rebrand is 118% used and others on track;
  fixed fees are budget × £105.

## Sheet tabs

| Tab | Columns |
|-----|---------|
| Settings | key, value, note |
| Team | person_id, name, role, team, email, is_manager, weekly_hours, cost_rate, bill_rate, active |
| Clients | client_id, name, sector, contact, contact_email, account_lead, retainer_hours, retainer_fee, status, since |
| Projects | project_id, client_id, name, type, billing (fixed, hourly, retainer, internal), status (active, on_hold, done), lead, start, due, budget_hours, fee |
| Tasks | task_id, project_id, title, assignee, status (todo, doing, review, done), priority, due, created_at, updated_at |
| Time | entry_id, date, person, project_id, task_id, hours, billable, note, logged_at, source, invoice_id |
| Invoices | invoice_id, client_id, project_id, period, issue_date, due_date, amount, vat, status (draft, sent, paid; overdue is worked out), paid_date, lines_json |
| Audit | at, server, tool, args_json, ok, summary, ms |

## Tools

| Server | Tool | Writes? |
|--------|------|---------|
| team | search, client_overview, project_status, list_tasks, my_week, team_capacity | no |
| team | log_time, create_task, update_task | yes |
| finance | client_finances, invoices, profitability | no |
| finance | draft_invoice (preview, then confirm=true) | yes |

## Workflows

| # | Name | ID | Trigger |
|---|------|----|---------|
| 1 | Team MCP Server | bmsTeamServer001 | MCP `/mcp/brindle` (bearer) |
| 2 | Finance MCP Server | bmsFinServer0002 | MCP `/mcp/brindle-finance` (bearer) |
| 3 | Tools | bmsTools00000003 | Called by the tool nodes |
| 4 | Audit Log | bmsAuditLog00004 | Called by 3 (not awaited) |
| 5 | Reset Demo | bmsResetDemo0005 | Manual |
| 6 | Create Spreadsheet | bmsCreateSheet06 | Manual (once) |

## Build notes

- `workflows/test/mcp.py` is a minimal MCP client (initialize, tools/list, tools/call) for tests.
- All 13 tools were run locally against the generated data before deployment, including the refusals.
- Checked on n8n 2.30 (2026-10-22): both servers answer `initialize` with the token and 403 without it;
  `tools/list` shows the right required and optional inputs.
