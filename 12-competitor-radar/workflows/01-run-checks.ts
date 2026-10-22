import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const CHECK_WF = { __rl: true, mode: 'id', value: 'csrCheckPage0002', cachedResultName: 'Radar 2: Check Page' };
const SAVE_WF = { __rl: true, mode: 'id', value: 'csrSaveChange005', cachedResultName: 'Radar 5: Save Changes' };

const schedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: { name: 'Every 6 Hours', position: [200, 160], parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 6, triggerAtMinute: 5 }] } } },
  output: [{}]
});

const runHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Run Request', position: [200, 320], parameters: { httpMethod: 'POST', path: 'radar/run', responseMode: 'lastNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { key: 'k', as_of: '' } }]
});

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 480], parameters: { inputSource: 'passthrough' } },
  output: [{}]
});

const manual = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Now', position: [200, 640] },
  output: [{}]
});

const load = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Watchlist',
    position: [440, 400],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/1TyTgZFE87WFKQzOTdusFeov6m27SAixpu-Xiz7DHD7g/values:batchGet?ranges=Settings&ranges=Watchlist&ranges=%27Our%20Products%27&ranges=Matches&valueRenderOption=UNFORMATTED_VALUE', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const planRun = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Run', position: [660, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Starts a run: one item per active page on the watchlist. A run started from the dashboard or a script\n' +
        '// needs the key; in test mode it can also pass `as_of` to stamp the run with another date (the demo\n' +
        '// replays four weeks in a few minutes).\n' +
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
        'const T = tablesOf($(\'Load Watchlist\').first().json);\n' +
        'const s = settingsOf(T.Settings);\n' +
        'let trigger = \'schedule\', asOf = \'\';\n' +
        'if ($(\'Run Request\').isExecuted) {\n' +
        '  const b = $(\'Run Request\').first().json.body || {};\n' +
        '  if (!s.dashboard_key || String(b.key || \'\') !== String(s.dashboard_key)) throw new Error(\'Wrong key\');\n' +
        '  trigger = \'webhook\';\n' +
        '  if (b.as_of && s.mode !== \'live\') asOf = isoOf(toDt(b.as_of));\n' +
        '} else if ($(\'When Called\').isExecuted) trigger = \'dashboard\';\n' +
        'else if ($(\'Run Now\').isExecuted) trigger = \'manual\';\n' +
        'const runId = newId(\'RUN-\', 6);\n' +
        'const pages = (T.Watchlist || []).filter(p => p.page_id && p.url && (p.active === \'\' || truthy(p.active)));\n' +
        'return pages.map(p => ({ json: { run_id: runId, trigger, started_ms: Date.now(), as_of: asOf, ignore_lines: s.ignore_lines || \'\', page: p } }));\n'
  } },
  output: [{ run_id: 'RUN-ABC123', page: { page_id: 'TS-BIKES' } }]
});

