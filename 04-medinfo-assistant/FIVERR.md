# Fiverr portfolio: MedInfo Assistant

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
RAG Document Assistant with Cited Answers in n8n
```

## Description

1,191 characters (Fiverr needs at least 120).

```text
A pharma Medical Information team answers questions about its medicines all day. Every answer must come from approved documents and cite them, and every side-effect report must reach the safety team.

I built a RAG assistant in n8n (AI that answers only from your documents), shown here for Larkmoor Therapeutics, a fictional pharma company:
• Reads a Google Drive folder of PDFs (scans too), Google Docs and a product sheet, re-checked every 15 minutes
• Finds passages by meaning and by exact codes such as NDC numbers
• Every answer cites document, version, section and page; made-up citations are removed
• Doctors, sales reps and staff each see only their own documents, enforced in the database
• Side effects, complaints and emergencies are caught on every message, logged and sent to Telegram
• Web chat page, a full audit log and a weekly knowledge-gap report

Results on 28 test questions: the right document every time, no document shown to the wrong role, 27 of 28 routed correctly. A second AI graded it 4.7/5 for correctness and 4.96/5 for sticking to the sources. Typical reply: 7.6 seconds.

The same setup works for any team that answers from manuals, policies or contracts.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, OpenAI API, Supabase (pgvector), PostgreSQL, Google Drive, Telegram, RAG, AI agents

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/chat-02-cited-answer.png`: An answer with citations (cover)
2. `screenshots/chat-01-welcome.png`: Chat page
3. `screenshots/chat-03-not-in-label.png`: Declines what the documents don't cover
4. `screenshots/chat-04-field-rep-catalog.png`: A sales rep sees only rep-approved documents
5. `screenshots/chat-05-phone.png`: On a phone
6. `screenshots/workflow-05-answer.png`: Answer workflow
7. `screenshots/workflow-04-agent-tools.png`: Agent tools
8. `screenshots/workflow-03-search-knowledge.png`: Hybrid search
9. `screenshots/workflow-01-sync-knowledge.png`: Drive sync
10. `screenshots/workflow-02-index-document.png`: Indexing
11. `screenshots/workflow-06-chat-api.png`: Chat API
12. `screenshots/workflow-07-record-turn.png`: Audit log
13. `screenshots/workflow-08-evaluation.png`: Evaluation
14. `screenshots/workflow-09-weekly-insights.png`: Weekly insights

Workflow images are renders of the live n8n workflows, 2880×1732 px (5:3, the same ratio as the 1280×769 Fiverr recommends, so they scale down cleanly). Sticky notes are moved into a band above the nodes and a few nodes nudged apart so the text is readable; nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-21. chat-05-phone is a portrait phone shot (1170×2532). The chat screens show real assistant answers recorded in n8n on 2026-10-07, replayed into the page because the Supabase database was unreachable on 2026-10-21.

## Notes for you (not for Fiverr)

- Supabase was unreachable on 2026-10-21 (probably paused after two idle weeks). Restore it in the Supabase dashboard before any live demo.
