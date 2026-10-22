# Business MCP Server (Brindle Studio)

Two MCP servers built in n8n that let a studio's staff ask Claude (or ChatGPT, Cursor, any MCP client) about
their own business and update it in plain English: what's overdue for a client, how a project is doing, who
has room this week, log time, add or update tasks, which invoices are overdue, whether a project still makes
money, and draft an invoice from unbilled time. The team server has 9 tools and no money; the finance server
(separate token) has 4 money tools. Every number is worked out in code from a Google Sheet; Claude only picks
the tools and words the answer. Writes are checked, invoices are previewed first, and every call is logged.

Demo for a fictional 14-person design studio in Manchester. Decisions and data design are in
[SPEC.md](SPEC.md).

## Connect

- Team server: `http://localhost:5678/mcp/brindle`, header `Authorization: Bearer <TEAM_TOKEN>`
- Finance server: `http://localhost:5678/mcp/brindle-finance`, header `Authorization: Bearer <FINANCE_TOKEN>`
- Tokens are in `workflows/config.json` (and in the n8n credentials "Brindle MCP: team token" / "finance token").
- Claude Code: `claude mcp add --transport http brindle http://localhost:5678/mcp/brindle --header "Authorization: Bearer <TEAM_TOKEN>"`
  (and the same for `brindle-finance`).
- Claude Desktop: add a server that runs `npx -y mcp-remote http://localhost:5678/mcp/brindle --header "Authorization:Bearer <TEAM_TOKEN>"`.
  Claude.ai or ChatGPT connectors need a public HTTPS address (e.g. the ngrok domain in `hosting/`, with
  `/mcp/` allowed in `hosting/ngrok-policy.yml`).
- Google Sheet: https://docs.google.com/spreadsheets/d/13IFBgri_0mBqjU5JZSvFjfmk4jVpqzGulaEWBLjJQks/edit

## Workflows

| # | Workflow | ID | What it does |
|---|----------|----|--------------|
| 1 | Team MCP Server | bmsTeamServer001 | `/mcp/brindle`: search, client_overview, project_status, list_tasks, my_week, team_capacity, log_time, create_task, update_task. Published. |
| 2 | Finance MCP Server | bmsFinServer0002 | `/mcp/brindle-finance`: client_finances, invoices, profitability, draft_invoice. Published. |
| 3 | Tools | bmsTools00000003 | Every tool call: one sheet read, answer in code, checked writes, audit. Published. |
| 4 | Audit Log | bmsAuditLog00004 | One Audit row per call (not awaited). Published. |
| 5 | Reset Demo | bmsResetDemo0005 | Team, clients, projects, tasks, invoices, 8 weeks of timesheets (relative to today). Manual. |
| 6 | Create Spreadsheet | bmsCreateSheet06 | Run once: creates the sheet and its tabs. Manual. |

## Running the demo

1. Run **Brindle 5: Reset Demo**.
2. `python3 workflows/test/smoke.py` calls every tool through the real servers.
3. `python3 workflows/test/ask-claude.py` asks real Claude (Claude Code, headless, only these two servers)
   eight questions and saves the conversations to `samples/conversations/`;
   `python3 workflows/test/render-chat.py <key>` turns one into `site/chat-<key>.html`.

## Status (2026-10-22)

| Test | Result |
|------|--------|
| Auth | `initialize` works with each token; no token gets 403. `tools/list` shows the right required and optional inputs (optional inputs have defaults). |
| Every tool through MCP | 13 tools answer in 0.9-1.7 s each against the live sheet (1,642 timesheet rows). |
| Refusals | Live: time on an on-hold project, 30 hours in a day. Same code run locally on the demo data: a future date, finance tools through the team server, an unknown client, an ambiguous project name (lists the options). |
| Real Claude (Claude Opus 5.5 via Claude Code) | 8 questions, 9-37 s each. It picked sensible tools (up to 6 per question, across both servers), quoted the numbers correctly, logged 2.5 h for Amira (saved to the sheet), refused the on-hold project and explained why, and drafted Northwind's September invoice only after a preview and a "yes" (INV-2047, £25,172.50 + VAT, 86 time entries marked billed). |

After the Claude run the sheet holds the logged hours and draft INV-2047; Reset Demo puts it back.

## Going live

1. Point **Load Data** in Brindle 3 at the studio's own sheet, or replace it with their project-management and
   accounting APIs (the tools and what Claude sees stay the same).
2. Give each person their own token (one credential per person, or n8n's OAuth option on the MCP trigger) if
   you need to know exactly who made each change.
3. Publish over HTTPS for Claude.ai or ChatGPT connectors.

## Files

- `workflows/code/lib-bms.js`: every tool; `seed-bms.js`: demo data.
- `workflows/src/*.ts` → `python3 workflows/build.py` → `workflows/*.ts`; `node workflows/deploy.js workflows/<file>.ts`.
- `workflows/test/`: MCP client (`mcp.py`), smoke test, Claude runner and chat renderer.
- `samples/conversations/`: the real Claude sessions; `site/`: chat renders and the how-it-connects diagram.
