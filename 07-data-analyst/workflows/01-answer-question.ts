import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'ilfPostgresLocal', name: 'Ironleaf Postgres (local)' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const RUN_SQL = 'SELECT ironleaf.run_readonly(convert_from(decode($1, \'base64\'), \'UTF8\')) AS rows';

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 400], parameters: { inputSource: 'passthrough' } },
  output: [{ question: 'Which branch lost the most members last month?', session_id: 'web-abc', history: '[]' }]
});

const prompt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prompt', position: [420, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The question with today\'s date and the last few questions in this chat (for follow-ups).\n' +
        '// ---- lib-ilf.js (included by build.py): shared helpers for the Ironleaf workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const clip = (t, n) => { t = String(t || \'\').trim().replace(/\\.$/, \'\'); return t.length <= n ? t : t.slice(0, n).replace(/\\s+\\S*$/, \'\') + \'…\'; };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1f26;max-width:600px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:800;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#d9480f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '// ---- end lib-ilf.js ----\n' +
        'const i = $(\'When Called\').first().json;\n' +
        'const now = DateTime.now().setZone(TZ);\n' +
        'const history = parseJson(i.history, []).slice(-3).filter(h => h && h.question);\n' +
        'const prompt = \'Today is \' + now.toFormat(\'cccc d LLLL yyyy\') + \' (current_date in SQL).\\n\\n\'\n' +
        '  + (history.length ? \'Earlier in this chat:\\n\' + history.map(h => \'- Q: \' + h.question + (h.sql ? \'\\n  SQL: \' + h.sql : \'\')).join(\'\\n\') + \'\\n\\n\' : \'\')\n' +
        '  + \'Question: \' + String(i.question || \'\').trim();\n' +
        'return [{ json: { question: String(i.question || \'\').trim(), prompt, started_ms: Date.now() } }];\n'
  } },
  output: [{ question: 'Which branch lost the most members last month?', prompt: 'Today is ...', started_ms: 0 }]
});

