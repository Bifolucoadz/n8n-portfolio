import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Reset the Demo', position: [200, 300] },
  output: [{}]
});

const seed = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Demo Data', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Puts the radar\'s sheet back to the demo start: settings, our eight bikes, nine competitor pages to watch\n' +
          '// (the invented sites in Radar 0) and the known product matches. Prices, changes and runs start empty,\n' +
          '// so the first check takes a snapshot of every page.\n' +
          '// ---- lib-cs.js (included by build.py): shared helpers for the Competitor Radar workflows ----\n' +
          'const TZ = \'Europe/London\';\n' +
          'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
          'const parseJson = (s, d) => { try { return typeof s === \'string\' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
          'const nowDt = () => DateTime.now().setZone(TZ);\n' +
          'const toDt = iso => DateTime.fromISO(String(iso), { zone: TZ });\n' +
          'const isoOf = dt => dt.set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });\n' +
          'const nowIso = () => isoOf(nowDt());\n' +
          'const newId = (p, n) => p + Array.from({ length: n || 8 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
          'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
          'const gbp = n => n === null || n === undefined || n === \'\' ? \'\' : \'£\' + Number(n).toLocaleString(\'en-GB\', { minimumFractionDigits: 0, maximumFractionDigits: 2 });\n' +
          'const day = iso => iso ? toDt(iso).toFormat(\'d LLL yyyy\') : \'\';\n' +
          'const truthy = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());\n' +
          'const COLUMNS = {"Settings": ["key", "value", "note"], "Watchlist": ["page_id", "competitor", "page_type", "url", "active", "last_checked", "last_status", "last_hash", "last_method", "fail_count", "last_items_json", "last_text", "note"], "Our Products": ["sku", "name", "category", "price", "battery_wh", "range_km", "motor", "url"], "Matches": ["competitor", "competitor_product", "our_sku", "confidence", "matched_by", "matched_at"], "Prices": ["checked_at", "competitor", "product", "price", "was_price", "in_stock", "page_id", "our_sku"], "Changes": ["change_id", "detected_at", "run_id", "competitor", "page_id", "page_type", "kind", "item", "before", "after", "delta_pct", "our_sku", "our_price", "significance", "headline", "why_it_matters", "suggested_action", "alerted", "status"], "Runs": ["run_id", "started_at", "finished_at", "trigger", "pages", "unchanged", "changed", "failed", "changes", "alerts", "ai_calls", "ms"], "Outbox": ["at", "to", "subject", "kind", "links", "html"]};\n' +
          '// Product names compared without case, punctuation or the competitor\'s own name\n' +
          'const normName = (name, competitor) => String(name || \'\').toLowerCase().replace(String(competitor || \'\').toLowerCase(), \'\').replace(/[^a-z0-9]+/g, \' \').trim();\n' +
          '\n' +
          'function tablesOf(res) {\n' +
          '  const out = {};\n' +
          '  for (const vr of (res && res.valueRanges) || []) {\n' +
          '    const name = String(vr.range || \'\').split(\'!\')[0].replace(/^\'|\'$/g, \'\').replace(/\'\'/g, "\'");\n' +
          '    const rows = vr.values || [];\n' +
          '    const head = (rows[0] || []).map(h => String(h).trim());\n' +
          '    out[name] = rows.slice(1).map((r, i) => {\n' +
          '      const o = { _row: i + 2 };\n' +
          '      head.forEach((h, j) => { if (h) o[h] = r[j] === undefined || r[j] === null ? \'\' : r[j]; });\n' +
          '      return o;\n' +
          '    }).filter(o => Object.keys(o).some(k => k !== \'_row\' && o[k] !== \'\'));\n' +
          '  }\n' +
          '  return out;\n' +
          '}\n' +
          'const settingsOf = rows => Object.fromEntries((rows || []).filter(r => r.key).map(r => [String(r.key).trim(), r.value === undefined ? \'\' : r.value]));\n' +
          'function sheetRow(o) {\n' +
          '  const r = {};\n' +
          '  for (const [k, v] of Object.entries(o)) if (k !== \'_row\') r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
          '  return r;\n' +
          '}\n' +
          '// OpenAI result (Responses API or the OpenAI node\'s simplified output) → the JSON object, or null\n' +
          'function aiJson(res) {\n' +
          '  if (!res || res.error) return null;\n' +
          '  const msg = (res.output || []).find(o => o && Array.isArray(o.content));\n' +
          '  const part = msg && (msg.content || []).find(c => c && (c.type === \'output_text\' || c.text !== undefined));\n' +
          '  let t = part ? part.text : null;\n' +
          '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
          '  return t && typeof t === \'object\' ? t : null;\n' +
          '}\n' +
          '\n' +
          'const baseUrl = s => String(s.base_url || \'http://localhost:5678\').replace(/\\/$/, \'\');\n' +
          'const dashboardUrl = s => baseUrl(s) + \'/webhook/radar/dashboard?key=\' + encodeURIComponent(s.dashboard_key || \'\');\n' +
          'function button(url, label) {\n' +
          '  return \'<p style="margin:22px 0;text-align:left"><a href="\' + esc(url) + \'" style="display:inline-block;background:#e4572e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">\' + esc(label) + \'</a></p>\';\n' +
          '}\n' +
          'function emailHtml(s, paragraphs, extraHtml) {\n' +
          '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
          '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c2430;max-width:620px;text-align:left">\'\n' +
          '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#e4572e;margin:0 0 18px">\' + esc(s.company || \'Cobble & Spoke\') + \' · Competitor Radar</div>\'\n' +
          '    + p + (extraHtml || \'\') + \'</div>\';\n' +
          '}\n' +
          'function pageHtml(title, bodyHtml) {\n' +
          '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>\' + esc(title) + \'</title>\'\n' +
          '    + \'<style>body{margin:0;background:#f3f4f6;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1c2430}.card{max-width:520px;margin:48px auto;background:#fff;border-radius:16px;padding:30px;box-shadow:0 8px 28px rgba(0,0,0,.06)}h1{font-size:22px;margin:0 0 10px}</style></head><body><div class="card"><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
          '}\n' +
          'function emptyPlan(s) { return { mode: s.mode === \'live\' ? \'live\' : \'test\', appends: { Changes: [], Prices: [], Runs: [], Matches: [], Watchlist: [] }, updates: { Watchlist: [], Changes: [] }, emails: [], result: { ok: true } }; }\n' +
          'const emailItem = (to, subject, html, kind, links) => ({ to, subject, html, kind, links: (links || []).join(\' \') });\n' +
          '\n' +
          '// Latest price of every product a rival still sells: rows from each page\'s most recent snapshot only\n' +
          '// (a bike dropped from the page disappears instead of keeping its old price)\n' +
          'function currentPrices(rows) {\n' +
          '  const lastCheck = {};\n' +
          '  for (const p of rows || []) if (!lastCheck[p.page_id] || String(p.checked_at) > lastCheck[p.page_id]) lastCheck[p.page_id] = String(p.checked_at);\n' +
          '  const out = {};\n' +
          '  for (const p of rows || []) if (String(p.checked_at) === lastCheck[p.page_id]) out[p.competitor + \'|\' + p.product] = p;\n' +
          '  return out;\n' +
          '}\n' +
          '\n' +
          'const KIND_LABEL = { price_drop: \'Price cut\', price_rise: \'Price rise\', new_product: \'New product\', removed_product: \'Product gone\', out_of_stock: \'Out of stock\', back_in_stock: \'Back in stock\', promotion: \'Promotion\', hiring: \'Hiring\', news: \'News\', messaging: \'Messaging\', layout_warning: \'Check page\', fetch_failed: \'Page down\', other: \'Change\' };\n' +
          '// ---- end lib-cs.js ----\n' +
          'const base = \'http://localhost:5678/webhook/demo-web/page?site=\';\n' +
          'const SETTINGS_ROWS = [\n' +
          '  [\'mode\', \'test\', \'test: emails go to the Outbox tab. live: Gmail.\'],\n' +
          '  [\'company\', \'Cobble & Spoke\', \'\'],\n' +
          '  [\'company_about\', \'an online e-bike shop in Edinburgh, Scotland, selling across the UK\', \'Tells the AI who "we" are.\'],\n' +
          '  [\'alert_email\', \'team@cobblespoke.example\', \'Gets alerts and the Monday digest.\'],\n' +
          '  [\'alert_threshold\', 4, \'Changes rated this or higher are emailed straight away (1-5).\'],\n' +
          '  [\'undercut_pct\', 3, \'A rival this % or more below our matched bike is always rated 4+.\'],\n' +
          '  [\'big_drop_pct\', 15, \'A price cut this big is always rated 4+.\'],\n' +
          '  [\'ignore_lines\', \'DEMO SITE:|cookie|©\', \'Lines containing these (| separated) are ignored when comparing pages.\'],\n' +
          '  [\'base_url\', \'http://localhost:5678\', \'Public address of n8n (dashboard link in emails).\'],\n' +
          '  [\'dashboard_key\', \'5EEHpAZzPOuMzkSjMopGhm9D\', \'Key in the dashboard link.\']\n' +
          '];\n' +
          'const PAGES = [\n' +
          '  [\'TS-BIKES\', \'Torque Street\', \'products\', \'torque-street&page=bikes\'],\n' +
          '  [\'TS-HOME\', \'Torque Street\', \'home\', \'torque-street&page=home\'],\n' +
          '  [\'TS-JOBS\', \'Torque Street\', \'careers\', \'torque-street&page=careers\'],\n' +
          '  [\'GV-SHOP\', \'Glenvolt\', \'products\', \'glenvolt&page=shop\'],\n' +
          '  [\'GV-NEWS\', \'Glenvolt\', \'news\', \'glenvolt&page=news\'],\n' +
          '  [\'PP-PRICES\', \'Pedalpoint Electric\', \'products\', \'pedalpoint&page=prices\'],\n'
        ) +
        (
          '  [\'PP-JOBS\', \'Pedalpoint Electric\', \'careers\', \'pedalpoint&page=careers\'],\n' +
          '  [\'HT-RANGE\', \'Hilltrack E-Bikes\', \'products\', \'hilltrack&page=range\'],\n' +
          '  [\'HT-HOME\', \'Hilltrack E-Bikes\', \'home\', \'hilltrack&page=home\']\n' +
          '];\n' +
          'const OURS = [\n' +
          '  [\'CS-METRO\', \'Metro 500\', \'commuter\', 1799, 500, 110, \'250 W hub\'],\n' +
          '  [\'CS-FOLD\', \'Fold 300\', \'folding\', 1349, 300, 60, \'250 W hub\'],\n' +
          '  [\'CS-STEP\', \'City Step 400\', \'step-through city\', 1499, 400, 80, \'250 W hub\'],\n' +
          '  [\'CS-URBAN\', \'Urban Lite\', \'lightweight city\', 1199, 250, 50, \'250 W rear hub\'],\n' +
          '  [\'CS-GRAVEL\', \'Gravel 500\', \'gravel\', 2499, 500, 100, \'250 W mid-drive\'],\n' +
          '  [\'CS-TOUR\', \'Tour 750\', \'trekking\', 2699, 750, 150, \'250 W mid-drive\'],\n' +
          '  [\'CS-TRAIL\', \'Trail 625\', \'mountain hardtail\', 2899, 625, 90, \'85 Nm mid-drive\'],\n' +
          '  [\'CS-CARGO\', \'Cargo Long\', \'longtail cargo\', 4299, 750, 100, \'85 Nm mid-drive\']\n' +
          '];\n' +
          'const MATCHES = [\n' +
          '  [\'Torque Street\', \'Commuter One\', \'CS-METRO\', \'high\'], [\'Torque Street\', \'Fold Mini\', \'CS-FOLD\', \'high\'], [\'Torque Street\', \'Ridge 625\', \'CS-TRAIL\', \'high\'], [\'Torque Street\', \'Cargo Duo\', \'CS-CARGO\', \'high\'],\n' +
          '  [\'Glenvolt\', \'Clyde City\', \'CS-METRO\', \'high\'], [\'Glenvolt\', \'Highland Trail\', \'CS-TRAIL\', \'medium\'], [\'Glenvolt\', \'Step-Through\', \'CS-STEP\', \'high\'], [\'Glenvolt\', \'Glenvolt Fold\', \'CS-FOLD\', \'high\'],\n' +
          '  [\'Pedalpoint Electric\', \'Pedalpoint Metro\', \'CS-METRO\', \'high\'], [\'Pedalpoint Electric\', \'Trekker 750\', \'CS-TOUR\', \'high\'], [\'Pedalpoint Electric\', \'Pedalpoint Cargo\', \'CS-CARGO\', \'high\'], [\'Pedalpoint Electric\', \'Urban Single\', \'CS-URBAN\', \'high\'],\n' +
          '  [\'Hilltrack E-Bikes\', \'Pennine 625\', \'CS-TRAIL\', \'medium\'], [\'Hilltrack E-Bikes\', \'Dales Gravel\', \'CS-GRAVEL\', \'high\'], [\'Hilltrack E-Bikes\', \'Moor Hardtail\', \'CS-TRAIL\', \'high\']\n' +
          '];\n' +
          'const at = nowIso();\n' +
          'const tabs = {\n' +
          '  \'Settings\': [COLUMNS.Settings].concat(SETTINGS_ROWS),\n' +
          '  \'Watchlist\': [COLUMNS.Watchlist].concat(PAGES.map(p => COLUMNS.Watchlist.map(c => ({ page_id: p[0], competitor: p[1], page_type: p[2], url: base + p[3], active: \'yes\', last_status: \'new\', fail_count: 0, note: \'Demo site (Radar 0)\' })[c] ?? \'\'))),\n' +
          '  \'Our Products\': [COLUMNS[\'Our Products\']].concat(OURS.map(o => [o[0], o[1], o[2], o[3], o[4], o[5], o[6], \'https://example.com/cobble-spoke/\' + o[0].toLowerCase()])),\n' +
          '  \'Matches\': [COLUMNS.Matches].concat(MATCHES.map(m => m.concat([\'manual\', at]))),\n' +
          '  \'Prices\': [COLUMNS.Prices], \'Changes\': [COLUMNS.Changes], \'Runs\': [COLUMNS.Runs], \'Outbox\': [COLUMNS.Outbox]\n' +
          '};\n' +
          'const q = n => "\'" + n.replace(/\'/g, "\'\'") + "\'";\n' +
          'return [{ json: {\n' +
          '  clear: { ranges: Object.keys(tabs).map(q) },\n' +
          '  write: { valueInputOption: \'RAW\', data: Object.entries(tabs).map(([n, v]) => ({ range: q(n) + \'!A1\', values: v })) },\n' +
          '  summary: Object.fromEntries(Object.entries(tabs).map(([n, v]) => [n, v.length - 1]))\n' +
          '} }];\n'
        )
  } },
  output: [{ clear: { ranges: [] }, write: { valueInputOption: 'RAW', data: [] }, summary: {} }]
});