const checkEach = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Check Each Page', position: [880, 400], parameters: { source: 'database', workflowId: CHECK_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const collect = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Collect Results', position: [1100, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Gathers what every page check found and writes the brief for the analyst: each change with the price\n' +
        '// gap to our matching bike (worked out here, not by the AI), plus new products that still need matching.\n' +
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
        'const T = tablesOf($(\'Load Watchlist\').first().json);\n' +
        'const s = settingsOf(T.Settings);\n' +
        'const results = $(\'Check Each Page\').all().map(i => i.json);\n' +
        'const ours = T[\'Our Products\'] || [];\n' +
        'const bySku = Object.fromEntries(ours.map(p => [p.sku, p]));\n' +
        'const matchOf = (competitor, product) => (T.Matches || []).find(m => m.competitor === competitor && normName(m.competitor_product, competitor) === normName(product, competitor) && m.our_sku);\n' +
        'const raw = [];\n' +
        'for (const r of results) for (const c of r.changes || []) raw.push(Object.assign({ ref: \'c\' + (raw.length + 1) }, c));\n' +
        'const gapText = (competitor, product, price) => {\n' +
        '  const m = matchOf(competitor, product);\n' +
        '  if (!m || !bySku[m.our_sku] || !price) return \'\';\n' +
        '  const our = Number(bySku[m.our_sku].price), diff = Number(price) - our;\n' +
        '  return \' | competes with our \' + bySku[m.our_sku].name + \' (\' + m.our_sku + \') at \' + gbp(our) + \': theirs is now \' + (diff === 0 ? \'the same price\' : gbp(Math.abs(diff)) + \' (\' + Math.abs(Math.round(diff / our * 1000) / 10) + \'%) \' + (diff < 0 ? \'cheaper\' : \'dearer\'));\n' +
        '};\n' +
        'const fmt = v => v === \'\' || v === undefined ? \'\' : (/^\\d+(\\.\\d+)?$/.test(String(v)) ? gbp(v) : String(v));\n' +
        'const lines = raw.map(c => {\n' +
        '  if (c.kind === \'content\') return c.ref + \' | \' + c.competitor + \' | \' + c.item + \' | content | added: \' + JSON.stringify(c.after.split(\'\\n\')) + \' | removed: \' + JSON.stringify(c.before.split(\'\\n\').filter(Boolean));\n' +
        '  const price = c.kind === \'removed_product\' ? \'\' : c.after;\n' +
        '  return c.ref + \' | \' + c.competitor + \' | \' + c.item + \' | \' + c.kind + \' | \' + fmt(c.before) + (c.before !== \'\' && c.after !== \'\' ? \' → \' : \'\') + fmt(c.after) + (c.delta_pct ? \' (\' + (c.delta_pct > 0 ? \'+\' : \'\') + c.delta_pct + \'%)\' : \'\') + (c.detail ? \' | \' + c.detail : \'\') + (/price|new_product|stock/.test(c.kind) ? gapText(c.competitor, c.item, price) : \'\');\n' +
        '});\n' +
        '// Competitor products nobody has matched to one of ours yet\n' +
        'const unmatched = [];\n' +
        'for (const r of results) for (const p of r.items || []) if (!(T.Matches || []).some(m => m.competitor === r.competitor && normName(m.competitor_product, r.competitor) === normName(p.name, r.competitor))) unmatched.push(r.competitor + \' | \' + p.name + \' | \' + gbp(p.price));\n' +
        'const prompt = \'We are \' + (s.company || \'Cobble & Spoke\') + \', \' + (s.company_about || \'an online e-bike shop\') + \'.\\nOur bikes (sku | name | type | price | battery | range):\\n\'\n' +
        '  + ours.map(p => [p.sku, p.name, p.category, gbp(p.price), p.battery_wh + \' Wh\', p.range_km + \' km\'].join(\' | \')).join(\'\\n\')\n' +
        '  + \'\\n\\nChanges found on competitor sites (ref | competitor | item | kind | before → after | notes | gap to our bike):\\n\' + (lines.join(\'\\n\') || \'(none)\')\n' +
        '  + \'\\n\\nProducts to match:\\n\' + (unmatched.join(\'\\n\') || \'(none)\');\n' +
        'return [{ json: { raw, prompt, needs_ai: raw.length > 0 || unmatched.length > 0, unmatched: unmatched.length } }];\n'
  } },
  output: [{ raw: [], prompt: '', needs_ai: true }]
});

