import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'ilfPostgresLocal', name: 'Ironleaf Postgres (local)' } };
const EVAL = { __rl: true, mode: 'id', value: 'Ttb7o3Bj7C1j5SrL', cachedResultName: 'Ironleaf Eval' };
const ANSWER_WF = { __rl: true, mode: 'id', value: 'ilfAnswerQues001', cachedResultName: 'Ironleaf 1: Answer Question' };

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Evaluation', position: [200, 300] },
  output: [{}]
});

const questions = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Questions', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The test set: questions a gym manager would ask, each with reference SQL written by hand using the\n' +
        '// same definitions the assistant is given (active member, churn, revenue, last week...).\n' +
        'const W = "date_trunc(\'week\', current_date) - interval \'7 days\'", W1 = "date_trunc(\'week\', current_date)";\n' +
        'const LM = "date_trunc(\'month\', current_date) - interval \'1 month\'", TM = "date_trunc(\'month\', current_date)";\n' +
        'const ACTIVE = "m.joined_on <= current_date AND (m.cancelled_on IS NULL OR m.cancelled_on > current_date)";\n' +
        'const Q = [\n' +
        '  [\'Q01\', \'How many active members do we have?\', `SELECT count(*)::int AS active_members FROM members m WHERE ${ACTIVE}`],\n' +
        '  [\'Q02\', \'How many active members are on each plan?\', `SELECT p.name AS plan, count(*)::int AS active_members FROM members m JOIN plans p ON p.id = m.plan_id WHERE ${ACTIVE} GROUP BY p.name ORDER BY 2 DESC`],\n' +
        '  [\'Q03\', \'Which branch lost the most members last month?\', `SELECT b.name AS branch, count(*)::int AS cancellations FROM members m JOIN branches b ON b.id = m.branch_id WHERE m.cancelled_on >= ${LM} AND m.cancelled_on < ${TM} GROUP BY b.name ORDER BY 2 DESC LIMIT 1`],\n' +
        '  [\'Q04\', \'How many new members joined in January this year?\', `SELECT count(*)::int AS new_members FROM members WHERE joined_on >= date_trunc(\'year\', current_date) AND joined_on < date_trunc(\'year\', current_date) + interval \'1 month\'`],\n' +
        '  [\'Q05\', \'What was our total revenue last month?\', `SELECT round(sum(amount), 2) AS revenue FROM payments WHERE status = \'paid\' AND paid_on >= ${LM} AND paid_on < ${TM}`],\n' +
        '  [\'Q06\', \'Show revenue by branch for last month.\', `SELECT b.name AS branch, round(sum(p.amount), 2) AS revenue FROM payments p JOIN members m ON m.id = p.member_id JOIN branches b ON b.id = m.branch_id WHERE p.status = \'paid\' AND p.paid_on >= ${LM} AND p.paid_on < ${TM} GROUP BY b.name ORDER BY 2 DESC`],\n' +
        '  [\'Q07\', \'What was the monthly churn rate at Salford Quays for each of the last 6 full months?\', `SELECT d::date AS month, round(100.0 * (SELECT count(*) FROM members m WHERE m.branch_id = 3 AND m.cancelled_on >= d AND m.cancelled_on < d + interval \'1 month\') / nullif((SELECT count(*) FROM members m WHERE m.branch_id = 3 AND m.joined_on <= d AND (m.cancelled_on IS NULL OR m.cancelled_on > d)), 0), 1) AS churn_rate_pct FROM generate_series(${TM} - interval \'6 months\', ${TM} - interval \'1 month\', interval \'1 month\') d ORDER BY 1`],\n' +
        '  [\'Q08\', \'What was the most common cancellation reason in the last 3 months?\', `SELECT cancel_reason, count(*)::int AS cancellations FROM members WHERE cancelled_on >= ${TM} - interval \'3 months\' AND cancelled_on < ${TM} GROUP BY 1 ORDER BY 2 DESC LIMIT 1`],\n' +
        '  [\'Q09\', \'How many members have cancelled because they moved to a competitor?\', `SELECT count(*)::int AS members FROM members WHERE cancel_reason = \'moved to a competitor\'`],\n' +
        '  [\'Q10\', \'How many check-ins did Stockport have last week?\', `SELECT count(*)::int AS check_ins FROM visits v JOIN branches b ON b.id = v.branch_id WHERE b.name = \'Stockport\' AND v.checked_in_at >= ${W} AND v.checked_in_at < ${W1}`],\n' +
        '  [\'Q11\', \'Which branch had the most check-ins last week?\', `SELECT b.name AS branch, count(*)::int AS check_ins FROM visits v JOIN branches b ON b.id = v.branch_id WHERE v.checked_in_at >= ${W} AND v.checked_in_at < ${W1} GROUP BY b.name ORDER BY 2 DESC LIMIT 1`],\n' +
        '  [\'Q12\', \'What were the 3 busiest hours of the day for check-ins over the last 30 days?\', `SELECT extract(hour FROM checked_in_at)::int AS hour, count(*)::int AS check_ins FROM visits WHERE checked_in_at >= current_date - 30 AND checked_in_at < current_date GROUP BY 1 ORDER BY 2 DESC LIMIT 3`],\n' +
        '  [\'Q13\', \'Which class type has the highest no-show rate?\', `SELECT c.class_type, round(100.0 * count(*) FILTER (WHERE bk.status = \'no_show\') / count(*) FILTER (WHERE bk.status <> \'cancelled\'), 1) AS no_show_rate_pct FROM bookings bk JOIN classes c ON c.id = bk.class_id GROUP BY 1 ORDER BY 2 DESC LIMIT 1`],\n' +
        '  [\'Q14\', \'What was the average fill rate of Spin classes in the last 30 days?\', `SELECT round(100.0 * (SELECT count(*) FROM bookings bk JOIN classes c ON c.id = bk.class_id WHERE c.class_type = \'Spin\' AND c.starts_at >= current_date - 30 AND c.starts_at < current_date AND bk.status <> \'cancelled\') / (SELECT sum(capacity) FROM classes c WHERE c.class_type = \'Spin\' AND c.starts_at >= current_date - 30 AND c.starts_at < current_date), 1) AS fill_rate_pct`],\n' +
        '  [\'Q15\', \'How many failed payments were there at Didsbury last week?\', `SELECT count(*)::int AS failed_payments FROM payments p JOIN members m ON m.id = p.member_id JOIN branches b ON b.id = m.branch_id WHERE b.name = \'Didsbury\' AND p.status = \'failed\' AND p.paid_on >= ${W} AND p.paid_on < ${W1}`],\n' +
        '  [\'Q16\', \'What share of new members in the last 90 days came from referrals?\', `SELECT round(100.0 * count(*) FILTER (WHERE source = \'referral\') / count(*), 1) AS referral_share_pct FROM members WHERE joined_on >= current_date - 90 AND joined_on < current_date`],\n' +
        '  [\'Q17\', \'How many active Premium members are there at Altrincham?\', `SELECT count(*)::int AS members FROM members m JOIN plans p ON p.id = m.plan_id JOIN branches b ON b.id = m.branch_id WHERE p.name = \'Premium\' AND b.name = \'Altrincham\' AND ${ACTIVE}`],\n' +
        '  [\'Q18\', \'Show revenue by month for the last 6 full months.\', `SELECT date_trunc(\'month\', paid_on)::date AS month, round(sum(amount), 2) AS revenue FROM payments WHERE status = \'paid\' AND paid_on >= ${TM} - interval \'6 months\' AND paid_on < ${TM} GROUP BY 1 ORDER BY 1`],\n' +
        '  [\'Q19\', \'How many members joined at each branch in the last 30 days?\', `SELECT b.name AS branch, count(*)::int AS new_members FROM members m JOIN branches b ON b.id = m.branch_id WHERE m.joined_on >= current_date - 30 AND m.joined_on < current_date GROUP BY b.name ORDER BY 2 DESC`]\n' +
        '];\n' +
        'return Q.map(([qid, question, sql]) => ({ json: { qid, question, sql, sql_b64: Buffer.from(sql, \'utf8\').toString(\'base64\'), session_id: \'eval-\' + qid, history: \'[]\' } }));\n'
  } },
  output: [{ qid: 'Q01', question: 'How many active members do we have?', sql: 'SELECT 1', sql_b64: 'U0VMRUNUIDE=', session_id: 'eval-Q01', history: '[]' }]
});

