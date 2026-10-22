import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const JOBS = { __rl: true, mode: 'id', value: 'qycslNJXs6wOwRxE', cachedResultName: 'Northgate Jobs' };
const CANDIDATES = { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' };
const EVENTS = { __rl: true, mode: 'id', value: 'v5LAsWSJxw2Uj4Ig', cachedResultName: 'Northgate Events' };
const FILES = { __rl: true, mode: 'id', value: 'nKofBkG4S6UPt1xd', cachedResultName: 'Northgate Files' };
const ACTION_WF = { __rl: true, mode: 'id', value: 'ngtCandAction005', cachedResultName: 'Northgate 5: Candidate Action' };
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };

// Page
const pageHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Dashboard Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'northgate/dashboard', responseMode: 'responseNode', options: {} } },
  output: [{ query: { key: 'k', job: 'NG-101' } }]
});

const pageSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'dashboard_key', value: 'k' }]
});

const pageJobs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Jobs', position: [640, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: JOBS, returnAll: true } },
  output: [{ job_id: 'NG-101', title: 'Customer Success Manager' }]
});

const pageCands = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Candidates', position: [860, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true } },
  output: [{ candidate_id: 'C1021-ABCD', job_id: 'NG-101', score: 82, band: 'shortlist', status: 'new' }]
});

const pageEvents = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Events', position: [1080, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: EVENTS, returnAll: true } },
  output: [{ candidate_id: 'C1021-ABCD', event: 'screened', detail: 'Score 82', at: '2026-10-21T19:00:00.000+01:00' }]
});

const buildPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Page', position: [1300, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Builds the dashboard: every job, every candidate with their screening, and a short history.\n' +
        '// The page needs the dashboard key from Settings; anyone without it gets a plain "not found".\n' +
        '// ---- lib-ngt.js (included by build.py): shared helpers for the Northgate workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const pounds = n => \'£\' + Math.round(Number(n) || 0).toLocaleString(\'en-GB\');\n' +
        'const whenText = iso => DateTime.fromISO(String(iso), { zone: TZ }).toFormat("cccc d LLLL \'at\' h:mm a").replace(\':00 \', \' \');\n' +
        'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
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
        '// Plain, left-aligned email body with the agency\'s name at the top.\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#0b6e4f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '\n' +
        '// A small standalone web page for candidates (booking links, confirmations, problems).\n' +
        'function pageHtml(company, title, bodyHtml) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \' · \' + esc(company) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef3f0;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#10231a}\'\n' +
        '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #dbe5df;border-radius:16px;padding:32px 30px;box-shadow:0 6px 24px rgba(16,35,26,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0b6e4f;margin-bottom:18px}\'\n' +
        '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4f45;margin:0 0 12px}\'\n' +
        '    + \'.slot{display:block;padding:12px 16px;border:1px solid #dbe5df;border-radius:12px;margin:8px 0;color:#0b6e4f;font-weight:600;text-decoration:none}.slot:hover{border-color:#0b6e4f;background:#f3faf6}\'\n' +
        '    + \'.big{font-size:19px;font-weight:700;color:#10231a;margin:6px 0 14px}.muted{color:#6b7c72;font-size:13px}</style></head><body><div class="card">\'\n' +
        '    + \'<div class="brand">\' + esc(company) + \'</div><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
        '}\n' +
        '\n' +
        'const BAND_LABEL = { shortlist: \'Shortlist\', review: \'Worth a look\', unlikely: \'Unlikely fit\', knockout: \'Knockout\' };\n' +
        '// ---- end lib-ngt.js ----\n' +
        'const q = $(\'Dashboard Request\').first().json.query || {};\n' +
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'if (!s.dashboard_key || q.key !== s.dashboard_key) return [{ json: { code: 404, html: \'<h1>Not found</h1>\' } }];\n' +
        'const TEMPLATE =\n' +
        '"<!doctype html>\\n<html lang=\\"en\\">\\n<head>\\n<meta charset=\\"utf-8\\">\\n<meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\">\\n<title>Screening · Northgate Talent</title>\\n<link rel=\\"preconnect\\" href=\\"https://fonts.googleapis.com\\">\\n<link href=\\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap\\" rel=\\"stylesheet\\">\\n<style>\\n:root {\\n  --bg: #f3f6f4; --panel: #ffffff; --line: #e3e9e5; --ink: #10231a; --ink-2: #3d4f45; --ink-3: #6b7c72; --brand: #0b6e4f; --brand-2: #e7f4ee;\\n  --green: #0f8a5f; --green-bg: #e5f5ec; --amber: #b45309; --amber-bg: #fdf3e2; --red: #c0352b; --red-bg: #fdecea; --grey-bg: #eef1ef; --blue: #2457c5; --blue-bg: #e8effc;\\n  --radius: 14px; --shadow: 0 1px 2px rgba(16,35,26,.06), 0 6px 24px rgba(16,35,26,.06);\\n}\\n* { box-sizing: border-box; }\\nhtml, body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.5 Inter, -apple-system, \\"Segoe UI\\", Helvetica, Arial, sans-serif; }\\nbutton { font: inherit; cursor: pointer; }\\n.top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 24px; background: var(--panel); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5; }\\n.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: -.2px; }\\n.logo { width: 30px; height: 30px; border-radius: 9px; background: var(--brand); color: #fff; display: grid; place-items: center; font-weight: 700; }\\n.brand small { display: block; font-weight: 500; color: var(--ink-3); font-size: 12px; letter-spacing: 0; }\\n.top-right { display: flex; align-items: center; gap: 14px; color: var(--ink-3); font-size: 13px; }\\n.pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }\\n.pill.test { background: var(--amber-bg); color: var(--amber); }\\n.pill.live { background: var(--green-bg); color: var(--green); }\\n.toggle { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; color: var(--ink-2); font-weight: 500; }\\n.toggle input { display: none; }\\n.toggle .sw { width: 34px; height: 20px; border-radius: 999px; background: #cfd8d3; position: relative; transition: .15s; }\\n.toggle .sw::after { content: \\"\\"; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: .15s; }\\n.toggle input:checked + .sw { background: var(--brand); }\\n.toggle input:checked + .sw::after { left: 16px; }\\n.layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 59px); }\\n.side { border-right: 1px solid var(--line); padding: 20px 14px; background: #f8faf9; }\\n.side h3 { margin: 0 10px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-3); }\\n.job { width: 100%; text-align: left; border: 0; background: transparent; padding: 10px 12px; border-radius: 10px; margin-bottom: 4px; color: var(--ink); }\\n.job:hover { background: var(--grey-bg); }\\n.job.on { background: var(--panel); box-shadow: var(--shadow); }\\n.job b { display: block; font-weight: 600; }\\n.job span { color: var(--ink-3); font-size: 12px; }\\n.job .count { float: right; background: var(--brand-2); color: var(--brand); font-weight: 700; font-size: 11px; border-radius: 999px; padding: 1px 8px; margin-top: 2px; }\\n.main { padding: 22px 26px 40px; min-width: 0; }\\n.head h1 { margin: 0; font-size: 22px; letter-spacing: -.4px; }\\n.head p { margin: 4px 0 0; color: var(--ink-3); }\\n.stats { display: flex; gap: 10px; flex-wrap: wrap; margin: 16px 0 14px; }\\n.stat { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; min-width: 110px; }\\n.stat b { display: block; font-size: 20px; letter-spacing: -.4px; }\\n.stat span { color: var(--ink-3); font-size: 12px; }\\n.tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }\\n.tab { border: 1px solid var(--line); background: var(--panel); border-radius: 999px; padding: 5px 12px; color: var(--ink-2); font-weight: 500; font-size: 13px; }\\n.tab.on { background: var(--ink); color: #fff; border-color: var(--ink); }\\n.cols { display: grid; grid-template-columns: minmax(300px, 400px) 1fr; gap: 18px; align-items: start; }\\n.list { display: flex; flex-direction: column; gap: 10px; }\\n.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; display: grid; grid-template-columns: 52px 1fr; gap: 12px; cursor: pointer; text-align: left; transition: border-color .12s, box-shadow .12s; }\\n.card:hover { border-color: #c9d6cf; }\\n.card.on { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(11,110,79,.12); }\\n.ring { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 15px; position: relative; }\\n.ring::before { content: \\"\\"; position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(var(--c) calc(var(--p) * 1%), #e8ede9 0); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px)); mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px)); }\\n.card .nm { font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\\n.card .sm { color: var(--ink-3); font-size: 13px; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\\n.band-shortlist { background: var(--green-bg); color: var(--green); }\\n.band-review { background: var(--blue-bg); color: var(--blue); }\\n.band-unlikely { background: var(--grey-bg); color: var(--ink-2); }\\n.band-knockout { background: var(--red-bg); color: var(--red); }\\n.st { background: #f3f4f6; color: #475467; }\\n.st-invited { background: var(--brand-2); color: var(--brand); }\\n.st-interview_booked { background: var(--green); color: #fff; }\\n.st-rejected { background: var(--red-bg); color: var(--red); }\\n.st-hold { background: var(--amber-bg); color: var(--amber); }\\n.flagdot { color: var(--amber); font-size: 12px; font-weight: 600; }\\n.detail { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 22px; box-shadow: var(--shadow); position: sticky; top: 80px; }\\n.detail h2 { margin: 0; font-size: 20px; letter-spacing: -.3px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }\\n.meta { display: flex; gap: 18px; flex-wrap: wrap; color: var(--ink-3); font-size: 13px; margin: 8px 0 14px; }\\n.meta b { color: var(--ink-2); font-weight: 600; }\\n.flags { display: flex; flex-direction: column; gap: 6px; margin: 0 0 14px; }\\n.flag { border-radius: 10px; padding: 9px 12px; font-size: 13px; }\\n.flag.stop { background: var(--red-bg); color: var(--red); }\\n.flag.warn { background: var(--amber-bg); color: #8a4207; }\\n.flag.info { background: var(--grey-bg); color: var(--ink-2); }\\n.summary { font-size: 14.5px; color: var(--ink-2); margin: 0 0 16px; }\\n.sect { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-3); font-weight: 600; margin: 18px 0 8px; }\\n.crit { display: grid; grid-template-columns: 26px 1fr; gap: 10px; padding: 10px 0; border-top: 1px solid var(--line); }\\n.crit:first-of-type { border-top: 0; }\\n.ico { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; margin-top: 1px; }\\n.ico.met { background: var(--green-bg); color: var(--green); }\\n.ico.partial { background: var(--amber-bg); color: var(--amber); }\\n.ico.not_met { background: var(--red-bg); color: var(--red); }\\n.ico.unclear { background: var(--grey-bg); color: var(--ink-3); }\\n.crit .t { font-weight: 500; }\\n.crit .tag { font-size: 10.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--ink-3); margin-left: 6px; }\\n.crit .ev { color: var(--ink-3); font-size: 13px; margin-top: 2px; }\\n.crit .ev q { color: var(--ink-2); font-style: italic; }\\n.two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }\\nul.plain { margin: 0; padding-left: 18px; color: var(--ink-2); }\\nul.plain li { margin: 3px 0; }\\n.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); }\\n.btn { border-radius: 10px; padding: 9px 16px; font-weight: 600; border: 1px solid var(--line); background: var(--panel); color: var(--ink); }\\n.btn.primary { background: var(--brand); border-color: var(--brand); color: #fff; }\\n.btn.danger { color: var(--red); border-color: #f1c5c0; }\\n.btn:disabled { opacity: .45; cursor: not-allowed; }\\n.btn.link { border: 0; color: var(--brand); padding-left: 4px; padding-right: 4px; margin-left: auto; text-decoration: none; display: inline-flex; align-items: center; }\\n.slots { margin-top: 12px; color: var(--ink-2); font-size: 13px; }\\n.slots li { margin: 2px 0; }\\n.timeline { margin: 0; padding: 0; list-style: none; font-size: 12.5px; color: var(--ink-3); }\\n.timeline li { padding: 3px 0 3px 14px; position: relative; }\\n.timeline li::before { content: \\"\\"; position: absolute; left: 0; top: 10px; width: 6px; height: 6px; border-radius: 50%; background: #c3cfc8; }\\n.empty { color: var(--ink-3); padding: 40px; text-align: center; background: var(--panel); border: 1px dashed var(--line); border-radius: var(--radius); }\\n.toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%) translateY(20px); background: var(--ink); color: #fff; padding: 11px 18px; border-radius: 12px; font-weight: 500; opacity: 0; transition: .2s; pointer-events: none; z-index: 10; }\\n.toast.show { opacity: 1; transform: translateX(-50%); }\\n@media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } .detail { position: static; } }\\n@media (max-width: 760px) { .layout { grid-template-columns: 1fr; } .side { border-right: 0; border-bottom: 1px solid var(--line); display: flex; gap: 6px; overflow-x: auto; padding: 10px; } .side h3 { display: none; } .job { min-width: 200px; } .two { grid-template-columns: 1fr; } .top-right .upd { display: none; } }\\n</style>\\n</head>\\n<body>\\n<div class=\\"top\\">\\n  <div class=\\"brand\\"><div class=\\"logo\\">N</div><div>Northgate Talent<small>Application screening</small></div></div>\\n  <div class=\\"top-right\\">\\n    <span class=\\"upd\\" id=\\"updated\\"></span>\\n    <span id=\\"mode\\"></span>\\n    <label class=\\"toggle\\" title=\\"Hide names until you decide\\"><input type=\\"checkbox\\" id=\\"blind\\"><span class=\\"sw\\"></span>Blind review</label>\\n  </div>\\n</div>\\n<div class=\\"layout\\">\\n  <nav class=\\"side\\"><h3>Open roles</h3><div id=\\"jobs\\"></div></nav>\\n  <main class=\\"main\\">\\n    <div class=\\"head\\" id=\\"head\\"></div>\\n    <div class=\\"stats\\" id=\\"stats\\"></div>\\n    <div class=\\"tabs\\" id=\\"tabs\\"></div>\\n    <div class=\\"cols\\"><div class=\\"list\\" id=\\"list\\"></div><div id=\\"detail\\"></div></div>\\n  </main>\\n</div>\\n<div class=\\"toast\\" id=\\"toast\\"></div>\\n<script>\\nconst DATA = /*__DATA__*/null;\\n// n8n serves this page sandboxed (no storage), so the blind-review choice is remembered only when storage works.\\nconst store = { get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} } };\\nconst state = { job: DATA.job, filter: \'all\', selected: DATA.selected || \'\', blind: store.get(\'ngt-blind\') !== \'0\' };\\nconst BAND = { shortlist: \'Shortlist\', review: \'Worth a look\', unlikely: \'Unlikely fit\', knockout: \'Knockout\' };\\nconst BAND_ORDER = { shortlist: 0, review: 1, unlikely: 2, knockout: 3 };\\nconst BAND_COLOR = { shortlist: \'#0f8a5f\', review: \'#2457c5\', unlikely: \'#8a9a91\', knockout: \'#c0352b\' };\\nconst STATUS = { new: \'New\', invited: \'Invited\', interview_booked: \'Interview booked\', rejected: \'Rejected\', hold: \'On hold\' };\\nconst ICON = { met: \'✓\', partial: \'◐\', not_met: \'✕\', unclear: \'?\' };\\nconst RATING = { met: \'Met\', partial: \'Partly\', not_met: \'Not met\', unclear: \'Not shown\' };\\nconst esc = s => String(s ?? \'\').replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/\\"/g, \'&quot;\');\\nconst $ = id => document.getElementById(id);\\nconst fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? \'\' : d.toLocaleString(\'en-GB\', { day: \'numeric\', month: \'short\', hour: \'2-digit\', minute: \'2-digit\' }); };\\nconst money = n => n ? \'£\' + Number(n).toLocaleString(\'en-GB\') : \'\';\\nconst displayName = c => state.blind && c.status !== \'invited\' && c.status !== \'interview_booked\' ? \'Candidate \' + c.candidate_id : c.name;\\nconst decided = c => c.status !== \'new\';\\n\\nfunction jobCands(jobId) {\\n  return DATA.candidates.filter(c => c.job_id === jobId).sort((a, b) => (BAND_ORDER[a.band] - BAND_ORDER[b.band]) || (b.score - a.score));\\n}\\nfunction filtered() {\\n  const all = jobCands(state.job);\\n  if (state.filter === \'all\') return all;\\n  if (state.filter === \'decided\') return all.filter(decided);\\n  return all.filter(c => c.band === state.filter && !decided(c));\\n}\\nfunction renderJobs() {\\n  $(\'jobs\').innerHTML = DATA.jobs.map(j => {\\n    const n = jobCands(j.job_id).filter(c => c.status === \'new\').length;\\n    return \'<button class=\\"job\' + (j.job_id === state.job ? \' on\' : \'\') + \'\\" data-job=\\"\' + j.job_id + \'\\">\' + (n ? \'<span class=\\"count\\">\' + n + \'</span>\' : \'\')\\n      + \'<b>\' + esc(j.title) + \'</b><span>\' + esc(j.location) + \' · \' + esc(j.job_id) + \'</span></button>\';\\n  }).join(\'\');\\n  document.querySelectorAll(\'.job\').forEach(b => b.onclick = () => { state.job = b.dataset.job; state.filter = \'all\'; state.selected = \'\'; render(); });\\n}\\nfunction renderHead() {\\n  const j = DATA.jobs.find(x => x.job_id === state.job) || {};\\n  $(\'head\').innerHTML = \'<h1>\' + esc(j.title) + \'</h1><p>\' + esc(j.client) + \' · \' + esc(j.location) + \' · \' + esc(j.work_mode) + \' · \' + money(j.salary_min) + \'–\' + money(j.salary_max) + (j.sponsorship ? \'\' : \' · No visa sponsorship\') + \'</p>\';\\n  const all = jobCands(state.job);\\n  const count = b => all.filter(c => c.band === b).length;\\n  const stats = [[all.length, \'Applications\'], [count(\'shortlist\'), \'Shortlist\'], [count(\'review\'), \'Worth a look\'], [count(\'unlikely\') + count(\'knockout\'), \'Unlikely or knockout\'], [all.filter(c => c.status === \'interview_booked\').length, \'Interviews booked\']];\\n  $(\'stats\').innerHTML = stats.map(s => \'<div class=\\"stat\\"><b>\' + s[0] + \'</b><span>\' + s[1] + \'</span></div>\').join(\'\');\\n  const tabs = [[\'all\', \'All\'], [\'shortlist\', \'Shortlist\'], [\'review\', \'Worth a look\'], [\'unlikely\', \'Unlikely\'], [\'knockout\', \'Knockout\'], [\'decided\', \'Decided\']];\\n  $(\'tabs\').innerHTML = tabs.map(t => \'<button class=\\"tab\' + (state.filter === t[0] ? \' on\' : \'\') + \'\\" data-f=\\"\' + t[0] + \'\\">\' + t[1] + \'</button>\').join(\'\');\\n  document.querySelectorAll(\'.tab\').forEach(b => b.onclick = () => { state.filter = b.dataset.f; render(); });\\n}\\nfunction ring(c) {\\n  const p = c.score < 0 ? 0 : c.score;\\n  return \'<div class=\\"ring\\" style=\\"--p:\' + p + \';--c:\' + BAND_COLOR[c.band] + \'\\">\' + (c.score < 0 ? \'–\' : c.score) + \'</div>\';\\n}\\nfunction renderList() {\\n  const rows = filtered();\\n  if (!rows.length) { $(\'list\').innerHTML = \'<div class=\\"empty\\">No applications here yet.</div>\'; return; }\\n  if (!rows.find(c => c.candidate_id === state.selected)) state.selected = rows[0].candidate_id;\\n  $(\'list\').innerHTML = rows.map(c => {\\n    const warn = c.flags.filter(f => f.level !== \'info\').length;\\n    return \'<button class=\\"card\' + (c.candidate_id === state.selected ? \' on\' : \'\') + \'\\" data-c=\\"\' + c.candidate_id + \'\\">\' + ring(c)\\n      + \'<div><div class=\\"nm\\">\' + esc(displayName(c)) + \' <span class=\\"pill band-\' + c.band + \'\\">\' + BAND[c.band] + \'</span>\'\\n      + (c.status !== \'new\' ? \'<span class=\\"pill st st-\' + c.status + \'\\">\' + STATUS[c.status] + \'</span>\' : \'\')\\n      + (warn ? \'<span class=\\"flagdot\\">⚑ \' + warn + \'</span>\' : \'\') + \'</div>\'\\n      + \'<div class=\\"sm\\">\' + esc(c.summary || \'No summary.\') + \'</div></div></button>\';\\n  }).join(\'\');\\n  document.querySelectorAll(\'.card\').forEach(b => b.onclick = () => { state.selected = b.dataset.c; renderList(); renderDetail(); });\\n}\\nfunction renderDetail() {\\n  const c = DATA.candidates.find(x => x.candidate_id === state.selected);\\n  if (!c) { $(\'detail\').innerHTML = \'\'; return; }\\n  const j = DATA.jobs.find(x => x.job_id === c.job_id) || {};\\n  const s = c.screening || {};\\n  const crit = (s.criteria || []).map(k => \'<div class=\\"crit\\"><div class=\\"ico \' + k.rating + \'\\" title=\\"\' + RATING[k.rating] + \'\\">\' + ICON[k.rating] + \'</div><div>\'\\n    + \'<div class=\\"t\\">\' + esc(k.text) + \'<span class=\\"tag\\">\' + (k.type === \'must\' ? \'Must\' : \'Nice\') + \'</span></div>\'\\n    + \'<div class=\\"ev\\">\' + (k.evidence ? \'<q>\' + esc(String(k.evidence).replace(/^[\\"“”\'\\\\s]+|[\\"“”\'\\\\s.]+$/g, \'\')) + \'</q> · \' : \'\') + esc(k.reason) + \'</div></div></div>\').join(\'\');\\n  const list = a => (a && a.length) ? \'<ul class=\\"plain\\">\' + a.map(x => \'<li>\' + esc(x) + \'</li>\').join(\'\') + \'</ul>\' : \'<span style=\\"color:var(--ink-3)\\">None noted.</span>\';\\n  const salary = c.salary_expectation ? money(c.salary_expectation) + (j.salary_max && c.salary_expectation > j.salary_max ? \' (above range)\' : \'\') : \'Not given\';\\n  const canInvite = c.band !== \'knockout\' && (c.status === \'new\' || c.status === \'hold\');\\n  const canHold = c.status === \'new\';\\n  const canReject = c.status === \'new\' || c.status === \'hold\' || c.status === \'invited\';\\n  const slots = (c.slots || []).length && c.status === \'invited\' ? \'<div class=\\"slots\\"><b>Times offered:</b><ul class=\\"plain\\">\' + c.slots.map(t => \'<li>\' + esc(t.label) + \'</li>\').join(\'\') + \'</ul></div>\' : \'\';\\n  const booked = c.status === \'interview_booked\' && c.interview_at ? \'<div class=\\"flag info\\" style=\\"margin-top:12px\\">Interview booked for <b>\' + esc(new Date(c.interview_at).toLocaleString(\'en-GB\', { weekday: \'long\', day: \'numeric\', month: \'long\', hour: \'2-digit\', minute: \'2-digit\' })) + \'</b> with \' + esc(j.interviewer) + \'.</div>\' : \'\';\\n  const events = (DATA.events[c.candidate_id] || []).map(e => \'<li>\' + esc(fmtDate(e.at)) + \' · \' + esc(e.text) + \'</li>\').join(\'\');\\n  $(\'detail\').innerHTML = \'<div class=\\"detail\\">\'\\n    + \'<h2>\' + esc(displayName(c)) + \' <span class=\\"pill band-\' + c.band + \'\\">\' + BAND[c.band] + (c.score >= 0 ? \' · \' + c.score : \'\') + \'</span>\'\\n    + (c.status !== \'new\' ? \'<span class=\\"pill st st-\' + c.status + \'\\">\' + STATUS[c.status] + \'</span>\' : \'\') + \'</h2>\'\\n    + \'<div class=\\"meta\\"><span>Applied <b>\' + esc(fmtDate(c.applied_at)) + \'</b></span><span>Right to work <b>\' + esc(c.right_to_work.replace(\', I would need visa sponsorship\', \': needs sponsorship\')) + \'</b></span><span>Notice <b>\' + esc(c.notice_period) + \'</b></span><span>Salary <b>\' + esc(salary) + \'</b></span>\'\\n    + (state.blind ? \'\' : \'<span>\' + esc(c.email) + \'</span>\') + \'</div>\'\\n    + (c.flags.length ? \'<div class=\\"flags\\">\' + c.flags.map(f => \'<div class=\\"flag \' + f.level + \'\\">\' + esc(f.text) + \'</div>\').join(\'\') + \'</div>\' : \'\')\\n    + \'<p class=\\"summary\\">\' + esc(c.summary) + \'</p>\'\\n    + \'<div class=\\"sect\\">Criteria</div>\' + crit\\n    + \'<div class=\\"two\\"><div><div class=\\"sect\\">Strengths</div>\' + list(s.strengths) + \'</div><div><div class=\\"sect\\">Gaps</div>\' + list(s.gaps) + \'</div></div>\'\\n    + \'<div class=\\"sect\\">Questions to ask</div>\' + list(s.interview_questions)\\n    + slots + booked\\n    + \'<div class=\\"actions\\">\'\\n    + \'<button class=\\"btn primary\\" data-a=\\"invite\\"\' + (canInvite ? \'\' : \' disabled\') + \'>Invite to interview</button>\'\\n    + \'<button class=\\"btn\\" data-a=\\"hold\\"\' + (canHold ? \'\' : \' disabled\') + \'>Hold</button>\'\\n    + \'<button class=\\"btn danger\\" data-a=\\"reject\\"\' + (canReject ? \'\' : \' disabled\') + \'>Reject</button>\'\\n    + \'<a class=\\"btn link\\" target=\\"_blank\\" href=\\"cv?key=\' + encodeURIComponent(DATA.key) + \'&c=\' + c.candidate_id + \'\\">View CV ↗</a></div>\'\\n    + (events ? \'<div class=\\"sect\\">History</div><ul class=\\"timeline\\">\' + events + \'</ul>\' : \'\')\\n    + \'</div>\';\\n  document.querySelectorAll(\'[data-a]\').forEach(b => b.onclick = () => act(c, b.dataset.a, b));\\n}\\nfunction toast(t) { const el = $(\'toast\'); el.textContent = t; el.classList.add(\'show\'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove(\'show\'), 3200); }\\nasync function act(c, action, btn) {\\n  if (action === \'reject\' && !confirm(\'Send \' + (state.blind ? \'this candidate\' : c.name) + \' a rejection email?\')) return;\\n  document.querySelectorAll(\'[data-a]\').forEach(b => b.disabled = true);\\n  btn.textContent = action === \'invite\' ? \'Finding times…\' : \'Saving…\';\\n  try {\\n    const res = await fetch(\'action\', { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify({ key: DATA.key, candidate_id: c.candidate_id, action }) });\\n    const out = await res.json();\\n    if (!res.ok || !out.ok) throw new Error(out.message || \'That didn\\\\\'t work.\');\\n    Object.assign(c, out.candidate);\\n    (DATA.events[c.candidate_id] = DATA.events[c.candidate_id] || []).push({ at: new Date().toISOString(), text: out.message });\\n    toast(out.message);\\n  } catch (e) { toast(e.message); }\\n  render();\\n}\\nfunction render() { renderJobs(); renderHead(); renderList(); renderDetail(); }\\n$(\'blind\').checked = state.blind;\\n$(\'blind\').onchange = e => { state.blind = e.target.checked; store.set(\'ngt-blind\', state.blind ? \'1\' : \'0\'); render(); };\\n$(\'mode\').innerHTML = DATA.mode === \'live\' ? \'<span class=\\"pill live\\">Live</span>\' : \'<span class=\\"pill test\\" title=\\"Emails go to the Outbox table\\">Test mode</span>\';\\n$(\'updated\').textContent = \'Updated \' + fmtDate(DATA.generated_at);\\nrender();\\n</script>\\n</body>\\n</html>\\n"\n' +
        ';\n' +
        'const jobs = $(\'Read Jobs\').all().map(i => i.json).filter(j => j.job_id).map(j => ({\n' +
        '  job_id: j.job_id, title: j.title, client: j.client, location: j.location, work_mode: j.work_mode,\n' +
        '  salary_min: j.salary_min, salary_max: j.salary_max, sponsorship: j.sponsorship, interviewer: j.interviewer\n' +
        '}));\n' +
        'const candidates = $(\'Read Candidates\').all().map(i => i.json).filter(c => c.candidate_id).map(c => ({\n' +
        '  candidate_id: c.candidate_id, job_id: c.job_id, name: c.name, email: c.email, score: c.score, band: c.band, status: c.status,\n' +
        '  summary: c.summary, right_to_work: c.right_to_work, notice_period: c.notice_period, salary_expectation: c.salary_expectation,\n' +
        '  applied_at: c.applied_at, interview_at: c.interview_at,\n' +
        '  flags: parseJson(c.flags_json, []), screening: parseJson(c.screening_json, {}), slots: parseJson(c.slots_json, [])\n' +
        '}));\n' +
        'const events = {};\n' +
        'for (const e of $(\'Read Events\').all().map(i => i.json).filter(e => e.candidate_id)) {\n' +
        '  (events[e.candidate_id] = events[e.candidate_id] || []).push({ at: e.at, text: e.detail });\n' +
        '}\n' +
        'const data = {\n' +
        '  company: s.company, key: q.key, mode: s.mode,\n' +
        '  job: jobs.some(j => j.job_id === q.job) ? q.job : (jobs[0] || {}).job_id, selected: q.c || \'\',\n' +
        '  jobs, candidates, events, generated_at: nowIso()\n' +
        '};\n' +
        'const html = TEMPLATE.replace(\'/*__DATA__*/null\', JSON.stringify(data).replace(/</g, \'\\\\u003c\'));\n' +
        'return [{ json: { code: 200, html } }];\n'
  } },
  output: [{ code: 200, html: '<html></html>' }]
});

