# MedInfo Assistant: build spec

Portfolio project 4. A retrieval-augmented (RAG) assistant for the Medical Information team of
**Larkmoor Therapeutics**, a fictional specialty pharma company. Healthcare professionals, field
sales reps and Medical Information specialists ask questions about Larkmoor's three medicines. The
assistant answers only from the company's approved documents, cites the exact section, page and
version, and limits what each role can see. It also catches anything that must go to the safety or
quality teams: adverse events, product complaints and off-label requests.

Everything is invented: company, medicines, doses, studies, NDC numbers, people and phone numbers.
Every document carries a "Fictional, for software demonstration only" notice.

## Decisions (2026-10-07)

- Use case picked by the user: healthcare and pharma. Narrowed to pharma Medical Information, one
  of the most common real RAG deployments in the industry, because it needs every feature that
  separates production RAG from a demo: access control, citations, version control and
  compliance routing.
- Models: `gpt-5.4-mini` for everything at run time (agent, compliance screen, reranking, chunk
  context, PDF reading), as in projects 2 and 3. `gpt-5.4` only as the evaluation judge.
- Reranking is done by the model (no Cohere account).
- Channel: a JSON chat API (n8n webhook) used by a web page. Telegram is used outbound only, for
  safety alerts. Inbound Telegram needs n8n on a public HTTPS address (`WEBHOOK_URL`), which
  this local install doesn't have; the core pipeline is a sub-workflow, so adding Telegram, Slack
  or Teams later is a small adapter workflow.
- Storage: the existing Supabase project (pgvector 0.8.2), new `kb_*` tables. All SQL goes through
  the `Postgres account` credential. Every call passes a single JSON parameter (`$1::jsonb`) to a
  SQL function, which avoids the Postgres node splitting parameters on commas.
- Eval dataset in an n8n Data Table (no Google dependency).

## What makes it more than basic RAG

| Area | Basic RAG (project 2) | This project |
|------|----------------------|--------------|
| Sources | One Google Doc | A Drive folder tree: Google Docs, text PDFs, scanned PDFs, a Sheet |
| Sync | Doc trigger, re-embed | Scheduled reconcile: new, changed and deleted files; one SQL transaction per document |
| Parsing | Plain text | PDFs read by the model into Markdown (tables kept), checked number-by-number against the PDF text layer; scans flagged as OCR |
| Chunks | 1,000 characters | Split on headings, tables kept whole (header row repeated if split), page numbers kept, plus a model-written context line per chunk ("contextual retrieval") |
| Metadata | File ID | Document number, version, effective date, product, type, access level; old versions marked superseded automatically |
| Search | Vector top 6 | Hybrid: pgvector + Postgres full-text, merged with reciprocal rank fusion, top 20 reranked by the model to the best 6 |
| Access | None | Role-based, enforced in the SQL `where` clause |
| Answers | Free text | Inline citations checked against what was retrieved; made-up citations removed |
| Compliance | Safety advice in prompt | A compliance screen on every message: adverse events, product complaints, off-label requests and emergencies are detected and routed deterministically |
| Quality | Correctness eval | Eval of retrieval hit, groundedness, correctness and routing; thumbs up/down; weekly gap report |

## Roles and access

| Role | Who | Sees access levels | Off-label questions |
|------|-----|--------------------|---------------------|
| `hcp` | Healthcare professional on the public site | `public` | Not answered. Offers a Medical Information request (needs name and email or phone). |
| `field` | Larkmoor sales rep | `public`, `internal` | Not answered (SOP-MI-002). Offers to log the request for MI to answer the HCP directly. |
| `medinfo` | Medical Information specialist | `public`, `internal`, `medical` | Answered from standard response letters, marked "Off-label: for unsolicited requests only". |

Access level comes from the Drive folder a file sits in: `Public`, `Internal`, `Medical`. In the
demo the web page has a role switch (`DEMO_ROLE_SWITCH`); in production the role comes from
sign-in (SSO) and the switch is off, which forces `hcp`.

