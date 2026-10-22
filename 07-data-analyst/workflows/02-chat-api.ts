import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const QUESTIONS = { __rl: true, mode: 'id', value: 'aJd2CJkonUN6vRaa', cachedResultName: 'Ironleaf Questions' };
const ANSWER_WF = { __rl: true, mode: 'id', value: 'ilfAnswerQues001', cachedResultName: 'Ironleaf 1: Answer Question' };
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }] };

const pageHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Chat Page', position: [200, 200], parameters: { httpMethod: 'GET', path: 'ironleaf/chat', responseMode: 'responseNode', options: {} } },
  output: [{}]
});

const page = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Page', position: [420, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The analyst chat page.\n' +
        'const html =\n' +
        '"<!doctype html>\\n<html lang=\\"en\\">\\n<head>\\n<meta charset=\\"utf-8\\">\\n<meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\">\\n<title>Data assistant · Ironleaf Fitness</title>\\n<link rel=\\"preconnect\\" href=\\"https://fonts.googleapis.com\\">\\n<link href=\\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap\\" rel=\\"stylesheet\\">\\n<script src=\\"https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js\\"></script>\\n<style>\\n:root { --bg: #f5f4f1; --panel: #fff; --ink: #1c1f26; --ink-2: #474c58; --ink-3: #868b96; --line: #e6e3dd; --brand: #d9480f; --brand-2: #fff0e8; --side: #17191f; --code: #12141a; }\\n* { box-sizing: border-box; }\\nhtml, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink); font: 14.5px/1.55 Inter, -apple-system, \\"Segoe UI\\", Helvetica, Arial, sans-serif; }\\n.app { display: grid; grid-template-columns: 300px 1fr; height: 100vh; }\\n.side { background: var(--side); color: #d6d8de; padding: 22px 18px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto; }\\n.brand { display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 800; letter-spacing: -.2px; font-size: 17px; }\\n.mark { width: 32px; height: 32px; border-radius: 9px; background: var(--brand); display: grid; place-items: center; color: #fff; font-weight: 800; }\\n.brand small { display: block; color: #8b8f99; font-weight: 500; font-size: 12px; letter-spacing: 0; }\\n.side h4 { margin: 6px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #8b8f99; }\\n.ex { display: flex; flex-direction: column; gap: 6px; }\\n.ex button { text-align: left; background: #22252d; border: 1px solid #2d313a; color: #e4e6ea; border-radius: 10px; padding: 9px 11px; font: inherit; font-size: 13px; cursor: pointer; }\\n.ex button:hover { border-color: var(--brand); }\\n.facts { font-size: 12.5px; color: #a3a7b0; line-height: 1.6; }\\n.facts b { color: #e4e6ea; font-weight: 600; }\\n.safe { margin-top: auto; font-size: 12px; color: #8b8f99; border-top: 1px solid #2d313a; padding-top: 14px; }\\n.main { display: flex; flex-direction: column; min-width: 0; }\\n.thread { flex: 1; overflow-y: auto; padding: 26px 34px 10px; }\\n.empty { max-width: 640px; margin: 8vh auto 0; text-align: center; color: var(--ink-3); }\\n.empty h1 { color: var(--ink); font-size: 28px; letter-spacing: -.6px; margin: 0 0 8px; }\\n.q { display: flex; justify-content: flex-end; margin: 0 0 12px; }\\n.q span { background: var(--ink); color: #fff; border-radius: 16px 16px 4px 16px; padding: 10px 15px; max-width: 70%; }\\n.a { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; margin: 0 0 22px; max-width: 920px; box-shadow: 0 1px 2px rgba(0,0,0,.03), 0 8px 24px rgba(0,0,0,.04); }\\n.a .ans { font-size: 16px; color: var(--ink); }\\n.a .note { color: var(--ink-3); font-size: 13px; margin-top: 6px; }\\n.big { font-size: 46px; font-weight: 800; letter-spacing: -1.5px; color: var(--brand); margin: 6px 0 0; }\\n.big small { display: block; font-size: 13px; color: var(--ink-3); font-weight: 500; letter-spacing: 0; }\\n.chart { position: relative; height: 290px; margin: 14px 0 4px; }\\n.ctitle { font-weight: 600; font-size: 13px; color: var(--ink-2); margin: 14px 0 0; }\\ndetails { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 10px; }\\nsummary { cursor: pointer; color: var(--ink-2); font-weight: 600; font-size: 13px; }\\ntable { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 13px; }\\nth { text-align: left; color: var(--ink-3); font-weight: 600; border-bottom: 1px solid var(--line); padding: 6px 8px; white-space: nowrap; }\\ntd { border-bottom: 1px solid #f0eee9; padding: 6px 8px; }\\ntd.n { text-align: right; font-variant-numeric: tabular-nums; }\\npre { background: var(--code); color: #e6e6e6; border-radius: 10px; padding: 12px 14px; overflow-x: auto; font: 12.5px/1.55 \\"JetBrains Mono\\", Menlo, monospace; margin: 8px 0 0; white-space: pre-wrap; }\\n.meta { display: flex; gap: 14px; flex-wrap: wrap; color: var(--ink-3); font-size: 12px; margin-top: 12px; }\\n.pill { background: var(--brand-2); color: var(--brand); border-radius: 999px; padding: 2px 9px; font-weight: 600; }\\n.warn { border-left: 3px solid #e8a33d; }\\n.ask { padding: 14px 34px 22px; }\\n.box { display: flex; gap: 10px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 8px 8px 8px 16px; max-width: 920px; box-shadow: 0 6px 24px rgba(0,0,0,.05); }\\n.box textarea { flex: 1; border: 0; resize: none; font: inherit; font-size: 15px; padding: 8px 0; height: 42px; outline: none; background: transparent; color: var(--ink); }\\n.box button { border: 0; background: var(--brand); color: #fff; font-weight: 700; border-radius: 12px; padding: 0 20px; cursor: pointer; font: inherit; font-weight: 700; }\\n.box button:disabled { opacity: .5; }\\n.thinking { color: var(--ink-3); margin: 0 0 18px; font-size: 13.5px; }\\n.thinking i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--brand); margin-right: 6px; animation: p 1s infinite alternate; }\\n@keyframes p { from { opacity: .3 } to { opacity: 1 } }\\n@media (max-width: 900px) { .app { grid-template-columns: 1fr; height: auto; } .side { display: none; } .thread { padding: 18px 16px; } .ask { padding: 10px 16px 16px; } .main { min-height: 100vh; } }\\n</style>\\n</head>\\n<body>\\n<div class=\\"app\\">\\n  <aside class=\\"side\\">\\n    <div class=\\"brand\\"><div class=\\"mark\\">I</div><div>Ironleaf Fitness<small>Data assistant</small></div></div>\\n    <h4>Try asking</h4>\\n    <div class=\\"ex\\" id=\\"ex\\"></div>\\n    <h4>What it knows</h4>\\n    <div class=\\"facts\\"><b>5 branches</b> · members, plans and cancellations · <b>18 months</b> of payments and gym check-ins · <b>6 months</b> of classes and bookings. Updated nightly.</div>\\n    <div class=\\"safe\\">Read-only: the assistant can look at the data but can\'t change anything. Every answer shows the SQL it ran.</div>\\n  </aside>\\n  <main class=\\"main\\">\\n    <div class=\\"thread\\" id=\\"thread\\"><div class=\\"empty\\" id=\\"empty\\"><h1>Ask your gym data anything</h1><div>Plain English in, numbers and a chart out. Follow-up questions work too.</div></div></div>\\n    <div class=\\"ask\\"><form class=\\"box\\" id=\\"f\\"><textarea id=\\"q\\" placeholder=\\"e.g. Which branch lost the most members last month?\\"></textarea><button id=\\"go\\">Ask</button></form></div>\\n  </main>\\n</div>\\n<script>\\nconst EXAMPLES = [\'Which branch lost the most members last month?\', \'Monthly churn rate by branch for the last 6 months\', \'How many active members do we have on each plan?\', \'Revenue by month this year\', \'What are the busiest hours for check-ins?\', \'Which class type has the highest no-show rate?\'];\\nconst session = \'web-\' + Math.random().toString(36).slice(2, 10);\\nconst thread = document.getElementById(\'thread\');\\nconst esc = s => String(s ?? \'\').replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\');\\nconst isMoney = c => /revenue|amount|price|income|takings|£/i.test(c);\\nconst isPct = c => /pct|percent|rate/i.test(c);\\nconst fmt = (v, c) => {\\n  if (v === null || v === undefined) return \'–\';\\n  if (typeof v === \'number\' || (/^-?\\\\d+(\\\\.\\\\d+)?$/.test(String(v)) && !/date|month|week|year|period|day/i.test(c))) {\\n    const n = Number(v);\\n    if (isMoney(c)) return \'£\' + n.toLocaleString(\'en-GB\', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\\n    if (isPct(c)) return n.toLocaleString(\'en-GB\', { maximumFractionDigits: 1 }) + \'%\';\\n    return n.toLocaleString(\'en-GB\', { maximumFractionDigits: 2 });\\n  }\\n  if (/^\\\\d{4}-\\\\d{2}-\\\\d{2}(T|$)/.test(String(v))) return String(v).slice(0, 10);\\n  return String(v);\\n};\\nconst xLabel = (v, c, monthly) => {\\n  const d = /^(\\\\d{4})-(\\\\d{2})-(\\\\d{2})/.exec(String(v ?? \'\'));\\n  if (d) return new Date(Date.UTC(+d[1], d[2] - 1, +d[3])).toLocaleDateString(\'en-GB\', monthly ? { month: \'short\', year: \'numeric\', timeZone: \'UTC\' } : { day: \'numeric\', month: \'short\', timeZone: \'UTC\' });\\n  if (/hour/i.test(c) && /^\\\\d{1,2}$/.test(String(v))) return String(v).padStart(2, \'0\') + \':00\';\\n  return fmt(v, c);\\n};\\nconst label = c => c.replace(/_/g, \' \').replace(/\\\\bpct\\\\b/, \'%\');\\nconst PALETTE = [\'#d9480f\', \'#1c7ed6\', \'#2f9e44\', \'#ae3ec9\', \'#f59f00\', \'#0ca678\', \'#e64980\', \'#495057\'];\\ndocument.getElementById(\'ex\').innerHTML = EXAMPLES.map(e => \'<button>\' + esc(e) + \'</button>\').join(\'\');\\ndocument.querySelectorAll(\'#ex button\').forEach(b => b.onclick = () => ask(b.textContent));\\nfunction card(r) {\\n  const el = document.createElement(\'div\');\\n  el.className = \'a\' + (r.ok ? \'\' : \' warn\');\\n  let html = \'<div class=\\"ans\\">\' + esc(r.answer) + \'</div>\' + (r.note ? \'<div class=\\"note\\">\' + esc(r.note) + \'</div>\' : \'\');\\n  const ch = r.chart || {};\\n  if (r.ok && r.rows.length) {\\n    const y = (ch.y || []).filter(c => r.columns.includes(c));\\n    if (ch.type === \'number\' && r.rows.length === 1 && y.length) html += \'<div class=\\"big\\">\' + esc(fmt(r.rows[0][y[0]], y[0])) + \'<small>\' + esc(ch.title || label(y[0])) + \'</small></div>\';\\n    else if ([\'bar\', \'line\', \'pie\'].includes(ch.type) && r.columns.includes(ch.x) && y.length) html += \'<div class=\\"ctitle\\">\' + esc(ch.title) + \'</div><div class=\\"chart\\"><canvas></canvas></div>\';\\n    const head = r.columns.map(c => \'<th>\' + esc(label(c)) + \'</th>\').join(\'\');\\n    const body = r.rows.slice(0, 100).map(row => \'<tr>\' + r.columns.map(c => { const v = row[c]; const num = typeof v === \'number\'; return \'<td\' + (num ? \' class=\\"n\\"\' : \'\') + \'>\' + esc(fmt(v, c)) + \'</td>\'; }).join(\'\') + \'</tr>\').join(\'\');\\n    html += \'<details\' + (ch.type === \'table\' ? \' open\' : \'\') + \'><summary>Data (\' + r.row_count + \' row\' + (r.row_count === 1 ? \'\' : \'s\') + \')</summary><div style=\\"overflow-x:auto\\"><table><tr>\' + head + \'</tr>\' + body + \'</table></div></details>\';\\n  }\\n  if (r.sql) html += \'<details><summary>SQL</summary>\' + (r.explanation ? \'<div class=\\"note\\">\' + esc(r.explanation) + \'</div>\' : \'\') + \'<pre>\' + esc(r.sql) + \'</pre></details>\';\\n  html += \'<div class=\\"meta\\"><span>\' + (r.ms / 1000).toFixed(1) + \' s</span>\' + (r.attempts > 1 ? \'<span class=\\"pill\\">fixed itself after a database error</span>\' : \'\') + ((r.assumptions || []).length ? \'<span>Assumed: \' + esc(r.assumptions.map(a => a.replace(/\\\\.$/, \'\')).join(\'; \')) + \'</span>\' : \'\') + \'</div>\';\\n  el.innerHTML = html;\\n  const canvas = el.querySelector(\'canvas\');\\n  if (canvas && window.Chart) {\\n    const y = ch.y.filter(c => r.columns.includes(c));\\n    // Long rows (period, branch, value) become one line or bar set per branch\\n    const xs = [...new Set(r.rows.map(row => String(row[ch.x])))];\\n    const by = ch.type !== \'pie\' && y.length === 1 && xs.length < r.rows.length ? r.columns.find(c => c !== ch.x && c !== y[0] && r.rows.every(row => typeof row[c] === \'string\')) : null;\\n    const monthly = xs.every(v => /^\\\\d{4}-\\\\d{2}-01/.test(v));\\n    const labels = (by ? xs : r.rows.map(row => String(row[ch.x]))).map(v => xLabel(v, ch.x, monthly));\\n    const series = by\\n      ? [...new Set(r.rows.map(row => row[by]))].map(name => ({ name, data: xs.map(x => { const m = r.rows.find(row => String(row[ch.x]) === x && row[by] === name); return m ? Number(m[y[0]]) : null; }) }))\\n      : y.map(c => ({ name: label(c), data: r.rows.map(row => Number(row[c])) }));\\n    new Chart(canvas, {\\n      type: ch.type,\\n      data: { labels, datasets: series.map((sr, i) => ({ label: sr.name, data: sr.data, backgroundColor: ch.type === \'pie\' ? PALETTE : (ch.type === \'line\' ? PALETTE[i] + \'22\' : PALETTE[i]), borderColor: ch.type === \'pie\' ? \'#fff\' : PALETTE[i], borderWidth: ch.type === \'line\' ? 2.5 : 1, fill: ch.type === \'line\' && series.length === 1, tension: 0.25, pointRadius: 2.5, borderRadius: ch.type === \'bar\' ? 6 : 0 })) },\\n      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: series.length > 1 || ch.type === \'pie\', position: \'bottom\' } }, scales: ch.type === \'pie\' ? {} : { y: { beginAtZero: true, grid: { color: \'#f0eee9\' } }, x: { grid: { display: false } } } }\\n    });\\n  }\\n  return el;\\n}\\nasync function ask(text) {\\n  text = text.trim(); if (!text) return;\\n  const empty = document.getElementById(\'empty\'); if (empty) empty.remove();\\n  const q = document.createElement(\'div\'); q.className = \'q\'; q.innerHTML = \'<span>\' + esc(text) + \'</span>\'; thread.appendChild(q);\\n  const t = document.createElement(\'div\'); t.className = \'thinking\'; t.innerHTML = \'<i></i>Reading the data…\'; thread.appendChild(t);\\n  thread.scrollTop = thread.scrollHeight; document.getElementById(\'go\').disabled = true;\\n  try {\\n    const res = await fetch(\'ask\', { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify({ session_id: session, question: text }) });\\n    const r = await res.json();\\n    t.replaceWith(card(r));\\n  } catch (e) { t.replaceWith(card({ ok: false, answer: \'Sorry, the assistant is not reachable right now.\', ms: 0, rows: [] })); }\\n  document.getElementById(\'go\').disabled = false; thread.scrollTop = thread.scrollHeight;\\n}\\ndocument.getElementById(\'f\').onsubmit = e => { e.preventDefault(); const q = document.getElementById(\'q\'); ask(q.value); q.value = \'\'; };\\ndocument.getElementById(\'q\').onkeydown = e => { if (e.key === \'Enter\' && !e.shiftKey) { e.preventDefault(); document.getElementById(\'f\').requestSubmit(); } };\\n</script>\\n</body>\\n</html>\\n"\n' +
        ';\n' +
        'return [{ json: { html } }];\n'
  } },
  output: [{ html: '<html></html>' }]
});