const reference = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Reference',
    position: [640, 300],
    parameters: { operation: 'executeQuery', query: 'SELECT ironleaf.run_readonly(convert_from(decode($1, \'base64\'), \'UTF8\')) AS rows', options: { queryReplacement: expr('{{ $json.sql_b64 }}'), largeNumbersOutput: 'numbers' } },
    credentials: PG_CRED
  },
  output: [{ rows: [{ active_members: 1271 }] }]
});

const items = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Ask Items', position: [860, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// One question per item for the assistant (no chat history).\nreturn $(\'Questions\').all().map(i => ({ json: { question: i.json.question, session_id: i.json.session_id, history: \'[]\' } }));\n' } },
  output: [{ question: 'How many active members do we have?', session_id: 'eval-Q01', history: '[]' }]
});

const ask = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Ask Assistant', position: [1080, 300], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: ANSWER_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const compare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Compare', position: [1300, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Marks each answer right or wrong against the reference SQL: every value in the reference result must\n' +
        '// appear in the assistant\'s result (numbers within 0.6% or 0.11 for rounding, text ignoring case, dates\n' +
        '// by day). Column names and order don\'t matter.\n' +
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
        'const qs = $(\'Questions\').all().map(i => i.json);\n' +
        'const refs = $(\'Reference\').all().map(i => i.json);\n' +
        'const gots = $(\'Ask Assistant\').all().map(i => i.json);\n' +
        'const runId = \'E\' + DateTime.now().setZone(TZ).toFormat(\'LLdd-HHmm\');\n' +
        'const asList = r => Array.isArray(r) ? r : (typeof r === \'string\' ? JSON.parse(r) : []);\n' +
        'const cells = rows => rows.flatMap(r => Object.values(r));\n' +
        'const isNum = v => typeof v === \'number\' || (typeof v === \'string\' && /^-?\\d+(\\.\\d+)?$/.test(v.trim()));\n' +
        'const isDate = v => typeof v === \'string\' && /^\\d{4}-\\d{2}-\\d{2}/.test(v);\n' +
        'const at = nowIso();\n' +
        'return qs.map((q, i) => {\n' +
        '  const expected = asList((refs[i] || {}).rows);\n' +
        '  const g = gots[i] || {};\n' +
        '  const got = g.ok ? asList(g.rows) : [];\n' +
        '  const gotCells = cells(got);\n' +
        '  const missing = [];\n' +
        '  for (const v of cells(expected)) {\n' +
        '    if (v === null) continue;\n' +
        '    let found;\n' +
        '    if (isNum(v)) { const n = Number(v); found = gotCells.some(x => isNum(x) && Math.abs(Number(x) - n) <= Math.max(0.11, Math.abs(n) * 0.006)); }\n' +
        '    else if (isDate(v)) found = gotCells.some(x => String(x).slice(0, 10) === v.slice(0, 10) || String(x).slice(0, 7) === v.slice(0, 7) && v.slice(8, 10) === \'01\');\n' +
        '    else found = gotCells.some(x => String(x).toLowerCase() === String(v).toLowerCase());\n' +
        '    if (!found) missing.push(v);\n' +
        '  }\n' +
        '  const pass = !!g.ok && expected.length > 0 && missing.length === 0;\n' +
        '  return { json: { run_id: runId, qid: q.qid, question: q.question, expected_json: JSON.stringify(expected), got_json: JSON.stringify(got.slice(0, 20)), sql: g.sql || \'\',\n' +
        '    pass, note: !g.ok ? (g.answer || \'no answer\').slice(0, 200) : missing.length ? \'missing: \' + missing.slice(0, 5).join(\', \') : \'\', ms: g.ms || 0, at } };\n' +
        '});\n'
  } },
  output: [{ qid: 'Q01', pass: true }]
});