## Compliance screen (every message, before the agent)

`gpt-5.4-mini` with a strict JSON schema reads the message plus the last few turns and returns:

- `adverse_event`: a side effect, lack of effect, overdose, misuse, medication error or exposure in
  pregnancy or breastfeeding, linked to a Larkmoor product. Product, event, patient details,
  reporter, seriousness hints and which of the four minimum criteria (identifiable patient,
  identifiable reporter, suspect product, event) are present.
- `product_complaint`: a quality defect (pen jams, broken seal, discoloured suspension, wrong
  count), with lot number if given.
- `off_label`: use outside the approved labeling summary in the Config (indication, population,
  dose, route, administration).
- `emergency`: someone in immediate danger now.
- `standalone_question`: the question rewritten without pronouns, used for logging.

What happens next is decided in code, not by the agent:

- Emergency: fixed reply (call 911 or the local emergency number, Poison Control 1-800-222-1222),
  no agent.
- Adverse event or complaint: a case reference (`AE-` / `PC-` + date + 4 characters) is created up
  front. The case is recorded in the background and the safety team is alerted on Telegram. The
  agent is told the reference and must acknowledge it and ask for missing minimum information.
  A second message in the same chat about the same product adds follow-up information to the same
  case instead of opening a new one.
- Off-label: the agent gets a turn-specific instruction that depends on the role (table above).
- Dry runs (evaluation) record the route but create no cases and send no alerts.

## Accounts and credentials (all exist)

| n8n credential | Used for |
|----------------|----------|
| `OpenAI account` (GQdth43VUJxkSsw9) | All models and embeddings (`text-embedding-3-small`, 1536 dimensions) |
| `Postgres account` (KuHYFOV4eYWj9L5O) | All `kb_*` tables and SQL functions, chat memory |
| `Google Drive account` (sN9bbP0t0u0A88QU) | Knowledge folder tree, Docs export, file downloads |
| `Google Sheets account` (D8rKxzgMrJwmFZoQ) | Product catalog sheet (setup only; sync reads it through Drive export) |
| `Telegram account` (V3kTN1drqw8YNjzk) | Safety alerts and the weekly report, outbound only |

No Gmail: the samuelgurru account is restricted, and AE alert wording is exactly the kind of
content that triggers abuse filters.

## Supabase (`supabase/setup.sql`, run by MedInfo 0: Setup)

| Table | Purpose |
|-------|---------|
| `kb_documents` | One row per Drive file: document number, title, product, type, version, effective date, status (current or superseded), access level, URL, modified time, parse method and flags, summary, chunk count |
| `kb_chunks` | Chunk text, context line, section path, page, embedding `vector(1536)`, full-text `tsvector` (title weight A, section B, text C) |
| `kb_products` | Product catalog rows (NDC, strength, pack, storage, list price, supply status) |
| `kb_turns` | Audit trail: every question, answer, role, channel, route, flags, cited chunk IDs with document number and version, latency, feedback |
| `kb_cases` | Adverse events, product complaints and Medical Information requests, with due time and follow-ups |
| `kb_chat_histories` | Postgres Chat Memory |

Functions (each takes one `jsonb` and returns `jsonb`): `kb_index_document`,
`kb_delete_document`, `kb_registry`, `kb_search`, `kb_read_section`, `kb_lookup_product`,
`kb_replace_products`, `kb_record_turn`, `kb_upsert_case`, `kb_feedback`, `kb_weekly_stats`.
Row level security is on for every table with no policies, and execute on every function is
revoked from `anon` and `authenticated`, so the public Supabase key can neither read the tables
nor call the functions.

### Hybrid search (`kb_search`)
1. Filter chunks by the caller's access levels, product (or `general`), and `current` status
   unless superseded versions are asked for.
2. Vector ranking: cosine distance, top 40.
3. Keyword ranking: the query's words OR-ed into a `tsquery`, `ts_rank_cd`, top 40. This is what
   finds exact strings like NDC numbers, lot numbers and document numbers that embeddings blur.