const sendPage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [640, 200], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseHeaders: HTML_HEADERS } } }
});

const askHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Ask Request', position: [200, 520], parameters: { httpMethod: 'POST', path: 'ironleaf/ask', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { session_id: 'web-abc', question: 'Which branch lost the most members last month?' } }]
});

const readHistory = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read History',
    position: [420, 520],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: QUESTIONS, limit: 3, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC', filters: { conditions: [{ keyName: 'session_id', condition: 'eq', keyValue: expr("{{ $('Ask Request').first().json.body.session_id || 'none' }}") }] } }
  },
  output: [{ session_id: 'web-abc', question: 'How many members?', sql: 'SELECT 1' }]
});

const question = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Question', position: [640, 520], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The question for Ironleaf 1, with this chat\'s last questions and their SQL (for follow-ups).\n' +
        'const b = $(\'Ask Request\').first().json.body || {};\n' +
        'const question = String(b.question || \'\').trim().slice(0, 500);\n' +
        'const session = String(b.session_id || \'\').replace(/[^A-Za-z0-9_-]/g, \'\').slice(0, 64) || \'anon\';\n' +
        'const history = $(\'Read History\').all().map(i => i.json).filter(h => h && h.question).sort((a, c) => String(a.at).localeCompare(String(c.at))).slice(-3).map(h => ({ question: h.question, sql: h.sql }));\n' +
        'return [{ json: { ok: question.length >= 3, question, session_id: session, history: JSON.stringify(history) } }];\n'
  } },
  output: [{ ok: true, question: 'Which branch lost the most members last month?', session_id: 'web-abc', history: '[]' }]
});