const sendPage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [1520, 300], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

// Actions
const actionHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Action Request', position: [200, 640], parameters: { httpMethod: 'POST', path: 'northgate/action', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { key: 'k', candidate_id: 'C1021-ABCD', action: 'invite' } }]
});

const actionSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings (Action)', position: [420, 640], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'dashboard_key', value: 'k' }]
});

const checkKey = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Key', position: [640, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Only requests carrying the dashboard key may change anything.\n' +
        '// ---- lib-ngt.js (included by build.py): shared helpers for the Northgate workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const pounds = n => \'£\' + Math.round(Number(n) || 0).toLocaleString(\'en-GB\');\n' +
        'const whenText = iso => DateTime.fromISO(String(iso), { zone: TZ }).toFormat("cccc d LLLL \'at\' h:mm a").replace(\':00 \', \' \');\n' +
        'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
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
        '// Plain, left-aligned email body with the agency\'s name at the top.\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#0b6e4f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '\n' +
        '// A small standalone web page for candidates (booking links, confirmations, problems).\n' +
        'function pageHtml(company, title, bodyHtml) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \' · \' + esc(company) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef3f0;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#10231a}\'\n' +
        '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #dbe5df;border-radius:16px;padding:32px 30px;box-shadow:0 6px 24px rgba(16,35,26,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0b6e4f;margin-bottom:18px}\'\n' +
        '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4f45;margin:0 0 12px}\'\n' +
        '    + \'.slot{display:block;padding:12px 16px;border:1px solid #dbe5df;border-radius:12px;margin:8px 0;color:#0b6e4f;font-weight:600;text-decoration:none}.slot:hover{border-color:#0b6e4f;background:#f3faf6}\'\n' +
        '    + \'.big{font-size:19px;font-weight:700;color:#10231a;margin:6px 0 14px}.muted{color:#6b7c72;font-size:13px}</style></head><body><div class="card">\'\n' +
        '    + \'<div class="brand">\' + esc(company) + \'</div><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
        '}\n' +
        '\n' +
        'const BAND_LABEL = { shortlist: \'Shortlist\', review: \'Worth a look\', unlikely: \'Unlikely fit\', knockout: \'Knockout\' };\n' +
        '// ---- end lib-ngt.js ----\n' +
        'const b = $(\'Action Request\').first().json.body || {};\n' +
        'const s = settingsOf($(\'Read Settings (Action)\').all());\n' +
        'const ok = !!s.dashboard_key && b.key === s.dashboard_key && /^C\\d{4}-[A-Z0-9]{4}$/.test(String(b.candidate_id || \'\')) && [\'invite\', \'reject\', \'hold\'].includes(b.action);\n' +
        'return [{ json: { ok, candidate_id: String(b.candidate_id || \'\'), action: String(b.action || \'\'), actor: s.recruiter_name || \'recruiter\' } }];\n'
  } },
  output: [{ ok: true, candidate_id: 'C1021-ABCD', action: 'invite', actor: 'Priya Shah' }]
});