const writeSql = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Write SQL',
    position: [640, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text', operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
        'You turn questions from managers at Ironleaf Fitness, a chain of five gyms in Greater Manchester, into one PostgreSQL 17 query.\n' +
        '\n' +
        'Database (schema ironleaf):\n' +
        '- branches(id, name, area, opened_on, capacity). Branches: Ancoats, Didsbury, Salford Quays, Stockport, Altrincham.\n' +
        '- plans(id, name, monthly_price, description). Plans: Off-Peak, Standard, Premium, Student. Standard went from 32.99 to 34.99 about 7 months ago.\n' +
        '- members(id, first_name, last_name, birth_year, branch_id, plan_id, source, joined_on, cancelled_on, cancel_reason). source: walk-in, online, referral, corporate. cancelled_on is null while active. cancel_reason: moving away, cost, not using it, injury or health, price increase, moved to a competitor, other.\n' +
        '- payments(id, member_id, paid_on, amount, status). Monthly direct debits; status: paid, failed, refunded. Covers the last 18 months.\n' +
        '- visits(member_id, branch_id, checked_in_at). One row per gym check-in (the branch they visited). Covers the last 18 months.\n' +
        '- classes(id, branch_id, class_type, instructor, starts_at, capacity). class_type: HIIT, Spin, Yoga, Pilates, Strength, Boxfit. Covers the last 6 months.\n' +
        '- bookings(class_id, member_id, status). status: attended, no_show, cancelled.\n' +
        '\n' +
        'Definitions to use:\n' +
        '- Active on a date D: joined_on <= D and (cancelled_on is null or cancelled_on > D). "Members" or "active members" with no date means active today.\n' +
        '- New members in a period: joined_on in the period. Cancellations: cancelled_on in the period.\n' +
        '- Churn rate for a month: cancellations in the month divided by members active on the first day of that month, as a percentage.\n' +
        '- Revenue: sum of payments.amount where status = \'paid\'.\n' +
        '- "Last month" is the previous calendar month; "this month" is month to date; "last week" is the previous Monday to Sunday; "the last N days" means the N days ending yesterday (date >= current_date - N and date < current_date); "the last N months" means the last N full calendar months, not the current month (date >= date_trunc(\'month\', current_date) - N months and date < date_trunc(\'month\', current_date)) unless the question says to include this month. Use current_date for today; the data runs up to yesterday.\n' +
        '- Class fill rate: bookings that are not cancelled divided by capacity. No-show rate: no_show divided by bookings that are not cancelled.\n' +
        '\n' +
        'Rules:\n' +
        '- One read-only query: SELECT, or WITH ... SELECT. No semicolons, no comments, no other statements.\n' +
        '- Show branch, plan and class names, not ids. Name output columns in plain words with underscores (branch, new_members, churn_rate_pct).\n' +
        '- Round money to 2 decimals and percentages to 1 decimal (0 to 100). Cast counts to int.\n' +
        '- Time series: one row per period, the period first (as a date), ordered by period. Split by a category ("by branch"): one row per period and category (period, branch, value) ordered by period then category; x is the period, y the one value column, and the chart draws a line per category. Rankings: ordered, LIMIT 10 unless asked otherwise. Never return more than 200 rows.\n' +
        '- Don\'t list individual members\' names unless the question asks for them.\n' +
        '- If a follow-up question ("and last year?") refers to an earlier one, reuse its meaning.\n' +
        '- If the question can\'t be answered from these tables (for example questions about marketing spend, staff rotas or opinions), set can_answer to false and say what data would be needed in clarification. If it is ambiguous but a sensible reading exists, answer it and state the assumption.\n' +
        '- chart: the best way to show the result. number for a single value; line for a time series; bar for comparing categories; pie only for a share of a whole with 6 or fewer parts; table otherwise. x is the label column, y the value column(s). title is short and plain.\n' +
        '- explanation: one plain sentence a manager would understand, saying what the query counts.\n'
        ,
        maxTokens: 4000, store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'sql_plan', strict: true, schema:
        '{"type": "object", "additionalProperties": false, "required": ["can_answer", "clarification", "sql", "explanation", "assumptions", "chart"], "properties": {"can_answer": {"type": "boolean"}, "clarification": {"type": "string"}, "sql": {"type": "string"}, "explanation": {"type": "string"}, "assumptions": {"type": "array", "items": {"type": "string"}}, "chart": {"type": "object", "additionalProperties": false, "required": ["type", "x", "y", "title"], "properties": {"type": {"type": "string", "enum": ["number", "line", "bar", "pie", "table"]}, "x": {"type": "string"}, "y": {"type": "array", "items": {"type": "string"}}, "title": {"type": "string"}}}}}\n'
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { can_answer: true, sql: 'SELECT 1' } }] }] }]
});

