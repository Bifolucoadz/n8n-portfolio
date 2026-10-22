# Fiverr portfolio: Business MCP Server

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
Custom MCP Server in n8n: Connect Claude to Your Business Data
```

## Description

1,146 characters (Fiverr needs at least 120).

```text
Your team's answers are spread across project tools, timesheets and invoices, and getting them means asking someone or building a report.

I built an MCP server in n8n that connects Claude (or ChatGPT, Cursor, any MCP client) to a business's own data, shown here for Brindle Studio, a fictional 14-person design studio:
• Staff ask in plain English: "What's overdue for Brightwater?", "Who has room this week?", "Is the Harbour rebrand still profitable?"
• 13 tools: client and project health, tasks, capacity, timesheets, invoices, profitability
• Claude can also act: log time, add or update tasks, draft an invoice from unbilled hours
• Money is on a separate server with its own key, for directors only

Safe by design: every number is worked out in code from the data, not guessed by the AI. Writes are checked (no future dates, no time on paused projects, invoices previewed before saving), and every call is logged.

Results: tested with real Claude on 8 questions. It chose the right tools, used up to 6 per question, refused an invalid timesheet entry with the reason, and created a £25,172.50 invoice draft only after the user said yes.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, MCP, Claude, AI agents, Google Sheets, API integration, automation

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/chat-02-project-health.png`: Claude checks a project's health across both servers (cover)
2. `screenshots/how-it-connects.png`: How it connects: Claude → MCP servers in n8n → tools → Google Sheet
3. `screenshots/chat-03-who-has-room.png`: Who has room this week?
4. `screenshots/chat-08-draft-invoice.png`: Drafting an invoice: preview first, then create
5. `screenshots/chat-05-refused-on-hold.png`: A time entry refused, with the reason
6. `screenshots/chat-01-whats-overdue.png`: What's overdue for a client?
7. `screenshots/chat-06-overdue-invoices.png`: Which invoices are overdue?
8. `screenshots/chat-07-profitability.png`: Is this project still making money?
9. `screenshots/chat-04-log-time.png`: Logging time in plain English
10. `screenshots/workflow-01-team-server.png`: Team MCP server: nine tools
11. `screenshots/workflow-02-finance-server.png`: Finance MCP server: four money tools, separate token
12. `screenshots/workflow-03-tools.png`: Tools: one read, answer in code, checked writes, audit
13. `screenshots/workflow-04-audit-log.png`: Audit Log
14. `screenshots/workflow-05-reset-demo.png`: Reset Demo
15. `screenshots/workflow-06-create-sheet.png`: Create Spreadsheet

The conversations are real Claude sessions (Claude Code in headless mode, Claude Opus 5.5, connected only to the two Brindle servers), shown in a simple viewer: the question, each tool Claude called with its arguments, and Claude's answer, unedited. Workflow images are renders of the live n8n workflows, 2880×1728 px (5:3, the ratio of the 1280×769 Fiverr recommends). Dark mode, captured 2026-10-22.

## Notes for you (not for Fiverr)

- The conversation viewer is our own page, not Claude's app. If you want screenshots inside Claude Desktop, add the servers with mcp-remote (README) and ask the same questions.
- The diagram mentions ChatGPT and Cursor because they speak MCP too; only Claude was tested.
