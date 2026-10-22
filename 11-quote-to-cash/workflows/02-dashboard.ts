import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'mgvSaveChange007', cachedResultName: 'Mossgrove 7: Save Changes' };
const LOAD_URL = 'https://sheets.googleapis.com/v4/spreadsheets/1754F1Rep-Rg9J3x6Dnga0fjTeSR4zfaLOS_zD7Zp1J4/values:batchGet?ranges=Settings&ranges=%27Price%20Book%27&ranges=Quotes&ranges=Events&ranges=Payments&ranges=Schedule&valueRenderOption=UNFORMATTED_VALUE';
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };
const IS_OK = { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' };

// Page
const pageHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Dashboard Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'mossgrove/dashboard', responseMode: 'responseNode', options: {} } },
  output: [{ query: { key: 'k', q: 'Q-1005' } }]
});

const loadAll = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load All',
    position: [420, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const buildPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Page', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// The owner\'s dashboard, with all the data in the page. Needs the key from Settings.\n' +
          '// ---- lib-mgv.js (included by build.py): shared helpers for the Mossgrove workflows ----\n' +
          'const TZ = \'Europe/London\';\n' +
          'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
          'const parseJson = (s, d) => { try { return typeof s === \'string\' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
          'const nowDt = () => DateTime.now().setZone(TZ);\n' +
          'const nowIso = () => nowDt().set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });\n' +
          'const toDt = iso => DateTime.fromISO(String(iso), { zone: TZ });\n' +
          'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
          'const round2 = n => Math.round((Number(n) || 0) * 100) / 100;\n' +
          'const money = n => \'£\' + round2(n).toLocaleString(\'en-GB\', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n' +
          'const day = iso => iso ? toDt(iso).toFormat(\'d LLL yyyy\') : \'\';\n' +
          'const dayLong = iso => iso ? toDt(iso).toFormat(\'cccc d LLLL\') : \'\';\n' +
          'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
          'const qtyText = n => (Math.round(Number(n) * 10) / 10).toLocaleString(\'en-GB\');\n' +
          'const unitText = (u, n) => u === \'each\' ? \'\' : (u === \'metre\' ? (Number(n) === 1 ? \'metre\' : \'metres\') : u);\n' +
          'const COLUMNS = {"Settings": ["key", "value", "note"], "Price Book": ["code", "category", "item", "unit", "unit_price", "labour_days", "min_qty", "notes", "active"], "Quotes": ["quote_id", "token", "status", "client_name", "client_email", "client_phone", "site_address", "postcode", "job_title", "summary", "visit_notes", "transcript", "lines_json", "extras_json", "custom_json", "assumptions_json", "questions_json", "flags_json", "subtotal", "vat", "total", "deposit", "labour_days", "version", "estimator", "created_at", "build_ms", "sent_at", "valid_until", "viewed_at", "view_count", "accepted_at", "signed_name", "sign_meta_json", "chosen_extras_json", "accepted_subtotal", "accepted_vat", "accepted_total", "deposit_due", "deposit_paid_at", "job_start", "job_end", "crew", "completed_at", "invoice_id", "balance_due", "balance_paid_at", "review_sent_at", "declined_at", "decline_reason", "reminders_sent", "last_reminder_at", "messages_json", "updated_at"], "Events": ["at", "quote_id", "event", "detail", "actor"], "Payments": ["payment_id", "quote_id", "kind", "amount", "status", "provider", "provider_ref", "created_at", "paid_at"], "Schedule": ["entry_id", "quote_id", "title", "start", "end", "crew", "kind", "notes"], "Outbox": ["at", "to", "subject", "kind", "quote_id", "links", "html"]};\n' +
          '\n' +
          '// Sheets API values:batchGet response → { \'Tab name\': [ { column: value, _row } ] } (blank rows dropped)\n' +
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
          'const truthy = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());\n' +
          'function bookOf(rows) {\n' +
          '  const b = {};\n' +
          '  for (const r of rows || []) if (r.code && (r.active === \'\' || truthy(r.active))) b[String(r.code).trim().toUpperCase()] = r;\n' +
          '  return b;\n' +
          '}\n' +
          '\n' +
          '// A quote row with its JSON columns parsed\n' +
          'function quoteOf(row) {\n' +
          '  if (!row) return null;\n' +
          '  const q = Object.assign({}, row);\n' +
          '  for (const k of [\'lines\', \'extras\', \'custom\', \'assumptions\', \'questions\', \'flags\', \'chosen_extras\', \'messages\', \'sign_meta\']) q[k] = parseJson(row[k + \'_json\'], k === \'sign_meta\' ? {} : []);\n' +
          '  for (const k of [\'subtotal\', \'vat\', \'total\', \'deposit\', \'labour_days\', \'view_count\', \'accepted_subtotal\', \'accepted_vat\', \'accepted_total\', \'deposit_due\', \'balance_due\', \'reminders_sent\', \'version\']) q[k] = Number(row[k]) || 0;\n' +
          '  return q;\n' +
          '}\n' +
          '\n' +
          '// ---- Pricing: the AI picks items and quantities; prices always come from the price book ----\n' +
          'function priceEntry(e, book) {\n' +
          '  const b = book[String(e.code || \'\').trim().toUpperCase()];\n' +
          '  if (!b) return null;\n' +
          '  let qty = Math.max(Number(e.quantity) || 0, 0);\n' +
          '  const min = Number(b.min_qty) || 0;\n' +
          '  const minApplied = qty > 0 && min > 0 && qty < min;\n' +
          '  if (minApplied) qty = min;\n' +
          '  qty = Math.round(qty * 10) / 10;\n' +
          '  const unitPrice = Number(b.unit_price) || 0;\n' +
          '  return {\n' +
          '    code: String(b.code).toUpperCase(), item: b.item, category: b.category, unit: b.unit, quantity: qty,\n' +
          '    unit_price: unitPrice, amount: round2(qty * unitPrice), labour_days: round2(qty * (Number(b.labour_days) || 0)),\n' +
          '    label: String(e.label || \'\'), evidence: String(e.evidence || \'\'), why: String(e.why || \'\'), min_applied: minApplied\n' +
          '  };\n' +
          '}\n' +
          '\n' +
          'function priceQuote(draft, book, s) {\n' +
          '  const flags = [];\n' +
          '  const lines = [], extras = [], custom = [];\n' +
          '  for (const e of draft.lines || []) {\n' +
          '    const p = priceEntry(e, book);\n' +
          '    if (!p) { custom.push({ description: String(e.label || e.code), quantity: Number(e.quantity) || 1, unit: \'each\', unit_price: null, why: \'Code \' + e.code + \' is not in the price book\' }); flags.push({ level: \'warn\', text: \'Code \' + e.code + \' is not in the price book, so it was moved to custom items.\' }); continue; }\n' +
          '    if (!p.quantity) { flags.push({ level: \'warn\', text: p.item + \' had no quantity and was left out.\' }); continue; }\n' +
          '    if (p.min_applied) flags.push({ level: \'info\', text: p.item + \': minimum of \' + qtyText(p.quantity) + \' \' + unitText(p.unit, p.quantity) + \' applied.\' });\n' +
          '    lines.push(p);\n' +
          '  }\n' +
          '  for (const e of draft.extras || []) { const p = priceEntry(e, book); if (p && p.quantity) extras.push(p); }\n' +
          '  for (const c of draft.custom_items || draft.custom || []) {\n' +
          '    const price = c.unit_price === null || c.unit_price === undefined || c.unit_price === \'\' ? null : Number(c.unit_price);\n' +
          '    const qty = Number(c.quantity) || 1;\n' +
          '    custom.push({ description: String(c.description || \'\'), quantity: qty, unit: String(c.unit || \'each\'), unit_price: price, amount: price === null ? null : round2(qty * price), labour_days: Number(c.labour_days) || 0, why: String(c.why || \'\') });\n' +
          '  }\n' +
          '  const unpriced = custom.filter(c => c.unit_price === null || isNaN(c.unit_price));\n' +
          '  if (unpriced.length) flags.push({ level: \'warn\', text: unpriced.length + (unpriced.length === 1 ? \' item isn\\\'t\' : \' items aren\\\'t\') + \' in the price book. Add a price before sending.\' });\n' +
          '  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0) + custom.reduce((a, c) => a + (c.amount || 0), 0));\n' +
          '  const vatRate = Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate);\n' +
          '  const vat = round2(subtotal * vatRate);\n' +
          '  const total = round2(subtotal + vat);\n' +
          '  const deposit = round2(total * (Number(s.deposit_pct) || 25) / 100);\n' +
          '  const labour = round2(lines.reduce((a, l) => a + l.labour_days, 0) + custom.reduce((a, c) => a + (c.labour_days || 0), 0));\n' +
          '  if (total >= (Number(s.big_job) || 15000)) flags.push({ level: \'info\', text: \'Large job (\' + money(total) + \'). Double-check the measurements before sending.\' });\n' +
          '  if (!lines.length && !custom.length) flags.push({ level: \'warn\', text: \'No priced lines yet. Add items before sending.\' });\n' +
          '  return { lines, extras, custom, subtotal, vat, total, deposit, labour_days: labour, flags };\n' +
          '}\n' +
          '\n' +
          '// Totals once the client has picked optional extras\n' +
          'function acceptedTotals(q, chosenCodes, s) {\n' +
          '  const chosen = (q.extras || []).filter(x => chosenCodes.includes(x.code));\n' +
          '  const subtotal = round2(Number(q.subtotal) + chosen.reduce((a, x) => a + x.amount, 0));\n'
        ) +
        (
          '  const vat = round2(subtotal * Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate));\n' +
          '  const total = round2(subtotal + vat);\n' +
          '  return { chosen, subtotal, vat, total, deposit: round2(total * (Number(s.deposit_pct) || 25) / 100), labour_days: round2(Number(q.labour_days) + chosen.reduce((a, x) => a + x.labour_days, 0)) };\n' +
          '}\n' +
          'const jobDays = labour => Math.max(1, Math.ceil(Number(labour) - 0.25));\n' +
          '\n' +
          '// ---- Links ----\n' +
          'const baseUrl = s => String(s.base_url || \'http://localhost:5678\').replace(/\\/$/, \'\');\n' +
          'const quoteUrl = (s, token) => baseUrl(s) + \'/webhook/mossgrove/quote?t=\' + token;\n' +
          'const pdfUrl = (s, token, doc) => baseUrl(s) + \'/webhook/mossgrove/pdf?t=\' + token + \'&doc=\' + (doc || \'quote\');\n' +
          'const payUrl = (s, token, kind) => baseUrl(s) + \'/webhook/mossgrove/pay?t=\' + token + \'&kind=\' + kind;\n' +
          'const dashboardUrl = s => baseUrl(s) + \'/webhook/mossgrove/dashboard?key=\' + encodeURIComponent(s.dashboard_key || \'\');\n' +
          '\n' +
          '// ---- Emails and plain pages ----\n' +
          'function button(url, label) {\n' +
          '  return \'<p style="margin:22px 0;text-align:left"><a href="\' + esc(url) + \'" style="display:inline-block;background:#1f4d3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">\' + esc(label) + \'</a></p>\';\n' +
          '}\n' +
          'function emailHtml(s, paragraphs, extraHtml) {\n' +
          '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
          '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1d2a24;max-width:560px;text-align:left">\'\n' +
          '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin:0 0 18px">\' + esc(s.company || \'Mossgrove Landscapes\') + \'</div>\'\n' +
          '    + p + (extraHtml || \'\')\n' +
          '    + \'<p style="margin:26px 0 0;color:#6b7a72;font-size:12px;text-align:left">\' + esc(s.company_legal || s.company || \'\') + \' · \' + esc(s.company_phone || \'\') + \'</p></div>\';\n' +
          '}\n' +
          'function pageHtml(s, title, bodyHtml) {\n' +
          '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>\' + esc(title) + \' · \' + esc(s.company || \'Mossgrove Landscapes\') + \'</title>\'\n' +
          '    + \'<style>body{margin:0;background:#f4f1ea;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2a24}\'\n' +
          '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #e3ddd0;border-radius:18px;padding:32px 30px;box-shadow:0 8px 28px rgba(31,77,58,.07)}\'\n' +
          '    + \'.brand{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin-bottom:20px}\'\n' +
          '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4b44;margin:0 0 12px}a.btn{display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;margin-top:8px}\'\n' +
          '    + \'.muted{color:#6b7a72;font-size:14px}</style></head><body><div class="card">\'\n' +
          '    + \'<div class="brand"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M2 32C2 14 14 2 32 2c0 18-12 30-30 30z" fill="#7bb661"/><path d="M5 29L27 7" stroke="#1f4d3a" stroke-width="2"/></svg>\' + esc(s.company || \'Mossgrove Landscapes\') + \'</div>\'\n' +
          '    + \'<h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
          '}\n' +
          '\n' +
          '// ---- Plans: decide everything in code, then Mossgrove 7: Save Changes writes it ----\n' +
          'function emptyPlan(s) { return { mode: s.mode === \'live\' ? \'live\' : \'test\', quote_inserts: [], quote_updates: [], events: [], payments: [], schedule: [], emails: [], result: { ok: true } }; }\n' +
          'const eventRow = (quote_id, event, detail, actor) => ({ at: nowIso(), quote_id, event, detail: String(detail || \'\'), actor: actor || \'system\' });\n' +
          'const emailItem = (to, subject, html, kind, quote_id, links, attach, token) => ({ to, subject, html, kind, quote_id, links: (links || []).join(\' \'), attach: attach || \'\', token: token || \'\' });\n' +
          '// Arrays and objects go to the sheet as JSON text\n' +
          'function sheetRow(o) {\n' +
          '  const r = {};\n' +
          '  for (const [k, v] of Object.entries(o)) if (k !== \'_row\') r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
          '  return r;\n' +
          '}\n' +
          '\n' +
          '// Working days (Mon–Fri) from a date, inclusive of the start\n' +
          'function addWorkdays(start, n) {\n' +
          '  let d = start, left = n - 1;\n' +
          '  while (left > 0) { d = d.plus({ days: 1 }); if (d.weekday <= 5) left--; }\n' +
          '  return d;\n' +
          '}\n' +
          '// Earliest start (after the lead time) where one crew has the whole job free\n' +
          'function nextSlot(schedule, s, days) {\n' +
          '  const crews = String(s.crews || \'Crew A\').split(\',\').map(c => c.trim()).filter(Boolean);\n' +
          '  const busy = (schedule || []).filter(e => e.start && e.end).map(e => ({ crew: String(e.crew), start: String(e.start).slice(0, 10), end: String(e.end).slice(0, 10) }));\n' +
          '  let d = nowDt().startOf(\'day\').plus({ days: Number(s.lead_days) || 7 });\n' +
          '  for (let i = 0; i < 180; i++, d = d.plus({ days: 1 })) {\n' +
          '    if (d.weekday > 5) continue;\n' +
          '    const end = addWorkdays(d, days);\n' +
          '    const a = d.toISODate(), b = end.toISODate();\n' +
          '    for (const crew of crews) {\n' +
          '      if (!busy.some(x => x.crew === crew && !(x.end < a || x.start > b))) return { crew, start: a, end: b };\n' +
          '    }\n' +
          '  }\n' +
          '  return null;\n' +
          '}\n' +
          '\n' +
          '// A payment arrived (card, test checkout or bank transfer the owner recorded)\n' +
          'function planPayment(plan, q, kind, provider, ref, T, s, actor) {\n' +
          '  const amount = kind === \'deposit\' ? q.deposit_due : q.balance_due;\n' +
          '  const at = nowIso();\n' +
          '  plan.payments.push({ payment_id: \'PAY-\' + newToken(8).toUpperCase(), quote_id: q.quote_id, kind, amount, status: \'paid\', provider, provider_ref: ref || \'\', created_at: at, paid_at: at });\n' +
          '  const links = [quoteUrl(s, q.token)];\n' +
          '  if (kind === \'deposit\') {\n' +
          '    const slot = nextSlot(T.Schedule, s, jobDays(q.labour_days));\n' +
          '    const upd = { quote_id: q.quote_id, status: \'scheduled\', deposit_paid_at: at, updated_at: at };\n' +
          '    let when = \'We\\\'ll be in touch shortly with your start date.\';\n' +
          '    if (slot) {\n' +
          '      Object.assign(upd, { job_start: slot.start, job_end: slot.end, crew: slot.crew });\n' +
          '      plan.schedule.push({ entry_id: \'JOB-\' + q.quote_id, quote_id: q.quote_id, title: q.client_name.split(\' \').slice(-1)[0] + \': \' + q.job_title, start: slot.start, end: slot.end, crew: slot.crew, kind: \'job\', notes: q.site_address });\n' +
          '      const n = jobDays(q.labour_days);\n' +
          '      when = \'We\\\'ve booked you in to start on <b>\' + esc(dayLong(slot.start)) + \'</b>, for about \' + n + \' working day\' + (n === 1 ? \'\' : \'s\') + \'. We\\\'ll confirm the arrival time the week before.\';\n' +
          '    }\n' +
          '    plan.quote_updates.push(upd);\n' +
          '    plan.events.push(eventRow(q.quote_id, \'deposit_paid\', money(amount) + \' via \' + provider + (slot ? \'; booked \' + slot.crew + \' from \' + slot.start + \' to \' + slot.end : \'; no free slot found\'), actor));\n' +
          '    plan.emails.push(emailItem(q.client_email, \'You\\\'re booked in: \' + q.job_title, emailHtml(s, [\n' +
          '      \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '      \'Thank you, we\\\'ve received your deposit of <b>\' + money(amount) + \'</b>.\',\n' +
          '      when\n' +
          '    ], button(quoteUrl(s, q.token), \'View your booking\')), \'deposit_receipt\', q.quote_id, links, \'quote\', q.token));\n' +
          '    plan.emails.push(emailItem(s.owner_email, \'Deposit paid: \' + q.quote_id + \' \' + q.client_name + \' (\' + money(amount) + \')\', emailHtml(s, [\n' +
          '      esc(q.client_name) + \' paid the \' + money(amount) + \' deposit for <b>\' + esc(q.job_title) + \'</b>.\',\n' +
          '      slot ? \'Booked for \' + esc(slot.crew) + \', \' + esc(day(slot.start)) + \' to \' + esc(day(slot.end)) + \'.\' : \'<b>No free slot was found in the next six months.</b> Please book it by hand.\'\n' +
          '    ], button(dashboardUrl(s), \'Open the dashboard\')), \'owner_deposit\', q.quote_id, links));\n' +
          '    return slot;\n' +
          '  }\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, status: \'paid\', balance_paid_at: at, updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, \'balance_paid\', money(amount) + \' via \' + provider, actor));\n' +
          '  plan.emails.push(emailItem(q.client_email, \'Payment received, thank you (\' + q.invoice_id + \')\', emailHtml(s, [\n'
        ) +
        (
          '    \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '    \'Thank you for your payment of <b>\' + money(amount) + \'</b>. Your invoice \' + esc(q.invoice_id) + \' is now paid in full; the receipt is attached.\',\n' +
          '    \'Enjoy the garden!\'\n' +
          '  ], button(pdfUrl(s, q.token, \'receipt\'), \'Download your receipt\')), \'balance_receipt\', q.quote_id, [pdfUrl(s, q.token, \'receipt\')], \'receipt\', q.token));\n' +
          '  plan.emails.push(emailItem(s.owner_email, \'Paid in full: \' + q.quote_id + \' \' + q.client_name + \' (\' + money(amount) + \')\', emailHtml(s, [\n' +
          '    esc(q.client_name) + \' paid the final \' + money(amount) + \' for <b>\' + esc(q.job_title) + \'</b>. The job is closed; a review request goes out in two days.\'\n' +
          '  ]), \'owner_paid\', q.quote_id, links));\n' +
          '  return null;\n' +
          '}\n' +
          '\n' +
          '// OpenAI Responses API result → the JSON object the model returned, or null\n' +
          'function aiJson(res) {\n' +
          '  if (!res || res.error) return null;\n' +
          '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
          '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
          '  let t = part ? part.text : null;\n' +
          '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
          '  return t && typeof t === \'object\' ? t : null;\n' +
          '}\n' +
          '\n' +
          '// Full page for the estimator\'s form results (the n8n form shows it instead of its own page)\n' +
          'function formPage(title, bodyHtml) {\n' +
          '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
          '    + \'<style>body{margin:0;background:#f4f1ea;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2a24}\'\n' +
          '    + \'.wrap{max-width:640px;margin:36px auto;padding:0 16px}.card{background:#fff;border:1px solid #e3ddd0;border-radius:18px;padding:28px 26px;box-shadow:0 8px 28px rgba(31,77,58,.07)}\'\n' +
          '    + \'.brand{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin-bottom:16px}\'\n' +
          '    + \'h1{font-size:22px;margin:0 0 6px;letter-spacing:-.3px}.sub{color:#5c6b63;margin:0 0 18px}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:8px 0;border-bottom:1px solid #eee8dc;vertical-align:top}td.r{text-align:right;white-space:nowrap;padding-left:12px}\'\n' +
          '    + \'.lbl{color:#76847c;font-size:13px}.tot td{border:0;font-weight:700;font-size:17px;padding-top:12px}.flag{background:#fff7e6;border:1px solid #f3dfb2;border-radius:10px;padding:9px 12px;margin:8px 0;font-size:14px}.flag.info{background:#eef5f0;border-color:#d3e6d8}\'\n' +
          '    + \'a.btn{display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;margin:14px 10px 0 0}a.ghost{background:#fff;color:#1f4d3a;border:1px solid #c9d8cd}ul{padding-left:20px;margin:6px 0}\'\n' +
          '    + \'</style></head><body><div class="wrap"><div class="card"><div class="brand"><svg width="20" height="20" viewBox="0 0 34 34"><path d="M2 32C2 14 14 2 32 2c0 18-12 30-30 30z" fill="#7bb661"/><path d="M5 29L27 7" stroke="#1f4d3a" stroke-width="2"/></svg>Mossgrove Landscapes</div>\'\n' +
          '    + \'<h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></div></body></html>\';\n' +
          '}\n' +
          '\n' +
          '// The client\'s terms, also printed on the PDF\n' +
          'function quoteTerms(q, s) {\n' +
          '  return [\n' +
          '    \'Prices include VAT at \' + Math.round(Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate) * 100) + \'% and are valid until \' + (day(q.valid_until) || \'the date shown\') + \'. A \' + (Number(s.deposit_pct) || 25) + \'% deposit books your start date; the balance is due within \' + (Number(s.payment_days) || 7) + \' days of completion.\',\n' +
          '    \'We remove all waste from the job. If we find something we could not see at the survey (such as buried concrete or old drains), we agree any extra cost with you before doing the work.\',\n' +
          '    \'New plants and turf are guaranteed for 3 months if watered as advised; paving and fencing workmanship for 5 years.\'\n' +
          '  ];\n' +
          '}\n' +
          'const isExpired = q => q.status === \'sent\' && q.valid_until && toDt(q.valid_until) < nowDt();\n' +
          '\n' +
          'const STATUS_LABEL = { draft: \'Draft\', sent: \'Sent\', accepted: \'Accepted\', scheduled: \'Booked\', completed: \'Invoiced\', paid: \'Paid\', declined: \'Declined\', expired: \'Expired\', cancelled: \'Cancelled\' };\n' +
          '// ---- end lib-mgv.js ----\n' +
          '// ---- lib-dash.js: everything the owner dashboard shows, from the sheet tabs ----\n' +
          'function dashData(T, s) {\n' +
          '  const book = {};\n' +
          '  for (const r of T[\'Price Book\'] || []) if (r.code && (r.active === \'\' || truthy(r.active))) book[String(r.code).toUpperCase()] = { code: String(r.code).toUpperCase(), category: r.category, item: r.item, unit: r.unit, unit_price: Number(r.unit_price) || 0, labour_days: Number(r.labour_days) || 0, min_qty: Number(r.min_qty) || 0 };\n' +
          '  const events = {};\n' +
          '  for (const e of (T.Events || []).slice().sort((a, b) => String(a.at) < String(b.at) ? -1 : 1)) (events[e.quote_id] = events[e.quote_id] || []).push({ at: e.at, event: e.event, detail: e.detail, actor: e.actor });\n' +
          '  const quotes = (T.Quotes || []).map(quoteOf).map(q => {\n' +
          '    const o = Object.assign({}, q);\n' +
          '    for (const k of Object.keys(o)) if (/_json$/.test(k) || k === \'_row\') delete o[k];\n' +
          '    if (o.sign_meta) o.sign_meta = { fingerprint: o.sign_meta.fingerprint, signed_at: o.sign_meta.signed_at };\n' +
          '    if (isExpired(q)) o.status = \'expired\';\n' +
          '    return o;\n' +
          '  });\n' +
          '  return {\n' +
          '    key: s.dashboard_key, now: nowIso(), today: nowDt().toISODate(), formUrl: \'../../form/mossgrove-site-visit\',\n' +
          '    settings: { company: s.company, mode: s.mode === \'live\' ? \'live\' : \'test\', vat_rate: Number(s.vat_rate === \'\' ? 0.2 : s.vat_rate), deposit_pct: Number(s.deposit_pct) || 25, payment_days: Number(s.payment_days) || 7, owner_name: s.owner_name, crews: String(s.crews || \'Crew A\').split(\',\').map(c => c.trim()).filter(Boolean) },\n' +
          '    book, quotes, events,\n' +
          '    schedule: (T.Schedule || []).filter(e => e.start && e.end).map(e => ({ entry_id: e.entry_id, quote_id: e.quote_id, title: e.title, start: String(e.start).slice(0, 10), end: String(e.end).slice(0, 10), crew: e.crew, kind: e.kind }))\n' +
          '  };\n' +
          '}\n' +
          '// ---- end lib-dash.js ----\n' +
          'const PAGE =\n' +
          '"<!doctype html>\\n<html lang=\\"en\\">\\n<head>\\n<meta charset=\\"utf-8\\">\\n<meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\">\\n<meta name=\\"robots\\" content=\\"noindex\\">\\n<title>Quotes and jobs · Mossgrove Landscapes</title>\\n<link href=\\"https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600;700&display=swap\\" rel=\\"stylesheet\\">\\n<style>\\n:root{--moss:#1f4d3a;--moss2:#173b2c;--leaf:#7bb661;--leafsoft:#e8f3e3;--cream:#f4f1ea;--paper:#fffdf8;--ink:#1d2a24;--body:#3d4b44;--muted:#748178;--line:#e6e0d3;--line2:#efeadf;--amber:#b7791f;--amberbg:#fff4de;--blue:#2f6690;--bluebg:#e8f1f8;--red:#a23b2a;--redbg:#fbeae6;--grey:#8a8f86;--greybg:#efede7}\\n*{box-sizing:border-box}\\nhtml,body{margin:0}\\nbody{background:var(--cream);color:var(--ink);font:14px/1.5 Inter,-apple-system,\\"Segoe UI\\",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}\\nbutton{font:inherit}\\n.top{background:var(--moss);color:#fff}\\n.top .in{max-width:1480px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:16px}\\n.brand{display:flex;align-items:center;gap:10px}\\n.brand b{font-family:Fraunces,Georgia,serif;font-size:19px;font-weight:600}\\n.brand span{color:#b9d4c1;font-size:13px;padding-left:10px;border-left:1px solid #3f6b56;margin-left:4px}\\n.top .sp{flex:1}\\n.pill{font-size:11.5px;font-weight:700;letter-spacing:.6px;padding:4px 10px;border-radius:99px;background:#f6d98b;color:#5a4206}\\n.pill.live{background:#bfe3b0;color:#1f4d3a}\\n.top a.new{background:#fff;color:var(--moss);text-decoration:none;font-weight:600;padding:9px 14px;border-radius:10px}\\n.top .who{font-size:13px;color:#cfe3d3}\\n.page{max-width:1480px;margin:0 auto;padding:22px 24px 40px}\\n.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:20px}\\n.kpi{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:14px 16px}\\n.kpi .k{font-size:12px;color:var(--muted);font-weight:600;letter-spacing:.3px}\\n.kpi .v{font-size:24px;font-weight:700;letter-spacing:-.4px;margin-top:2px}\\n.kpi .s{font-size:12.5px;color:var(--muted)}\\n.main{display:grid;grid-template-columns:minmax(0,1fr) 560px;gap:20px;align-items:start}\\n.panel{background:var(--paper);border:1px solid var(--line);border-radius:18px;box-shadow:0 8px 26px rgba(31,77,58,.05)}\\n.tabs{display:flex;gap:4px;padding:10px 10px 0;border-bottom:1px solid var(--line);overflow-x:auto}\\n.tab{border:0;background:none;padding:10px 12px;border-radius:10px 10px 0 0;color:var(--muted);font-weight:600;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;margin-bottom:-1px}\\n.tab.on{color:var(--moss);border-bottom-color:var(--moss)}\\n.tab .n{display:inline-block;min-width:20px;padding:0 6px;margin-left:5px;border-radius:99px;background:var(--line2);color:var(--body);font-size:11.5px;text-align:center}\\n.tab.on .n{background:var(--leafsoft);color:var(--moss)}\\n.list{list-style:none;margin:0;padding:6px}\\n.row{display:grid;grid-template-columns:70px minmax(0,1fr) 110px 104px;gap:14px;align-items:center;padding:12px 12px;border-radius:12px;cursor:pointer}\\n.row:hover{background:#f6f3ec}\\n.row.sel{background:#eef5ee;box-shadow:inset 3px 0 0 var(--leaf)}\\n.row .id{font-weight:600;color:var(--muted);font-size:13px}\\n.row .who{font-weight:600}\\n.row .job{color:var(--body);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\\n.row .act{font-size:12.5px;color:var(--muted);margin-top:2px}\\n.row .act b{color:var(--amber);font-weight:600}\\n.row .amt{text-align:right;font-weight:700}\\n.chip{display:inline-block;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:99px;white-space:nowrap}\\n.c-draft{background:var(--amberbg);color:#8a5a12}.c-sent{background:var(--bluebg);color:var(--blue)}.c-accepted{background:#e5f3dd;color:#2d6a1e}.c-scheduled{background:var(--leafsoft);color:var(--moss)}.c-completed{background:#f3e8fb;color:#6b3f8f}.c-paid{background:var(--moss);color:#fff}.c-declined,.c-expired,.c-cancelled{background:var(--greybg);color:var(--grey)}\\n.empty{padding:40px;text-align:center;color:var(--muted)}\\n.detail{position:sticky;top:16px;max-height:calc(100vh - 32px);overflow:auto}\\n.dh{padding:20px 22px 14px;border-bottom:1px solid var(--line)}\\n.dh .t1{display:flex;align-items:center;gap:10px;color:var(--muted);font-weight:600;font-size:13px}\\n.dh h2{font-family:Fraunces,Georgia,serif;font-size:23px;font-weight:600;margin:6px 0 2px;letter-spacing:-.2px}\\n.dh .contact{font-size:13px;color:var(--muted)}\\n.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}\\n.b{border:1.5px solid #c9d8cd;background:#fff;color:var(--moss);border-radius:10px;padding:8px 13px;font-weight:600;cursor:pointer;text-decoration:none;font-size:13.5px}\\n.b:hover{background:#f6faf6}\\n.b.p{background:var(--moss);border-color:var(--moss);color:#fff}\\n.b.p:hover{background:#25604a}\\n.b.d{color:var(--red);border-color:#e7c4bc}\\n.b[disabled]{opacity:.45;cursor:not-allowed}\\n.sec{padding:16px 22px;border-bottom:1px solid var(--line2)}\\n.sec h3{font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);margin:0 0 10px}\\n.note{border-radius:10px;padding:9px 12px;margin:0 0 8px;font-size:13px;display:flex;gap:8px}\\n.note.warn{background:var(--amberbg);color:#6e4a0f}\\n.note.info{background:#eef4f0;color:#2f5141}\\n.note.ok{background:#e9f4e3;color:#2d5a1e}\\n.ai{display:flex;gap:10px;align-items:center;font-size:12.5px;color:var(--muted);margin-bottom:10px}\\n.ai .spark{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#7bb661,#2f6690);color:#fff;display:grid;place-items:center;font-size:12px}\\ntable.lines{width:100%;border-collapse:collapse}\\ntable.lines td{padding:8px 4px;border-top:1px solid var(--line2);vertical-align:top}\\ntable.lines tr:first-child td{border-top:0}\\ntable.lines .nm{font-weight:600}\\ntable.lines .lb{font-size:12px;color:var(--muted)}\\ntable.lines .r{text-align:right;white-space:nowrap}\\ntable.lines input.q{width:62px;text-align:right}\\ntable.lines input.lbl{width:100%;margin-top:3px;font-size:12px;color:var(--muted);border-color:transparent;padding:3px 6px}\\ntable.lines input.lbl:focus{border-color:#d8d2c4}\\ninput.f,select.f,textarea.f{border:1.5px solid #d8d2c4;border-radius:8px;padding:6px 8px;font:13.5px Inter,sans-serif;color:var(--ink);background:#fff}\\ninput.f:focus,select.f:focus,textarea.f:focus{outline:0;border-color:var(--moss)}\\ntextarea.f{width:100%;min-height:64px}\\ninput.title{width:100%;font-family:Fraunces,Georgia,serif;font-size:20px;font-weight:600;border-color:transparent;padding:4px 6px;margin-left:-6px}\\ninput.title:focus{border-color:#d8d2c4}\\n.x{border:0;background:none;color:#b3a99a;cursor:pointer;font-size:16px;line-height:1;padding:2px 4px}\\n.x:hover{color:var(--red)}\\n.add{display:flex;gap:8px;margin-top:10px}\\n.add select{flex:1;min-width:0}\\n.tot{margin-top:10px;border-top:1.5px solid var(--ink);padding-top:8px}\\n.tot div{display:flex;justify-content:space-between;padding:2px 0;color:var(--body)}\\n.tot .big{font-weight:700;font-size:17px;color:var(--ink)}\\n.kv{display:grid;grid-template-columns:130px 1fr;gap:6px 12px;font-size:13px}\\n.kv span:nth-child(odd){color:var(--muted)}\\n.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}\\n.tl{list-style:none;margin:0;padding:0}\\n.tl li{display:grid;grid-template-columns:18px 1fr auto;gap:10px;padding:7px 0;font-size:13px}\\n.tl .dot{width:10px;height:10px;border-radius:50%;background:#c9d8cd;margin-top:5px}\\n.tl .dot.k-accepted,.tl .dot.k-deposit_paid,.tl .dot.k-balance_paid{background:var(--leaf)}\\n.tl .dot.k-viewed{background:#7fb2d8}.tl .dot.k-question{background:#e0a23d}.tl .dot.k-declined,.tl .dot.k-expired,.tl .dot.k-cancelled{background:#c1b8aa}\\n.tl .when{color:var(--muted);font-size:12px;white-space:nowrap}\\n.tl .ev{font-weight:600}\\n.tl .dt{color:var(--body)}\\ndetails.raw{font-size:13px;color:var(--body);margin-top:8px}\\ndetails.raw summary{cursor:pointer;color:var(--muted);font-weight:600}\\ndetails.raw p{white-space:pre-wrap;background:#f7f4ed;border-radius:8px;padding:10px;margin:6px 0 0}\\n.sched{margin-top:20px;padding:18px 20px}\\n.sched h2{font-family:Fraunces,Georgia,serif;font-size:19px;font-weight:600;margin:0 0 12px}\\n.gantt{display:grid;grid-template-columns:90px 1fr;gap:8px 12px;align-items:center}\\n.lane{position:relative;height:34px;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(100%/35 - 1px),var(--line2) calc(100%/35 - 1px),var(--line2) calc(100%/35));border-radius:8px;background-color:#faf8f2}\\n.bar{position:absolute;top:4px;bottom:4px;border-radius:7px;background:#cfe3c4;color:#24452f;font-size:11.5px;font-weight:600;padding:5px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default}\\n.bar.mine{background:var(--moss);color:#fff;cursor:pointer}\\n.bar.past{opacity:.5}\\n.weeks{position:relative;height:18px;font-size:11.5px;color:var(--muted)}\\n.weeks span{position:absolute;top:0}\\n.today{position:absolute;top:-4px;bottom:-4px;width:2px;background:#d9534f;border-radius:2px}\\n.crew{font-weight:600;font-size:13px;color:var(--body)}\\n.toast{position:fixed;right:24px;bottom:24px;background:var(--ink);color:#fff;padding:12px 16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-size:13.5px;z-index:9;max-width:420px}\\n.toast.err{background:var(--red)}\\n.busy{opacity:.6;pointer-events:none}\\n@media (max-width:1180px){.kpis{grid-template-columns:repeat(3,1fr)}.main{grid-template-columns:1fr}.detail{position:static;max-height:none}}\\n@media (max-width:640px){.kpis{grid-template-columns:repeat(2,1fr)}.row{grid-template-columns:1fr auto}.row .id,.row .st{display:none}.top .who{display:none}.page{padding:14px}}\\n</style>\\n</head>\\n<body>\\n<div class=\\"top\\"><div class=\\"in\\">\\n  <div class=\\"brand\\"><svg width=\\"26\\" height=\\"26\\" viewBox=\\"0 0 34 34\\" aria-hidden=\\"true\\"><path d=\\"M2 32C2 14 14 2 32 2c0 18-12 30-30 30z\\" fill=\\"#7bb661\\"/><path d=\\"M5 29L27 7\\" stroke=\\"#1f4d3a\\" stroke-width=\\"2\\"/></svg><b id=\\"co\\">Mossgrove Landscapes</b><span>Quotes and jobs</span></div>\\n  <div class=\\"sp\\"></div>\\n  <span class=\\"pill\\" id=\\"mode\\"></span>\\n  <span class=\\"who\\" id=\\"who\\"></span>\\n  <a class=\\"new\\" id=\\"newVisit\\" href=\\"#\\">+ New site visit</a>\\n</div></div>\\n<div class=\\"page\\">\\n  <section class=\\"kpis\\" id=\\"kpis\\"></section>\\n  <div class=\\"main\\">\\n    <section class=\\"panel\\">\\n      <nav class=\\"tabs\\" id=\\"tabs\\"></nav>\\n      <ul class=\\"list\\" id=\\"list\\"></ul>\\n    </section>\\n    <aside class=\\"panel detail\\" id=\\"detail\\"></aside>\\n  </div>\\n  <section class=\\"panel sched\\" id=\\"sched\\"></section>\\n</div>\\n<script>\\nvar D = /*__DATA__*/null;\\n(function () {\\n  if (!D) return;\\n  var $ = function (id) { return document.getElementById(id); };\\n  var gbp = function (n) { return \'£\' + (Math.round(Number(n || 0) * 100) / 100).toLocaleString(\'en-GB\', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };\\n  var gbp0 = function (n) { return \'£\' + Math.round(Number(n || 0)).toLocaleString(\'en-GB\'); };\\n  var esc = function (s) { return String(s == null ? \'\' : s).replace(/[&<>\\"]/g, function (c) { return { \'&\': \'&amp;\', \'<\': \'&lt;\', \'>\': \'&gt;\', \'\\"\': \'&quot;\' }[c]; }); };\\n  var LABEL = { draft: \'Draft\', sent: \'Sent\', accepted: \'Accepted\', scheduled: \'Booked\', completed: \'Invoiced\', paid: \'Paid\', declined: \'Declined\', expired: \'Expired\', cancelled: \'Cancelled\' };\\n  var EVENT = { drafted: \'Drafted by AI\', edited: \'Edited\', sent: \'Sent to client\', resent: \'Sent again\', viewed: \'Opened by client\', question: \'Client asked\', accepted: \'Accepted and signed\', deposit_paid: \'Deposit paid\', scheduled: \'Booked\', completed: \'Job done, invoiced\', balance_paid: \'Paid in full\', review_requested: \'Review requested\', reminder: \'Reminder sent\', deposit_reminder: \'Deposit reminder\', balance_reminder: \'Payment reminder\', declined: \'Declined\', expired: \'Expired\', cancelled: \'Cancelled\' };\\n  var NOW = new Date(D.now);\\n  var state = { tab: \'action\', sel: null, edit: null };\\n  var params = new URLSearchParams(location.search);\\n  state.sel = params.get(\'q\');\\n\\n  function days(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }\\n  function ago(iso) { if (!iso) return \'\'; var m = Math.round((NOW - new Date(iso)) / 6e4); if (m < 1) return \'just now\'; if (m < 60) return m + \' min ago\'; var h = Math.round(m / 60); if (h < 24) return h + \' h ago\'; var d = Math.round(h / 24); return d === 1 ? \'yesterday\' : d + \' days ago\'; }\\n  function dshort(iso) { return iso ? new Date(iso + (String(iso).length === 10 ? \'T12:00:00\' : \'\')).toLocaleDateString(\'en-GB\', { weekday: \'short\', day: \'numeric\', month: \'short\' }) : \'\'; }\\n  function qty(l) { var n = Math.round(Number(l.quantity) * 10) / 10; return l.unit === \'each\' ? String(n) : n + \' \' + (l.unit === \'metre\' ? \'m\' : esc(l.unit)); }\\n  function value(q) { return q.accepted_at ? q.accepted_total : q.total; }\\n  function unpriced(q) { return (q.custom || []).some(function (c) { return c.unit_price == null || c.unit_price === \'\'; }); }\\n\\n  function nextStep(q) {\\n    if (q.status === \'draft\') return unpriced(q) ? \'<b>Needs a price</b> before sending\' : \'<b>Ready to check and send</b>\';\\n    if (q.status === \'sent\') { var v = q.view_count ? \'Viewed \' + q.view_count + \'× · last \' + ago(q.viewed_at) : \'<b>Not opened yet</b>\'; return \'Sent \' + ago(q.sent_at) + \' · \' + v; }\\n    if (q.status === \'accepted\') return \'<b>Deposit due</b> \' + gbp(q.deposit_due) + \' · accepted \' + ago(q.accepted_at);\\n    if (q.status === \'scheduled\') return (q.job_start ? \'Starts \' + dshort(q.job_start) + \' · \' + esc(q.crew) : \'Deposit in, needs a date\');\\n    if (q.status === \'completed\') { var due = days(NOW, new Date(new Date(q.completed_at).getTime() + D.settings.payment_days * 864e5)); return \'<b>Balance due</b> \' + gbp(q.balance_due) + (due >= 0 ? \' in \' + due + \' days\' : \' · \' + -due + \' days late\'); }\\n    if (q.status === \'paid\') return \'Paid \' + ago(q.balance_paid_at) + (q.review_sent_at ? \' · review asked\' : \'\');\\n    if (q.status === \'declined\') return \'Declined: \' + esc(q.decline_reason || \'no reason\');\\n    if (q.status === \'expired\') return \'Expired after \' + (q.reminders_sent || 0) + \' reminders\';\\n    return LABEL[q.status] || q.status;\\n  }\\n\\n  var TABS = [\\n    [\'action\', \'Needs action\', function (q) { return q.status === \'draft\' || (q.status === \'sent\' && q.view_count > 0) || q.status === \'accepted\' || q.status === \'completed\'; }],\\n    [\'draft\', \'Drafts\', function (q) { return q.status === \'draft\'; }],\\n    [\'sent\', \'Sent\', function (q) { return q.status === \'sent\'; }],\\n    [\'won\', \'Won\', function (q) { return [\'accepted\', \'scheduled\', \'completed\', \'paid\'].indexOf(q.status) >= 0; }],\\n    [\'lost\', \'Lost\', function (q) { return [\'declined\', \'expired\', \'cancelled\'].indexOf(q.status) >= 0; }],\\n    [\'all\', \'All\', function () { return true; }]\\n  ];\\n\\n  function kpis() {\\n    var Q = D.quotes;\\n    var open = Q.filter(function (q) { return q.status === \'sent\'; });\\n    var since = function (iso, d) { return iso && (NOW - new Date(iso)) / 864e5 <= d; };\\n    var won30 = Q.filter(function (q) { return since(q.accepted_at, 30); });\\n    var decided = Q.filter(function (q) { return since(q.sent_at, 90) && [\'draft\', \'sent\'].indexOf(q.status) < 0; });\\n    var wonD = decided.filter(function (q) { return q.accepted_at; });\\n    var dep = Q.filter(function (q) { return q.status === \'accepted\'; });\\n    var owed = Q.filter(function (q) { return q.status === \'completed\'; });\\n    var next = D.schedule.filter(function (e) { return e.start >= D.today; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; })[0];\\n    var tiles = [\\n      [\'Open quotes\', gbp0(open.reduce(function (a, q) { return a + q.total; }, 0)), open.length + \' waiting for the client\'],\\n      [\'Won (30 days)\', gbp0(won30.reduce(function (a, q) { return a + q.accepted_total; }, 0)), won30.length + \' jobs accepted\'],\\n      [\'Win rate (90 days)\', decided.length ? Math.round(wonD.length / decided.length * 100) + \'%\' : \'–\', wonD.length + \' of \' + decided.length + \' decided quotes\'],\\n      [\'Deposits due\', gbp0(dep.reduce(function (a, q) { return a + q.deposit_due; }, 0)), dep.length + \' accepted, not yet booked\'],\\n      [\'Owed to you\', gbp0(owed.reduce(function (a, q) { return a + q.balance_due; }, 0)), owed.length + \' final invoice\' + (owed.length === 1 ? \'\' : \'s\')],\\n      [\'Next job\', next ? dshort(next.start) : \'–\', next ? esc(next.title) + \' · \' + esc(next.crew) : \'Nothing booked\']\\n    ];\\n    $(\'kpis\').innerHTML = tiles.map(function (t) { return \'<div class=\\"kpi\\"><div class=\\"k\\">\' + t[0] + \'</div><div class=\\"v\\">\' + t[1] + \'</div><div class=\\"s\\">\' + t[2] + \'</div></div>\'; }).join(\'\');\\n  }\\n\\n  function list() {\\n    var tab = TABS.find(function (t) { return t[0] === state.tab; });\\n    $(\'tabs\').innerHTML = TABS.map(function (t) { var n = D.quotes.filter(t[2]).length; return \'<button class=\\"tab\' + (t[0] === state.tab ? \' on\' : \'\') + \'\\" data-tab=\\"\' + t[0] + \'\\">\' + t[1] + \'<span class=\\"n\\">\' + n + \'</span></button>\'; }).join(\'\');\\n    var rows = D.quotes.filter(tab[2]).sort(function (a, b) { return (b.updated_at || b.created_at) > (a.updated_at || a.created_at) ? 1 : -1; });\\n    $(\'list\').innerHTML = rows.length ? rows.map(function (q) {\\n      return \'<li class=\\"row\' + (q.quote_id === state.sel ? \' sel\' : \'\') + \'\\" data-q=\\"\' + q.quote_id + \'\\"><span class=\\"id\\">\' + q.quote_id + \'</span><div><div class=\\"who\\">\' + esc(q.client_name) + \'</div><div class=\\"job\\">\' + esc(q.job_title) + \'</div><div class=\\"act\\">\' + nextStep(q) + \'</div></div><span class=\\"st\\"><span class=\\"chip c-\' + q.status + \'\\">\' + LABEL[q.status] + \'</span></span><span class=\\"amt\\">\' + gbp0(value(q)) + \'</span></li>\';\\n    }).join(\'\') : \'<li class=\\"empty\\">Nothing here right now.</li>\';\\n  }\\n\\n  // ---- Detail ----\\n  function priceLine(l) {\\n    var b = D.book[l.code]; if (!b) return null;\\n    var qty = Math.max(Number(l.quantity) || 0, 0); if (b.min_qty && qty > 0 && qty < b.min_qty) qty = b.min_qty; qty = Math.round(qty * 10) / 10;\\n    return Object.assign({}, l, { item: b.item, unit: b.unit, unit_price: b.unit_price, quantity: qty, amount: Math.round(qty * b.unit_price * 100) / 100 });\\n  }\\n  function editTotals(e) {\\n    var sub = e.lines.reduce(function (a, l) { var p = priceLine(l); return a + (p ? p.amount : 0); }, 0) + e.custom.reduce(function (a, c) { return a + (c.unit_price === \'\' || c.unit_price == null ? 0 : Math.round(c.quantity * c.unit_price * 100) / 100); }, 0);\\n    sub = Math.round(sub * 100) / 100; var vat = Math.round(sub * D.settings.vat_rate * 100) / 100;\\n    return { sub: sub, vat: vat, tot: Math.round((sub + vat) * 100) / 100 };\\n  }\\n  function bookOptions() {\\n    var cats = {};\\n    Object.keys(D.book).forEach(function (c) { var b = D.book[c]; (cats[b.category] = cats[b.category] || []).push(b); });\\n    return \'<option value=\\"\\">Add an item from the price book…</option>\' + Object.keys(cats).map(function (k) { return \'<optgroup label=\\"\' + esc(k) + \'\\">\' + cats[k].map(function (b) { return \'<option value=\\"\' + b.code + \'\\">\' + esc(b.item) + \' (\' + gbp(b.unit_price) + \' / \' + esc(b.unit) + \')</option>\'; }).join(\'\') + \'</optgroup>\'; }).join(\'\');\\n  }\\n\\n  function detail() {\\n    var q = D.quotes.find(function (x) { return x.quote_id === state.sel; });\\n    if (!q) { $(\'detail\').innerHTML = \'<div class=\\"empty\\">Pick a quote on the left.</div>\'; return; }\\n    var e = state.edit && state.edit.quote_id === q.quote_id ? state.edit : null;\\n    var h = \'<div class=\\"dh\\"><div class=\\"t1\\"><span>\' + q.quote_id + \'</span><span class=\\"chip c-\' + q.status + \'\\">\' + LABEL[q.status] + \'</span>\' + (q.version > 1 ? \'<span>v\' + q.version + \'</span>\' : \'\') + \'</div>\';\\n    h += e ? \'<input class=\\"f title\\" id=\\"eTitle\\" value=\\"\' + esc(e.job_title) + \'\\">\' : \'<h2>\' + esc(q.job_title) + \'</h2>\';\\n    h += \'<div class=\\"contact\\">\' + esc(q.client_name) + \' · \' + esc(q.client_email) + (q.client_phone ? \' · \' + esc(q.client_phone) : \'\') + \'<br>\' + esc(q.site_address) + (q.postcode ? \', \' + esc(q.postcode) : \'\') + \'</div>\';\\n    h += \'<div class=\\"btns\\">\' + buttons(q, e) + \'</div></div>\';\\n\\n    // AI and checks\\n    var notes = \'\';\\n    if (q.status === \'draft\' || e) {\\n      notes += \'<div class=\\"ai\\"><span class=\\"spark\\">✦</span><span>Drafted by AI in \' + Math.round((q.build_ms || 0) / 1000) + \' s\' + (q.transcript ? \' from a voice memo\' : \' from notes\') + \' · by \' + esc(q.estimator) + \' · priced from the price book</span></div>\';\\n      (e ? e.flags : q.flags || []).forEach(function (f) { notes += \'<div class=\\"note \' + f.level + \'\\">\' + (f.level === \'warn\' ? \'⚠\' : \'ℹ\') + \'<span>\' + esc(f.text) + \'</span></div>\'; });\\n      (q.questions || []).forEach(function (t) { notes += \'<div class=\\"note warn\\">?<span>\' + esc(t) + \'</span></div>\'; });\\n    }\\n    (q.messages || []).forEach(function (m) { notes += \'<div class=\\"note info\\">✉<span><b>\' + esc(q.client_name.split(\' \')[0]) + \' asked \' + ago(m.at) + \':</b> \' + esc(m.text) + \'</span></div>\'; });\\n    if (notes) h += \'<div class=\\"sec\\">\' + notes + \'</div>\';\\n\\n    // Lines\\n    h += \'<div class=\\"sec\\"><h3>\' + (e ? \'Edit the quote\' : \'The quote\') + \'</h3>\';\\n    if (e) {\\n      h += \'<textarea class=\\"f\\" id=\\"eSummary\\" placeholder=\\"Summary for the client\\">\' + esc(e.summary) + \'</textarea>\';\\n      h += \'<table class=\\"lines\\" style=\\"margin-top:10px\\">\' + e.lines.map(function (l, i) {\\n        var p = priceLine(l) || l;\\n        return \'<tr><td><div class=\\"nm\\">\' + esc(p.item) + \'</div><input class=\\"f lbl\\" data-i=\\"\' + i + \'\\" data-k=\\"label\\" value=\\"\' + esc(l.label) + \'\\"></td><td class=\\"r\\"><input class=\\"f q\\" data-i=\\"\' + i + \'\\" data-k=\\"quantity\\" value=\\"\' + l.quantity + \'\\"> <span class=\\"lb\\">\' + esc(p.unit) + \'</span></td><td class=\\"r\\">\' + gbp(p.amount) + \'</td><td><button class=\\"x\\" data-del=\\"\' + i + \'\\" title=\\"Remove\\">×</button></td></tr>\';\\n      }).join(\'\') + e.custom.map(function (c, i) {\\n        return \'<tr><td><div class=\\"nm\\">\' + esc(c.description) + \'</div><div class=\\"lb\\">Custom item, not in the price book</div></td><td class=\\"r\\">\' + c.quantity + \' \' + esc(c.unit) + \'</td><td class=\\"r\\">£<input class=\\"f q\\" style=\\"width:80px\\" data-c=\\"\' + i + \'\\" value=\\"\' + (c.unit_price == null ? \'\' : c.unit_price) + \'\\" placeholder=\\"price\\"></td><td><button class=\\"x\\" data-cdel=\\"\' + i + \'\\">×</button></td></tr>\';\\n      }).join(\'\') + \'</table>\';\\n      h += \'<div class=\\"add\\"><select class=\\"f\\" id=\\"eAdd\\">\' + bookOptions() + \'</select><input class=\\"f\\" id=\\"eAddQty\\" placeholder=\\"qty\\" style=\\"width:70px\\"><button class=\\"b\\" id=\\"eAddGo\\">Add</button></div>\';\\n      if (e.extras.length) h += \'<p class=\\"lb\\" style=\\"margin:12px 0 4px;color:var(--muted)\\">Optional extras offered: \' + e.extras.map(function (x, i) { var p = priceLine(x) || x; return esc(p.item) + \' (\' + gbp(p.amount) + \') <button class=\\"x\\" data-xdel=\\"\' + i + \'\\">×</button>\'; }).join(\' · \') + \'</p>\';\\n      var t = editTotals(e);\\n      h += \'<div class=\\"tot\\"><div><span>Subtotal</span><span>\' + gbp(t.sub) + \'</span></div><div><span>VAT</span><span>\' + gbp(t.vat) + \'</span></div><div class=\\"big\\"><span>Total</span><span>\' + gbp(t.tot) + \'</span></div></div>\';\\n    } else {\\n      if (q.summary) h += \'<p style=\\"margin:0 0 10px;color:var(--body)\\">\' + esc(q.summary) + \'</p>\';\\n      var chosen = q.chosen_extras || [];\\n      h += \'<table class=\\"lines\\">\' + q.lines.map(function (l) { return \'<tr><td><div class=\\"nm\\">\' + esc(l.item) + \'</div><div class=\\"lb\\">\' + esc(l.label) + \'</div></td><td class=\\"r lb\\">\' + qty(l) + \'</td><td class=\\"r\\">\' + gbp(l.amount) + \'</td></tr>\'; }).join(\'\')\\n        + (q.custom || []).map(function (c) { return \'<tr><td><div class=\\"nm\\">\' + esc(c.description) + \'</div><div class=\\"lb\\">Custom item</div></td><td class=\\"r lb\\">\' + c.quantity + \' \' + esc(c.unit) + \'</td><td class=\\"r\\">\' + (c.amount == null ? \'<b style=\\"color:var(--amber)\\">to price</b>\' : gbp(c.amount)) + \'</td></tr>\'; }).join(\'\')\\n        + (q.extras || []).map(function (x) { var on = chosen.indexOf(x.code) >= 0; return \'<tr><td><div class=\\"nm\\">\' + esc(x.item) + \' <span class=\\"chip \' + (on ? \'c-accepted\' : \'c-cancelled\') + \'\\">\' + (on ? \'extra added\' : \'optional extra\') + \'</span></div><div class=\\"lb\\">\' + esc(x.why || x.label) + \'</div></td><td class=\\"r lb\\">\' + qty(x) + \'</td><td class=\\"r\\"\' + (on ? \'\' : \' style=\\"color:var(--muted)\\"\') + \'>\' + gbp(x.amount) + \'</td></tr>\'; }).join(\'\') + \'</table>\';\\n      var acc = !!q.accepted_at;\\n      h += \'<div class=\\"tot\\"><div><span>Subtotal</span><span>\' + gbp(acc ? q.accepted_subtotal : q.subtotal) + \'</span></div><div><span>VAT</span><span>\' + gbp(acc ? q.accepted_vat : q.vat) + \'</span></div><div class=\\"big\\"><span>Total</span><span>\' + gbp(acc ? q.accepted_total : q.total) + \'</span></div><div><span>Deposit (\' + D.settings.deposit_pct + \'%)</span><span>\' + gbp(acc ? q.deposit_due : q.deposit) + \'</span></div></div>\';\\n    }\\n    h += \'</div>\';\\n\\n    // Facts\\n    var kv = [];\\n    if (q.sent_at) kv.push([\'Sent\', dshort(q.sent_at) + (q.valid_until ? \' · valid until \' + dshort(q.valid_until) : \'\')]);\\n    if (q.sent_at && q.status === \'sent\') kv.push([\'Opened\', q.view_count ? q.view_count + \' times, first \' + ago(q.viewed_at) : \'not yet\']);\\n    if (q.accepted_at) kv.push([\'Signed\', esc(q.signed_name) + \', \' + new Date(q.accepted_at).toLocaleString(\'en-GB\', { day: \'numeric\', month: \'short\', hour: \'2-digit\', minute: \'2-digit\' })]);\\n    if (q.sign_meta && q.sign_meta.fingerprint) kv.push([\'Fingerprint\', \'<span class=\\"mono\\">\' + esc(String(q.sign_meta.fingerprint).slice(0, 24)) + \'…</span>\']);\\n    if (q.deposit_paid_at) kv.push([\'Deposit\', gbp(q.deposit_due) + \' paid \' + dshort(q.deposit_paid_at)]);\\n    if (q.job_start) kv.push([\'Booked\', esc(q.crew) + \', \' + dshort(q.job_start) + \' to \' + dshort(q.job_end)]);\\n    if (q.invoice_id) kv.push([\'Invoice\', esc(q.invoice_id) + \' · balance \' + gbp(q.balance_due) + (q.balance_paid_at ? \' paid \' + dshort(q.balance_paid_at) : \'\')]);\\n    if (kv.length) h += \'<div class=\\"sec\\"><h3>Status</h3><div class=\\"kv\\">\' + kv.map(function (k) { return \'<span>\' + k[0] + \'</span><span>\' + k[1] + \'</span>\'; }).join(\'\') + \'</div></div>\';\\n\\n    // Visit notes\\n    if (q.visit_notes || q.transcript) h += \'<div class=\\"sec\\"><h3>From the site visit</h3>\' + (q.visit_notes ? \'<details class=\\"raw\\" open><summary>Notes</summary><p>\' + esc(q.visit_notes) + \'</p></details>\' : \'\') + (q.transcript ? \'<details class=\\"raw\\"><summary>Voice memo transcript</summary><p>\' + esc(q.transcript) + \'</p></details>\' : \'\') + \'</div>\';\\n\\n    // Timeline\\n    var ev = (D.events[q.quote_id] || []).slice().reverse();\\n    if (ev.length) h += \'<div class=\\"sec\\" style=\\"border:0\\"><h3>History</h3><ul class=\\"tl\\">\' + ev.map(function (x) { return \'<li><span class=\\"dot k-\' + esc(x.event) + \'\\"></span><div><span class=\\"ev\\">\' + esc(EVENT[x.event] || x.event) + \'</span> <span class=\\"dt\\">\' + esc(x.detail) + \'</span></div><span class=\\"when\\">\' + ago(x.at) + \'</span></li>\'; }).join(\'\') + \'</ul></div>\';\\n    $(\'detail\').innerHTML = h;\\n    wire(q, e);\\n  }\\n\\n  function buttons(q, e) {\\n    var pdf = \'<a class=\\"b\\" target=\\"_blank\\" href=\\"pdf?t=\' + q.token + \'&doc=quote\\">PDF</a>\';\\n    var view = \'<a class=\\"b\\" target=\\"_blank\\" href=\\"quote?t=\' + q.token + (q.status === \'draft\' ? \'&preview=1\' : \'\') + \'\\">\' + (q.status === \'draft\' ? \'Preview\' : \'Client page\') + \'</a>\';\\n    if (e) return \'<button class=\\"b p\\" id=\\"bSaveSend\\"\' + (unpricedEdit(e) || !e.lines.length ? \' disabled\' : \'\') + \'>Save and send</button><button class=\\"b\\" id=\\"bSave\\">Save</button><button class=\\"b\\" id=\\"bCancelEdit\\">Cancel</button>\';\\n    if (q.status === \'draft\') return \'<button class=\\"b p\\" id=\\"bSend\\"\' + (unpriced(q) || !q.lines.length ? \' disabled title=\\"Price the custom items first\\"\' : \'\') + \'>Send to client</button><button class=\\"b\\" id=\\"bEdit\\">Edit</button>\' + view + pdf + \'<button class=\\"b d\\" id=\\"bCancel\\">Cancel</button>\';\\n    if (q.status === \'sent\') return \'<button class=\\"b\\" id=\\"bEdit\\">Edit</button><button class=\\"b\\" id=\\"bResend\\">Send again</button>\' + view + pdf + \'<button class=\\"b d\\" id=\\"bCancel\\">Withdraw</button>\';\\n    if (q.status === \'accepted\') return \'<button class=\\"b p\\" id=\\"bDeposit\\">Record deposit (bank transfer)</button>\' + view + pdf;\\n    if (q.status === \'scheduled\') return \'<button class=\\"b p\\" id=\\"bComplete\\">Job done: send final invoice</button>\' + view + pdf;\\n    if (q.status === \'completed\') return \'<button class=\\"b p\\" id=\\"bBalance\\">Record payment (bank transfer)</button><a class=\\"b\\" target=\\"_blank\\" href=\\"pdf?t=\' + q.token + \'&doc=invoice\\">Invoice PDF</a>\' + view;\\n    if (q.status === \'paid\') return \'<a class=\\"b\\" target=\\"_blank\\" href=\\"pdf?t=\' + q.token + \'&doc=receipt\\">Receipt PDF</a><a class=\\"b\\" target=\\"_blank\\" href=\\"pdf?t=\' + q.token + \'&doc=invoice\\">Invoice PDF</a>\' + view;\\n    return view + pdf;\\n  }\\n  function unpricedEdit(e) { return e.custom.some(function (c) { return c.unit_price === \'\' || c.unit_price == null || isNaN(Number(c.unit_price)); }); }\\n\\n  function startEdit(q) {\\n    state.edit = { quote_id: q.quote_id, job_title: q.job_title, summary: q.summary, flags: q.flags || [],\\n      lines: q.lines.map(function (l) { return { code: l.code, quantity: l.quantity, label: l.label }; }),\\n      extras: (q.extras || []).map(function (x) { return { code: x.code, quantity: x.quantity, label: x.label, why: x.why }; }),\\n      custom: (q.custom || []).map(function (c) { return { description: c.description, quantity: c.quantity, unit: c.unit, unit_price: c.unit_price, why: c.why }; }) };\\n    detail();\\n  }\\n  function readEdit() {\\n    var e = state.edit; if (!e) return;\\n    if ($(\'eTitle\')) e.job_title = $(\'eTitle\').value;\\n    if ($(\'eSummary\')) e.summary = $(\'eSummary\').value;\\n  }\\n  function payload(e) { return { job_title: e.job_title, summary: e.summary, lines: e.lines, extras: e.extras, custom: e.custom.map(function (c) { return Object.assign({}, c, { unit_price: c.unit_price === \'\' || c.unit_price == null ? null : Number(c.unit_price) }); }) }; }\\n\\n  function wire(q, e) {\\n    var on = function (id, fn) { var el = $(id); if (el) el.onclick = fn; };\\n    on(\'bEdit\', function () { startEdit(q); });\\n    on(\'bCancelEdit\', function () { state.edit = null; detail(); });\\n    on(\'bSave\', function () { readEdit(); act(\'save\', q, payload(state.edit), function () { state.edit = null; }); });\\n    on(\'bSaveSend\', function () { readEdit(); var p = payload(state.edit); act(\'save\', q, p, function () { state.edit = null; act(\'send\', q, {}); }); });\\n    on(\'bSend\', function () { if (confirm(\'Send \' + q.quote_id + \' to \' + q.client_name + \' (\' + q.client_email + \')?\')) act(\'send\', q, {}); });\\n    on(\'bResend\', function () { act(\'send\', q, {}); });\\n    on(\'bCancel\', function () { if (confirm(\'Cancel \' + q.quote_id + \'?\')) act(\'cancel\', q, {}); });\\n    on(\'bDeposit\', function () { if (confirm(\'Record a \' + gbp(q.deposit_due) + \' deposit paid by bank transfer? This books the job.\')) act(\'record_payment\', q, { kind: \'deposit\' }); });\\n    on(\'bBalance\', function () { if (confirm(\'Record \' + gbp(q.balance_due) + \' paid by bank transfer?\')) act(\'record_payment\', q, { kind: \'balance\' }); });\\n    on(\'bComplete\', function () { if (confirm(\'Mark the job done and send the final invoice for \' + gbp(q.accepted_total - q.deposit_due) + \'?\')) act(\'complete\', q, {}); });\\n    if (!e) return;\\n    Array.prototype.forEach.call(document.querySelectorAll(\'[data-k]\'), function (el) { el.onchange = function () { readEdit(); var l = e.lines[+el.getAttribute(\'data-i\')]; l[el.getAttribute(\'data-k\')] = el.getAttribute(\'data-k\') === \'quantity\' ? Number(el.value) : el.value; detail(); }; });\\n    Array.prototype.forEach.call(document.querySelectorAll(\'[data-c]\'), function (el) { el.onchange = function () { readEdit(); e.custom[+el.getAttribute(\'data-c\')].unit_price = el.value === \'\' ? null : Number(el.value); detail(); }; });\\n    Array.prototype.forEach.call(document.querySelectorAll(\'[data-del]\'), function (el) { el.onclick = function () { readEdit(); e.lines.splice(+el.getAttribute(\'data-del\'), 1); detail(); }; });\\n    Array.prototype.forEach.call(document.querySelectorAll(\'[data-cdel]\'), function (el) { el.onclick = function () { readEdit(); e.custom.splice(+el.getAttribute(\'data-cdel\'), 1); detail(); }; });\\n    Array.prototype.forEach.call(document.querySelectorAll(\'[data-xdel]\'), function (el) { el.onclick = function () { readEdit(); e.extras.splice(+el.getAttribute(\'data-xdel\'), 1); detail(); }; });\\n    on(\'eAddGo\', function () { readEdit(); var c = $(\'eAdd\').value, n = Number($(\'eAddQty\').value) || 1; if (!c) return; e.lines.push({ code: c, quantity: n, label: \'Added by \' + D.settings.owner_name }); detail(); });\\n  }\\n\\n  function toast(t, err) { var d = document.createElement(\'div\'); d.className = \'toast\' + (err ? \' err\' : \'\'); d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 4200); }\\n  function act(action, q, extra, after) {\\n    document.body.classList.add(\'busy\');\\n    fetch(\'owner\', { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify(Object.assign({ key: D.key, action: action, quote_id: q.quote_id }, extra)) })\\n      .then(function (r) { return r.json(); })\\n      .then(function (r) {\\n        document.body.classList.remove(\'busy\');\\n        if (!r.ok) { toast(r.message || \'That didn\\\\\'t work.\', true); return; }\\n        if (r.data) { D = Object.assign(D, r.data); }\\n        if (after) after();\\n        toast(r.message || \'Done\');\\n        render();\\n      })\\n      .catch(function () { document.body.classList.remove(\'busy\'); toast(\'Could not reach n8n.\', true); });\\n  }\\n\\n  function schedule() {\\n    var start = new Date(D.today + \'T00:00:00\'); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7);\\n    var span = 35, pos = function (iso) { return (new Date(iso + \'T00:00:00\') - start) / 864e5 / span * 100; };\\n    var h = \'<h2>Crew schedule</h2><div class=\\"gantt\\"><div></div><div class=\\"weeks\\">\';\\n    for (var w = 0; w < 5; w++) { var d = new Date(start); d.setDate(d.getDate() + w * 7); h += \'<span style=\\"left:\' + (w * 20) + \'%\\">w/c \' + d.toLocaleDateString(\'en-GB\', { day: \'numeric\', month: \'short\' }) + \'</span>\'; }\\n    h += \'</div>\';\\n    D.settings.crews.forEach(function (crew) {\\n      h += \'<div class=\\"crew\\">\' + esc(crew) + \'</div><div class=\\"lane\\"><span class=\\"today\\" style=\\"left:\' + pos(D.today) + \'%\\"></span>\';\\n      D.schedule.filter(function (x) { return x.crew === crew; }).forEach(function (x) {\\n        var l = Math.max(0, pos(x.start)), r = Math.min(100, pos(x.end) + 100 / span); if (r <= 0 || l >= 100) return;\\n        h += \'<span class=\\"bar\' + (x.quote_id ? \' mine\' : \'\') + (x.end < D.today ? \' past\' : \'\') + \'\\" \' + (x.quote_id ? \'data-q=\\"\' + x.quote_id + \'\\"\' : \'\') + \' style=\\"left:\' + l + \'%;width:\' + (r - l) + \'%\\" title=\\"\' + esc(x.title) + \' (\' + x.start + \' to \' + x.end + \')\\">\' + esc(x.title) + \'</span>\';\\n      });\\n      h += \'</div>\';\\n    });\\n    $(\'sched\').innerHTML = h + \'</div>\';\\n  }\\n\\n  function render() { kpis(); list(); detail(); schedule(); }\\n  document.addEventListener(\'click\', function (ev) {\\n    var t = ev.target.closest(\'[data-tab]\'); if (t) { state.tab = t.getAttribute(\'data-tab\'); list(); return; }\\n    var r = ev.target.closest(\'.row[data-q], .bar[data-q]\'); if (r) { state.sel = r.getAttribute(\'data-q\'); state.edit = null; list(); detail(); }\\n  });\\n  $(\'co\').textContent = D.settings.company;\\n  $(\'mode\').textContent = D.settings.mode === \'live\' ? \'LIVE\' : \'TEST MODE\';\\n  if (D.settings.mode === \'live\') $(\'mode\').classList.add(\'live\');\\n  $(\'who\').textContent = D.settings.owner_name;\\n  $(\'newVisit\').href = D.formUrl;\\n  if (state.sel) { var sq = D.quotes.find(function (x) { return x.quote_id === state.sel; }); if (sq) state.tab = TABS.find(function (t) { return t[2](sq) && t[0] !== \'all\'; })[0]; }\\n  else { var first = D.quotes.filter(TABS[0][2]).sort(function (a, b) { return (b.updated_at || b.created_at) > (a.updated_at || a.created_at) ? 1 : -1; })[0]; if (first) state.sel = first.quote_id; }\\n  render();\\n})();\\n</script>\\n</body>\\n</html>\\n"\n' +
          ';\n' +
          'const query = $(\'Dashboard Request\').first().json.query || {};\n' +
          'const T = tablesOf($(\'Load All\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'if (!s.dashboard_key || String(query.key || \'\') !== String(s.dashboard_key)) return [{ json: { code: 403, html: pageHtml(s, \'Wrong link\', \'<p>This dashboard link is not valid. Use the link with the key from the Settings tab.</p>\') } }];\n' +
          'return [{ json: { code: 200, html: PAGE.replace(\'/*__DATA__*/null\', JSON.stringify(dashData(T, s)).replace(/</g, \'\\\\u003c\')) } }];\n'
        )
  } },
  output: [{ code: 200, html: '<html></html>' }]
});