const needsAi = ifElse({
  version: 2.2,
  config: {
    name: 'Anything to Analyse?',
    position: [1320, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.needs_ai }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const analyse = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Analyse Changes (GPT-5.4)',
    position: [1560, 240],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
        'You are a competitor analyst for a small online e-bike shop. Each morning the owner reads your notes in two minutes, so be specific and brief.\n' +
        '\n' +
        'For every change in the list, return one entry with the same `ref`:\n' +
        '- kind: keep the kind given for price, product, stock, layout and page-down changes. For a "content" change (lines added to or removed from a home, careers or news page), choose: promotion (sale, discount, free delivery, offer), hiring (new or removed job ads), news (announcements such as a new shop, partnership or product launch post), messaging (new slogans, positioning, claims), or other.\n' +
        '- headline: under 90 characters, with the competitor, the product and the numbers. Example: "Torque Street cut the Commuter One to £1,649, £150 under our Metro 500".\n' +
        '- why_it_matters: one or two sentences for the owner, using the price gaps you are given and where the shop is based. Say plainly when something is not a threat.\n' +
        '- suggested_action: one concrete next step, or "No action needed".\n' +
        '- significance from 1 to 5:\n' +
        '  5 = hurts sales now or is a big move into our market (a rival now clearly cheaper than one of our best sellers, a new shop or showroom in our city, a direct competitor to one of our bikes launched below our price)\n' +
        '  4 = notable (a price cut on a bike that competes with ours, a big sale of 20% or more, hiring that signals expansion)\n' +
        '  3 = worth knowing (a new bike that doesn\'t compete directly, a rival\'s bike selling out, messaging changes, a page we can\'t read any more)\n' +
        '  2 = minor (a small price move under 3%, small wording changes)\n' +
        '  1 = noise\n' +
        '  For price changes, use the gap to our price, not just the size of the change.\n' +
        '\n' +
        'matches: for every competitor product listed under "Products to match", give the client\'s product (sku) it competes with most directly, or "" if none, with confidence high, medium or low. Match on type and use (commuter, folding, cargo, mountain, gravel, trekking, step-through, lightweight city), then battery and price.\n' +
        '\n' +
        'Only use the facts given. Don\'t guess at reasons you can\'t see.\n'
        ,
        maxTokens: 8000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'analysis', strict: true, schema:
        '{"type": "object", "additionalProperties": false, "required": ["changes", "matches"], "properties": {"changes": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["ref", "kind", "headline", "why_it_matters", "suggested_action", "significance"], "properties": {"ref": {"type": "string"}, "kind": {"type": "string", "enum": ["price_drop", "price_rise", "new_product", "removed_product", "out_of_stock", "back_in_stock", "promotion", "hiring", "news", "messaging", "layout_warning", "fetch_failed", "other"]}, "headline": {"type": "string"}, "why_it_matters": {"type": "string"}, "suggested_action": {"type": "string"}, "significance": {"type": "integer"}}}}, "matches": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["competitor", "competitor_product", "our_sku", "confidence"], "properties": {"competitor": {"type": "string"}, "competitor_product": {"type": "string"}, "our_sku": {"type": "string"}, "confidence": {"type": "string", "enum": ["high", "medium", "low"]}}}}}}\n'
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [] }]
});

