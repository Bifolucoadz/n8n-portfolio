import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'IFuurjqqfST0GLCi', cachedResultName: 'Tidewater Settings' };
const CALLS = { __rl: true, mode: 'id', value: '0hHsTxLEuk6Su6C7', cachedResultName: 'Tidewater Calls' };
const CRM_WF = { __rl: true, mode: 'id', value: 'tdwCrmAdapter003', cachedResultName: 'Tidewater 3: CRM' };
const SEND_WF = { __rl: true, mode: 'id', value: 'tdwSendEmail0005', cachedResultName: 'Tidewater 5: Send Email' };
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };

// The page
const link = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Review Link', position: [200, 300], parameters: { httpMethod: 'GET', path: 'tidewater/review', responseMode: 'responseNode', options: {} } },
  output: [{ query: { call: 'CL-ABCDE', t: 'token' } }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const readCall = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Call', position: [640, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CALLS, returnAll: true, filters: { conditions: [{ keyName: 'call_id', condition: 'eq', keyValue: expr("{{ $('Review Link').first().json.query.call || 'none' }}") }] } } },
  output: [{ call_id: 'CL-ABCDE', token: 'token', deal_id: 'D-1001' }]
});

const check = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Link', position: [860, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The review link must carry the call\'s private token.\n' +
        '// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----\n' +
        'const TZ = \'America/New_York\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const dollars = n => \'$\' + Math.round(Number(n) || 0).toLocaleString(\'en-US\');\n' +
        'const day = d => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat(\'ccc, LLL d\') : String(d || \'\');\n' +
        'const mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\n' +
        '\n' +
        '// HubSpot\'s default sales pipeline.\n' +
        'const STAGES = [\n' +
        '  [\'appointmentscheduled\', \'Appointment scheduled\', \'A first meeting is booked.\'],\n' +
        '  [\'qualifiedtobuy\', \'Qualified to buy\', \'Need, rough budget, decision process and timeline are understood.\'],\n' +
        '  [\'presentationscheduled\', \'Presentation scheduled\', \'A demo or presentation is booked or has been given.\'],\n' +
        '  [\'decisionmakerboughtin\', \'Decision maker bought-in\', \'The person who signs has seen it and supports it.\'],\n' +
        '  [\'contractsent\', \'Contract sent\', \'A proposal or contract has been sent.\'],\n' +
        '  [\'closedwon\', \'Closed won\', \'Signed.\'],\n' +
        '  [\'closedlost\', \'Closed lost\', \'The prospect said no.\']\n' +
        '];\n' +
        'const stageIndex = id => STAGES.findIndex(s => s[0] === id);\n' +
        'const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];\n' +
        '\n' +
        '// OpenAI node (Responses API) output: the JSON object from the first output_text part, or null.\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        '\n' +
        '// Is this quote really in the transcript? (case, punctuation and spacing ignored)\n' +
        'const norm = s => String(s || \'\').toLowerCase().replace(/[’\']/g, "\'").replace(/[^a-z0-9\' ]+/g, \' \').replace(/\\s+/g, \' \').trim();\n' +
        'const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };\n' +
        '\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'const plainToHtml = t => String(t || \'\').split(/\\n{2,}/).map(p => \'<p style="margin:0 0 14px;text-align:left">\' + esc(p).replace(/\\n/g, \'<br>\') + \'</p>\').join(\'\');\n' +
        '// n8n shows a form\'s completion HTML as the whole page, so it needs its own styling.\n' +
        'function formPage(title, inner) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}\'\n' +
        '    + \'.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>\'\n' +
        '    + \'<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>\' + inner + \'</div></body></html>\';\n' +
        '}\n' +
        '// ---- end lib-tdw.js ----\n' +
        'const q = $(\'Review Link\').first().json.query || {};\n' +
        'const c = $(\'Read Call\').all().map(i => i.json).find(r => r.call_id === q.call) || null;\n' +
        'const ok = !!c && !!q.t && q.t === c.token;\n' +
        'return [{ json: { ok, action: \'get_deal\', deal_id: c ? c.deal_id : \'\' } }];\n'
  } },
  output: [{ ok: true, action: 'get_deal', deal_id: 'D-1001' }]
});