const sendPage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [860, 300], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

// Owner actions
const actionHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Owner Action', position: [200, 640], parameters: { httpMethod: 'POST', path: 'mossgrove/owner', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { key: 'k', action: 'send', quote_id: 'Q-1009' } }]
});

const loadAction = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load All (Action)',
    position: [420, 640],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const planAction = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Owner Action', position: [640, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// The owner\'s buttons: save edits (repriced from the price book), send, withdraw, record a bank transfer,\n' +
          '// and "job done" (final invoice). Checks the key and that the action fits the quote\'s status.\n' +
          '// ---- lib-mgv.js (included by build.py): shared helpers for the Mossgrove workflows ----\n' +
          'const TZ = \'Europe/London\';\n' +
          'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
          'const parseJson = (s, d) => { try { return typeof s === \'string\' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
          'const nowDt = () => DateTime.now().setZone(TZ);\n' +
          'const nowIso = () => nowDt().set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });\n' +
          'const toDt = iso => DateTime.fromISO(String(iso), { zone: TZ });\n' +
          'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
          'const round2 = n => Math.round((Number(n) || 0) * 100) / 100;\n' +
          'const money = n => \'£\' + round2(n).toLocaleString(\'en-GB\', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n' +
          'const day = iso => iso ? toDt(iso).toFormat(\'d LLL yyyy\') : \'\';\n' +
          'const dayLong = iso => iso ? toDt(iso).toFormat(\'cccc d LLLL\') : \'\';\n' +
          'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
          'const qtyText = n => (Math.round(Number(n) * 10) / 10).toLocaleString(\'en-GB\');\n' +
          'const unitText = (u, n) => u === \'each\' ? \'\' : (u === \'metre\' ? (Number(n) === 1 ? \'metre\' : \'metres\') : u);\n' +
          'const COLUMNS = {"Settings": ["key", "value", "note"], "Price Book": ["code", "category", "item", "unit", "unit_price", "labour_days", "min_qty", "notes", "active"], "Quotes": ["quote_id", "token", "status", "client_name", "client_email", "client_phone", "site_address", "postcode", "job_title", "summary", "visit_notes", "transcript", "lines_json", "extras_json", "custom_json", "assumptions_json", "questions_json", "flags_json", "subtotal", "vat", "total", "deposit", "labour_days", "version", "estimator", "created_at", "build_ms", "sent_at", "valid_until", "viewed_at", "view_count", "accepted_at", "signed_name", "sign_meta_json", "chosen_extras_json", "accepted_subtotal", "accepted_vat", "accepted_total", "deposit_due", "deposit_paid_at", "job_start", "job_end", "crew", "completed_at", "invoice_id", "balance_due", "balance_paid_at", "review_sent_at", "declined_at", "decline_reason", "reminders_sent", "last_reminder_at", "messages_json", "updated_at"], "Events": ["at", "quote_id", "event", "detail", "actor"], "Payments": ["payment_id", "quote_id", "kind", "amount", "status", "provider", "provider_ref", "created_at", "paid_at"], "Schedule": ["entry_id", "quote_id", "title", "start", "end", "crew", "kind", "notes"], "Outbox": ["at", "to", "subject", "kind", "quote_id", "links", "html"]};\n' +
          '\n' +
          '// Sheets API values:batchGet response → { \'Tab name\': [ { column: value, _row } ] } (blank rows dropped)\n' +
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
          'const truthy = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());\n' +
          'function bookOf(rows) {\n' +
          '  const b = {};\n' +
          '  for (const r of rows || []) if (r.code && (r.active === \'\' || truthy(r.active))) b[String(r.code).trim().toUpperCase()] = r;\n' +
          '  return b;\n' +
          '}\n' +
          '\n' +
          '// A quote row with its JSON columns parsed\n' +
          'function quoteOf(row) {\n' +
          '  if (!row) return null;\n' +
          '  const q = Object.assign({}, row);\n' +
          '  for (const k of [\'lines\', \'extras\', \'custom\', \'assumptions\', \'questions\', \'flags\', \'chosen_extras\', \'messages\', \'sign_meta\']) q[k] = parseJson(row[k + \'_json\'], k === \'sign_meta\' ? {} : []);\n' +
          '  for (const k of [\'subtotal\', \'vat\', \'total\', \'deposit\', \'labour_days\', \'view_count\', \'accepted_subtotal\', \'accepted_vat\', \'accepted_total\', \'deposit_due\', \'balance_due\', \'reminders_sent\', \'version\']) q[k] = Number(row[k]) || 0;\n' +
          '  return q;\n' +
          '}\n' +
          '\n' +
          '// ---- Pricing: the AI picks items and quantities; prices always come from the price book ----\n' +
          'function priceEntry(e, book) {\n' +
          '  const b = book[String(e.code || \'\').trim().toUpperCase()];\n' +
          '  if (!b) return null;\n' +
          '  let qty = Math.max(Number(e.quantity) || 0, 0);\n' +
          '  const min = Number(b.min_qty) || 0;\n' +
          '  const minApplied = qty > 0 && min > 0 && qty < min;\n' +
          '  if (minApplied) qty = min;\n' +
          '  qty = Math.round(qty * 10) / 10;\n' +
          '  const unitPrice = Number(b.unit_price) || 0;\n' +
          '  return {\n' +
          '    code: String(b.code).toUpperCase(), item: b.item, category: b.category, unit: b.unit, quantity: qty,\n' +
          '    unit_price: unitPrice, amount: round2(qty * unitPrice), labour_days: round2(qty * (Number(b.labour_days) || 0)),\n' +
          '    label: String(e.label || \'\'), evidence: String(e.evidence || \'\'), why: String(e.why || \'\'), min_applied: minApplied\n' +
          '  };\n' +
          '}\n' +
          '\n' +
          'function priceQuote(draft, book, s) {\n' +
          '  const flags = [];\n' +
          '  const lines = [], extras = [], custom = [];\n' +
          '  for (const e of draft.lines || []) {\n' +
          '    const p = priceEntry(e, book);\n' +
          '    if (!p) { custom.push({ description: String(e.label || e.code), quantity: Number(e.quantity) || 1, unit: \'each\', unit_price: null, why: \'Code \' + e.code + \' is not in the price book\' }); flags.push({ level: \'warn\', text: \'Code \' + e.code + \' is not in the price book, so it was moved to custom items.\' }); continue; }\n' +
          '    if (!p.quantity) { flags.push({ level: \'warn\', text: p.item + \' had no quantity and was left out.\' }); continue; }\n' +
          '    if (p.min_applied) flags.push({ level: \'info\', text: p.item + \': minimum of \' + qtyText(p.quantity) + \' \' + unitText(p.unit, p.quantity) + \' applied.\' });\n' +
          '    lines.push(p);\n' +
          '  }\n' +
          '  for (const e of draft.extras || []) { const p = priceEntry(e, book); if (p && p.quantity) extras.push(p); }\n' +
          '  for (const c of draft.custom_items || draft.custom || []) {\n' +
          '    const price = c.unit_price === null || c.unit_price === undefined || c.unit_price === \'\' ? null : Number(c.unit_price);\n' +
          '    const qty = Number(c.quantity) || 1;\n' +
          '    custom.push({ description: String(c.description || \'\'), quantity: qty, unit: String(c.unit || \'each\'), unit_price: price, amount: price === null ? null : round2(qty * price), labour_days: Number(c.labour_days) || 0, why: String(c.why || \'\') });\n' +
          '  }\n' +
          '  const unpriced = custom.filter(c => c.unit_price === null || isNaN(c.unit_price));\n' +
          '  if (unpriced.length) flags.push({ level: \'warn\', text: unpriced.length + (unpriced.length === 1 ? \' item isn\\\'t\' : \' items aren\\\'t\') + \' in the price book. Add a price before sending.\' });\n' +
          '  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0) + custom.reduce((a, c) => a + (c.amount || 0), 0));\n' +
          '  const vatRate = Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate);\n' +
          '  const vat = round2(subtotal * vatRate);\n' +
          '  const total = round2(subtotal + vat);\n' +
          '  const deposit = round2(total * (Number(s.deposit_pct) || 25) / 100);\n' +
          '  const labour = round2(lines.reduce((a, l) => a + l.labour_days, 0) + custom.reduce((a, c) => a + (c.labour_days || 0), 0));\n' +
          '  if (total >= (Number(s.big_job) || 15000)) flags.push({ level: \'info\', text: \'Large job (\' + money(total) + \'). Double-check the measurements before sending.\' });\n' +
          '  if (!lines.length && !custom.length) flags.push({ level: \'warn\', text: \'No priced lines yet. Add items before sending.\' });\n' +
          '  return { lines, extras, custom, subtotal, vat, total, deposit, labour_days: labour, flags };\n' +
          '}\n' +
          '\n' +
          '// Totals once the client has picked optional extras\n' +
          'function acceptedTotals(q, chosenCodes, s) {\n' +
          '  const chosen = (q.extras || []).filter(x => chosenCodes.includes(x.code));\n'
        ) +
        (
          '  const subtotal = round2(Number(q.subtotal) + chosen.reduce((a, x) => a + x.amount, 0));\n' +
          '  const vat = round2(subtotal * Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate));\n' +
          '  const total = round2(subtotal + vat);\n' +
          '  return { chosen, subtotal, vat, total, deposit: round2(total * (Number(s.deposit_pct) || 25) / 100), labour_days: round2(Number(q.labour_days) + chosen.reduce((a, x) => a + x.labour_days, 0)) };\n' +
          '}\n' +
          'const jobDays = labour => Math.max(1, Math.ceil(Number(labour) - 0.25));\n' +
          '\n' +
          '// ---- Links ----\n' +
          'const baseUrl = s => String(s.base_url || \'http://localhost:5678\').replace(/\\/$/, \'\');\n' +
          'const quoteUrl = (s, token) => baseUrl(s) + \'/webhook/mossgrove/quote?t=\' + token;\n' +
          'const pdfUrl = (s, token, doc) => baseUrl(s) + \'/webhook/mossgrove/pdf?t=\' + token + \'&doc=\' + (doc || \'quote\');\n' +
          'const payUrl = (s, token, kind) => baseUrl(s) + \'/webhook/mossgrove/pay?t=\' + token + \'&kind=\' + kind;\n' +
          'const dashboardUrl = s => baseUrl(s) + \'/webhook/mossgrove/dashboard?key=\' + encodeURIComponent(s.dashboard_key || \'\');\n' +
          '\n' +
          '// ---- Emails and plain pages ----\n' +
          'function button(url, label) {\n' +
          '  return \'<p style="margin:22px 0;text-align:left"><a href="\' + esc(url) + \'" style="display:inline-block;background:#1f4d3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">\' + esc(label) + \'</a></p>\';\n' +
          '}\n' +
          'function emailHtml(s, paragraphs, extraHtml) {\n' +
          '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
          '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1d2a24;max-width:560px;text-align:left">\'\n' +
          '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin:0 0 18px">\' + esc(s.company || \'Mossgrove Landscapes\') + \'</div>\'\n' +
          '    + p + (extraHtml || \'\')\n' +
          '    + \'<p style="margin:26px 0 0;color:#6b7a72;font-size:12px;text-align:left">\' + esc(s.company_legal || s.company || \'\') + \' · \' + esc(s.company_phone || \'\') + \'</p></div>\';\n' +
          '}\n' +
          'function pageHtml(s, title, bodyHtml) {\n' +
          '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>\' + esc(title) + \' · \' + esc(s.company || \'Mossgrove Landscapes\') + \'</title>\'\n' +
          '    + \'<style>body{margin:0;background:#f4f1ea;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2a24}\'\n' +
          '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #e3ddd0;border-radius:18px;padding:32px 30px;box-shadow:0 8px 28px rgba(31,77,58,.07)}\'\n' +
          '    + \'.brand{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin-bottom:20px}\'\n' +
          '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4b44;margin:0 0 12px}a.btn{display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;margin-top:8px}\'\n' +
          '    + \'.muted{color:#6b7a72;font-size:14px}</style></head><body><div class="card">\'\n' +
          '    + \'<div class="brand"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M2 32C2 14 14 2 32 2c0 18-12 30-30 30z" fill="#7bb661"/><path d="M5 29L27 7" stroke="#1f4d3a" stroke-width="2"/></svg>\' + esc(s.company || \'Mossgrove Landscapes\') + \'</div>\'\n' +
          '    + \'<h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
          '}\n' +
          '\n' +
          '// ---- Plans: decide everything in code, then Mossgrove 7: Save Changes writes it ----\n' +
          'function emptyPlan(s) { return { mode: s.mode === \'live\' ? \'live\' : \'test\', quote_inserts: [], quote_updates: [], events: [], payments: [], schedule: [], emails: [], result: { ok: true } }; }\n' +
          'const eventRow = (quote_id, event, detail, actor) => ({ at: nowIso(), quote_id, event, detail: String(detail || \'\'), actor: actor || \'system\' });\n' +
          'const emailItem = (to, subject, html, kind, quote_id, links, attach, token) => ({ to, subject, html, kind, quote_id, links: (links || []).join(\' \'), attach: attach || \'\', token: token || \'\' });\n' +
          '// Arrays and objects go to the sheet as JSON text\n' +
          'function sheetRow(o) {\n' +
          '  const r = {};\n' +
          '  for (const [k, v] of Object.entries(o)) if (k !== \'_row\') r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
          '  return r;\n' +
          '}\n' +
          '\n' +
          '// Working days (Mon–Fri) from a date, inclusive of the start\n' +
          'function addWorkdays(start, n) {\n' +
          '  let d = start, left = n - 1;\n' +
          '  while (left > 0) { d = d.plus({ days: 1 }); if (d.weekday <= 5) left--; }\n' +
          '  return d;\n' +
          '}\n' +
          '// Earliest start (after the lead time) where one crew has the whole job free\n' +
          'function nextSlot(schedule, s, days) {\n' +
          '  const crews = String(s.crews || \'Crew A\').split(\',\').map(c => c.trim()).filter(Boolean);\n' +
          '  const busy = (schedule || []).filter(e => e.start && e.end).map(e => ({ crew: String(e.crew), start: String(e.start).slice(0, 10), end: String(e.end).slice(0, 10) }));\n' +
          '  let d = nowDt().startOf(\'day\').plus({ days: Number(s.lead_days) || 7 });\n' +
          '  for (let i = 0; i < 180; i++, d = d.plus({ days: 1 })) {\n' +
          '    if (d.weekday > 5) continue;\n' +
          '    const end = addWorkdays(d, days);\n' +
          '    const a = d.toISODate(), b = end.toISODate();\n' +
          '    for (const crew of crews) {\n' +
          '      if (!busy.some(x => x.crew === crew && !(x.end < a || x.start > b))) return { crew, start: a, end: b };\n' +
          '    }\n' +
          '  }\n' +
          '  return null;\n' +
          '}\n' +
          '\n' +
          '// A payment arrived (card, test checkout or bank transfer the owner recorded)\n' +
          'function planPayment(plan, q, kind, provider, ref, T, s, actor) {\n' +
          '  const amount = kind === \'deposit\' ? q.deposit_due : q.balance_due;\n' +
          '  const at = nowIso();\n' +
          '  plan.payments.push({ payment_id: \'PAY-\' + newToken(8).toUpperCase(), quote_id: q.quote_id, kind, amount, status: \'paid\', provider, provider_ref: ref || \'\', created_at: at, paid_at: at });\n' +
          '  const links = [quoteUrl(s, q.token)];\n' +
          '  if (kind === \'deposit\') {\n' +
          '    const slot = nextSlot(T.Schedule, s, jobDays(q.labour_days));\n' +
          '    const upd = { quote_id: q.quote_id, status: \'scheduled\', deposit_paid_at: at, updated_at: at };\n' +
          '    let when = \'We\\\'ll be in touch shortly with your start date.\';\n' +
          '    if (slot) {\n' +
          '      Object.assign(upd, { job_start: slot.start, job_end: slot.end, crew: slot.crew });\n' +
          '      plan.schedule.push({ entry_id: \'JOB-\' + q.quote_id, quote_id: q.quote_id, title: q.client_name.split(\' \').slice(-1)[0] + \': \' + q.job_title, start: slot.start, end: slot.end, crew: slot.crew, kind: \'job\', notes: q.site_address });\n' +
          '      const n = jobDays(q.labour_days);\n' +
          '      when = \'We\\\'ve booked you in to start on <b>\' + esc(dayLong(slot.start)) + \'</b>, for about \' + n + \' working day\' + (n === 1 ? \'\' : \'s\') + \'. We\\\'ll confirm the arrival time the week before.\';\n' +
          '    }\n' +
          '    plan.quote_updates.push(upd);\n' +
          '    plan.events.push(eventRow(q.quote_id, \'deposit_paid\', money(amount) + \' via \' + provider + (slot ? \'; booked \' + slot.crew + \' from \' + slot.start + \' to \' + slot.end : \'; no free slot found\'), actor));\n' +
          '    plan.emails.push(emailItem(q.client_email, \'You\\\'re booked in: \' + q.job_title, emailHtml(s, [\n' +
          '      \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '      \'Thank you, we\\\'ve received your deposit of <b>\' + money(amount) + \'</b>.\',\n' +
          '      when\n' +
          '    ], button(quoteUrl(s, q.token), \'View your booking\')), \'deposit_receipt\', q.quote_id, links, \'quote\', q.token));\n' +
          '    plan.emails.push(emailItem(s.owner_email, \'Deposit paid: \' + q.quote_id + \' \' + q.client_name + \' (\' + money(amount) + \')\', emailHtml(s, [\n' +
          '      esc(q.client_name) + \' paid the \' + money(amount) + \' deposit for <b>\' + esc(q.job_title) + \'</b>.\',\n' +
          '      slot ? \'Booked for \' + esc(slot.crew) + \', \' + esc(day(slot.start)) + \' to \' + esc(day(slot.end)) + \'.\' : \'<b>No free slot was found in the next six months.</b> Please book it by hand.\'\n' +
          '    ], button(dashboardUrl(s), \'Open the dashboard\')), \'owner_deposit\', q.quote_id, links));\n' +
          '    return slot;\n' +
          '  }\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, status: \'paid\', balance_paid_at: at, updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, \'balance_paid\', money(amount) + \' via \' + provider, actor));\n'
        ) +
        (
          '  plan.emails.push(emailItem(q.client_email, \'Payment received, thank you (\' + q.invoice_id + \')\', emailHtml(s, [\n' +
          '    \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '    \'Thank you for your payment of <b>\' + money(amount) + \'</b>. Your invoice \' + esc(q.invoice_id) + \' is now paid in full; the receipt is attached.\',\n' +
          '    \'Enjoy the garden!\'\n' +
          '  ], button(pdfUrl(s, q.token, \'receipt\'), \'Download your receipt\')), \'balance_receipt\', q.quote_id, [pdfUrl(s, q.token, \'receipt\')], \'receipt\', q.token));\n' +
          '  plan.emails.push(emailItem(s.owner_email, \'Paid in full: \' + q.quote_id + \' \' + q.client_name + \' (\' + money(amount) + \')\', emailHtml(s, [\n' +
          '    esc(q.client_name) + \' paid the final \' + money(amount) + \' for <b>\' + esc(q.job_title) + \'</b>. The job is closed; a review request goes out in two days.\'\n' +
          '  ]), \'owner_paid\', q.quote_id, links));\n' +
          '  return null;\n' +
          '}\n' +
          '\n' +
          '// OpenAI Responses API result → the JSON object the model returned, or null\n' +
          'function aiJson(res) {\n' +
          '  if (!res || res.error) return null;\n' +
          '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
          '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
          '  let t = part ? part.text : null;\n' +
          '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
          '  return t && typeof t === \'object\' ? t : null;\n' +
          '}\n' +
          '\n' +
          '// Full page for the estimator\'s form results (the n8n form shows it instead of its own page)\n' +
          'function formPage(title, bodyHtml) {\n' +
          '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
          '    + \'<style>body{margin:0;background:#f4f1ea;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2a24}\'\n' +
          '    + \'.wrap{max-width:640px;margin:36px auto;padding:0 16px}.card{background:#fff;border:1px solid #e3ddd0;border-radius:18px;padding:28px 26px;box-shadow:0 8px 28px rgba(31,77,58,.07)}\'\n' +
          '    + \'.brand{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin-bottom:16px}\'\n' +
          '    + \'h1{font-size:22px;margin:0 0 6px;letter-spacing:-.3px}.sub{color:#5c6b63;margin:0 0 18px}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:8px 0;border-bottom:1px solid #eee8dc;vertical-align:top}td.r{text-align:right;white-space:nowrap;padding-left:12px}\'\n' +
          '    + \'.lbl{color:#76847c;font-size:13px}.tot td{border:0;font-weight:700;font-size:17px;padding-top:12px}.flag{background:#fff7e6;border:1px solid #f3dfb2;border-radius:10px;padding:9px 12px;margin:8px 0;font-size:14px}.flag.info{background:#eef5f0;border-color:#d3e6d8}\'\n' +
          '    + \'a.btn{display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;margin:14px 10px 0 0}a.ghost{background:#fff;color:#1f4d3a;border:1px solid #c9d8cd}ul{padding-left:20px;margin:6px 0}\'\n' +
          '    + \'</style></head><body><div class="wrap"><div class="card"><div class="brand"><svg width="20" height="20" viewBox="0 0 34 34"><path d="M2 32C2 14 14 2 32 2c0 18-12 30-30 30z" fill="#7bb661"/><path d="M5 29L27 7" stroke="#1f4d3a" stroke-width="2"/></svg>Mossgrove Landscapes</div>\'\n' +
          '    + \'<h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></div></body></html>\';\n' +
          '}\n' +
          '\n' +
          '// The client\'s terms, also printed on the PDF\n' +
          'function quoteTerms(q, s) {\n' +
          '  return [\n' +
          '    \'Prices include VAT at \' + Math.round(Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate) * 100) + \'% and are valid until \' + (day(q.valid_until) || \'the date shown\') + \'. A \' + (Number(s.deposit_pct) || 25) + \'% deposit books your start date; the balance is due within \' + (Number(s.payment_days) || 7) + \' days of completion.\',\n' +
          '    \'We remove all waste from the job. If we find something we could not see at the survey (such as buried concrete or old drains), we agree any extra cost with you before doing the work.\',\n' +
          '    \'New plants and turf are guaranteed for 3 months if watered as advised; paving and fencing workmanship for 5 years.\'\n' +
          '  ];\n' +
          '}\n' +
          'const isExpired = q => q.status === \'sent\' && q.valid_until && toDt(q.valid_until) < nowDt();\n' +
          '\n' +
          'const STATUS_LABEL = { draft: \'Draft\', sent: \'Sent\', accepted: \'Accepted\', scheduled: \'Booked\', completed: \'Invoiced\', paid: \'Paid\', declined: \'Declined\', expired: \'Expired\', cancelled: \'Cancelled\' };\n' +
          '// ---- end lib-mgv.js ----\n' +
          '// ---- lib-pay.js: what a payment link is for, and whether it can be paid now ----\n' +
          'function payable(q, kind) {\n' +
          '  if (!q) return { ok: false, message: \'This payment link is not valid.\' };\n' +
          '  if (kind === \'deposit\') {\n' +
          '    if (q.status === \'accepted\' && !q.deposit_paid_at) return { ok: true, amount: q.deposit_due, label: \'Deposit for quote \' + q.quote_id + \': \' + q.job_title };\n' +
          '    return { ok: false, message: q.deposit_paid_at ? \'Your deposit is already paid. Thank you!\' : \'This quote has not been accepted yet.\' };\n' +
          '  }\n' +
          '  if (kind === \'balance\') {\n' +
          '    if (q.status === \'completed\' && !q.balance_paid_at) return { ok: true, amount: q.balance_due, label: \'Invoice \' + q.invoice_id + \': \' + q.job_title };\n' +
          '    return { ok: false, message: q.balance_paid_at ? \'This invoice is already paid. Thank you!\' : \'There is no invoice to pay yet.\' };\n' +
          '  }\n' +
          '  return { ok: false, message: \'This payment link is not valid.\' };\n' +
          '}\n' +
          '// ---- end lib-pay.js ----\n' +
          'const body = $(\'Owner Action\').first().json.body || {};\n' +
          'const T = tablesOf($(\'Load All (Action)\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'const no = (message, code) => [{ json: { ok: false, code: code || 400, message } }];\n' +
          'if (!s.dashboard_key || String(body.key || \'\') !== String(s.dashboard_key)) return no(\'Not allowed.\', 403);\n' +
          'const q = quoteOf((T.Quotes || []).find(r => r.quote_id === body.quote_id));\n' +
          'if (!q) return no(\'Quote not found.\', 404);\n' +
          'if (isExpired(q)) q.status = \'expired\';\n' +
          'const plan = emptyPlan(s);\n' +
          'const at = nowIso();\n' +
          'const actor = s.owner_name || \'owner\';\n' +
          'const action = String(body.action || \'\');\n' +
          'const clientLink = quoteUrl(s, q.token);\n' +
          '\n' +
          'if (action === \'save\') {\n' +
          '  if (![\'draft\', \'sent\'].includes(q.status)) return no(\'Only drafts and sent quotes can be edited.\', 409);\n' +
          '  const priced = priceQuote({ lines: body.lines || [], extras: body.extras || [], custom_items: body.custom || [] }, bookOf(T[\'Price Book\']), s);\n' +
          '  const version = q.status === \'sent\' ? q.version + 1 : q.version;\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, job_title: String(body.job_title || q.job_title).slice(0, 120), summary: String(body.summary === undefined ? q.summary : body.summary).slice(0, 1200),\n' +
          '    lines_json: priced.lines, extras_json: priced.extras, custom_json: priced.custom, flags_json: priced.flags, subtotal: priced.subtotal, vat: priced.vat, total: priced.total, deposit: priced.deposit, labour_days: priced.labour_days, version, updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, \'edited\', priced.lines.length + priced.custom.length + \' lines, \' + money(priced.total) + (version > q.version ? \' (version \' + version + \')\' : \'\'), actor));\n' +
          '  plan.result = { message: \'Saved: \' + money(priced.total) + \' including VAT\' };\n' +
          '} else if (action === \'send\') {\n' +
          '  if (![\'draft\', \'sent\', \'expired\'].includes(q.status)) return no(\'This quote can\\\'t be sent in its current state.\', 409);\n' +
          '  if (!q.lines.length && !q.custom.length) return no(\'Add at least one line first.\');\n' +
          '  if (q.custom.some(c => c.unit_price === null || c.unit_price === \'\' || isNaN(Number(c.unit_price)))) return no(\'Price the custom items first.\');\n' +
          '  const validUntil = nowDt().plus({ days: Number(s.validity_days) || 30 }).endOf(\'day\').toISO({ suppressMilliseconds: true });\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, status: \'sent\', sent_at: at, valid_until: validUntil, reminders_sent: 0, updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, q.status === \'sent\' ? \'resent\' : \'sent\', \'To \' + q.client_email + \', valid until \' + day(validUntil), actor));\n' +
          '  plan.emails.push(emailItem(q.client_email, \'Your quote from \' + s.company + \': \' + q.job_title, emailHtml(s, [\n' +
          '    \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '    \'Thanks for having us round. Here\\\'s your quote for <b>\' + esc(q.job_title) + \'</b>: <b>\' + money(q.total) + \'</b> including VAT.\',\n' +
          '    esc(q.summary),\n' +
          '    \'On the page you can add optional extras, ask us a question, or accept and sign in a minute. The quote is valid until \' + day(validUntil) + (s.mode === \'live\' ? \' and the PDF is attached.\' : \'.\')\n' +
          '  ], button(clientLink, \'View your quote\') + \'<p style="margin:0;color:#6b7a72;font-size:13px;text-align:left">\' + esc(q.estimator || s.owner_name) + \', \' + esc(s.company) + \' · \' + esc(s.company_phone) + \'</p>\'), \'quote_sent\', q.quote_id, [clientLink, pdfUrl(s, q.token, \'quote\')], \'quote\', q.token));\n' +
          '  plan.result = { message: (q.status === \'sent\' ? \'Sent again to \' : \'Sent to \') + q.client_email };\n' +
          '} else if (action === \'cancel\') {\n' +
          '  if (![\'draft\', \'sent\', \'accepted\', \'expired\'].includes(q.status)) return no(\'This quote can\\\'t be cancelled now.\', 409);\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, status: \'cancelled\', updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, \'cancelled\', \'Withdrawn by the owner\', actor));\n'
        ) +
        (
          '  plan.result = { message: q.quote_id + \' cancelled\' };\n' +
          '} else if (action === \'complete\') {\n' +
          '  if (q.status !== \'scheduled\') return no(\'Only booked jobs can be marked done.\', 409);\n' +
          '  const invoiceId = q.quote_id.replace(\'Q-\', \'INV-\');\n' +
          '  const balance = round2(q.accepted_total - q.deposit_due);\n' +
          '  const due = day(nowDt().plus({ days: Number(s.payment_days) || 7 }).toISO());\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, status: \'completed\', completed_at: at, invoice_id: invoiceId, balance_due: balance, updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, \'completed\', \'Invoice \' + invoiceId + \': balance \' + money(balance) + \' due \' + due, actor));\n' +
          '  plan.emails.push(emailItem(q.client_email, \'Your final invoice \' + invoiceId + \' from \' + s.company, emailHtml(s, [\n' +
          '    \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '    \'Thank you for having us. We\\\'ve finished <b>\' + esc(q.job_title) + \'</b> and hope you love it.\',\n' +
          '    \'Your final invoice \' + invoiceId + \' is for <b>\' + money(balance) + \'</b> (the \' + money(q.accepted_total) + \' total less your \' + money(q.deposit_due) + \' deposit), due by \' + due + \'. You can pay by card below or by bank transfer using the details on the invoice.\'\n' +
          '  ], button(payUrl(s, q.token, \'balance\'), \'Pay \' + money(balance))), \'invoice\', q.quote_id, [payUrl(s, q.token, \'balance\'), pdfUrl(s, q.token, \'invoice\')], \'invoice\', q.token));\n' +
          '  plan.result = { message: \'Invoice \' + invoiceId + \' sent: \' + money(balance) };\n' +
          '} else if (action === \'record_payment\') {\n' +
          '  const kind = String(body.kind || \'\');\n' +
          '  if (kind === \'balance\' && q.status === \'completed\') q.balance_due = q.balance_due || round2(q.accepted_total - q.deposit_due);\n' +
          '  const p = payable(q, kind);\n' +
          '  if (!p.ok) return no(p.message, 409);\n' +
          '  const slot = planPayment(plan, q, kind, \'bank transfer\', String(body.ref || \'\'), T, s, actor);\n' +
          '  plan.result = { message: kind === \'deposit\' ? \'Deposit recorded\' + (slot ? \'; booked \' + slot.crew + \' from \' + day(slot.start) : \'\') : \'Payment recorded; job closed\' };\n' +
          '} else {\n' +
          '  return no(\'Unknown action.\');\n' +
          '}\n' +
          'plan.result.ok = true;\n' +
          'return [{ json: { ok: true, plan } }];\n'
        )
  } },
  output: [{ ok: true, plan: { result: { ok: true, message: 'Sent' } } }]
});