const valid = ifElse({
  version: 2.2,
  config: {
    name: 'Valid?',
    position: [860, 520],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const answer = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Answer Question', position: [1080, 420], parameters: { source: 'database', workflowId: ANSWER_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ ok: true, answer: 'Salford Quays lost the most.', rows: [] }]
});

const logRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Log Row', position: [1300, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One row per question for the log (and for follow-ups in the same chat).\n' +
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
        'const r = $(\'Answer Question\').first().json;\n' +
        'const q = $(\'Question\').first().json;\n' +
        'return [{ json: { session_id: q.session_id, question: q.question, sql: r.sql || \'\', ok: !!r.ok, row_count: r.row_count || 0, answer: r.answer || \'\', error: r.ok ? \'\' : (r.kind || \'error\'), attempts: r.attempts || 1, ms: r.ms || 0, at: nowIso() } }];\n'
  } },
  output: [{ session_id: 'web-abc', question: 'Which branch?', ok: true }]
});

const save = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save to Log', position: [1520, 420], onError: 'continueRegularOutput', parameters: { resource: 'row', operation: 'insert', dataTableId: QUESTIONS, columns: { mappingMode: 'defineBelow', value: {
          session_id: expr('{{ $json.session_id }}'),
          question: expr('{{ $json.question }}'),
          sql: expr('{{ $json.sql }}'),
          ok: expr('{{ $json.ok }}'),
          row_count: expr('{{ $json.row_count }}'),
          answer: expr('{{ $json.answer }}'),
          error: expr('{{ $json.error }}'),
          attempts: expr('{{ $json.attempts }}'),
          ms: expr('{{ $json.ms }}'),
          at: expr('{{ $json.at }}')
  }, schema: [
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'question', displayName: 'question', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'sql', displayName: 'sql', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'ok', displayName: 'ok', required: false, defaultMatch: false, display: true, type: 'boolean', readOnly: false, removed: false },
          { id: 'row_count', displayName: 'row_count', required: false, defaultMatch: false, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'answer', displayName: 'answer', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'error', displayName: 'error', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'attempts', displayName: 'attempts', required: false, defaultMatch: false, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'ms', displayName: 'ms', required: false, defaultMatch: false, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});

const reply = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Answer', position: [1740, 420], parameters: { respondWith: 'json', responseBody: expr("{{ $('Answer Question').first().json }}"), options: {} } }
});

const bad = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Bad Request', position: [1080, 640], parameters: { respondWith: 'json', responseBody: '{ "ok": false, "answer": "Please type a question.", "rows": [], "columns": [], "ms": 0 }', options: { responseCode: 400 } } }
});

const note = sticky(
  '## Ironleaf 2: Chat API\n`GET /webhook/ironleaf/chat` serves the data assistant page. `POST /webhook/ironleaf/ask` takes a question, adds the last 3 questions of the same chat (so follow-ups like "and last year?" work), gets the answer from **Ironleaf 1** and logs it in **Ironleaf Questions**. The page shows the answer, a chart, the rows and the SQL.',
  [], { position: [160, 0], width: 1100, height: 160, color: 4 }
);

export default workflow('ironleaf-chat-api', 'Ironleaf 2: Chat API')
  .add(pageHook)
  .to(page)
  .to(sendPage)
  .add(askHook)
  .to(readHistory)
  .to(question)
  .to(valid
    .onTrue(answer.to(logRow).to(save).to(reply))
    .onFalse(bad))
  .add(note);