const checkSql = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check SQL', position: [860, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'const ATTEMPT = 1;\n' +
        '// Checks the model\'s SQL before it goes anywhere near the database: one SELECT (or WITH ... SELECT),\n' +
        '// no semicolons or comments, no write or admin keywords. The database itself is the real guard\n' +
        '// (read-only role, STABLE function), this just gives a clear error early.\n' +
        '// ---- lib-ilf.js (included by build.py): shared helpers for the Ironleaf workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const clip = (t, n) => { t = String(t || \'\').trim().replace(/\\.$/, \'\'); return t.length <= n ? t : t.slice(0, n).replace(/\\s+\\S*$/, \'\') + \'…\'; };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1f26;max-width:600px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:800;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#d9480f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '// ---- end lib-ilf.js ----\n' +
        'const plan = aiJson($input.first().json);\n' +
        'const base = $(\'Prompt\').first().json;\n' +
        'const out = { attempt: ATTEMPT, plan, ok: false, error: \'\', sql: \'\', sql_b64: \'\' };\n' +
        'if (!plan) out.error = \'The AI did not return a query.\';\n' +
        'else if (!plan.can_answer) out.error = \'\';\n' +
        'else {\n' +
        '  let sql = String(plan.sql || \'\').trim().replace(/;\\s*$/, \'\');\n' +
        '  const bad = [];\n' +
        '  if (!/^(select|with)\\b/i.test(sql)) bad.push(\'it must start with SELECT or WITH\');\n' +
        '  if (/;/.test(sql)) bad.push(\'only one statement is allowed\');\n' +
        '  if (/--|\\/\\*/.test(sql)) bad.push(\'no comments\');\n' +
        '  const kw = sql.replace(/\'(?:[^\']|\'\')*\'/g, "\'\'").match(/\\b(insert|update|delete|merge|drop|alter|create|grant|revoke|truncate|copy|vacuum|analyze|call|do|set|reset|lock|listen|notify|prepare|execute|comment|refresh|cluster|reindex|pg_sleep|pg_read_file|pg_read_binary_file|pg_terminate_backend|lo_import|dblink|set_config)\\b/i);\n' +
        '  if (kw) bad.push(\'"\' + kw[1] + \'" is not allowed\');\n' +
        '  if (sql.length > 6000) bad.push(\'the query is too long\');\n' +
        '  if (bad.length) out.error = \'Query rejected: \' + bad.join(\'; \') + \'.\';\n' +
        '  else Object.assign(out, { ok: true, sql, sql_b64: Buffer.from(sql, \'utf8\').toString(\'base64\') });\n' +
        '}\n' +
        'return [{ json: { ...out, can_answer: plan ? !!plan.can_answer : true, started_ms: base.started_ms } }];\n'
  } },
  output: [{ ok: true, attempt: 1, sql: 'SELECT 1', sql_b64: 'U0VMRUNUIDE=', can_answer: true }]
});

const canRun = ifElse({
  version: 2.2,
  config: {
    name: 'Safe to Run?',
    position: [1080, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const runQuery = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Run Query',
    position: [1300, 300],
    onError: 'continueRegularOutput',
    parameters: { operation: 'executeQuery', query: RUN_SQL, options: { queryReplacement: expr('{{ $json.sql_b64 }}'), largeNumbersOutput: 'numbers' } },
    credentials: PG_CRED
  },
  output: [{ rows: [{ branch: 'Salford Quays', cancellations: 41 }] }]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result', position: [1520, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What the query returned, from the second attempt if there was one. On a database error the first\n' +
        '// time, asks for one fix (needs_fix); after that it gives up with the error.\n' +
        'const run = $input.first().json || {};\n' +
        'const chk = $(\'Check SQL\').first().json;\n' +
        'const rows = Array.isArray(run.rows) ? run.rows : (typeof run.rows === \'string\' ? JSON.parse(run.rows) : null);\n' +
        'const err = run.error ? String(run.error.message || run.error.description || run.error) : (rows ? \'\' : \'The query returned nothing usable.\');\n' +
        'return [{ json: { ok: !err, rows: rows || [], error: err, needs_fix: !!err && chk.attempt === 1, sql: chk.sql, plan: chk.plan,\n' +
        '  fix_prompt: err ? $(\'Prompt\').first().json.prompt + \'\\n\\nThis SQL failed:\\n\' + chk.sql + \'\\n\\nDatabase error: \' + err + \'\\n\\nReturn a corrected query.\' : \'\' } }];\n'
  } },
  output: [{ ok: true, rows: [], error: '', needs_fix: false, sql: 'SELECT 1' }]
});