const linkOk = ifElse({
  version: 2.2,
  config: {
    name: 'Link OK?',
    position: [1080, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const getDeal = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Deal', position: [1300, 200], parameters: { source: 'database', workflowId: CRM_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ found: true, deal: {}, contacts: [] }]
});

const buildPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Page', position: [1520, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Fills the review page with the call, its analysis and the deal as it is now.\n' +
        '// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----\n' +
        'const TZ = \'America/New_York\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const dollars = n => \'$\' + Math.round(Number(n) || 0).toLocaleString(\'en-US\');\n' +
        'const day = d => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat(\'ccc, LLL d\') : String(d || \'\');\n' +
        'const mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\n' +
        '\n' +
        '// HubSpot\'s default sales pipeline.\n' +
        'const STAGES = [\n' +
        '  [\'appointmentscheduled\', \'Appointment scheduled\', \'A first meeting is booked.\'],\n' +
        '  [\'qualifiedtobuy\', \'Qualified to buy\', \'Need, rough budget, decision process and timeline are understood.\'],\n' +
        '  [\'presentationscheduled\', \'Presentation scheduled\', \'A demo or presentation is booked or has been given.\'],\n' +
        '  [\'decisionmakerboughtin\', \'Decision maker bought-in\', \'The person who signs has seen it and supports it.\'],\n' +
        '  [\'contractsent\', \'Contract sent\', \'A proposal or contract has been sent.\'],\n' +
        '  [\'closedwon\', \'Closed won\', \'Signed.\'],\n' +
        '  [\'closedlost\', \'Closed lost\', \'The prospect said no.\']\n' +
        '];\n' +
        'const stageIndex = id => STAGES.findIndex(s => s[0] === id);\n' +
        'const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];\n' +
        '\n' +
        '// OpenAI node (Responses API) output: the JSON object from the first output_text part, or null.\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        '\n' +
        '// Is this quote really in the transcript? (case, punctuation and spacing ignored)\n' +
        'const norm = s => String(s || \'\').toLowerCase().replace(/[’\']/g, "\'").replace(/[^a-z0-9\' ]+/g, \' \').replace(/\\s+/g, \' \').trim();\n' +
        'const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };\n' +
        '\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'const plainToHtml = t => String(t || \'\').split(/\\n{2,}/).map(p => \'<p style="margin:0 0 14px;text-align:left">\' + esc(p).replace(/\\n/g, \'<br>\') + \'</p>\').join(\'\');\n' +
        '// n8n shows a form\'s completion HTML as the whole page, so it needs its own styling.\n' +
        'function formPage(title, inner) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}\'\n' +
        '    + \'.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>\'\n' +
        '    + \'<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>\' + inner + \'</div></body></html>\';\n' +
        '}\n' +
        '// ---- end lib-tdw.js ----\n' +
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'const q = $(\'Review Link\').first().json.query || {};\n' +
        'const c = $(\'Read Call\').all().map(i => i.json).find(r => r.call_id === q.call);\n' +
        'const crm = $(\'Get Deal\').first().json || {};\n' +
        'const TEMPLATE =\n' +
        '"<!doctype html>\\n<html lang=\\"en\\">\\n<head>\\n<meta charset=\\"utf-8\\">\\n<meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\">\\n<title>Call review · Tidewater Software</title>\\n<link rel=\\"preconnect\\" href=\\"https://fonts.googleapis.com\\">\\n<link href=\\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap\\" rel=\\"stylesheet\\">\\n<style>\\n:root {\\n  --bg: #f2f5fb; --panel: #fff; --line: #e1e7f2; --ink: #0f1b3d; --ink-2: #3b4a6b; --ink-3: #6b7a99; --brand: #1d4ed8; --brand-2: #e8efff;\\n  --green: #0f8a5f; --green-bg: #e5f5ec; --amber: #b45309; --amber-bg: #fdf3e2; --red: #c0352b; --red-bg: #fdecea; --grey-bg: #eef1f7;\\n  --us: #1d4ed8; --them: #0f8a5f; --radius: 14px; --shadow: 0 1px 2px rgba(15,27,61,.05), 0 8px 24px rgba(15,27,61,.06);\\n}\\n* { box-sizing: border-box; }\\nhtml, body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.5 Inter, -apple-system, \\"Segoe UI\\", Helvetica, Arial, sans-serif; }\\nbutton, input, textarea { font: inherit; }\\n.top { display: flex; align-items: center; justify-content: space-between; padding: 14px 26px; background: var(--panel); border-bottom: 1px solid var(--line); }\\n.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }\\n.logo { width: 30px; height: 30px; border-radius: 9px; background: var(--brand); color: #fff; display: grid; place-items: center; }\\n.brand small { display: block; font-weight: 500; color: var(--ink-3); font-size: 12px; }\\n.pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }\\n.pill.test { background: var(--amber-bg); color: var(--amber); }\\n.pill.stage { background: var(--brand-2); color: var(--brand); }\\n.pill.pos { background: var(--green-bg); color: var(--green); } .pill.neu { background: var(--grey-bg); color: var(--ink-2); } .pill.neg { background: var(--red-bg); color: var(--red); }\\n.wrap { max-width: 1320px; margin: 0 auto; padding: 24px 26px 60px; }\\n.head h1 { margin: 0; font-size: 23px; letter-spacing: -.4px; }\\n.meta { display: flex; gap: 10px 18px; flex-wrap: wrap; align-items: center; color: var(--ink-3); margin: 8px 0 0; font-size: 13px; }\\n.meta b { color: var(--ink-2); font-weight: 600; }\\n.talk { display: flex; align-items: center; gap: 8px; }\\n.bar { width: 160px; height: 8px; border-radius: 999px; background: var(--them); overflow: hidden; }\\n.bar i { display: block; height: 100%; background: var(--us); }\\n.grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 18px; margin-top: 20px; align-items: start; }\\n.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px 20px; box-shadow: var(--shadow); margin-bottom: 18px; }\\n.card h2 { margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-3); font-weight: 600; display: flex; justify-content: space-between; align-items: center; }\\n.summary { font-size: 15px; color: var(--ink-2); margin: 0; }\\n.list { list-style: none; margin: 0; padding: 0; }\\n.list li { display: grid; grid-template-columns: 24px 1fr; gap: 10px; padding: 9px 0; border-top: 1px solid var(--line); }\\n.list li:first-child { border-top: 0; padding-top: 2px; }\\n.ok { width: 22px; height: 22px; border-radius: 50%; background: var(--green-bg); color: var(--green); display: grid; place-items: center; font-size: 12px; font-weight: 700; }\\n.sub { color: var(--ink-3); font-size: 12.5px; margin-top: 2px; }\\n.sub q { font-style: italic; color: var(--ink-2); }\\n.chg { display: grid; grid-template-columns: 24px 1fr; gap: 10px; padding: 11px 0; border-top: 1px solid var(--line); cursor: pointer; }\\n.chg:first-of-type { border-top: 0; padding-top: 2px; }\\n.chg input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--brand); }\\n.arrow { color: var(--ink-3); margin: 0 4px; }\\n.why { color: var(--amber); font-size: 12.5px; margin-top: 2px; }\\n.email label { display: block; font-size: 12px; color: var(--ink-3); font-weight: 600; margin: 10px 0 4px; }\\n.email input, .email textarea { width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; color: var(--ink); background: #fbfcff; }\\n.email textarea { min-height: 260px; resize: vertical; line-height: 1.55; }\\n.email input:focus, .email textarea:focus { outline: 2px solid rgba(29,78,216,.2); border-color: var(--brand); }\\n.to { color: var(--ink-2); font-weight: 500; }\\n.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }\\n.btn { border-radius: 10px; padding: 10px 16px; font-weight: 600; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; }\\n.btn.primary { background: var(--brand); border-color: var(--brand); color: #fff; }\\n.btn.ghost { color: var(--ink-3); }\\n.btn:disabled { opacity: .45; cursor: not-allowed; }\\n.banner { border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; font-weight: 500; }\\n.banner.done { background: var(--green-bg); color: var(--green); }\\n.banner.info { background: var(--grey-bg); color: var(--ink-2); }\\n.bant { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }\\n.b { border: 1px solid var(--line); border-radius: 12px; padding: 11px 12px; }\\n.b .k { display: flex; justify-content: space-between; align-items: center; font-weight: 600; margin-bottom: 4px; }\\n.b .d { color: var(--ink-2); font-size: 13px; }\\n.st-known { background: var(--green-bg); color: var(--green); } .st-partial { background: var(--amber-bg); color: var(--amber); } .st-unknown { background: var(--grey-bg); color: var(--ink-3); }\\nul.plain { margin: 0; padding-left: 18px; color: var(--ink-2); } ul.plain li { margin: 4px 0; }\\n.tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; padding: 1px 7px; border-radius: 999px; margin-left: 6px; }\\n.tag.open { background: var(--amber-bg); color: var(--amber); } .tag.resolved { background: var(--green-bg); color: var(--green); }\\ndetails summary { cursor: pointer; font-weight: 600; color: var(--brand); list-style: none; }\\n.turn { padding: 8px 0; border-top: 1px dashed var(--line); font-size: 13.5px; }\\n.turn .ts { color: var(--ink-3); font-variant-numeric: tabular-nums; font-size: 12px; padding-top: 2px; }\\n.turn .who { font-weight: 600; font-size: 12.5px; }\\n.who.us { color: var(--us); } .who.them { color: var(--them); }\\n.plaintext { white-space: pre-wrap; color: var(--ink-2); font-size: 13.5px; }\\n@media (max-width: 980px) { .grid { grid-template-columns: 1fr; } .bant { grid-template-columns: 1fr; } }\\n</style>\\n</head>\\n<body>\\n<div class=\\"top\\">\\n  <div class=\\"brand\\"><div class=\\"logo\\">T</div><div>Tidewater Software<small>Call review</small></div></div>\\n  <div id=\\"mode\\"></div>\\n</div>\\n<div class=\\"wrap\\">\\n  <div class=\\"head\\" id=\\"head\\"></div>\\n  <div class=\\"grid\\">\\n    <div id=\\"left\\"></div>\\n    <div id=\\"right\\"></div>\\n  </div>\\n</div>\\n<script>\\nconst DATA = /*__DATA__*/null;\\nconst esc = s => String(s ?? \'\').replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/\\"/g, \'&quot;\');\\nconst day = d => /^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(String(d)) ? new Date(d + \'T12:00:00Z\').toLocaleDateString(\'en-US\', { weekday: \'short\', month: \'short\', day: \'numeric\', timeZone: \'UTC\' }) : String(d || \'\');\\nconst $ = id => document.getElementById(id);\\nconst a = DATA.analysis, applied = DATA.applied, pending = DATA.pending.filter(p => p.field !== \'email\');\\nconst STATUS = { pending_review: \'\', sent: \'Follow-up sent and the CRM is up to date.\', approved: \'Changes approved; no email was sent.\', discarded: \'Discarded. Nothing else was changed.\' };\\nconst sideOf = Object.fromEntries((a.speakers || []).map(s => [s.name, s.side]));\\nconst mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\\nconst quote = q => q ? \'<q>\' + esc(String(q).replace(/^[\\"“”\'\\\\s]+|[\\"“”\'\\\\s.]+$/g, \'\')) + \'</q>\' : \'\';\\n\\nfunction head() {\\n  const d = DATA.deal;\\n  const sent = { positive: [\'pos\', \'Positive call\'], neutral: [\'neu\', \'Neutral call\'], negative: [\'neg\', \'Negative call\'] }[a.sentiment] || [\'neu\', \'\'];\\n  const talk = a.talk_us !== null && a.talk_us !== undefined ? \'<span class=\\"talk\\">Talk time <span class=\\"bar\\"><i style=\\"width:\' + a.talk_us + \'%\\"></i></span> <b>\' + a.talk_us + \'%</b> rep · <b>\' + (100 - a.talk_us) + \'%</b> prospect</span>\' : \'\';\\n  $(\'head\').innerHTML = \'<h1>\' + esc(d.name) + \'</h1><div class=\\"meta\\"><span>\' + esc(DATA.company) + \'</span><span class=\\"pill stage\\">\' + esc(DATA.stage_label) + \'</span>\'\\n    + (d.amount ? \'<span><b>$\' + Number(d.amount).toLocaleString(\'en-US\') + \'</b></span>\' : \'\') + \'<span>Call \' + esc(DATA.when) + \' · <b>\' + mmss(DATA.duration_s) + \'</b> · \' + esc(DATA.rep) + \'</span>\'\\n    + \'<span class=\\"pill \' + sent[0] + \'\\">\' + sent[1] + \'</span>\' + talk + \'</div>\';\\n  $(\'mode\').innerHTML = DATA.mode === \'live\' ? \'\' : \'<span class=\\"pill test\\" title=\\"Emails go to the Outbox table and the CRM is the demo tables\\">Test mode</span>\';\\n}\\nfunction left() {\\n  const done = [\'<li><div class=\\"ok\\">✓</div><div>Call note added to the deal<div class=\\"sub\\">Summary, BANT, objections, competitors, next steps and risks</div></div></li>\']\\n    .concat(applied.changes.map(c => \'<li><div class=\\"ok\\">✓</div><div>\' + esc(c.label) + \': \' + esc(c.from) + \'<span class=\\"arrow\\">→</span><b>\' + esc(c.to) + \'</b>\' + (c.quote ? \'<div class=\\"sub\\">\' + quote(c.quote) + \'</div>\' : \'\') + \'</div></li>\'))\\n    .concat(applied.tasks.map(t => \'<li><div class=\\"ok\\">✓</div><div>Task: \' + esc(t.title) + \'<div class=\\"sub\\">Due \' + esc(day(t.due)) + \' · \' + esc(t.owner) + \'</div></div></li>\'));\\n  const open = DATA.status === \'pending_review\';\\n  const chg = pending.map(p => \'<label class=\\"chg\\"><input type=\\"checkbox\\" data-id=\\"\' + p.id + \'\\" checked\' + (open ? \'\' : \' disabled\') + \'><div>\' + esc(p.label) + \': \' + esc(p.from) + \'<span class=\\"arrow\\">→</span><b>\' + esc(p.to) + \'</b>\'\\n    + \'<div class=\\"why\\">\' + esc(p.why) + \'</div>\' + (p.quote ? \'<div class=\\"sub\\">\' + quote(p.quote) + (p.verified ? \'\' : \' · not found in the transcript\') + \'</div>\' : \'\') + \'</div></label>\').join(\'\');\\n  $(\'left\').innerHTML = (STATUS[DATA.status] ? \'<div class=\\"banner \' + (DATA.status === \'discarded\' ? \'info\' : \'done\') + \'\\">\' + STATUS[DATA.status] + \'</div>\' : \'\')\\n    + \'<div class=\\"card\\"><h2>Summary</h2><p class=\\"summary\\">\' + esc(a.summary) + \'</p></div>\'\\n    + \'<div class=\\"card\\"><h2>Done in the CRM</h2><ul class=\\"list\\">\' + done.join(\'\') + \'</ul></div>\'\\n    + (pending.length ? \'<div class=\\"card\\"><h2>Needs your OK <span>\' + pending.length + \'</span></h2>\' + chg + \'</div>\' : \'\')\\n    + \'<div class=\\"card email\\"><h2>Follow-up email</h2><div class=\\"to\\">To \' + esc(DATA.email_to_name) + \' &lt;\' + esc(DATA.email_to) + \'&gt;</div>\'\\n    + \'<label for=\\"subject\\">Subject</label><input id=\\"subject\\" value=\\"\' + esc(DATA.email_subject) + \'\\"\' + (open ? \'\' : \' disabled\') + \'>\'\\n    + \'<label for=\\"body\\">Message</label><textarea id=\\"body\\"\' + (open ? \'\' : \' disabled\') + \'>\' + esc(DATA.email_body) + \'</textarea>\'\\n    + \'<div class=\\"actions\\"><button class=\\"btn primary\\" id=\\"send\\"\' + (open ? \'\' : \' disabled\') + \'>Approve and send</button><button class=\\"btn\\" id=\\"approve\\"\' + (open ? \'\' : \' disabled\') + \'>Approve changes only</button><button class=\\"btn ghost\\" id=\\"discard\\"\' + (open ? \'\' : \' disabled\') + \'>Discard</button></div></div>\';\\n  if (open) { $(\'send\').onclick = () => submit(\'send\'); $(\'approve\').onclick = () => submit(\'approve\'); $(\'discard\').onclick = () => submit(\'discard\'); }\\n}\\nfunction right() {\\n  const b = a.bant || {};\\n  const tile = (k, v) => \'<div class=\\"b\\"><div class=\\"k\\">\' + k + \'<span class=\\"pill st-\' + (v ? v.status : \'unknown\') + \'\\">\' + esc(v ? v.status : \'unknown\') + \'</span></div><div class=\\"d\\">\' + esc(v ? v.detail : \'\') + \'</div></div>\';\\n  const theirs = (a.next_steps || []).filter(n => n.side === \'them\');\\n  const turns = (DATA.transcript.turns || []).map(t => \'<div class=\\"turn\\"><div><div class=\\"who \' + (sideOf[t.speaker] || (t.speaker === DATA.rep ? \'us\' : \'them\')) + \'\\">\' + esc(t.speaker) + \'</div>\' + esc(t.text) + \'</div></div>\').join(\'\');\\n  $(\'right\').innerHTML = \'<div class=\\"card\\"><h2>BANT</h2><div class=\\"bant\\">\' + tile(\'Budget\', b.budget) + tile(\'Authority\', b.authority) + tile(\'Need\', b.need) + tile(\'Timeline\', b.timeline) + \'</div></div>\'\\n    + \'<div class=\\"card\\"><h2>Objections</h2>\' + ((a.objections || []).length ? \'<ul class=\\"plain\\">\' + a.objections.map(o => \'<li>\' + esc(o.objection) + \'<span class=\\"tag \' + o.status + \'\\">\' + o.status + \'</span><div class=\\"sub\\">\' + esc(o.response) + \'</div></li>\').join(\'\') + \'</ul>\' : \'<span class=\\"sub\\">None raised.</span>\') + \'</div>\'\\n    + \'<div class=\\"card\\"><h2>Risks and competitors</h2><ul class=\\"plain\\">\' + (a.risks || []).map(r => \'<li>\' + esc(r) + \'</li>\').join(\'\') + (a.competitors || []).map(c => \'<li><b>\' + esc(c.name) + \'</b>: \' + esc(c.context) + \'</li>\').join(\'\') + \'</ul></div>\'\\n    + (theirs.length ? \'<div class=\\"card\\"><h2>Waiting on them</h2><ul class=\\"plain\\">\' + theirs.map(n => \'<li>\' + esc(n.action) + \' <span class=\\"sub\\">(\' + esc(n.owner) + (n.due ? \', \' + esc(day(n.due)) : \'\') + \')</span></li>\').join(\'\') + \'</ul></div>\' : \'\')\\n    + \'<div class=\\"card\\"><details><summary>Transcript\' + (DATA.transcript.labelled ? \'\' : \' (no speaker labels)\') + \'</summary>\' + (turns || \'<div class=\\"plaintext\\">\' + esc(DATA.transcript.text) + \'</div>\') + \'</details></div>\';\\n}\\nasync function submit(action) {\\n  [\'send\', \'approve\', \'discard\'].forEach(id => $(id).disabled = true);\\n  const approve = [...document.querySelectorAll(\'.chg input:checked\')].map(i => i.dataset.id);\\n  try {\\n    const res = await fetch(\'review\', { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify({ call_id: DATA.call_id, token: DATA.token, action, approve, subject: $(\'subject\').value, body: $(\'body\').value }) });\\n    const out = await res.json();\\n    if (!res.ok || !out.ok) throw new Error(out.message || \'That didn\\\\\'t work.\');\\n    DATA.status = out.status;\\n    left();\\n  } catch (e) { alert(e.message); [\'send\', \'approve\', \'discard\'].forEach(id => $(id).disabled = false); }\\n}\\nhead(); left(); right();\\n</script>\\n</body>\\n</html>\\n"\n' +
        ';\n' +
        'const contact = (crm.contacts || []).find(p => p.email === c.email_to) || {};\n' +
        'const data = {\n' +
        '  mode: s.mode, call_id: c.call_id, token: c.token, status: c.status, rep: c.rep, duration_s: c.duration_s,\n' +
        '  when: DateTime.fromISO(c.created_at).setZone(TZ).toFormat(\'ccc d LLL, h:mm a\'),\n' +
        '  deal: crm.deal || {}, company: (crm.company || {}).name || \'\', stage_label: stageLabel((crm.deal || {}).stage),\n' +
        '  analysis: parseJson(c.analysis_json, {}), applied: parseJson(c.applied_json, { changes: [], tasks: [] }), pending: parseJson(c.pending_json, []),\n' +
        '  transcript: parseJson(c.transcript_json, { segments: [] }),\n' +
        '  email_to: c.email_to, email_to_name: contact.name || \'\', email_subject: c.email_subject, email_body: c.email_body\n' +
        '};\n' +
        'return [{ json: { code: 200, html: TEMPLATE.replace(\'/*__DATA__*/null\', JSON.stringify(data).replace(/</g, \'\\\\u003c\')) } }];\n'
  } },
  output: [{ code: 200, html: '<html></html>' }]
});

