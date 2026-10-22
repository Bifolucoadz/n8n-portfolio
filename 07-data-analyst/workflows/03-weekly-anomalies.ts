import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'ilfPostgresLocal', name: 'Ironleaf Postgres (local)' } };
const SETTINGS = { __rl: true, mode: 'id', value: 'eLHuDVWvuDw7XkhB', cachedResultName: 'Ironleaf Settings' };
const REPORTS = { __rl: true, mode: 'id', value: 'B5yiB01JQHOCKTZ2', cachedResultName: 'Ironleaf Reports' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ilfSendEmail0005', cachedResultName: 'Ironleaf 5: Send Email' };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const monday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Mondays 7:00', position: [200, 300], parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 7, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const runNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [440, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'anomaly_z', value: '2' }]
});

const query = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Weekly Query', position: [660, 400], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The fixed weekly query, as a base64 parameter for the read-only function.\n' +
        'const sql =\n' +
        '"WITH weeks AS (\\n  SELECT generate_series(date_trunc(\'week\', current_date) - interval \'9 weeks\', date_trunc(\'week\', current_date) - interval \'1 week\', interval \'1 week\')::date AS wk\\n),\\nv AS (\\n  SELECT branch_id, date_trunc(\'week\', checked_in_at)::date AS wk, count(*)::int AS n FROM visits\\n  WHERE checked_in_at >= date_trunc(\'week\', current_date) - interval \'9 weeks\' AND checked_in_at < date_trunc(\'week\', current_date) GROUP BY 1, 2\\n),\\nj AS (\\n  SELECT branch_id, date_trunc(\'week\', joined_on)::date AS wk, count(*)::int AS n FROM members\\n  WHERE joined_on >= date_trunc(\'week\', current_date) - interval \'9 weeks\' AND joined_on < date_trunc(\'week\', current_date) GROUP BY 1, 2\\n),\\nc AS (\\n  SELECT branch_id, date_trunc(\'week\', cancelled_on)::date AS wk, count(*)::int AS n FROM members\\n  WHERE cancelled_on >= date_trunc(\'week\', current_date) - interval \'9 weeks\' AND cancelled_on < date_trunc(\'week\', current_date) GROUP BY 1, 2\\n),\\np AS (\\n  SELECT m.branch_id, date_trunc(\'week\', p.paid_on)::date AS wk, count(*) FILTER (WHERE p.status = \'failed\')::int AS failed,\\n    coalesce(round(sum(p.amount) FILTER (WHERE p.status = \'paid\'), 2), 0) AS revenue\\n  FROM payments p JOIN members m ON m.id = p.member_id\\n  WHERE p.paid_on >= date_trunc(\'week\', current_date) - interval \'9 weeks\' AND p.paid_on < date_trunc(\'week\', current_date) GROUP BY 1, 2\\n)\\nSELECT b.name AS branch, w.wk AS week, coalesce(v.n, 0) AS check_ins, coalesce(j.n, 0) AS new_members, coalesce(c.n, 0) AS cancellations,\\n  coalesce(p.failed, 0) AS failed_payments, coalesce(p.revenue, 0) AS revenue\\nFROM branches b CROSS JOIN weeks w\\nLEFT JOIN v ON v.branch_id = b.id AND v.wk = w.wk\\nLEFT JOIN j ON j.branch_id = b.id AND j.wk = w.wk\\nLEFT JOIN c ON c.branch_id = b.id AND c.wk = w.wk\\nLEFT JOIN p ON p.branch_id = b.id AND p.wk = w.wk\\nWHERE w.wk >= b.opened_on - 7\\nORDER BY 1, 2\\n"\n' +
        ';\n' +
        'return [{ json: { sql_b64: Buffer.from(sql, \'utf8\').toString(\'base64\') } }];\n'
  } },
  output: [{ sql_b64: 'U0VMRUNUIDE=' }]
});

const run = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Last 9 Weeks',
    position: [880, 400],
    parameters: { operation: 'executeQuery', query: 'SELECT ironleaf.run_readonly(convert_from(decode($1, \'base64\'), \'UTF8\')) AS rows', options: { queryReplacement: expr('{{ $json.sql_b64 }}'), largeNumbersOutput: 'numbers' } },
    credentials: PG_CRED
  },
  output: [{ rows: [{ branch: 'Stockport', week: '2026-10-12', check_ins: 203 }] }]
});