const keyOk = ifElse({
  version: 2.2,
  config: {
    name: 'Allowed?',
    position: [860, 640],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const runAction = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Run Action', position: [1080, 560], alwaysOutputData: true, parameters: { source: 'database', workflowId: ACTION_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const readAgain = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read Candidate Again',
    position: [1300, 560],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true, filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr("{{ $('Check Key').first().json.candidate_id }}") }] } }
  },
  output: [{ candidate_id: 'C1021-ABCD', status: 'invited', slots_json: '[]' }]
});

const actionResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Action Response', position: [1520, 560], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What the dashboard gets back: the outcome and the candidate\'s new state.\n' +
        '// ---- lib-ngt.js (included by build.py): shared helpers for the Northgate workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const pounds = n => \'£\' + Math.round(Number(n) || 0).toLocaleString(\'en-GB\');\n' +
        'const whenText = iso => DateTime.fromISO(String(iso), { zone: TZ }).toFormat("cccc d LLLL \'at\' h:mm a").replace(\':00 \', \' \');\n' +
        'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
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
        '// Plain, left-aligned email body with the agency\'s name at the top.\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#0b6e4f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '\n' +
        '// A small standalone web page for candidates (booking links, confirmations, problems).\n' +
        'function pageHtml(company, title, bodyHtml) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \' · \' + esc(company) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef3f0;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#10231a}\'\n' +
        '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #dbe5df;border-radius:16px;padding:32px 30px;box-shadow:0 6px 24px rgba(16,35,26,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0b6e4f;margin-bottom:18px}\'\n' +
        '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4f45;margin:0 0 12px}\'\n' +
        '    + \'.slot{display:block;padding:12px 16px;border:1px solid #dbe5df;border-radius:12px;margin:8px 0;color:#0b6e4f;font-weight:600;text-decoration:none}.slot:hover{border-color:#0b6e4f;background:#f3faf6}\'\n' +
        '    + \'.big{font-size:19px;font-weight:700;color:#10231a;margin:6px 0 14px}.muted{color:#6b7c72;font-size:13px}</style></head><body><div class="card">\'\n' +
        '    + \'<div class="brand">\' + esc(company) + \'</div><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
        '}\n' +
        '\n' +
        'const BAND_LABEL = { shortlist: \'Shortlist\', review: \'Worth a look\', unlikely: \'Unlikely fit\', knockout: \'Knockout\' };\n' +
        '// ---- end lib-ngt.js ----\n' +
        'const answer = $(\'Run Action\').first().json || {};\n' +
        'const c = $(\'Read Candidate Again\').all().map(i => i.json).find(r => r.candidate_id === $(\'Check Key\').first().json.candidate_id) || {};\n' +
        'return [{ json: {\n' +
        '  code: answer.ok ? 200 : 409,\n' +
        '  body: { ok: !!answer.ok, message: answer.message || \'Something went wrong.\', candidate: { status: c.status, slots: parseJson(c.slots_json, []), interview_at: c.interview_at } }\n' +
        '} }];\n'
  } },
  output: [{ code: 200, body: { ok: true, message: 'Invite sent.', candidate: {} } }]
});