const notFound = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Not Found', position: [1300, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Wrong or old link.\n' +
        'return [{ json: { code: 404, html: \'<!doctype html><meta charset="utf-8"><title>Not found</title><p style="font-family:sans-serif;padding:40px">This review link isn\\\'t valid.</p>\' } }];\n'
  } },
  output: [{ code: 404, html: '<p>Not found</p>' }]
});

const sendPage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [1740, 300], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

// The decision
const submit = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Review Submit', position: [200, 700], parameters: { httpMethod: 'POST', path: 'tidewater/review', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { call_id: 'CL-ABCDE', token: 'token', action: 'send' } }]
});

const readSettings2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings (Submit)', position: [420, 700], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const readCall2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Call (Submit)', position: [640, 700], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CALLS, returnAll: true, filters: { conditions: [{ keyName: 'call_id', condition: 'eq', keyValue: expr("{{ $('Review Submit').first().json.body.call_id || 'none' }}") }] } } },
  output: [{ call_id: 'CL-ABCDE', token: 'token', status: 'pending_review' }]
});

const plan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan', position: [860, 700], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What the rep decided: which waiting changes to apply, and whether to send the (possibly edited) email.\n' +
        '// The token must match and the call must still be waiting for review.\n' +
        '// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----\n' +
        'const TZ = \'America/New_York\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const dollars = n => \'$\' + Math.round(Number(n) || 0).toLocaleString(\'en-US\');\n' +
        'const day = d => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat(\'ccc, LLL d\') : String(d || \'\');\n' +
        'const mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\n' +
        '\n' +
        '// HubSpot\'s default sales pipeline.\n' +
        'const STAGES = [\n' +
        '  [\'appointmentscheduled\', \'Appointment scheduled\', \'A first meeting is booked.\'],\n' +
        '  [\'qualifiedtobuy\', \'Qualified to buy\', \'Need, rough budget, decision process and timeline are understood.\'],\n' +
        '  [\'presentationscheduled\', \'Presentation scheduled\', \'A demo or presentation is booked or has been given.\'],\n' +
        '  [\'decisionmakerboughtin\', \'Decision maker bought-in\', \'The person who signs has seen it and supports it.\'],\n' +
        '  [\'contractsent\', \'Contract sent\', \'A proposal or contract has been sent.\'],\n' +
        '  [\'closedwon\', \'Closed won\', \'Signed.\'],\n' +
        '  [\'closedlost\', \'Closed lost\', \'The prospect said no.\']\n' +
        '];\n' +
        'const stageIndex = id => STAGES.findIndex(s => s[0] === id);\n' +
        'const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];\n' +
        '\n' +
        '// OpenAI node (Responses API) output: the JSON object from the first output_text part, or null.\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        '\n' +
        '// Is this quote really in the transcript? (case, punctuation and spacing ignored)\n' +
        'const norm = s => String(s || \'\').toLowerCase().replace(/[’\']/g, "\'").replace(/[^a-z0-9\' ]+/g, \' \').replace(/\\s+/g, \' \').trim();\n' +
        'const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };\n' +
        '\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'const plainToHtml = t => String(t || \'\').split(/\\n{2,}/).map(p => \'<p style="margin:0 0 14px;text-align:left">\' + esc(p).replace(/\\n/g, \'<br>\') + \'</p>\').join(\'\');\n' +
        '// n8n shows a form\'s completion HTML as the whole page, so it needs its own styling.\n' +
        'function formPage(title, inner) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}\'\n' +
        '    + \'.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>\'\n' +
        '    + \'<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>\' + inner + \'</div></body></html>\';\n' +
        '}\n' +
        '// ---- end lib-tdw.js ----\n' +
        'const b = $(\'Review Submit\').first().json.body || {};\n' +
        'const c = $(\'Read Call (Submit)\').all().map(i => i.json).find(r => r.call_id === b.call_id) || null;\n' +
        'const s = settingsOf($(\'Read Settings (Submit)\').all());\n' +
        'if (!c || !b.token || b.token !== c.token) return [{ json: { ok: false, code: 403, message: \'Not allowed.\' } }];\n' +
        'if (c.status !== \'pending_review\') return [{ json: { ok: false, code: 409, message: \'This call was already reviewed.\' } }];\n' +
        'const action = [\'send\', \'approve\', \'discard\'].includes(b.action) ? b.action : \'approve\';\n' +
        'const pending = parseJson(c.pending_json, []);\n' +
        'const chosen = action === \'discard\' ? [] : pending.filter(p => p.field !== \'email\' && [].concat(b.approve || []).includes(p.id));\n' +
        'const fields = {};\n' +
        'for (const p of chosen) fields[p.field] = p.value;\n' +
        'const subject = String(b.subject || c.email_subject).slice(0, 200);\n' +
        'const body = String(b.body || c.email_body).slice(0, 5000);\n' +
        'const ops = [];\n' +
        'if (Object.keys(fields).length) ops.push({ action: \'update_deal\', deal_id: c.deal_id, fields });\n' +
        'if (action === \'send\') ops.push({ action: \'add_note\', deal_id: c.deal_id, kind: \'email\', title: \'Follow-up email sent: \' + subject, body, owner: c.rep, source: \'call-autopilot\' });\n' +
        'const applied = parseJson(c.applied_json, { changes: [], tasks: [] });\n' +
        'applied.changes = applied.changes.concat(chosen.map(p => ({ ...p, approved_by: c.rep })));\n' +
        'const status = action === \'send\' ? \'sent\' : action === \'approve\' ? \'approved\' : \'discarded\';\n' +
        'return [{ json: {\n' +
        '  ok: true, code: 200, call_id: c.call_id, status, ops,\n' +
        '  email: action === \'send\' && c.email_to ? { to: c.email_to, subject, html: plainToHtml(body), kind: \'follow_up\', call_id: c.call_id } : null,\n' +
        '  row: { applied_json: JSON.stringify(applied), pending_json: JSON.stringify(pending.filter(p => !chosen.includes(p))), email_subject: subject, email_body: body, status, reviewed_at: nowIso() },\n' +
        '  message: status === \'sent\' ? \'Sent, and the CRM is up to date.\' : status === \'approved\' ? \'Changes approved.\' : \'Discarded.\'\n' +
        '} }];\n'
  } },
  output: [{ ok: true, code: 200, call_id: 'CL-ABCDE', status: 'sent', ops: [], email: null, row: {}, message: 'Sent.' }]
});