const needsFix = ifElse({
  version: 2.2,
  config: {
    name: 'Needs a Fix?',
    position: [1740, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.needs_fix }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const fixSql = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Fix SQL',
    position: [1960, 140],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text', operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.fix_prompt }}') }] },
      options: {
        instructions:
        'You turn questions from managers at Ironleaf Fitness, a chain of five gyms in Greater Manchester, into one PostgreSQL 17 query.\n' +
        '\n' +
        'Database (schema ironleaf):\n' +
        '- branches(id, name, area, opened_on, capacity). Branches: Ancoats, Didsbury, Salford Quays, Stockport, Altrincham.\n' +
        '- plans(id, name, monthly_price, description). Plans: Off-Peak, Standard, Premium, Student. Standard went from 32.99 to 34.99 about 7 months ago.\n' +
        '- members(id, first_name, last_name, birth_year, branch_id, plan_id, source, joined_on, cancelled_on, cancel_reason). source: walk-in, online, referral, corporate. cancelled_on is null while active. cancel_reason: moving away, cost, not using it, injury or health, price increase, moved to a competitor, other.\n' +
        '- payments(id, member_id, paid_on, amount, status). Monthly direct debits; status: paid, failed, refunded. Covers the last 18 months.\n' +
        '- visits(member_id, branch_id, checked_in_at). One row per gym check-in (the branch they visited). Covers the last 18 months.\n' +
        '- classes(id, branch_id, class_type, instructor, starts_at, capacity). class_type: HIIT, Spin, Yoga, Pilates, Strength, Boxfit. Covers the last 6 months.\n' +
        '- bookings(class_id, member_id, status). status: attended, no_show, cancelled.\n' +
        '\n' +
        'Definitions to use:\n' +
        '- Active on a date D: joined_on <= D and (cancelled_on is null or cancelled_on > D). "Members" or "active members" with no date means active today.\n' +
        '- New members in a period: joined_on in the period. Cancellations: cancelled_on in the period.\n' +
        '- Churn rate for a month: cancellations in the month divided by members active on the first day of that month, as a percentage.\n' +
        '- Revenue: sum of payments.amount where status = \'paid\'.\n' +
        '- "Last month" is the previous calendar month; "this month" is month to date; "last week" is the previous Monday to Sunday; "the last N days" means the N days ending yesterday (date >= current_date - N and date < current_date); "the last N months" means the last N full calendar months, not the current month (date >= date_trunc(\'month\', current_date) - N months and date < date_trunc(\'month\', current_date)) unless the question says to include this month. Use current_date for today; the data runs up to yesterday.\n' +
        '- Class fill rate: bookings that are not cancelled divided by capacity. No-show rate: no_show divided by bookings that are not cancelled.\n' +
        '\n' +
        'Rules:\n' +
        '- One read-only query: SELECT, or WITH ... SELECT. No semicolons, no comments, no other statements.\n' +
        '- Show branch, plan and class names, not ids. Name output columns in plain words with underscores (branch, new_members, churn_rate_pct).\n' +
        '- Round money to 2 decimals and percentages to 1 decimal (0 to 100). Cast counts to int.\n' +
        '- Time series: one row per period, the period first (as a date), ordered by period. Split by a category ("by branch"): one row per period and category (period, branch, value) ordered by period then category; x is the period, y the one value column, and the chart draws a line per category. Rankings: ordered, LIMIT 10 unless asked otherwise. Never return more than 200 rows.\n' +
        '- Don\'t list individual members\' names unless the question asks for them.\n' +
        '- If a follow-up question ("and last year?") refers to an earlier one, reuse its meaning.\n' +
        '- If the question can\'t be answered from these tables (for example questions about marketing spend, staff rotas or opinions), set can_answer to false and say what data would be needed in clarification. If it is ambiguous but a sensible reading exists, answer it and state the assumption.\n' +
        '- chart: the best way to show the result. number for a single value; line for a time series; bar for comparing categories; pie only for a share of a whole with 6 or fewer parts; table otherwise. x is the label column, y the value column(s). title is short and plain.\n' +
        '- explanation: one plain sentence a manager would understand, saying what the query counts.\n'
        ,
        maxTokens: 4000, store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'sql_plan', strict: true, schema:
        '{"type": "object", "additionalProperties": false, "required": ["can_answer", "clarification", "sql", "explanation", "assumptions", "chart"], "properties": {"can_answer": {"type": "boolean"}, "clarification": {"type": "string"}, "sql": {"type": "string"}, "explanation": {"type": "string"}, "assumptions": {"type": "array", "items": {"type": "string"}}, "chart": {"type": "object", "additionalProperties": false, "required": ["type", "x", "y", "title"], "properties": {"type": {"type": "string", "enum": ["number", "line", "bar", "pie", "table"]}, "x": {"type": "string"}, "y": {"type": "array", "items": {"type": "string"}}, "title": {"type": "string"}}}}}\n'
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { can_answer: true, sql: 'SELECT 1' } }] }] }]
});