const save = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Results', position: [1520, 300], parameters: { resource: 'row', operation: 'insert', dataTableId: EVAL, columns: { mappingMode: 'defineBelow', value: {
          run_id: expr('{{ $json.run_id }}'),
          qid: expr('{{ $json.qid }}'),
          question: expr('{{ $json.question }}'),
          expected_json: expr('{{ $json.expected_json }}'),
          got_json: expr('{{ $json.got_json }}'),
          sql: expr('{{ $json.sql }}'),
          pass: expr('{{ $json.pass }}'),
          note: expr('{{ $json.note }}'),
          ms: expr('{{ $json.ms }}'),
          at: expr('{{ $json.at }}')
  }, schema: [
          { id: 'run_id', displayName: 'run_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'qid', displayName: 'qid', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'question', displayName: 'question', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'expected_json', displayName: 'expected_json', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'got_json', displayName: 'got_json', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'sql', displayName: 'sql', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'pass', displayName: 'pass', required: false, defaultMatch: false, display: true, type: 'boolean', readOnly: false, removed: false },
          { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'ms', displayName: 'ms', required: false, defaultMatch: false, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Score', position: [1740, 300], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The score.\n' +
        'const rows = $(\'Compare\').all().map(i => i.json);\n' +
        'const passed = rows.filter(r => r.pass);\n' +
        'const ms = rows.map(r => r.ms).sort((a, b) => a - b);\n' +
        'return [{ json: { run_id: rows[0].run_id, questions: rows.length, passed: passed.length, accuracy_pct: Math.round(1000 * passed.length / rows.length) / 10,\n' +
        '  median_s: Math.round(ms[Math.floor(ms.length / 2)] / 100) / 10, failed: rows.filter(r => !r.pass).map(r => r.qid + \': \' + r.question + \' (\' + r.note + \')\') } }];\n'
  } },
  output: [{ questions: 19, passed: 18, accuracy_pct: 94.7 }]
});

const note = sticky(
  '## Ironleaf 4: Evaluation (manual)\n19 questions a manager would ask, each with reference SQL written by hand using the same definitions the assistant gets. Each question goes through the real assistant (**Ironleaf 1**), and **Compare** passes it only if every value in the reference result appears in the assistant\'s result (numbers within 0.6% for rounding). Results go to **Ironleaf Eval**, with the SQL the assistant wrote.',
  [], { position: [160, 60], width: 1100, height: 180, color: 6 }
);

export default workflow('ironleaf-evaluation', 'Ironleaf 4: Evaluation')
  .add(run)
  .to(questions)
  .to(reference)
  .to(items)
  .to(ask)
  .to(compare)
  .to(save)
  .to(summary)
  .add(note);