const allowed = ifElse({ version: 2.2, config: { name: 'Allowed?', position: [860, 640], parameters: { conditions: IS_OK } } });

const saveAction = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save Changes', position: [1080, 560], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const loadAfter = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load All (After)',
    position: [1300, 560],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const actionResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Action Result', position: [1520, 560], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Sends the dashboard fresh data after the change, so it updates without reloading.\n' +
          '// ---- lib-mgv.js (included by build.py): shared helpers for the Mossgrove workflows ----\n' +
          'const TZ = \'Europe/London\';\n' +
          'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
          'const parseJson = (s, d) => { try { return typeof s === \'string\' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
          'const nowDt = () => DateTime.now().setZone(TZ);\n' +
          'const nowIso = () => nowDt().set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });\n' +
          'const toDt = iso => DateTime.fromISO(String(iso), { zone: TZ });\n' +
          'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
          'const round2 = n => Math.round((Number(n) || 0) * 100) / 100;\n' +
          'const money = n => \'£\' + round2(n).toLocaleString(\'en-GB\', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n' +
          'const day = iso => iso ? toDt(iso).toFormat(\'d LLL yyyy\') : \'\';\n' +
          'const dayLong = iso => iso ? toDt(iso).toFormat(\'cccc d LLLL\') : \'\';\n' +
          'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
          'const qtyText = n => (Math.round(Number(n) * 10) / 10).toLocaleString(\'en-GB\');\n' +
          'const unitText = (u, n) => u === \'each\' ? \'\' : (u === \'metre\' ? (Number(n) === 1 ? \'metre\' : \'metres\') : u);\n' +
          'const COLUMNS = {"Settings": ["key", "value", "note"], "Price Book": ["code", "category", "item", "unit", "unit_price", "labour_days", "min_qty", "notes", "active"], "Quotes": ["quote_id", "token", "status", "client_name", "client_email", "client_phone", "site_address", "postcode", "job_title", "summary", "visit_notes", "transcript", "lines_json", "extras_json", "custom_json", "assumptions_json", "questions_json", "flags_json", "subtotal", "vat", "total", "deposit", "labour_days", "version", "estimator", "created_at", "build_ms", "sent_at", "valid_until", "viewed_at", "view_count", "accepted_at", "signed_name", "sign_meta_json", "chosen_extras_json", "accepted_subtotal", "accepted_vat", "accepted_total", "deposit_due", "deposit_paid_at", "job_start", "job_end", "crew", "completed_at", "invoice_id", "balance_due", "balance_paid_at", "review_sent_at", "declined_at", "decline_reason", "reminders_sent", "last_reminder_at", "messages_json", "updated_at"], "Events": ["at", "quote_id", "event", "detail", "actor"], "Payments": ["payment_id", "quote_id", "kind", "amount", "status", "provider", "provider_ref", "created_at", "paid_at"], "Schedule": ["entry_id", "quote_id", "title", "start", "end", "crew", "kind", "notes"], "Outbox": ["at", "to", "subject", "kind", "quote_id", "links", "html"]};\n' +
          '\n' +
          '// Sheets API values:batchGet response → { \'Tab name\': [ { column: value, _row } ] } (blank rows dropped)\n' +
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
          'const truthy = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());\n' +
          'function bookOf(rows) {\n' +
          '  const b = {};\n' +
          '  for (const r of rows || []) if (r.code && (r.active === \'\' || truthy(r.active))) b[String(r.code).trim().toUpperCase()] = r;\n' +
          '  return b;\n' +
          '}\n' +
          '\n' +
          '// A quote row with its JSON columns parsed\n' +
          'function quoteOf(row) {\n' +
          '  if (!row) return null;\n' +
          '  const q = Object.assign({}, row);\n' +
          '  for (const k of [\'lines\', \'extras\', \'custom\', \'assumptions\', \'questions\', \'flags\', \'chosen_extras\', \'messages\', \'sign_meta\']) q[k] = parseJson(row[k + \'_json\'], k === \'sign_meta\' ? {} : []);\n' +
          '  for (const k of [\'subtotal\', \'vat\', \'total\', \'deposit\', \'labour_days\', \'view_count\', \'accepted_subtotal\', \'accepted_vat\', \'accepted_total\', \'deposit_due\', \'balance_due\', \'reminders_sent\', \'version\']) q[k] = Number(row[k]) || 0;\n' +
          '  return q;\n' +
          '}\n' +
          '\n' +
          '// ---- Pricing: the AI picks items and quantities; prices always come from the price book ----\n' +
          'function priceEntry(e, book) {\n' +
          '  const b = book[String(e.code || \'\').trim().toUpperCase()];\n' +
          '  if (!b) return null;\n' +
          '  let qty = Math.max(Number(e.quantity) || 0, 0);\n' +
          '  const min = Number(b.min_qty) || 0;\n' +
          '  const minApplied = qty > 0 && min > 0 && qty < min;\n' +
          '  if (minApplied) qty = min;\n' +
          '  qty = Math.round(qty * 10) / 10;\n' +
          '  const unitPrice = Number(b.unit_price) || 0;\n' +
          '  return {\n' +
          '    code: String(b.code).toUpperCase(), item: b.item, category: b.category, unit: b.unit, quantity: qty,\n' +
          '    unit_price: unitPrice, amount: round2(qty * unitPrice), labour_days: round2(qty * (Number(b.labour_days) || 0)),\n' +
          '    label: String(e.label || \'\'), evidence: String(e.evidence || \'\'), why: String(e.why || \'\'), min_applied: minApplied\n' +
          '  };\n' +
          '}\n' +
          '\n' +
          'function priceQuote(draft, book, s) {\n' +
          '  const flags = [];\n' +
          '  const lines = [], extras = [], custom = [];\n' +
          '  for (const e of draft.lines || []) {\n' +
          '    const p = priceEntry(e, book);\n' +
          '    if (!p) { custom.push({ description: String(e.label || e.code), quantity: Number(e.quantity) || 1, unit: \'each\', unit_price: null, why: \'Code \' + e.code + \' is not in the price book\' }); flags.push({ level: \'warn\', text: \'Code \' + e.code + \' is not in the price book, so it was moved to custom items.\' }); continue; }\n' +
          '    if (!p.quantity) { flags.push({ level: \'warn\', text: p.item + \' had no quantity and was left out.\' }); continue; }\n' +
          '    if (p.min_applied) flags.push({ level: \'info\', text: p.item + \': minimum of \' + qtyText(p.quantity) + \' \' + unitText(p.unit, p.quantity) + \' applied.\' });\n' +
          '    lines.push(p);\n' +
          '  }\n' +
          '  for (const e of draft.extras || []) { const p = priceEntry(e, book); if (p && p.quantity) extras.push(p); }\n' +
          '  for (const c of draft.custom_items || draft.custom || []) {\n' +
          '    const price = c.unit_price === null || c.unit_price === undefined || c.unit_price === \'\' ? null : Number(c.unit_price);\n' +
          '    const qty = Number(c.quantity) || 1;\n' +
          '    custom.push({ description: String(c.description || \'\'), quantity: qty, unit: String(c.unit || \'each\'), unit_price: price, amount: price === null ? null : round2(qty * price), labour_days: Number(c.labour_days) || 0, why: String(c.why || \'\') });\n' +
          '  }\n' +
          '  const unpriced = custom.filter(c => c.unit_price === null || isNaN(c.unit_price));\n' +
          '  if (unpriced.length) flags.push({ level: \'warn\', text: unpriced.length + (unpriced.length === 1 ? \' item isn\\\'t\' : \' items aren\\\'t\') + \' in the price book. Add a price before sending.\' });\n' +
          '  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0) + custom.reduce((a, c) => a + (c.amount || 0), 0));\n' +
          '  const vatRate = Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate);\n' +
          '  const vat = round2(subtotal * vatRate);\n' +
          '  const total = round2(subtotal + vat);\n' +
          '  const deposit = round2(total * (Number(s.deposit_pct) || 25) / 100);\n' +
          '  const labour = round2(lines.reduce((a, l) => a + l.labour_days, 0) + custom.reduce((a, c) => a + (c.labour_days || 0), 0));\n' +
          '  if (total >= (Number(s.big_job) || 15000)) flags.push({ level: \'info\', text: \'Large job (\' + money(total) + \'). Double-check the measurements before sending.\' });\n' +
          '  if (!lines.length && !custom.length) flags.push({ level: \'warn\', text: \'No priced lines yet. Add items before sending.\' });\n' +
          '  return { lines, extras, custom, subtotal, vat, total, deposit, labour_days: labour, flags };\n' +
          '}\n' +
          '\n' +
          '// Totals once the client has picked optional extras\n' +
          'function acceptedTotals(q, chosenCodes, s) {\n' +
          '  const chosen = (q.extras || []).filter(x => chosenCodes.includes(x.code));\n' +
          '  const subtotal = round2(Number(q.subtotal) + chosen.reduce((a, x) => a + x.amount, 0));\n'
        ) +
        (
          '  const vat = round2(subtotal * Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate));\n' +
          '  const total = round2(subtotal + vat);\n' +
          '  return { chosen, subtotal, vat, total, deposit: round2(total * (Number(s.deposit_pct) || 25) / 100), labour_days: round2(Number(q.labour_days) + chosen.reduce((a, x) => a + x.labour_days, 0)) };\n' +
          '}\n' +
          'const jobDays = labour => Math.max(1, Math.ceil(Number(labour) - 0.25));\n' +
          '\n' +
          '// ---- Links ----\n' +
          'const baseUrl = s => String(s.base_url || \'http://localhost:5678\').replace(/\\/$/, \'\');\n' +
          'const quoteUrl = (s, token) => baseUrl(s) + \'/webhook/mossgrove/quote?t=\' + token;\n' +
          'const pdfUrl = (s, token, doc) => baseUrl(s) + \'/webhook/mossgrove/pdf?t=\' + token + \'&doc=\' + (doc || \'quote\');\n' +
          'const payUrl = (s, token, kind) => baseUrl(s) + \'/webhook/mossgrove/pay?t=\' + token + \'&kind=\' + kind;\n' +
          'const dashboardUrl = s => baseUrl(s) + \'/webhook/mossgrove/dashboard?key=\' + encodeURIComponent(s.dashboard_key || \'\');\n' +
          '\n' +
          '// ---- Emails and plain pages ----\n' +
          'function button(url, label) {\n' +
          '  return \'<p style="margin:22px 0;text-align:left"><a href="\' + esc(url) + \'" style="display:inline-block;background:#1f4d3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">\' + esc(label) + \'</a></p>\';\n' +
          '}\n' +
          'function emailHtml(s, paragraphs, extraHtml) {\n' +
          '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
          '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1d2a24;max-width:560px;text-align:left">\'\n' +
          '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin:0 0 18px">\' + esc(s.company || \'Mossgrove Landscapes\') + \'</div>\'\n' +
          '    + p + (extraHtml || \'\')\n' +
          '    + \'<p style="margin:26px 0 0;color:#6b7a72;font-size:12px;text-align:left">\' + esc(s.company_legal || s.company || \'\') + \' · \' + esc(s.company_phone || \'\') + \'</p></div>\';\n' +
          '}\n' +
          'function pageHtml(s, title, bodyHtml) {\n' +
          '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>\' + esc(title) + \' · \' + esc(s.company || \'Mossgrove Landscapes\') + \'</title>\'\n' +
          '    + \'<style>body{margin:0;background:#f4f1ea;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2a24}\'\n' +
          '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #e3ddd0;border-radius:18px;padding:32px 30px;box-shadow:0 8px 28px rgba(31,77,58,.07)}\'\n' +
          '    + \'.brand{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin-bottom:20px}\'\n' +
          '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4b44;margin:0 0 12px}a.btn{display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;margin-top:8px}\'\n' +
          '    + \'.muted{color:#6b7a72;font-size:14px}</style></head><body><div class="card">\'\n' +
          '    + \'<div class="brand"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M2 32C2 14 14 2 32 2c0 18-12 30-30 30z" fill="#7bb661"/><path d="M5 29L27 7" stroke="#1f4d3a" stroke-width="2"/></svg>\' + esc(s.company || \'Mossgrove Landscapes\') + \'</div>\'\n' +
          '    + \'<h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
          '}\n' +
          '\n' +
          '// ---- Plans: decide everything in code, then Mossgrove 7: Save Changes writes it ----\n' +
          'function emptyPlan(s) { return { mode: s.mode === \'live\' ? \'live\' : \'test\', quote_inserts: [], quote_updates: [], events: [], payments: [], schedule: [], emails: [], result: { ok: true } }; }\n' +
          'const eventRow = (quote_id, event, detail, actor) => ({ at: nowIso(), quote_id, event, detail: String(detail || \'\'), actor: actor || \'system\' });\n' +
          'const emailItem = (to, subject, html, kind, quote_id, links, attach, token) => ({ to, subject, html, kind, quote_id, links: (links || []).join(\' \'), attach: attach || \'\', token: token || \'\' });\n' +
          '// Arrays and objects go to the sheet as JSON text\n' +
          'function sheetRow(o) {\n' +
          '  const r = {};\n' +
          '  for (const [k, v] of Object.entries(o)) if (k !== \'_row\') r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
          '  return r;\n' +
          '}\n' +
          '\n' +
          '// Working days (Mon–Fri) from a date, inclusive of the start\n' +
          'function addWorkdays(start, n) {\n' +
          '  let d = start, left = n - 1;\n' +
          '  while (left > 0) { d = d.plus({ days: 1 }); if (d.weekday <= 5) left--; }\n' +
          '  return d;\n' +
          '}\n' +
          '// Earliest start (after the lead time) where one crew has the whole job free\n' +
          'function nextSlot(schedule, s, days) {\n' +
          '  const crews = String(s.crews || \'Crew A\').split(\',\').map(c => c.trim()).filter(Boolean);\n' +
          '  const busy = (schedule || []).filter(e => e.start && e.end).map(e => ({ crew: String(e.crew), start: String(e.start).slice(0, 10), end: String(e.end).slice(0, 10) }));\n' +
          '  let d = nowDt().startOf(\'day\').plus({ days: Number(s.lead_days) || 7 });\n' +
          '  for (let i = 0; i < 180; i++, d = d.plus({ days: 1 })) {\n' +
          '    if (d.weekday > 5) continue;\n' +
          '    const end = addWorkdays(d, days);\n' +
          '    const a = d.toISODate(), b = end.toISODate();\n' +
          '    for (const crew of crews) {\n' +
          '      if (!busy.some(x => x.crew === crew && !(x.end < a || x.start > b))) return { crew, start: a, end: b };\n' +
          '    }\n' +
          '  }\n' +
          '  return null;\n' +
          '}\n' +
          '\n' +
          '// A payment arrived (card, test checkout or bank transfer the owner recorded)\n' +
          'function planPayment(plan, q, kind, provider, ref, T, s, actor) {\n' +
          '  const amount = kind === \'deposit\' ? q.deposit_due : q.balance_due;\n' +
          '  const at = nowIso();\n' +
          '  plan.payments.push({ payment_id: \'PAY-\' + newToken(8).toUpperCase(), quote_id: q.quote_id, kind, amount, status: \'paid\', provider, provider_ref: ref || \'\', created_at: at, paid_at: at });\n' +
          '  const links = [quoteUrl(s, q.token)];\n' +
          '  if (kind === \'deposit\') {\n' +
          '    const slot = nextSlot(T.Schedule, s, jobDays(q.labour_days));\n' +
          '    const upd = { quote_id: q.quote_id, status: \'scheduled\', deposit_paid_at: at, updated_at: at };\n' +
          '    let when = \'We\\\'ll be in touch shortly with your start date.\';\n' +
          '    if (slot) {\n' +
          '      Object.assign(upd, { job_start: slot.start, job_end: slot.end, crew: slot.crew });\n' +
          '      plan.schedule.push({ entry_id: \'JOB-\' + q.quote_id, quote_id: q.quote_id, title: q.client_name.split(\' \').slice(-1)[0] + \': \' + q.job_title, start: slot.start, end: slot.end, crew: slot.crew, kind: \'job\', notes: q.site_address });\n' +
          '      const n = jobDays(q.labour_days);\n' +
          '      when = \'We\\\'ve booked you in to start on <b>\' + esc(dayLong(slot.start)) + \'</b>, for about \' + n + \' working day\' + (n === 1 ? \'\' : \'s\') + \'. We\\\'ll confirm the arrival time the week before.\';\n' +
          '    }\n' +
          '    plan.quote_updates.push(upd);\n' +
          '    plan.events.push(eventRow(q.quote_id, \'deposit_paid\', money(amount) + \' via \' + provider + (slot ? \'; booked \' + slot.crew + \' from \' + slot.start + \' to \' + slot.end : \'; no free slot found\'), actor));\n' +
          '    plan.emails.push(emailItem(q.client_email, \'You\\\'re booked in: \' + q.job_title, emailHtml(s, [\n' +
          '      \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '      \'Thank you, we\\\'ve received your deposit of <b>\' + money(amount) + \'</b>.\',\n' +
          '      when\n' +
          '    ], button(quoteUrl(s, q.token), \'View your booking\')), \'deposit_receipt\', q.quote_id, links, \'quote\', q.token));\n' +
          '    plan.emails.push(emailItem(s.owner_email, \'Deposit paid: \' + q.quote_id + \' \' + q.client_name + \' (\' + money(amount) + \')\', emailHtml(s, [\n' +
          '      esc(q.client_name) + \' paid the \' + money(amount) + \' deposit for <b>\' + esc(q.job_title) + \'</b>.\',\n' +
          '      slot ? \'Booked for \' + esc(slot.crew) + \', \' + esc(day(slot.start)) + \' to \' + esc(day(slot.end)) + \'.\' : \'<b>No free slot was found in the next six months.</b> Please book it by hand.\'\n' +
          '    ], button(dashboardUrl(s), \'Open the dashboard\')), \'owner_deposit\', q.quote_id, links));\n' +
          '    return slot;\n' +
          '  }\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, status: \'paid\', balance_paid_at: at, updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, \'balance_paid\', money(amount) + \' via \' + provider, actor));\n' +
          '  plan.emails.push(emailItem(q.client_email, \'Payment received, thank you (\' + q.invoice_id + \')\', emailHtml(s, [\n'
        ) +
        (
          '    \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '    \'Thank you for your payment of <b>\' + money(amount) + \'</b>. Your invoice \' + esc(q.invoice_id) + \' is now paid in full; the receipt is attached.\',\n' +
          '    \'Enjoy the garden!\'\n' +
          '  ], button(pdfUrl(s, q.token, \'receipt\'), \'Download your receipt\')), \'balance_receipt\', q.quote_id, [pdfUrl(s, q.token, \'receipt\')], \'receipt\', q.token));\n' +
          '  plan.emails.push(emailItem(s.owner_email, \'Paid in full: \' + q.quote_id + \' \' + q.client_name + \' (\' + money(amount) + \')\', emailHtml(s, [\n' +
          '    esc(q.client_name) + \' paid the final \' + money(amount) + \' for <b>\' + esc(q.job_title) + \'</b>. The job is closed; a review request goes out in two days.\'\n' +
          '  ]), \'owner_paid\', q.quote_id, links));\n' +
          '  return null;\n' +
          '}\n' +
          '\n' +
          '// OpenAI Responses API result → the JSON object the model returned, or null\n' +
          'function aiJson(res) {\n' +
          '  if (!res || res.error) return null;\n' +
          '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
          '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
          '  let t = part ? part.text : null;\n' +
          '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
          '  return t && typeof t === \'object\' ? t : null;\n' +
          '}\n' +
          '\n' +
          '// Full page for the estimator\'s form results (the n8n form shows it instead of its own page)\n' +
          'function formPage(title, bodyHtml) {\n' +
          '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
          '    + \'<style>body{margin:0;background:#f4f1ea;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2a24}\'\n' +
          '    + \'.wrap{max-width:640px;margin:36px auto;padding:0 16px}.card{background:#fff;border:1px solid #e3ddd0;border-radius:18px;padding:28px 26px;box-shadow:0 8px 28px rgba(31,77,58,.07)}\'\n' +
          '    + \'.brand{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin-bottom:16px}\'\n' +
          '    + \'h1{font-size:22px;margin:0 0 6px;letter-spacing:-.3px}.sub{color:#5c6b63;margin:0 0 18px}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:8px 0;border-bottom:1px solid #eee8dc;vertical-align:top}td.r{text-align:right;white-space:nowrap;padding-left:12px}\'\n' +
          '    + \'.lbl{color:#76847c;font-size:13px}.tot td{border:0;font-weight:700;font-size:17px;padding-top:12px}.flag{background:#fff7e6;border:1px solid #f3dfb2;border-radius:10px;padding:9px 12px;margin:8px 0;font-size:14px}.flag.info{background:#eef5f0;border-color:#d3e6d8}\'\n' +
          '    + \'a.btn{display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;margin:14px 10px 0 0}a.ghost{background:#fff;color:#1f4d3a;border:1px solid #c9d8cd}ul{padding-left:20px;margin:6px 0}\'\n' +
          '    + \'</style></head><body><div class="wrap"><div class="card"><div class="brand"><svg width="20" height="20" viewBox="0 0 34 34"><path d="M2 32C2 14 14 2 32 2c0 18-12 30-30 30z" fill="#7bb661"/><path d="M5 29L27 7" stroke="#1f4d3a" stroke-width="2"/></svg>Mossgrove Landscapes</div>\'\n' +
          '    + \'<h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></div></body></html>\';\n' +
          '}\n' +
          '\n' +
          '// The client\'s terms, also printed on the PDF\n' +
          'function quoteTerms(q, s) {\n' +
          '  return [\n' +
          '    \'Prices include VAT at \' + Math.round(Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate) * 100) + \'% and are valid until \' + (day(q.valid_until) || \'the date shown\') + \'. A \' + (Number(s.deposit_pct) || 25) + \'% deposit books your start date; the balance is due within \' + (Number(s.payment_days) || 7) + \' days of completion.\',\n' +
          '    \'We remove all waste from the job. If we find something we could not see at the survey (such as buried concrete or old drains), we agree any extra cost with you before doing the work.\',\n' +
          '    \'New plants and turf are guaranteed for 3 months if watered as advised; paving and fencing workmanship for 5 years.\'\n' +
          '  ];\n' +
          '}\n' +
          'const isExpired = q => q.status === \'sent\' && q.valid_until && toDt(q.valid_until) < nowDt();\n' +
          '\n' +
          'const STATUS_LABEL = { draft: \'Draft\', sent: \'Sent\', accepted: \'Accepted\', scheduled: \'Booked\', completed: \'Invoiced\', paid: \'Paid\', declined: \'Declined\', expired: \'Expired\', cancelled: \'Cancelled\' };\n' +
          '// ---- end lib-mgv.js ----\n' +
          '// ---- lib-dash.js: everything the owner dashboard shows, from the sheet tabs ----\n' +
          'function dashData(T, s) {\n' +
          '  const book = {};\n' +
          '  for (const r of T[\'Price Book\'] || []) if (r.code && (r.active === \'\' || truthy(r.active))) book[String(r.code).toUpperCase()] = { code: String(r.code).toUpperCase(), category: r.category, item: r.item, unit: r.unit, unit_price: Number(r.unit_price) || 0, labour_days: Number(r.labour_days) || 0, min_qty: Number(r.min_qty) || 0 };\n' +
          '  const events = {};\n' +
          '  for (const e of (T.Events || []).slice().sort((a, b) => String(a.at) < String(b.at) ? -1 : 1)) (events[e.quote_id] = events[e.quote_id] || []).push({ at: e.at, event: e.event, detail: e.detail, actor: e.actor });\n' +
          '  const quotes = (T.Quotes || []).map(quoteOf).map(q => {\n' +
          '    const o = Object.assign({}, q);\n' +
          '    for (const k of Object.keys(o)) if (/_json$/.test(k) || k === \'_row\') delete o[k];\n' +
          '    if (o.sign_meta) o.sign_meta = { fingerprint: o.sign_meta.fingerprint, signed_at: o.sign_meta.signed_at };\n' +
          '    if (isExpired(q)) o.status = \'expired\';\n' +
          '    return o;\n' +
          '  });\n' +
          '  return {\n' +
          '    key: s.dashboard_key, now: nowIso(), today: nowDt().toISODate(), formUrl: \'../../form/mossgrove-site-visit\',\n' +
          '    settings: { company: s.company, mode: s.mode === \'live\' ? \'live\' : \'test\', vat_rate: Number(s.vat_rate === \'\' ? 0.2 : s.vat_rate), deposit_pct: Number(s.deposit_pct) || 25, payment_days: Number(s.payment_days) || 7, owner_name: s.owner_name, crews: String(s.crews || \'Crew A\').split(\',\').map(c => c.trim()).filter(Boolean) },\n' +
          '    book, quotes, events,\n' +
          '    schedule: (T.Schedule || []).filter(e => e.start && e.end).map(e => ({ entry_id: e.entry_id, quote_id: e.quote_id, title: e.title, start: String(e.start).slice(0, 10), end: String(e.end).slice(0, 10), crew: e.crew, kind: e.kind }))\n' +
          '  };\n' +
          '}\n' +
          '// ---- end lib-dash.js ----\n' +
          'const T = tablesOf($(\'Load All (After)\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'const r = $(\'Plan Owner Action\').first().json.plan.result;\n' +
          'return [{ json: { ok: true, message: r.message, data: dashData(T, s) } }];\n'
        )
  } },
  output: [{ ok: true, message: 'Sent', data: {} }]
});