const checkFix = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Fixed SQL', position: [2180, 140], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'const ATTEMPT = 2;\n' +
        '// Checks the model\'s SQL before it goes anywhere near the database: one SELECT (or WITH ... SELECT),\n' +
        '// no semicolons or comments, no write or admin keywords. The database itself is the real guard\n' +
        '// (read-only role, STABLE function), this just gives a clear error early.\n' +
        '// ---- lib-ilf.js (included by build.py): shared helpers for the Ironleaf workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const clip = (t, n) => { t = String(t || \'\').trim().replace(/\\.$/, \'\'); return t.length <= n ? t : t.slice(0, n).replace(/\\s+\\S*$/, \'\') + \'…\'; };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1f26;max-width:600px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:800;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#d9480f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '// ---- end lib-ilf.js ----\n' +
        'const plan = aiJson($input.first().json);\n' +
        'const base = $(\'Prompt\').first().json;\n' +
        'const out = { attempt: ATTEMPT, plan, ok: false, error: \'\', sql: \'\', sql_b64: \'\' };\n' +
        'if (!plan) out.error = \'The AI did not return a query.\';\n' +
        'else if (!plan.can_answer) out.error = \'\';\n' +
        'else {\n' +
        '  let sql = String(plan.sql || \'\').trim().replace(/;\\s*$/, \'\');\n' +
        '  const bad = [];\n' +
        '  if (!/^(select|with)\\b/i.test(sql)) bad.push(\'it must start with SELECT or WITH\');\n' +
        '  if (/;/.test(sql)) bad.push(\'only one statement is allowed\');\n' +
        '  if (/--|\\/\\*/.test(sql)) bad.push(\'no comments\');\n' +
        '  const kw = sql.replace(/\'(?:[^\']|\'\')*\'/g, "\'\'").match(/\\b(insert|update|delete|merge|drop|alter|create|grant|revoke|truncate|copy|vacuum|analyze|call|do|set|reset|lock|listen|notify|prepare|execute|comment|refresh|cluster|reindex|pg_sleep|pg_read_file|pg_read_binary_file|pg_terminate_backend|lo_import|dblink|set_config)\\b/i);\n' +
        '  if (kw) bad.push(\'"\' + kw[1] + \'" is not allowed\');\n' +
        '  if (sql.length > 6000) bad.push(\'the query is too long\');\n' +
        '  if (bad.length) out.error = \'Query rejected: \' + bad.join(\'; \') + \'.\';\n' +
        '  else Object.assign(out, { ok: true, sql, sql_b64: Buffer.from(sql, \'utf8\').toString(\'base64\') });\n' +
        '}\n' +
        'return [{ json: { ...out, can_answer: plan ? !!plan.can_answer : true, started_ms: base.started_ms } }];\n'
  } },
  output: [{ ok: true, attempt: 2, sql: 'SELECT 1', sql_b64: 'U0VMRUNUIDE=' }]
});