4. Reciprocal rank fusion, `1/(50 + rank)` from each list, top 20 returned.

### Versions
Documents with the same document number (`LRK-PI-QNV`) are versions of each other. The one with the
latest effective date is `current`, older ones `superseded`, recomputed inside the same transaction
whenever a version is indexed or deleted. Superseded text is only searched when the agent asks for
it ("what changed in the renal dosing?").

## Knowledge content (fictional)

Products:
- **Quenvara** (davorixaban) tablets 2.5 mg, 5 mg: oral factor Xa inhibitor (anticoagulant).
- **Lumetra** (pelvaglutide) injection, prefilled pen 0.5 mg, 1 mg, 2 mg: once-weekly GLP-1
  receptor agonist for type 2 diabetes.
- **Aurivex** (cefovatrin) for oral suspension 125 mg/5 mL, 250 mg/5 mL: paediatric cephalosporin
  antibiotic.

Drive folder `Larkmoor MedInfo Knowledge` with subfolders:
- `Public`: Prescribing Information for each product (PDF); the previous Quenvara PI (v4.0, now
  superseded, with different renal dosing); a scanned Dear HCP letter changing the Aurivex
  reconstitution volume for new bottles (image-only PDF, tests OCR and conflict handling).
- `Medical`: standard response letters (Google Docs) on off-label topics: Quenvara with mechanical
  heart valves, crushing Quenvara for feeding tubes, Aurivex under 3 months, Lumetra temperature
  excursions.
- `Internal`: SOPs (Google Docs) for adverse event intake, off-label requests and product
  complaints.
- `Data`: `Larkmoor Product Catalog` (Google Sheet), synced to `kb_products`.

Sources live in `knowledge/src/` (Markdown) and are rendered to `knowledge/out/` by
`knowledge/build.py`.

## Workflows

| # | Workflow | Trigger |
|---|----------|---------|
| 0 | MedInfo 0: Setup | Manual, run once (schema, folders, upload content, catalog) |
| 1 | MedInfo 1: Sync Knowledge | Every 15 minutes + manual (with full rebuild option) |
| 2 | MedInfo 2: Index Document | Called by 1, once per changed file |
| 3 | MedInfo 3: Search Knowledge | Agent tool |
| 4 | MedInfo 4: Agent Tools | Agent tools: `read_section`, `lookup_product`, `request_medical_information` |
| 5 | MedInfo 5: Answer | Called by 6 and 8: screen, route, agent, citations |
| 6 | MedInfo 6: Chat API | Webhooks `POST /webhook/medinfo/chat` and `/webhook/medinfo/feedback` |
| 7 | MedInfo 7: Record Turn | Called by 5 without waiting: audit row, cases, Telegram alert |
| 8 | MedInfo 8: Evaluation | Evaluation Trigger (Data Table `MedInfo Eval`) |
| 9 | MedInfo 9: Weekly Insights | Mondays 08:00 America/New_York |

Errors go to **Lead Engine 0: Error Alerts** like the other projects.

### 1. Sync Knowledge
1. List every file under the four subfolders (Drive search, `trashed = false`).
2. Read `kb_registry` (ID, modified time, parse version).
3. Diff: new or changed files go to MedInfo 2 one at a time (a failure on one file doesn't stop
   the others and is reported); files no longer in Drive are deleted with `kb_delete_document`.
4. The catalog sheet is exported as CSV and replaces `kb_products` when it changed.

### 2. Index Document
1. Download by type: Google Doc exported as Markdown (backslash escapes stripped); PDF downloaded.
2. PDF: text layer extracted per page and, for files up to 25 pages, the PDF read by
   `gpt-5.4-mini` into Markdown with `<!-- page N -->` markers. Every number in the model's version
   must appear in the text layer (98%+), otherwise the text layer is used and the document is
   flagged `transcription_mismatch`. No text layer at all: the model's reading is used and
   flagged `ocr_unverified`.