const sendResult = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Result', position: [1740, 560], parameters: { respondWith: 'json', responseBody: expr('{{ $json.body }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

const refuse = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Refuse', position: [1080, 760], parameters: { respondWith: 'json', responseBody: '{ "ok": false, "message": "Not allowed." }', options: { responseCode: 403 } } }
});

// CV download
const cvHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'CV Request', position: [200, 980], parameters: { httpMethod: 'GET', path: 'northgate/cv', responseMode: 'responseNode', options: {} } },
  output: [{ query: { key: 'k', c: 'C1021-ABCD' } }]
});

const cvSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings (CV)', position: [420, 980], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'dashboard_key', value: 'k' }]
});

const readFile = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read CV File',
    position: [640, 980],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: FILES, limit: 1, filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr("{{ $('CV Request').first().json.query.c }}") }] } }
  },
  output: [{ candidate_id: 'C1021-ABCD', filename: 'cv.pdf', mime: 'application/pdf', base64: 'JVBERi0=' }]
});

const makePdf = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Make PDF', position: [860, 980], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Returns the stored CV as a PDF, for people with the dashboard key.\n' +
        '// ---- lib-ngt.js (included by build.py): shared helpers for the Northgate workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const pounds = n => \'£\' + Math.round(Number(n) || 0).toLocaleString(\'en-GB\');\n' +
        'const whenText = iso => DateTime.fromISO(String(iso), { zone: TZ }).toFormat("cccc d LLLL \'at\' h:mm a").replace(\':00 \', \' \');\n' +
        'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
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
        '// Plain, left-aligned email body with the agency\'s name at the top.\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#0b6e4f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '\n' +
        '// A small standalone web page for candidates (booking links, confirmations, problems).\n' +
        'function pageHtml(company, title, bodyHtml) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \' · \' + esc(company) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef3f0;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#10231a}\'\n' +
        '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #dbe5df;border-radius:16px;padding:32px 30px;box-shadow:0 6px 24px rgba(16,35,26,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0b6e4f;margin-bottom:18px}\'\n' +
        '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4f45;margin:0 0 12px}\'\n' +
        '    + \'.slot{display:block;padding:12px 16px;border:1px solid #dbe5df;border-radius:12px;margin:8px 0;color:#0b6e4f;font-weight:600;text-decoration:none}.slot:hover{border-color:#0b6e4f;background:#f3faf6}\'\n' +
        '    + \'.big{font-size:19px;font-weight:700;color:#10231a;margin:6px 0 14px}.muted{color:#6b7c72;font-size:13px}</style></head><body><div class="card">\'\n' +
        '    + \'<div class="brand">\' + esc(company) + \'</div><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
        '}\n' +
        '\n' +
        'const BAND_LABEL = { shortlist: \'Shortlist\', review: \'Worth a look\', unlikely: \'Unlikely fit\', knockout: \'Knockout\' };\n' +
        '// ---- end lib-ngt.js ----\n' +
        'const q = $(\'CV Request\').first().json.query || {};\n' +
        'const s = settingsOf($(\'Read Settings (CV)\').all());\n' +
        'const f = $(\'Read CV File\').all().map(i => i.json).find(r => r.candidate_id === q.c && r.base64);\n' +
        'if (!s.dashboard_key || q.key !== s.dashboard_key || !f) return [{ json: { found: false } }];\n' +
        'const data = await this.helpers.prepareBinaryData(Buffer.from(f.base64, \'base64\'), f.filename || \'cv.pdf\', f.mime || \'application/pdf\');\n' +
        'return [{ json: { found: true, filename: f.filename }, binary: { data } }];\n'
  } },
  output: [{ found: true, filename: 'cv.pdf' }]
});