const sendResult = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Result', position: [1740, 560], parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: {} } }
});

const refuse = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Refuse', position: [1080, 760], parameters: { respondWith: 'json', responseBody: expr('{{ { ok: false, message: $json.message } }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

// Test inbox
const inboxHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Inbox Request', position: [200, 1000], parameters: { httpMethod: 'GET', path: 'mossgrove/outbox', responseMode: 'responseNode', options: {} } },
  output: [{ query: { key: 'k' } }]
});

const loadOutbox = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Outbox',
    position: [420, 1000],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/1754F1Rep-Rg9J3x6Dnga0fjTeSR4zfaLOS_zD7Zp1J4/values:batchGet?ranges=Settings&ranges=Outbox&valueRenderOption=UNFORMATTED_VALUE', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const buildInbox = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Inbox', position: [640, 1000], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Test mode keeps emails in the Outbox tab instead of sending them; this page shows them like an inbox\n' +
          '// (newest first). Same key as the dashboard.\n' +
          '// ---- lib-mgv.js (included by build.py): shared helpers for the Mossgrove workflows ----\n' +
          'const TZ = \'Europe/London\';\n' +
          'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
          'const parseJson = (s, d) => { try { return typeof s === \'string\' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
          'const nowDt = () => DateTime.now().setZone(TZ);\n' +
          'const nowIso = () => nowDt().set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });\n' +
          'const toDt = iso => DateTime.fromISO(String(iso), { zone: TZ });\n' +
          'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
          'const round2 = n => Math.round((Number(n) || 0) * 100) / 100;\n' +
          'const money = n => \'£\' + round2(n).toLocaleString(\'en-GB\', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n' +
          'const day = iso => iso ? toDt(iso).toFormat(\'d LLL yyyy\') : \'\';\n' +
          'const dayLong = iso => iso ? toDt(iso).toFormat(\'cccc d LLLL\') : \'\';\n' +
          'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
          'const qtyText = n => (Math.round(Number(n) * 10) / 10).toLocaleString(\'en-GB\');\n' +
          'const unitText = (u, n) => u === \'each\' ? \'\' : (u === \'metre\' ? (Number(n) === 1 ? \'metre\' : \'metres\') : u);\n' +
          'const COLUMNS = {"Settings": ["key", "value", "note"], "Price Book": ["code", "category", "item", "unit", "unit_price", "labour_days", "min_qty", "notes", "active"], "Quotes": ["quote_id", "token", "status", "client_name", "client_email", "client_phone", "site_address", "postcode", "job_title", "summary", "visit_notes", "transcript", "lines_json", "extras_json", "custom_json", "assumptions_json", "questions_json", "flags_json", "subtotal", "vat", "total", "deposit", "labour_days", "version", "estimator", "created_at", "build_ms", "sent_at", "valid_until", "viewed_at", "view_count", "accepted_at", "signed_name", "sign_meta_json", "chosen_extras_json", "accepted_subtotal", "accepted_vat", "accepted_total", "deposit_due", "deposit_paid_at", "job_start", "job_end", "crew", "completed_at", "invoice_id", "balance_due", "balance_paid_at", "review_sent_at", "declined_at", "decline_reason", "reminders_sent", "last_reminder_at", "messages_json", "updated_at"], "Events": ["at", "quote_id", "event", "detail", "actor"], "Payments": ["payment_id", "quote_id", "kind", "amount", "status", "provider", "provider_ref", "created_at", "paid_at"], "Schedule": ["entry_id", "quote_id", "title", "start", "end", "crew", "kind", "notes"], "Outbox": ["at", "to", "subject", "kind", "quote_id", "links", "html"]};\n' +
          '\n' +
          '// Sheets API values:batchGet response → { \'Tab name\': [ { column: value, _row } ] } (blank rows dropped)\n' +
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
          'const truthy = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());\n' +
          'function bookOf(rows) {\n' +
          '  const b = {};\n' +
          '  for (const r of rows || []) if (r.code && (r.active === \'\' || truthy(r.active))) b[String(r.code).trim().toUpperCase()] = r;\n' +
          '  return b;\n' +
          '}\n' +
          '\n' +
          '// A quote row with its JSON columns parsed\n' +
          'function quoteOf(row) {\n' +
          '  if (!row) return null;\n' +
          '  const q = Object.assign({}, row);\n' +
          '  for (const k of [\'lines\', \'extras\', \'custom\', \'assumptions\', \'questions\', \'flags\', \'chosen_extras\', \'messages\', \'sign_meta\']) q[k] = parseJson(row[k + \'_json\'], k === \'sign_meta\' ? {} : []);\n' +
          '  for (const k of [\'subtotal\', \'vat\', \'total\', \'deposit\', \'labour_days\', \'view_count\', \'accepted_subtotal\', \'accepted_vat\', \'accepted_total\', \'deposit_due\', \'balance_due\', \'reminders_sent\', \'version\']) q[k] = Number(row[k]) || 0;\n' +
          '  return q;\n' +
          '}\n' +
          '\n' +
          '// ---- Pricing: the AI picks items and quantities; prices always come from the price book ----\n' +
          'function priceEntry(e, book) {\n' +
          '  const b = book[String(e.code || \'\').trim().toUpperCase()];\n' +
          '  if (!b) return null;\n' +
          '  let qty = Math.max(Number(e.quantity) || 0, 0);\n' +
          '  const min = Number(b.min_qty) || 0;\n' +
          '  const minApplied = qty > 0 && min > 0 && qty < min;\n' +
          '  if (minApplied) qty = min;\n' +
          '  qty = Math.round(qty * 10) / 10;\n' +
          '  const unitPrice = Number(b.unit_price) || 0;\n' +
          '  return {\n' +
          '    code: String(b.code).toUpperCase(), item: b.item, category: b.category, unit: b.unit, quantity: qty,\n' +
          '    unit_price: unitPrice, amount: round2(qty * unitPrice), labour_days: round2(qty * (Number(b.labour_days) || 0)),\n' +
          '    label: String(e.label || \'\'), evidence: String(e.evidence || \'\'), why: String(e.why || \'\'), min_applied: minApplied\n' +
          '  };\n' +
          '}\n' +
          '\n' +
          'function priceQuote(draft, book, s) {\n' +
          '  const flags = [];\n' +
          '  const lines = [], extras = [], custom = [];\n' +
          '  for (const e of draft.lines || []) {\n' +
          '    const p = priceEntry(e, book);\n' +
          '    if (!p) { custom.push({ description: String(e.label || e.code), quantity: Number(e.quantity) || 1, unit: \'each\', unit_price: null, why: \'Code \' + e.code + \' is not in the price book\' }); flags.push({ level: \'warn\', text: \'Code \' + e.code + \' is not in the price book, so it was moved to custom items.\' }); continue; }\n' +
          '    if (!p.quantity) { flags.push({ level: \'warn\', text: p.item + \' had no quantity and was left out.\' }); continue; }\n' +
          '    if (p.min_applied) flags.push({ level: \'info\', text: p.item + \': minimum of \' + qtyText(p.quantity) + \' \' + unitText(p.unit, p.quantity) + \' applied.\' });\n' +
          '    lines.push(p);\n' +
          '  }\n' +
          '  for (const e of draft.extras || []) { const p = priceEntry(e, book); if (p && p.quantity) extras.push(p); }\n' +
          '  for (const c of draft.custom_items || draft.custom || []) {\n' +
          '    const price = c.unit_price === null || c.unit_price === undefined || c.unit_price === \'\' ? null : Number(c.unit_price);\n' +
          '    const qty = Number(c.quantity) || 1;\n' +
          '    custom.push({ description: String(c.description || \'\'), quantity: qty, unit: String(c.unit || \'each\'), unit_price: price, amount: price === null ? null : round2(qty * price), labour_days: Number(c.labour_days) || 0, why: String(c.why || \'\') });\n' +
          '  }\n' +
          '  const unpriced = custom.filter(c => c.unit_price === null || isNaN(c.unit_price));\n' +
          '  if (unpriced.length) flags.push({ level: \'warn\', text: unpriced.length + (unpriced.length === 1 ? \' item isn\\\'t\' : \' items aren\\\'t\') + \' in the price book. Add a price before sending.\' });\n' +
          '  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0) + custom.reduce((a, c) => a + (c.amount || 0), 0));\n' +
          '  const vatRate = Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate);\n' +
          '  const vat = round2(subtotal * vatRate);\n' +
          '  const total = round2(subtotal + vat);\n' +
          '  const deposit = round2(total * (Number(s.deposit_pct) || 25) / 100);\n' +
          '  const labour = round2(lines.reduce((a, l) => a + l.labour_days, 0) + custom.reduce((a, c) => a + (c.labour_days || 0), 0));\n' +
          '  if (total >= (Number(s.big_job) || 15000)) flags.push({ level: \'info\', text: \'Large job (\' + money(total) + \'). Double-check the measurements before sending.\' });\n' +
          '  if (!lines.length && !custom.length) flags.push({ level: \'warn\', text: \'No priced lines yet. Add items before sending.\' });\n' +
          '  return { lines, extras, custom, subtotal, vat, total, deposit, labour_days: labour, flags };\n' +
          '}\n' +
          '\n' +
          '// Totals once the client has picked optional extras\n' +
          'function acceptedTotals(q, chosenCodes, s) {\n' +
          '  const chosen = (q.extras || []).filter(x => chosenCodes.includes(x.code));\n'
        ) +
        (
          '  const subtotal = round2(Number(q.subtotal) + chosen.reduce((a, x) => a + x.amount, 0));\n' +
          '  const vat = round2(subtotal * Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate));\n' +
          '  const total = round2(subtotal + vat);\n' +
          '  return { chosen, subtotal, vat, total, deposit: round2(total * (Number(s.deposit_pct) || 25) / 100), labour_days: round2(Number(q.labour_days) + chosen.reduce((a, x) => a + x.labour_days, 0)) };\n' +
          '}\n' +
          'const jobDays = labour => Math.max(1, Math.ceil(Number(labour) - 0.25));\n' +
          '\n' +
          '// ---- Links ----\n' +
          'const baseUrl = s => String(s.base_url || \'http://localhost:5678\').replace(/\\/$/, \'\');\n' +
          'const quoteUrl = (s, token) => baseUrl(s) + \'/webhook/mossgrove/quote?t=\' + token;\n' +
          'const pdfUrl = (s, token, doc) => baseUrl(s) + \'/webhook/mossgrove/pdf?t=\' + token + \'&doc=\' + (doc || \'quote\');\n' +
          'const payUrl = (s, token, kind) => baseUrl(s) + \'/webhook/mossgrove/pay?t=\' + token + \'&kind=\' + kind;\n' +
          'const dashboardUrl = s => baseUrl(s) + \'/webhook/mossgrove/dashboard?key=\' + encodeURIComponent(s.dashboard_key || \'\');\n' +
          '\n' +
          '// ---- Emails and plain pages ----\n' +
          'function button(url, label) {\n' +
          '  return \'<p style="margin:22px 0;text-align:left"><a href="\' + esc(url) + \'" style="display:inline-block;background:#1f4d3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">\' + esc(label) + \'</a></p>\';\n' +
          '}\n' +
          'function emailHtml(s, paragraphs, extraHtml) {\n' +
          '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
          '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1d2a24;max-width:560px;text-align:left">\'\n' +
          '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin:0 0 18px">\' + esc(s.company || \'Mossgrove Landscapes\') + \'</div>\'\n' +
          '    + p + (extraHtml || \'\')\n' +
          '    + \'<p style="margin:26px 0 0;color:#6b7a72;font-size:12px;text-align:left">\' + esc(s.company_legal || s.company || \'\') + \' · \' + esc(s.company_phone || \'\') + \'</p></div>\';\n' +
          '}\n' +
          'function pageHtml(s, title, bodyHtml) {\n' +
          '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>\' + esc(title) + \' · \' + esc(s.company || \'Mossgrove Landscapes\') + \'</title>\'\n' +
          '    + \'<style>body{margin:0;background:#f4f1ea;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2a24}\'\n' +
          '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #e3ddd0;border-radius:18px;padding:32px 30px;box-shadow:0 8px 28px rgba(31,77,58,.07)}\'\n' +
          '    + \'.brand{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin-bottom:20px}\'\n' +
          '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4b44;margin:0 0 12px}a.btn{display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;margin-top:8px}\'\n' +
          '    + \'.muted{color:#6b7a72;font-size:14px}</style></head><body><div class="card">\'\n' +
          '    + \'<div class="brand"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M2 32C2 14 14 2 32 2c0 18-12 30-30 30z" fill="#7bb661"/><path d="M5 29L27 7" stroke="#1f4d3a" stroke-width="2"/></svg>\' + esc(s.company || \'Mossgrove Landscapes\') + \'</div>\'\n' +
          '    + \'<h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
          '}\n' +
          '\n' +
          '// ---- Plans: decide everything in code, then Mossgrove 7: Save Changes writes it ----\n' +
          'function emptyPlan(s) { return { mode: s.mode === \'live\' ? \'live\' : \'test\', quote_inserts: [], quote_updates: [], events: [], payments: [], schedule: [], emails: [], result: { ok: true } }; }\n' +
          'const eventRow = (quote_id, event, detail, actor) => ({ at: nowIso(), quote_id, event, detail: String(detail || \'\'), actor: actor || \'system\' });\n' +
          'const emailItem = (to, subject, html, kind, quote_id, links, attach, token) => ({ to, subject, html, kind, quote_id, links: (links || []).join(\' \'), attach: attach || \'\', token: token || \'\' });\n' +
          '// Arrays and objects go to the sheet as JSON text\n' +
          'function sheetRow(o) {\n' +
          '  const r = {};\n' +
          '  for (const [k, v] of Object.entries(o)) if (k !== \'_row\') r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
          '  return r;\n' +
          '}\n' +
          '\n' +
          '// Working days (Mon–Fri) from a date, inclusive of the start\n' +
          'function addWorkdays(start, n) {\n' +
          '  let d = start, left = n - 1;\n' +
          '  while (left > 0) { d = d.plus({ days: 1 }); if (d.weekday <= 5) left--; }\n' +
          '  return d;\n' +
          '}\n' +
          '// Earliest start (after the lead time) where one crew has the whole job free\n' +
          'function nextSlot(schedule, s, days) {\n' +
          '  const crews = String(s.crews || \'Crew A\').split(\',\').map(c => c.trim()).filter(Boolean);\n' +
          '  const busy = (schedule || []).filter(e => e.start && e.end).map(e => ({ crew: String(e.crew), start: String(e.start).slice(0, 10), end: String(e.end).slice(0, 10) }));\n' +
          '  let d = nowDt().startOf(\'day\').plus({ days: Number(s.lead_days) || 7 });\n' +
          '  for (let i = 0; i < 180; i++, d = d.plus({ days: 1 })) {\n' +
          '    if (d.weekday > 5) continue;\n' +
          '    const end = addWorkdays(d, days);\n' +
          '    const a = d.toISODate(), b = end.toISODate();\n' +
          '    for (const crew of crews) {\n' +
          '      if (!busy.some(x => x.crew === crew && !(x.end < a || x.start > b))) return { crew, start: a, end: b };\n' +
          '    }\n' +
          '  }\n' +
          '  return null;\n' +
          '}\n' +
          '\n' +
          '// A payment arrived (card, test checkout or bank transfer the owner recorded)\n' +
          'function planPayment(plan, q, kind, provider, ref, T, s, actor) {\n' +
          '  const amount = kind === \'deposit\' ? q.deposit_due : q.balance_due;\n' +
          '  const at = nowIso();\n' +
          '  plan.payments.push({ payment_id: \'PAY-\' + newToken(8).toUpperCase(), quote_id: q.quote_id, kind, amount, status: \'paid\', provider, provider_ref: ref || \'\', created_at: at, paid_at: at });\n' +
          '  const links = [quoteUrl(s, q.token)];\n' +
          '  if (kind === \'deposit\') {\n' +
          '    const slot = nextSlot(T.Schedule, s, jobDays(q.labour_days));\n' +
          '    const upd = { quote_id: q.quote_id, status: \'scheduled\', deposit_paid_at: at, updated_at: at };\n' +
          '    let when = \'We\\\'ll be in touch shortly with your start date.\';\n' +
          '    if (slot) {\n' +
          '      Object.assign(upd, { job_start: slot.start, job_end: slot.end, crew: slot.crew });\n' +
          '      plan.schedule.push({ entry_id: \'JOB-\' + q.quote_id, quote_id: q.quote_id, title: q.client_name.split(\' \').slice(-1)[0] + \': \' + q.job_title, start: slot.start, end: slot.end, crew: slot.crew, kind: \'job\', notes: q.site_address });\n' +
          '      const n = jobDays(q.labour_days);\n' +
          '      when = \'We\\\'ve booked you in to start on <b>\' + esc(dayLong(slot.start)) + \'</b>, for about \' + n + \' working day\' + (n === 1 ? \'\' : \'s\') + \'. We\\\'ll confirm the arrival time the week before.\';\n' +
          '    }\n' +
          '    plan.quote_updates.push(upd);\n' +
          '    plan.events.push(eventRow(q.quote_id, \'deposit_paid\', money(amount) + \' via \' + provider + (slot ? \'; booked \' + slot.crew + \' from \' + slot.start + \' to \' + slot.end : \'; no free slot found\'), actor));\n' +
          '    plan.emails.push(emailItem(q.client_email, \'You\\\'re booked in: \' + q.job_title, emailHtml(s, [\n' +
          '      \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '      \'Thank you, we\\\'ve received your deposit of <b>\' + money(amount) + \'</b>.\',\n' +
          '      when\n' +
          '    ], button(quoteUrl(s, q.token), \'View your booking\')), \'deposit_receipt\', q.quote_id, links, \'quote\', q.token));\n' +
          '    plan.emails.push(emailItem(s.owner_email, \'Deposit paid: \' + q.quote_id + \' \' + q.client_name + \' (\' + money(amount) + \')\', emailHtml(s, [\n' +
          '      esc(q.client_name) + \' paid the \' + money(amount) + \' deposit for <b>\' + esc(q.job_title) + \'</b>.\',\n' +
          '      slot ? \'Booked for \' + esc(slot.crew) + \', \' + esc(day(slot.start)) + \' to \' + esc(day(slot.end)) + \'.\' : \'<b>No free slot was found in the next six months.</b> Please book it by hand.\'\n' +
          '    ], button(dashboardUrl(s), \'Open the dashboard\')), \'owner_deposit\', q.quote_id, links));\n' +
          '    return slot;\n' +
          '  }\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, status: \'paid\', balance_paid_at: at, updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, \'balance_paid\', money(amount) + \' via \' + provider, actor));\n'
        ) +
        (
          '  plan.emails.push(emailItem(q.client_email, \'Payment received, thank you (\' + q.invoice_id + \')\', emailHtml(s, [\n' +
          '    \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '    \'Thank you for your payment of <b>\' + money(amount) + \'</b>. Your invoice \' + esc(q.invoice_id) + \' is now paid in full; the receipt is attached.\',\n' +
          '    \'Enjoy the garden!\'\n' +
          '  ], button(pdfUrl(s, q.token, \'receipt\'), \'Download your receipt\')), \'balance_receipt\', q.quote_id, [pdfUrl(s, q.token, \'receipt\')], \'receipt\', q.token));\n' +
          '  plan.emails.push(emailItem(s.owner_email, \'Paid in full: \' + q.quote_id + \' \' + q.client_name + \' (\' + money(amount) + \')\', emailHtml(s, [\n' +
          '    esc(q.client_name) + \' paid the final \' + money(amount) + \' for <b>\' + esc(q.job_title) + \'</b>. The job is closed; a review request goes out in two days.\'\n' +
          '  ]), \'owner_paid\', q.quote_id, links));\n' +
          '  return null;\n' +
          '}\n' +
          '\n' +
          '// OpenAI Responses API result → the JSON object the model returned, or null\n' +
          'function aiJson(res) {\n' +
          '  if (!res || res.error) return null;\n' +
          '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
          '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
          '  let t = part ? part.text : null;\n' +
          '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
          '  return t && typeof t === \'object\' ? t : null;\n' +
          '}\n' +
          '\n' +
          '// Full page for the estimator\'s form results (the n8n form shows it instead of its own page)\n' +
          'function formPage(title, bodyHtml) {\n' +
          '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
          '    + \'<style>body{margin:0;background:#f4f1ea;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2a24}\'\n' +
          '    + \'.wrap{max-width:640px;margin:36px auto;padding:0 16px}.card{background:#fff;border:1px solid #e3ddd0;border-radius:18px;padding:28px 26px;box-shadow:0 8px 28px rgba(31,77,58,.07)}\'\n' +
          '    + \'.brand{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin-bottom:16px}\'\n' +
          '    + \'h1{font-size:22px;margin:0 0 6px;letter-spacing:-.3px}.sub{color:#5c6b63;margin:0 0 18px}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:8px 0;border-bottom:1px solid #eee8dc;vertical-align:top}td.r{text-align:right;white-space:nowrap;padding-left:12px}\'\n' +
          '    + \'.lbl{color:#76847c;font-size:13px}.tot td{border:0;font-weight:700;font-size:17px;padding-top:12px}.flag{background:#fff7e6;border:1px solid #f3dfb2;border-radius:10px;padding:9px 12px;margin:8px 0;font-size:14px}.flag.info{background:#eef5f0;border-color:#d3e6d8}\'\n' +
          '    + \'a.btn{display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;margin:14px 10px 0 0}a.ghost{background:#fff;color:#1f4d3a;border:1px solid #c9d8cd}ul{padding-left:20px;margin:6px 0}\'\n' +
          '    + \'</style></head><body><div class="wrap"><div class="card"><div class="brand"><svg width="20" height="20" viewBox="0 0 34 34"><path d="M2 32C2 14 14 2 32 2c0 18-12 30-30 30z" fill="#7bb661"/><path d="M5 29L27 7" stroke="#1f4d3a" stroke-width="2"/></svg>Mossgrove Landscapes</div>\'\n' +
          '    + \'<h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></div></body></html>\';\n' +
          '}\n' +
          '\n' +
          '// The client\'s terms, also printed on the PDF\n' +
          'function quoteTerms(q, s) {\n' +
          '  return [\n' +
          '    \'Prices include VAT at \' + Math.round(Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate) * 100) + \'% and are valid until \' + (day(q.valid_until) || \'the date shown\') + \'. A \' + (Number(s.deposit_pct) || 25) + \'% deposit books your start date; the balance is due within \' + (Number(s.payment_days) || 7) + \' days of completion.\',\n' +
          '    \'We remove all waste from the job. If we find something we could not see at the survey (such as buried concrete or old drains), we agree any extra cost with you before doing the work.\',\n' +
          '    \'New plants and turf are guaranteed for 3 months if watered as advised; paving and fencing workmanship for 5 years.\'\n' +
          '  ];\n' +
          '}\n' +
          'const isExpired = q => q.status === \'sent\' && q.valid_until && toDt(q.valid_until) < nowDt();\n' +
          '\n' +
          'const STATUS_LABEL = { draft: \'Draft\', sent: \'Sent\', accepted: \'Accepted\', scheduled: \'Booked\', completed: \'Invoiced\', paid: \'Paid\', declined: \'Declined\', expired: \'Expired\', cancelled: \'Cancelled\' };\n' +
          '// ---- end lib-mgv.js ----\n' +
          'const PAGE =\n' +
          '"<!doctype html>\\n<html lang=\\"en\\">\\n<head>\\n<meta charset=\\"utf-8\\">\\n<meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\">\\n<meta name=\\"robots\\" content=\\"noindex\\">\\n<title>Test inbox</title>\\n<style>\\n*{box-sizing:border-box}\\nbody{margin:0;background:#eef0f3;font:14px/1.5 -apple-system,\\"Segoe UI\\",Helvetica,Arial,sans-serif;color:#1c2430}\\n.bar{background:#1c2430;color:#fff;padding:12px 20px;display:flex;align-items:center;gap:12px;font-weight:600}\\n.bar span{font-weight:400;color:#aab3c2;font-size:13px}\\n.wrap{display:grid;grid-template-columns:380px 1fr;height:calc(100vh - 46px)}\\n.list{overflow:auto;border-right:1px solid #d9dde4;background:#f7f8fa}\\n.m{padding:12px 16px;border-bottom:1px solid #e3e6eb;cursor:pointer}\\n.m:hover{background:#fff}\\n.m.on{background:#fff;box-shadow:inset 3px 0 0 #3b82f6}\\n.m .s{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\\n.m .t{font-size:12.5px;color:#6b7686;display:flex;justify-content:space-between;gap:8px}\\n.k{font-size:11px;font-weight:600;background:#e6eaf0;border-radius:6px;padding:1px 7px;color:#4a5566}\\n.view{overflow:auto;padding:24px}\\n.mail{max-width:760px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.08);overflow:hidden}\\n.head{padding:18px 24px;border-bottom:1px solid #eceff3}\\n.head h1{font-size:19px;margin:0 0 10px}\\n.head .r{font-size:13px;color:#5b6676;margin:2px 0}\\n.head .r b{color:#1c2430;font-weight:600;display:inline-block;width:52px}\\n.body{padding:26px 28px 34px}\\n.empty{padding:40px;text-align:center;color:#6b7686}\\n@media (max-width:800px){.wrap{grid-template-columns:1fr;height:auto}.list{max-height:40vh}}\\n</style>\\n</head>\\n<body>\\n<div class=\\"bar\\">Test inbox <span id=\\"sub\\"></span></div>\\n<div class=\\"wrap\\"><div class=\\"list\\" id=\\"list\\"></div><div class=\\"view\\" id=\\"view\\"></div></div>\\n<script>\\nvar D = /*__DATA__*/null;\\n(function () {\\n  if (!D) return;\\n  var $ = function (id) { return document.getElementById(id); };\\n  var esc = function (s) { return String(s == null ? \'\' : s).replace(/[&<>\\"]/g, function (c) { return { \'&\': \'&amp;\', \'<\': \'&lt;\', \'>\': \'&gt;\', \'\\"\': \'&quot;\' }[c]; }); };\\n  var when = function (iso) { return iso ? new Date(iso).toLocaleString(\'en-GB\', { day: \'numeric\', month: \'short\', hour: \'2-digit\', minute: \'2-digit\' }) : \'\'; };\\n  $(\'sub\').textContent = D.company + \' · \' + D.mails.length + \' emails that test mode kept instead of sending\';\\n  var sel = Math.min(D.selected || 0, D.mails.length - 1);\\n  function show() {\\n    $(\'list\').innerHTML = D.mails.length ? D.mails.map(function (m, i) { return \'<div class=\\"m\' + (i === sel ? \' on\' : \'\') + \'\\" data-i=\\"\' + i + \'\\"><div class=\\"s\\">\' + esc(m.subject) + \'</div><div class=\\"t\\"><span>\' + esc(m.to) + \'</span><span>\' + when(m.at) + \'</span></div><span class=\\"k\\">\' + esc(m.kind) + \'</span></div>\'; }).join(\'\') : \'<div class=\\"empty\\">No emails yet.</div>\';\\n    var m = D.mails[sel];\\n    $(\'view\').innerHTML = m ? \'<div class=\\"mail\\"><div class=\\"head\\"><h1>\' + esc(m.subject) + \'</h1><div class=\\"r\\"><b>From</b>\' + esc(D.from) + \'</div><div class=\\"r\\"><b>To</b>\' + esc(m.to) + \'</div><div class=\\"r\\"><b>Date</b>\' + when(m.at) + \'</div></div><div class=\\"body\\">\' + m.html + \'</div></div>\' : \'\';\\n  }\\n  document.addEventListener(\'click\', function (e) { var r = e.target.closest(\'[data-i]\'); if (r) { sel = +r.getAttribute(\'data-i\'); show(); } });\\n  show();\\n})();\\n</script>\\n</body>\\n</html>\\n"\n' +
          ';\n' +
          'const query = $(\'Inbox Request\').first().json.query || {};\n' +
          'const T = tablesOf($(\'Load Outbox\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'if (!s.dashboard_key || String(query.key || \'\') !== String(s.dashboard_key)) return [{ json: { code: 403, html: pageHtml(s, \'Wrong link\', \'<p>This link is not valid.</p>\') } }];\n' +
          'const mails = (T.Outbox || []).slice().reverse().map(m => ({ at: m.at, to: m.to, subject: m.subject, kind: m.kind, html: String(m.html || \'\') }));\n' +
          'const data = { company: s.company, from: (s.company || \'Mossgrove Landscapes\') + \' <\' + (s.company_email || \'hello@mossgrove.example\') + \'>\', selected: Number(query.i) || 0, mails };\n' +
          'return [{ json: { code: 200, html: PAGE.replace(\'/*__DATA__*/null\', JSON.stringify(data).replace(/</g, \'\\\\u003c\')) } }];\n'
        )
  } },
  output: [{ code: 200, html: '<html></html>' }]
});