const fixOk = ifElse({
  version: 2.2,
  config: {
    name: 'Fixed Query Safe?',
    position: [2400, 140],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const runFixed = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Run Fixed Query',
    position: [2620, 60],
    onError: 'continueRegularOutput',
    parameters: { operation: 'executeQuery', query: RUN_SQL, options: { queryReplacement: expr('{{ $json.sql_b64 }}'), largeNumbersOutput: 'numbers' } },
    credentials: PG_CRED
  },
  output: [{ rows: [] }]
});

const resultFix = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result (Fixed)', position: [2840, 140], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The second attempt\'s result (no more retries).\n' +
        'const run = $input.first().json || {};\n' +
        'const chk = $(\'Check Fixed SQL\').first().json;\n' +
        'const rows = Array.isArray(run.rows) ? run.rows : (typeof run.rows === \'string\' ? JSON.parse(run.rows) : null);\n' +
        'const err = !chk.ok ? (chk.error || \'The corrected query was rejected.\') : run.error ? String(run.error.message || run.error.description || run.error) : (rows ? \'\' : \'The query returned nothing usable.\');\n' +
        'return [{ json: { ok: !err, rows: rows || [], error: err, needs_fix: false, sql: chk.sql, plan: chk.plan || $(\'Check SQL\').first().json.plan } }];\n'
  } },
  output: [{ ok: true, rows: [], error: '', sql: 'SELECT 1' }]
});

const rowsOk = ifElse({
  version: 2.2,
  config: {
    name: 'Got Rows?',
    position: [3060, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const answerInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer Input', position: [3280, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The result for the answer writer: question, what was counted, and the rows (first 40).\n' +
        'const r = $input.first().json;\n' +
        'const p = r.plan || {};\n' +
        'const rows = r.rows.slice(0, 40);\n' +
        'return [{ json: { ...r, prompt: \'Question: \' + $(\'Prompt\').first().json.question + \'\\nWhat the query counts: \' + (p.explanation || \'\') + \'\\nAssumptions: \' + ((p.assumptions || []).join(\'; \') || \'none\')\n' +
        '  + \'\\nRows returned: \' + r.rows.length + (r.rows.length > 40 ? \' (first 40 shown)\' : \'\') + \'\\n\' + JSON.stringify(rows) } }];\n'
  } },
  output: [{ ok: true, rows: [], prompt: 'Question: ...' }]
});

const writeAnswer = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Write Answer',
    position: [3500, 300],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text', operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
        'You explain a query result to a gym manager in plain English.\n' +
        '\n' +
        '- answer: 1 to 3 short sentences that answer the question directly. Use only numbers that appear in the rows; write them with thousands separators (18,727), money as £1,234.56 and percentages with %. Name the top or notable items. If there are no rows, say nothing matched.\n' +
        '- Write dates the way a manager says them: months as July 2026, days as Mon 12 Oct, hours of the day as 7am or 6pm. Never write dates like 2026-07-01.\n' +
        '- Don\'t explain SQL, don\'t speculate about causes, and don\'t add facts that aren\'t in the rows.\n' +
        '- note: a short caveat if one of the assumptions matters for reading the result (for example "Counts check-ins, not unique members"), otherwise empty.\n'
        ,
        maxTokens: 1500, store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'answer', strict: true, schema:
        '{"type": "object", "additionalProperties": false, "required": ["answer", "note"], "properties": {"answer": {"type": "string"}, "note": {"type": "string"}}}\n'
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { answer: 'Salford Quays lost the most.', note: '' } }] }] }]
});