const clear = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Clear All Tabs',
    position: [640, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/1TyTgZFE87WFKQzOTdusFeov6m27SAixpu-Xiz7DHD7g/values:batchClear',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify($('Build Demo Data').first().json.clear) }}"),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ clearedRanges: [] }]
});

const write = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Write All Tabs',
    position: [860, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/1TyTgZFE87WFKQzOTdusFeov6m27SAixpu-Xiz7DHD7g/values:batchUpdate',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify($('Build Demo Data').first().json.write) }}"),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ totalUpdatedRows: 60 }]
});

const demoWeek = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Demo Sites to Week 1',
    position: [1080, 300],
    parameters: { method: 'GET', url: 'http://localhost:5678/webhook/demo-web/admin?key=aft4Xk1dxydLOo6S&week=1', options: {} }
  },
  output: [{ ok: true, week: 1 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [1300, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "return [{ json: { rows: $('Build Demo Data').first().json.summary, cellsWritten: $('Write All Tabs').first().json.totalUpdatedCells, demoWeek: $input.first().json.week } }];" } },
  output: [{ rows: {} }]
});

const note = sticky(
  '## Radar 6: Reset Demo\nPuts the sheet back to the start of the demo: settings, our eight bikes, nine competitor pages on the watchlist and the known product matches; prices, changes, runs and the Outbox are emptied. Then the demo competitor sites (Radar 0) go back to week 1. Next, run the four demo weeks (README) or press **Check now**.',
  [], { position: [160, 80], width: 1160, height: 150, color: 7 }
);

export default workflow('radar-reset-demo', 'Radar 6: Reset Demo')
  .add(start)
  .to(seed)
  .to(clear)
  .to(write)
  .to(demoWeek)
  .to(summary)
  .add(note);
