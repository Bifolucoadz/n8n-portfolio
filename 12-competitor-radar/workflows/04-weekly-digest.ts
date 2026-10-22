import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'csrSaveChange005', cachedResultName: 'Radar 5: Save Changes' };

const monday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: { name: 'Mondays 8:00', position: [200, 240], parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 8, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const manual = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Now', position: [200, 420] },
  output: [{}]
});

const loadAll = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load All',
    position: [440, 320],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/1TyTgZFE87WFKQzOTdusFeov6m27SAixpu-Xiz7DHD7g/values:batchGet?ranges=Settings&ranges=Watchlist&ranges=%27Our%20Products%27&ranges=Matches&ranges=Prices&ranges=Changes&valueRenderOption=UNFORMATTED_VALUE', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const build = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Digest', position: [660, 320], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Monday\'s digest: what changed this week by importance, where we stand on price against the cheapest\n' +
        '// matching rival bike, and any pages the radar couldn\'t read.\n' +
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
        'const T = tablesOf($(\'Load All\').first().json);\n' +
        'const s = settingsOf(T.Settings);\n' +
        'const now = nowDt();\n' +
        'const week = (T.Changes || []).filter(c => now.diff(toDt(c.detected_at), \'days\').days <= 7.5).map(c => Object.assign({}, c, { significance: Number(c.significance) || 1 }));\n' +
        'const alerts = week.filter(c => c.significance >= (Number(s.alert_threshold) || 4));\n' +
        'const top = week.filter(c => c.significance >= 3).sort((a, b) => b.significance - a.significance).slice(0, 8);\n' +
        'const latest = currentPrices(T.Prices);\n' +
        'const rows = (T[\'Our Products\'] || []).map(o => {\n' +
        '  const rivals = (T.Matches || []).filter(m => m.our_sku === o.sku).map(m => latest[m.competitor + \'|\' + m.competitor_product]).filter(Boolean).filter(p => p.in_stock !== \'no\');\n' +
        '  const cheapest = rivals.sort((a, b) => Number(a.price) - Number(b.price))[0];\n' +
        '  return { o, cheapest, gap: cheapest ? Number(cheapest.price) - Number(o.price) : null };\n' +
        '});\n' +
        'const under = rows.filter(r => r.gap !== null && r.gap < 0);\n' +
        'const issues = (T.Watchlist || []).filter(w => /fail|warn/.test(String(w.last_status)));\n' +
        'const colour = n => n >= 5 ? \'#d1382a\' : (n >= 4 ? \'#e4572e\' : \'#b7791f\');\n' +
        'const td = \'padding:7px 10px;border-bottom:1px solid #eceef3;text-align:left;font-size:14px\';\n' +
        'const h = t => \'<p style="margin:24px 0 8px;font-weight:700;font-size:16px;text-align:left">\' + t + \'</p>\';\n' +
        'let html = h(\'The week in \' + top.length + \' changes\') + (top.length ? top.map(c => \'<div style="border-left:4px solid \' + colour(c.significance) + \';padding:2px 0 2px 12px;margin:0 0 14px;text-align:left"><div style="font-weight:700">\' + esc(c.headline) + \'</div><div style="color:#475467;font-size:14px">\' + esc(c.why_it_matters) + \'</div>\' + (c.suggested_action && !/^no action/i.test(c.suggested_action) ? \'<div style="font-size:14px;margin-top:3px"><b>Next step:</b> \' + esc(c.suggested_action) + \'</div>\' : \'\') + \'</div>\').join(\'\') : \'<p style="color:#7a8496;text-align:left">A quiet week: nothing important changed.</p>\');\n' +
        'html += h(\'Where we stand on price\') + \'<table style="border-collapse:collapse;width:100%"><tr><th style="\' + td + \';color:#7a8496;font-size:12px">Our bike</th><th style="\' + td + \';color:#7a8496;font-size:12px">Ours</th><th style="\' + td + \';color:#7a8496;font-size:12px">Cheapest rival in stock</th><th style="\' + td + \';color:#7a8496;font-size:12px">Gap</th></tr>\'\n' +
        '  + rows.map(r => \'<tr><td style="\' + td + \'">\' + esc(r.o.name) + \'</td><td style="\' + td + \'">\' + gbp(r.o.price) + \'</td><td style="\' + td + \'">\' + (r.cheapest ? esc(r.cheapest.competitor + \' \' + r.cheapest.product) + \' \' + gbp(r.cheapest.price) : \'–\') + \'</td><td style="\' + td + \';font-weight:700;color:\' + (r.gap === null ? \'#7a8496\' : (r.gap < 0 ? \'#d1382a\' : \'#2f7d4f\')) + \'">\' + (r.gap === null ? \'\' : (r.gap < 0 ? \'−\' : \'+\') + gbp(Math.abs(r.gap))) + \'</td></tr>\').join(\'\') + \'</table>\';\n' +
        'if (issues.length) html += h(\'Pages to look at\') + \'<ul style="padding-left:20px;margin:0;text-align:left">\' + issues.map(w => \'<li>\' + esc(w.competitor) + \' \' + esc(w.page_type) + \': \' + esc(w.last_status) + \'</li>\').join(\'\') + \'</ul>\';\n' +
        'html += button(dashboardUrl(s), \'Open the radar\');\n' +
        'const intro = \'This week the radar found <b>\' + week.length + \' changes</b> across \' + new Set(week.map(c => c.competitor)).size + \' competitors\' + (alerts.length ? \', \' + alerts.length + \' of them important enough to alert you at the time\' : \'\') + \'. A rival is cheaper than us on <b>\' + under.length + \' of our \' + rows.length + \' bikes</b>.\';\n' +
        'const plan = emptyPlan(s);\n' +
        'plan.emails.push(emailItem(s.alert_email, \'Competitor digest, week of \' + now.startOf(\'week\').toFormat(\'d LLLL\') + \': \' + week.length + \' changes, \' + alerts.length + \' alerts\', emailHtml(s, [\'Good morning,\', intro], html), \'digest\', [dashboardUrl(s)]));\n' +
        'plan.result = { ok: true, changes: week.length, alerts: alerts.length, undercut: under.length };\n' +
        'return [{ json: { plan } }];\n'
  } },
  output: [{ plan: {} }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Digest', position: [880, 320], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Radar 4: Weekly Digest\nMonday 8:00 (Europe/London). One email for the team: the week\'s changes in order of importance with what to do about them, our price against the cheapest in-stock rival for every bike, and any pages the radar couldn\'t read.',
  [], { position: [160, 40], width: 880, height: 150, color: 7 }
);

export default workflow('radar-weekly-digest', 'Radar 4: Weekly Digest')
  .add(monday)
  .to(loadAll)
  .to(build)
  .to(send)
  .add(manual)
  .to(loadAll)
  .add(note);