const planWrites = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Writes', position: [1860, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Turns the run into rows for the sheet: changes (AI notes plus rules worked out in code), new product\n' +
          '// matches, price history, the page states, the run log, and one alert email for anything important.\n' +
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
          'const T = tablesOf($(\'Load Watchlist\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'const first = $(\'Plan Run\').first().json;\n' +
          'const results = $(\'Check Each Page\').all().map(i => i.json);\n' +
          'const col = $(\'Collect Results\').first().json;\n' +
          'const ai = $(\'Analyse Changes (GPT-5.4)\').isExecuted ? aiJson($(\'Analyse Changes (GPT-5.4)\').first().json) : null;\n' +
          'const plan = emptyPlan(s);\n' +
          'const at = first.as_of || nowIso();\n' +
          'const threshold = Number(s.alert_threshold) || 4, undercut = Number(s.undercut_pct) || 3, bigDrop = Number(s.big_drop_pct) || 15;\n' +
          'const ours = Object.fromEntries((T[\'Our Products\'] || []).map(p => [p.sku, p]));\n' +
          'const matches = (T.Matches || []).slice();\n' +
          'for (const m of (ai && ai.matches) || []) {\n' +
          '  if (!m.our_sku || !ours[m.our_sku] || m.confidence === \'low\') continue;\n' +
          '  if (matches.some(x => x.competitor === m.competitor && normName(x.competitor_product, m.competitor) === normName(m.competitor_product, m.competitor))) continue;\n' +
          '  const row = { competitor: m.competitor, competitor_product: m.competitor_product, our_sku: m.our_sku, confidence: m.confidence, matched_by: \'ai\', matched_at: at };\n' +
          '  matches.push(row); plan.appends.Matches.push(row);\n' +
          '}\n' +
          'const matchOf = (competitor, product) => matches.find(m => m.competitor === competitor && normName(m.competitor_product, competitor) === normName(product, competitor) && m.our_sku);\n' +
          'const notes = Object.fromEntries(((ai && ai.changes) || []).map(c => [c.ref, c]));\n' +
          'const alerts = [];\n' +
          'for (const c of col.raw) {\n'
        ) +
        (
          '  const n = notes[c.ref] || {};\n' +
          '  const m = /price|new_product|stock|removed/.test(c.kind) ? matchOf(c.competitor, c.item) : null;\n' +
          '  const our = m && ours[m.our_sku] ? Number(ours[m.our_sku].price) : null;\n' +
          '  let kind = c.kind === \'content\' ? (n.kind || \'other\') : c.kind;\n' +
          '  let sig = Math.min(5, Math.max(1, Math.round(Number(n.significance) || 2)));\n' +
          '  const price = Number(c.after) || 0;\n' +
          '  // Rules that don\'t depend on the AI\'s judgement\n' +
          '  if (our && price && /price_drop|new_product/.test(kind) && price <= our * (1 - undercut / 100)) sig = Math.max(sig, 4);\n' +
          '  if (kind === \'price_drop\' && Math.abs(Number(c.delta_pct) || 0) >= bigDrop) sig = Math.max(sig, 4);\n' +
          '  if (kind === \'layout_warning\' || kind === \'fetch_failed\') sig = 3;\n' +
          '  const fallback = c.competitor + \': \' + (KIND_LABEL[kind] || kind).toLowerCase() + \' on \' + c.item;\n' +
          '  const row = {\n' +
          '    change_id: newId(\'CH-\', 8), detected_at: at, run_id: first.run_id, competitor: c.competitor, page_id: c.page_id, page_type: c.page_type, kind, item: c.item,\n' +
          '    before: c.before, after: c.after, delta_pct: c.delta_pct || \'\', our_sku: m ? m.our_sku : \'\', our_price: our || \'\', significance: sig,\n' +
          '    headline: n.headline || fallback, why_it_matters: n.why_it_matters || c.detail || \'\', suggested_action: n.suggested_action || \'\', alerted: sig >= threshold ? \'yes\' : \'no\', status: \'new\'\n' +
          '  };\n' +
          '  plan.appends.Changes.push(row);\n' +
          '  if (sig >= threshold) alerts.push(row);\n' +
          '}\n' +
          'for (const r of results) {\n' +
          '  if (r.page_type === \'products\' && (r.status === \'baseline\' || r.status === \'changed\')) for (const p of r.items || []) {\n' +
          '    const m = matchOf(r.competitor, p.name);\n' +
          '    plan.appends.Prices.push({ checked_at: at, competitor: r.competitor, product: p.name, price: p.price, was_price: p.was_price || \'\', in_stock: p.in_stock ? \'yes\' : \'no\', page_id: r.page_id, our_sku: m ? m.our_sku : \'\' });\n' +
          '  }\n' +
          '  if (r.state) plan.updates.Watchlist.push(r.state);\n' +
          '}\n' +
          'const count = st => results.filter(r => r.status === st).length;\n' +
          'const aiCalls = results.filter(r => r.ai_used).length + (ai ? 1 : 0);\n' +
          'plan.appends.Runs.push({ run_id: first.run_id, started_at: first.as_of || isoOf(DateTime.fromMillis(first.started_ms).setZone(TZ)), finished_at: first.as_of ? isoOf(toDt(first.as_of).plus({ milliseconds: Date.now() - first.started_ms })) : nowIso(), trigger: first.trigger,\n' +
          '  pages: results.length, unchanged: count(\'unchanged\'), changed: count(\'changed\') + count(\'baseline\'), failed: count(\'failed\') + count(\'warning\'), changes: col.raw.length, alerts: alerts.length, ai_calls: aiCalls, ms: Date.now() - first.started_ms });\n' +
          'if (alerts.length) {\n' +
          '  alerts.sort((a, b) => b.significance - a.significance);\n' +
          '  const card = a => \'<div style="border-left:4px solid \' + (a.significance >= 5 ? \'#d1382a\' : \'#e4572e\') + \';padding:4px 0 4px 14px;margin:0 0 18px;text-align:left">\'\n' +
          '    + \'<div style="font-weight:700;font-size:16px">\' + esc(a.headline) + \'</div>\'\n' +
          '    + (a.why_it_matters ? \'<div style="color:#475467;margin-top:4px">\' + esc(a.why_it_matters) + \'</div>\' : \'\')\n' +
          '    + (a.suggested_action ? \'<div style="margin-top:6px"><b>Next step:</b> \' + esc(a.suggested_action) + \'</div>\' : \'\') + \'</div>\';\n' +
          '  plan.emails.push(emailItem(s.alert_email, \'Competitor alert: \' + alerts[0].headline + (alerts.length > 1 ? \' (+\' + (alerts.length - 1) + \' more)\' : \'\'),\n' +
          '    emailHtml(s, [\'The radar checked \' + results.length + \' competitor pages and found \' + alerts.length + \' change\' + (alerts.length > 1 ? \'s\' : \'\') + \' worth your attention:\'], alerts.map(card).join(\'\') + button(dashboardUrl(s), \'Open the radar\')), \'alert\', [dashboardUrl(s)]));\n' +
          '}\n' +
          'plan.result = { ok: true, run_id: first.run_id, as_of: at, pages: results.length, unchanged: count(\'unchanged\'), changed: count(\'changed\'), baseline: count(\'baseline\'), failed: count(\'failed\'), warnings: count(\'warning\'), changes: col.raw.length, alerts: alerts.length, new_matches: plan.appends.Matches.length, ai_calls: aiCalls, seconds: Math.round((Date.now() - first.started_ms) / 100) / 10,\n' +
          '  headlines: plan.appends.Changes.map(c => c.significance + \' \' + c.headline) };\n' +
          'return [{ json: { plan } }];\n'
        )
  } },
  output: [{ plan: {} }]
});

const save = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save and Alert', position: [2080, 400], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Radar 1: Run Checks\nEvery 6 hours (or from the dashboard\'s **Check now**, a script, or by hand). Each active page on the **Watchlist** tab goes through **Radar 2: Check Page**. Everything that changed goes to **GPT-5.4** in one call, with the price gap to our matching bike already worked out in code. It writes a headline, why it matters and a next step, rates it 1 to 5, and matches new competitor bikes to ours. Rules in code make sure an undercut or a big price cut is never rated low. Changes, prices, matches and page states go to the sheet; anything rated 4 or 5 is emailed straight away.',
  [], { position: [160, -60], width: 1320, height: 190, color: 7 }
);

export default workflow('radar-run-checks', 'Radar 1: Run Checks')
  .add(schedule)
  .to(load)
  .add(runHook)
  .to(load)
  .add(whenCalled)
  .to(load)
  .add(manual)
  .to(load)
  .add(load)
  .to(planRun)
  .to(checkEach)
  .to(collect)
  .to(needsAi
    .onTrue(analyse.to(planWrites))
    .onFalse(planWrites))
  .add(planWrites)
  .to(save)
  .add(note);