3. Header block parsed with regular expressions (`Document No.`, `Version`, `Effective date`,
   `Product`, `Document type`).
4. Guard: under 300 characters of text is an error, never an empty index.
5. Chunking: split on headings (section path kept, e.g. `2 Dosage > 2.3 Renal impairment`), about
   1,200 characters, Markdown tables never split mid-row and the header row repeated when a table
   is split, page number tracked.
6. Context: one `gpt-5.4-mini` call per 30 chunks with the whole document, returning a summary,
   any missing header fields and one context sentence per chunk.
7. Embeddings: one batched call (`title | section`, context, text).
8. `kb_index_document`: replaces the document's chunks and recomputes version status in one
   transaction.

### 3. Search Knowledge (tool `search_knowledge`)
Inputs from the model: `query` (standalone, with product names), `product` (or `any`),
`include_superseded`. Fixed by expression: `allowed_access`, `session_id`.
Embed → `kb_search` (20) → model rerank (0-3 per passage, keep 2+, best 6) → JSON of passages,
each with a citation ID `c<chunk id>`, document number, title, version, effective date, status,
section, page and text. Nothing relevant returns `no_relevant_passages`.

### 4. Agent Tools
- `read_section`: the whole section around a cited chunk (access-checked), for long tables.
- `lookup_product`: catalog rows by product, strength or NDC (citation ID `p<row id>`).
- `request_medical_information`: creates an `MIR-` case for MI to answer directly. Name, contact
  and question required, 3 per chat at most.

### 5. Answer
Input: `message`, `session_id`, `role`, `channel`, `dry_run`.
1. Prepare: trim to 2,000 characters, resolve role and access levels, turn ID.
2. Last 6 messages from chat memory.
3. Compliance screen → route (code).
4. Emergency: fixed reply. Otherwise the agent: `gpt-5.4-mini`, reasoning low, max 6 steps,
   memory 10 messages, the four tools, a system prompt with role rules and this turn's
   compliance notes.
5. Finalize (code): turn `[c123]` citations into numbered references, remove any citation ID
   that wasn't retrieved this turn, build the source list (title, version, section, page, link,
   superseded flag), and label the route: `answered`, `not_in_documents`, `off_label_declined`,
   `off_label_answered`, `safety_captured`, `emergency`, `error`.
6. MedInfo 7 records everything in the background.
Output: `{ answer, sources[], route, flags, case_refs[], turn_id, latency_ms }`.

### 6. Chat API
`POST /webhook/medinfo/chat` `{ session_id, message, role }` → the Answer output.
`POST /webhook/medinfo/feedback` `{ turn_id, rating: 1 | -1, comment }`.
CORS `*` for the demo page. On error, a fixed message with the (fictional) MI phone line.

### 8. Evaluation (Data Table `MedInfo Eval`)
Columns: `qid`, `role`, `question`, `expected_answer`, `expected_route`, `expected_doc`.
Metrics: `retrieval_hit` (expected document number among the sources), `route_ok`,
`grounded` (judge: every claim supported by the retrieved passages, 1-5), `Correctness`
(judge, 1-5).

### 9. Weekly Insights
Last 7 days excluding eval: questions by role, answer routes, thumbs up/down, cases opened and
still open past due, slowest turns; `gpt-5.4-mini` groups `not_in_documents` and thumbs-down
questions into knowledge gaps with the document to fix. Sent on Telegram.

## Config (Set node where needed)

| Key | Value |
|-----|-------|
| `MODEL` | `gpt-5.4-mini` |
| `ROLE_ACCESS` | `hcp: public`, `field: public,internal`, `medinfo: public,internal,medical` |
| `DEMO_ROLE_SWITCH` | `true` |
| `SAFETY_CHAT_ID` | Telegram chat ID for alerts (empty = no alert, case still recorded) |
| `MI_PHONE` | `1-800-555-0199` (fictional) |
| `MAX_MI_REQUESTS_PER_SESSION` | `3` |
| `APPROVED_LABELING` | Indication, population, dose and administration summary per product, for the screen |