const planOk = ifElse({
  version: 2.2,
  config: {
    name: 'Allowed?',
    position: [1080, 700],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const ops = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'CRM Updates', position: [1300, 600], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One CRM write per item (a placeholder when there is nothing to change).\n' +
        'const p = $(\'Plan\').first().json;\n' +
        'return (p.ops.length ? p.ops : [{ action: \'none\' }]).map(json => ({ json }));\n'
  } },
  output: [{ action: 'update_deal', deal_id: 'D-1001', fields: { stage: 'qualifiedtobuy' } }]
});

const applyOps = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Update CRM', position: [1520, 600], alwaysOutputData: true, parameters: { source: 'database', workflowId: CRM_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const email = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Follow-up Email', position: [1740, 600], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The follow-up email, if the rep chose to send it.\n' +
        'const p = $(\'Plan\').first().json;\n' +
        'return [{ json: p.email || { to: \'\' } }];\n'
  } },
  output: [{ to: 'renee.alvarez@callowaydental.example', subject: 'Next steps', html: '<p>Hi</p>', kind: 'follow_up', call_id: 'CL-ABCDE' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Email', position: [1960, 600], alwaysOutputData: true, onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const updateRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Reviewed Row', position: [2180, 600], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The call row after review.\n' +
        'const p = $(\'Plan\').first().json;\n' +
        'return [{ json: { call_id: p.call_id, ...p.row } }];\n'
  } },
  output: [{ call_id: 'CL-ABCDE', status: 'sent' }]
});