const answer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer', position: [3720, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The final answer for the chat page, in one shape for every outcome: answered, needs a different\n' +
        '// question, or failed.\n' +
        '// ---- lib-ilf.js (included by build.py): shared helpers for the Ironleaf workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const clip = (t, n) => { t = String(t || \'\').trim().replace(/\\.$/, \'\'); return t.length <= n ? t : t.slice(0, n).replace(/\\s+\\S*$/, \'\') + \'…\'; };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1f26;max-width:600px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:800;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#d9480f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '// ---- end lib-ilf.js ----\n' +
        'const p0 = $(\'Prompt\').first().json;\n' +
        'const chk = $(\'Check SQL\').first().json;\n' +
        'const ms = Date.now() - p0.started_ms;\n' +
        'if (chk.plan && !chk.can_answer) {\n' +
        '  return [{ json: { ok: false, kind: \'clarify\', answer: chk.plan.clarification || \'I can\\\'t answer that from the gym data.\', sql: \'\', columns: [], rows: [], row_count: 0, chart: { type: \'table\' }, note: \'\', attempts: 1, ms } }];\n' +
        '}\n' +
        'const r = $(\'Write Answer\').isExecuted ? $(\'Answer Input\').first().json : ($(\'Result (Fixed)\').isExecuted ? $(\'Result (Fixed)\').first().json : ($(\'Result\').isExecuted ? $(\'Result\').first().json : chk));\n' +
        'const attempts = $(\'Fix SQL\').isExecuted ? 2 : 1;\n' +
        'if (!r.ok) {\n' +
        '  return [{ json: { ok: false, kind: \'error\', answer: \'Sorry, I couldn\\\'t get that from the data (\' + (r.error || \'unknown error\').slice(0, 200) + \'). Try asking it another way.\', sql: r.sql || \'\', columns: [], rows: [], row_count: 0, chart: { type: \'table\' }, note: \'\', attempts, ms } }];\n' +
        '}\n' +
        'const a = aiJson($(\'Write Answer\').first().json) || { answer: r.rows.length ? \'Here is what the data shows.\' : \'Nothing matched.\', note: \'\' };\n' +
        'const plan = r.plan || {};\n' +
        'return [{ json: { ok: true, kind: \'answer\', answer: a.answer, note: a.note, explanation: plan.explanation || \'\', assumptions: plan.assumptions || [],\n' +
        '  sql: r.sql, columns: r.rows.length ? Object.keys(r.rows[0]) : [], rows: r.rows.slice(0, 200), row_count: r.rows.length, chart: plan.chart || { type: \'table\' }, attempts, ms } }];\n'
  } },
  output: [{ ok: true, kind: 'answer', answer: 'Salford Quays lost the most.', sql: 'SELECT 1', columns: [], rows: [], chart: { type: 'bar' } }]
});

const note = sticky(
  '## Ironleaf 1: Answer Question\nOne question in plain English → one answer with the data behind it.\n1. **Write SQL**: GPT-5.4 gets the documented schema and business definitions (active member, churn, revenue…) and returns one query, a chart choice and its assumptions. Questions the data can\'t answer get a clarification instead.\n2. **Check SQL** (code): one SELECT, no semicolons, comments or write keywords.\n3. **Run Query**: inside `ironleaf.run_readonly()`: read-only role, writes refused, 500 rows max, 10 s limit.\n4. If Postgres rejects it, **Fix SQL** gets the error and one more try.\n5. **Write Answer**: GPT-5.4 mini explains the rows in 1-3 sentences, using only numbers from the rows.',
  [], { position: [160, -120], width: 1500, height: 260, color: 5 }
);

export default workflow('ironleaf-answer-question', 'Ironleaf 1: Answer Question')
  .add(whenCalled)
  .to(prompt)
  .to(writeSql)
  .to(checkSql)
  .to(canRun
    .onTrue(runQuery.to(result).to(needsFix
      .onTrue(fixSql.to(checkFix).to(fixOk
        .onTrue(runFixed.to(resultFix))
        .onFalse(resultFix)))
      .onFalse(rowsOk)))
    .onFalse(answer))
  .add(resultFix)
  .to(rowsOk
    .onTrue(answerInput.to(writeAnswer).to(answer))
    .onFalse(answer))
  .add(note);