const flags = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Flag Changes', position: [1100, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Last full week vs the 8 weeks before, per branch and metric (code, not AI). A change is flagged when it\n' +
        '// is at least `anomaly_z` standard deviations from the average AND at least `anomaly_min_change_pct`\n' +
        '// away from it, and the numbers aren\'t tiny.\n' +
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
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'const rows = (() => { const r = $input.first().json.rows; return Array.isArray(r) ? r : JSON.parse(r || \'[]\'); })();\n' +
        'const Z = Number(s.anomaly_z || 2), MIN = Number(s.anomaly_min_change_pct || 15);\n' +
        'const METRICS = { check_ins: \'check-ins\', new_members: \'new members\', cancellations: \'cancellations\', failed_payments: \'failed payments\', revenue: \'revenue (£)\' };\n' +
        'const weeks = [...new Set(rows.map(r => r.week))].sort();\n' +
        'const last = weeks[weeks.length - 1];\n' +
        'const flags = [], totals = {};\n' +
        'for (const branch of [...new Set(rows.map(r => r.branch))]) {\n' +
        '  const br = rows.filter(r => r.branch === branch);\n' +
        '  for (const m of Object.keys(METRICS)) {\n' +
        '    const now = Number((br.find(r => r.week === last) || {})[m] || 0);\n' +
        '    const before = br.filter(r => r.week !== last).map(r => Number(r[m]));\n' +
        '    const mean = before.reduce((a, b) => a + b, 0) / before.length;\n' +
        '    const sd = Math.sqrt(before.reduce((a, b) => a + (b - mean) ** 2, 0) / before.length) || 1;\n' +
        '    const z = (now - mean) / Math.max(sd, 1);\n' +
        '    const pct = mean ? 100 * (now - mean) / mean : 0;\n' +
        '    totals[m] = totals[m] || { last: 0, usual: 0 };\n' +
        '    totals[m].last += now; totals[m].usual += mean;\n' +
        '    if (Math.abs(z) >= Z && Math.abs(pct) >= MIN && (mean >= 3 || now >= 5)) {\n' +
        '      flags.push({ branch, metric: METRICS[m], last_week: Math.round(now * 100) / 100, usual: Math.round(mean * 10) / 10, change_pct: Math.round(pct), z: Math.round(z * 10) / 10 });\n' +
        '    }\n' +
        '  }\n' +
        '}\n' +
        'flags.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));\n' +
        'const weekLabel = DateTime.fromISO(last).toFormat(\'d LLL\') + \' to \' + DateTime.fromISO(last).plus({ days: 6 }).toFormat(\'d LLL yyyy\');\n' +
        'const prompt = \'Last week: \' + weekLabel + \'.\\n\\nFlagged changes (last week vs the average of the 8 weeks before):\\n\'\n' +
        '  + (flags.length ? flags.map(f => \'- \' + f.branch + \', \' + f.metric + \': \' + f.last_week + \' vs usual \' + f.usual + \' (\' + (f.change_pct > 0 ? \'+\' : \'\') + f.change_pct + \'%, z = \' + f.z + \')\').join(\'\\n\') : \'- none\')\n' +
        '  + \'\\n\\nWhole chain last week vs usual:\\n\' + Object.entries(totals).map(([m, t]) => \'- \' + METRICS[m] + \': \' + Math.round(t.last) + \' vs \' + Math.round(t.usual)).join(\'\\n\');\n' +
        'return [{ json: { week: last, week_label: weekLabel, flags, totals, prompt } }];\n'
  } },
  output: [{ week: '2026-10-12', flags: [], prompt: 'Last week: ...' }]
});

const write = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Write Summary',
    position: [1320, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text', operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
        'You write the Monday note for the owner of Ironleaf Fitness, a chain of five gyms.\n' +
        '\n' +
        '- headline: one sentence with the most important change last week and its numbers.\n' +
        '- items: one per flagged change, most important first. what: the change in plain words with last week\'s number and the usual level ("Stockport had 203 check-ins, against a usual 368"). check: one practical thing the owner could check or ask the branch manager. Don\'t guess the cause; you may say what would explain it.\n' +
        '- If nothing was flagged, headline says it was a normal week and items is empty.\n' +
        '- Use only the numbers given.\n'
        ,
        maxTokens: 2500, store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'anomalies', strict: true, schema:
        '{"type": "object", "additionalProperties": false, "required": ["headline", "items"], "properties": {"headline": {"type": "string"}, "items": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["branch", "metric", "what", "check"], "properties": {"branch": {"type": "string"}, "metric": {"type": "string"}, "what": {"type": "string"}, "check": {"type": "string"}}}}}}\n'
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { headline: 'Stockport check-ins fell 45%.', items: [] } }] }] }]
});