const updateCall = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Call',
    position: [2400, 600],
    parameters: {
      resource: 'row', operation: 'update', dataTableId: CALLS,
      filters: { conditions: [{ keyName: 'call_id', condition: 'eq', keyValue: expr('{{ $json.call_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: {
          applied_json: expr('{{ $json.applied_json }}'),
          pending_json: expr('{{ $json.pending_json }}'),
          email_subject: expr('{{ $json.email_subject }}'),
          email_body: expr('{{ $json.email_body }}'),
          status: expr('{{ $json.status }}'),
          reviewed_at: expr('{{ $json.reviewed_at }}')
      }, schema: [
          { id: 'applied_json', displayName: 'applied_json', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'pending_json', displayName: 'pending_json', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'email_subject', displayName: 'email_subject', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'email_body', displayName: 'email_body', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'reviewed_at', displayName: 'reviewed_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ id: 1 }]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Submit Result', position: [2620, 700], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What the page gets back.\n' +
        'const p = $(\'Plan\').first().json;\n' +
        'return [{ json: { code: p.code, body: { ok: p.ok, message: p.message, status: p.status || \'\' } } }];\n'
  } },
  output: [{ code: 200, body: { ok: true, message: 'Sent.', status: 'sent' } }]
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Result', position: [2840, 700], parameters: { respondWith: 'json', responseBody: expr('{{ $json.body }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

const note = sticky(
  '## Tidewater 4: Review Page\n`GET /webhook/tidewater/review?call=…&t=…` is the rep\'s page for one call: summary, what already went into the CRM, the changes that wait for an OK (with the quote behind each), BANT, objections, risks, the transcript, and the follow-up email to edit.\n`POST` applies the changes the rep ticked, sends the email (Gmail live, Outbox test), logs it on the deal and closes the review. Each link has a private token, and a call can only be reviewed once.',
  [], { position: [160, -20], width: 1400, height: 220, color: 5 }
);

export default workflow('tidewater-review-page', 'Tidewater 4: Review Page')
  .add(link)
  .to(readSettings)
  .to(readCall)
  .to(check)
  .to(linkOk
    .onTrue(getDeal.to(buildPage).to(sendPage))
    .onFalse(notFound.to(sendPage)))
  .add(submit)
  .to(readSettings2)
  .to(readCall2)
  .to(plan)
  .to(planOk
    .onTrue(ops.to(applyOps).to(email).to(send).to(updateRow).to(updateCall).to(result))
    .onFalse(result))
  .add(result)
  .to(respond)
  .add(note);