const found = ifElse({
  version: 2.2,
  config: {
    name: 'Found?',
    position: [1080, 980],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.found }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const sendPdf = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send PDF', position: [1300, 900], parameters: { respondWith: 'binary', responseDataSource: 'automatically', options: { responseHeaders: { entries: [{ name: 'Content-Disposition', value: expr('inline; filename="{{ $json.filename }}"') }, { name: 'Cache-Control', value: 'no-store' }] } } } }
});

const notFound = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Not Found', position: [1300, 1080], parameters: { respondWith: 'text', responseBody: 'Not found', options: { responseCode: 404 } } }
});

const note = sticky(
  '## Northgate 4: Recruiter Dashboard\nThree endpoints behind the dashboard key in **Northgate Settings**:\n- `GET /webhook/northgate/dashboard?key=…` serves the page: jobs, candidates ranked by band and score, the evidence for every criterion, flags and history. **Blind review** hides names until someone is invited.\n- `POST /webhook/northgate/action` runs **Invite**, **Hold** or **Reject** through **Northgate 5** and returns the new state.\n- `GET /webhook/northgate/cv?key=…&c=…` returns the stored CV.',
  [], { position: [160, 20], width: 1300, height: 220, color: 5 }
);

export default workflow('northgate-recruiter-dashboard', 'Northgate 4: Recruiter Dashboard')
  .add(pageHook)
  .to(pageSettings)
  .to(pageJobs)
  .to(pageCands)
  .to(pageEvents)
  .to(buildPage)
  .to(sendPage)
  .add(actionHook)
  .to(actionSettings)
  .to(checkKey)
  .to(keyOk
    .onTrue(runAction.to(readAgain).to(actionResponse).to(sendResult))
    .onFalse(refuse))
  .add(cvHook)
  .to(cvSettings)
  .to(readFile)
  .to(makePdf)
  .to(found
    .onTrue(sendPdf)
    .onFalse(notFound))
  .add(note);