const report = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Report', position: [1540, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The Monday email and the saved report.\n' +
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
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'const f = $(\'Flag Changes\').first().json;\n' +
        'const x = aiJson($input.first().json) || { headline: f.flags.length ? f.flags.length + \' unusual changes last week.\' : \'A normal week.\', items: [] };\n' +
        'const cell = \'padding:6px 10px;border-bottom:1px solid #eee;text-align:left;font-size:13px\';\n' +
        'const worse = g => /cancellation|failed/.test(g.metric) ? g.change_pct > 0 : g.change_pct < 0;\n' +
        'const rows = f.flags.map(g => \'<tr><td style="\' + cell + \'"><b>\' + esc(g.branch) + \'</b></td><td style="\' + cell + \'">\' + esc(g.metric) + \'</td><td style="\' + cell + \'">\' + g.last_week + \'</td><td style="\' + cell + \'">\' + g.usual + \'</td><td style="\' + cell + \';color:\' + (worse(g) ? \'#c92a2a\' : \'#2b8a3e\') + \'"><b>\' + (g.change_pct > 0 ? \'+\' : \'\') + g.change_pct + \'%</b></td></tr>\').join(\'\');\n' +
        'const items = x.items.map(i => \'<li style="margin:0 0 8px"><b>\' + esc(i.branch) + \', \' + esc(i.metric) + \':</b> \' + esc(i.what) + \'<br><span style="color:#666">Worth checking: \' + esc(i.check) + \'</span></li>\').join(\'\');\n' +
        'const link = (s.base_url || \'http://localhost:5678\') + \'/webhook/ironleaf/chat\';\n' +
        'const html = emailHtml(s.company || \'Ironleaf Fitness\', [\n' +
        '  \'Good morning \' + esc((s.owner_name || \'\').split(\' \')[0]) + \'. Here\\\'s what stood out in the week of \' + esc(f.week_label) + \'.\',\n' +
        '  \'<b>\' + esc(x.headline) + \'</b>\'\n' +
        '], (rows ? \'<table style="border-collapse:collapse;margin:0 0 16px"><tr>\' + [\'Branch\', \'Metric\', \'Last week\', \'Usual\', \'Change\'].map(h => \'<th style="\' + cell + \';color:#999;font-size:12px">\' + h + \'</th>\').join(\'\') + \'</tr>\' + rows + \'</table>\' : \'\')\n' +
        '  + (items ? \'<ul style="padding-left:18px;margin:0 0 16px;text-align:left">\' + items + \'</ul>\' : \'\')\n' +
        '  + \'<p style="font-size:12px;color:#999;text-align:left">"Usual" is the average of the 8 weeks before. Flagged when at least 2 standard deviations and 15% away from it. <a href="\' + esc(link) + \'" style="color:#d9480f">Ask the data assistant</a> to dig in.</p>\');\n' +
        'return [{ json: {\n' +
        '  email: { to: s.owner_email, subject: \'Week of \' + f.week_label + \': \' + clip(x.headline, 70), html, kind: \'weekly_anomalies\', ref: f.week },\n' +
        '  report: { kind: \'weekly_anomalies\', period: f.week, summary: x.headline, data_json: JSON.stringify({ flags: f.flags, totals: f.totals, items: x.items }), created_at: nowIso() }\n' +
        '} }];\n'
  } },
  output: [{ email: {}, report: {} }]
});

const save = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Report', position: [1760, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: REPORTS, columns: { mappingMode: 'defineBelow', value: {
    kind: expr('{{ $json.report.kind }}'), period: expr('{{ $json.report.period }}'), summary: expr('{{ $json.report.summary }}'), data_json: expr('{{ $json.report.data_json }}'), created_at: expr('{{ $json.report.created_at }}')
  }, schema: [
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'period', displayName: 'period', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'summary', displayName: 'summary', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'data_json', displayName: 'data_json', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});

const emailItem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Email Item', position: [1980, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// The report email for Send Email.\nreturn [{ json: $(\'Report\').first().json.email }];\n' } },
  output: [{ to: 'rachel.moss@ironleaf.example', subject: 'Week of ...', html: '<p>Report</p>', kind: 'weekly_anomalies', ref: '' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Email the Owner', position: [2200, 400], parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Ironleaf 3: Weekly Anomalies\nEvery Monday at 7:00. A fixed query (through the same read-only function) gets check-ins, new members, cancellations, failed payments and revenue per branch for the last 9 full weeks. **Flag Changes** (code) compares last week with the 8 weeks before and flags anything at least 2 standard deviations and 15% away from normal. GPT-5.4 writes the headline and what to check, using only those numbers. The report is saved and emailed to the owner.',
  [], { position: [160, 60], width: 1300, height: 200, color: 5 }
);

export default workflow('ironleaf-weekly-anomalies', 'Ironleaf 3: Weekly Anomalies')
  .add(monday)
  .to(readSettings)
  .to(query)
  .to(run)
  .to(flags)
  .to(write)
  .to(report)
  .to(save)
  .to(emailItem)
  .to(send)
  .add(runNow)
  .to(readSettings)
  .add(note);