const sendInbox = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Inbox', position: [860, 1000], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

const note = sticky(
  '## Mossgrove 2: Owner Dashboard\nThe owner\'s page (`/webhook/mossgrove/dashboard?key=…`, key in the **Settings** tab): pipeline numbers, every quote with its next step, the AI draft with its checks, an editor (lines are repriced from the price book on save), the client\'s signature and payments, the history, and both crews\' calendars. **Inbox Request** shows the test-mode Outbox as an inbox. Buttons post to **Owner Action**: save, send, withdraw, record a bank transfer (books the job), and "job done" (sends the final invoice). Each action is decided in code and written by **Mossgrove 7: Save Changes**; the page gets fresh data back.',
  [], { position: [160, 0], width: 1380, height: 190, color: 7 }
);

export default workflow('mossgrove-dashboard', 'Mossgrove 2: Owner Dashboard')
  .add(pageHook)
  .to(loadAll)
  .to(buildPage)
  .to(sendPage)
  .add(actionHook)
  .to(loadAction)
  .to(planAction)
  .to(allowed
    .onTrue(saveAction.to(loadAfter.to(actionResult.to(sendResult))))
    .onFalse(refuse))
  .add(inboxHook)
  .to(loadOutbox)
  .to(buildInbox)
  .to(sendInbox)
  .add(note);
