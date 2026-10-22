import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'mgvSaveChange007', cachedResultName: 'Mossgrove 7: Save Changes' };
const LOAD_URL = 'https://sheets.googleapis.com/v4/spreadsheets/1754F1Rep-Rg9J3x6Dnga0fjTeSR4zfaLOS_zD7Zp1J4/values:batchGet?ranges=Settings&ranges=Quotes&valueRenderOption=UNFORMATTED_VALUE';
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };
const IS_OK = { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' };

// Page
const pageHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Quote Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'mossgrove/quote', responseMode: 'responseNode', options: {} } },
  output: [{ query: { t: 'abc' }, headers: { 'user-agent': 'Mozilla/5.0' } }]
});

const loadQuote = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote',
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
          '// The client\'s quote page: the quote with live extras, accept-and-sign, questions, and the next step\n' +
          '// (pay the deposit, booking, final invoice, receipt). Also works out the view log (first view emails the owner).\n' +
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
          '"<!doctype html>\\n<html lang=\\"en\\">\\n<head>\\n<meta charset=\\"utf-8\\">\\n<meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\">\\n<meta name=\\"robots\\" content=\\"noindex\\">\\n<title>Your quote · Mossgrove Landscapes</title>\\n<link rel=\\"preconnect\\" href=\\"https://fonts.googleapis.com\\">\\n<link rel=\\"preconnect\\" href=\\"https://fonts.gstatic.com\\" crossorigin>\\n<link href=\\"https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap\\" rel=\\"stylesheet\\">\\n<style>\\n:root{--moss:#1f4d3a;--moss2:#173b2c;--leaf:#7bb661;--leafsoft:#e8f3e3;--cream:#f4f1ea;--paper:#fffdf8;--ink:#1d2a24;--body:#3d4b44;--muted:#6f7d75;--line:#e6e0d3;--warn:#a5671a;--warnbg:#fff6e5;--red:#a23b2a}\\n*{box-sizing:border-box}\\nhtml,body{margin:0}\\nbody{background:var(--cream);color:var(--ink);font:15.5px/1.6 Inter,-apple-system,\\"Segoe UI\\",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}\\na{color:var(--moss)}\\n.top{background:var(--moss);color:#fff}\\n.top .in{max-width:1080px;margin:0 auto;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}\\n.brand{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:.2px}\\n.brand b{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:19px;letter-spacing:.1px}\\n.top .ref{font-size:13px;color:#cfe3d3}\\n.steps{background:var(--moss2);color:#cfe3d3}\\n.steps ol{max-width:1080px;margin:0 auto;padding:10px 20px 12px;display:flex;gap:6px;list-style:none;overflow-x:auto;font-size:12.5px}\\n.steps li{display:flex;align-items:center;gap:7px;white-space:nowrap;padding-right:12px}\\n.steps li .dot{width:18px;height:18px;border-radius:50%;border:1.5px solid #5f8a72;display:grid;place-items:center;font-size:11px;color:#cfe3d3}\\n.steps li.done .dot{background:var(--leaf);border-color:var(--leaf);color:var(--moss2)}\\n.steps li.now{color:#fff;font-weight:600}\\n.steps li.now .dot{border-color:#fff}\\n.steps li+li:before{content:\\"\\";width:18px;height:1px;background:#4b7360;margin-right:6px}\\n.wrap{max-width:1080px;margin:0 auto;padding:28px 20px 120px;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}\\n.card{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:24px 24px;box-shadow:0 1px 0 rgba(0,0,0,.02),0 10px 30px rgba(31,77,58,.05);margin-bottom:18px}\\n.eyebrow{font-size:12.5px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:var(--leaf);margin-bottom:6px}\\nh1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:34px;line-height:1.15;letter-spacing:-.4px;margin:0 0 12px}\\nh2{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:21px;letter-spacing:-.2px;margin:0 0 14px}\\n.lead{font-size:16.5px;color:var(--body);margin:0 0 16px}\\n.meta{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13.5px;color:var(--muted)}\\n.meta b{color:var(--ink);font-weight:600}\\n.lines{list-style:none;margin:0;padding:0}\\n.lines li{display:grid;grid-template-columns:1fr auto;gap:4px 16px;padding:14px 0;border-top:1px solid var(--line)}\\n.lines li:first-child{border-top:0;padding-top:4px}\\n.lines .nm{font-weight:600}\\n.lines .lb{grid-column:1;font-size:13.5px;color:var(--muted)}\\n.lines .am{font-weight:600;text-align:right;white-space:nowrap}\\n.lines .qt{grid-column:2;text-align:right;font-size:13px;color:var(--muted);white-space:nowrap}\\n.tag{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:99px;background:var(--leafsoft);color:var(--moss);margin-left:6px;vertical-align:2px}\\n.extra{display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;margin-top:10px;cursor:pointer;transition:border-color .15s,background .15s}\\n.extra:hover{border-color:#bcd3c2}\\n.extra.on{border-color:var(--leaf);background:#f3f9f0}\\n.extra input{width:20px;height:20px;accent-color:var(--moss);margin-top:2px;flex:none}\\n.extra .x{flex:1}\\n.extra .nm{font-weight:600}\\n.extra .why{font-size:13.5px;color:var(--muted)}\\n.extra .am{font-weight:600;white-space:nowrap}\\n.extra.locked{cursor:default;opacity:.65}\\n.howto{counter-reset:s;list-style:none;padding:0;margin:0;display:grid;gap:10px}\\n.howto li{counter-increment:s;display:flex;gap:12px;align-items:flex-start;color:var(--body)}\\n.howto li:before{content:counter(s);flex:none;width:26px;height:26px;border-radius:50%;background:var(--leafsoft);color:var(--moss);font-weight:700;font-size:13px;display:grid;place-items:center}\\nul.plain{margin:0;padding-left:18px;color:var(--body)}\\nul.plain li{margin:4px 0}\\ndetails{color:var(--body);font-size:14px}\\nsummary{cursor:pointer;font-weight:600;color:var(--ink)}\\ndetails ol{padding-left:18px}\\n.side{position:sticky;top:20px}\\n.sum .row{display:flex;justify-content:space-between;padding:6px 0;color:var(--body)}\\n.sum .row.total{border-top:1.5px solid var(--ink);margin-top:8px;padding-top:12px;color:var(--ink);font-weight:700;font-size:20px}\\n.sum .row.dep{color:var(--moss);font-weight:600}\\n.sum .added{font-size:13px;color:var(--moss)}\\n.btn{display:block;width:100%;border:0;border-radius:12px;padding:14px 16px;font:600 15.5px Inter,sans-serif;cursor:pointer;text-align:center;text-decoration:none;margin-top:10px;transition:transform .05s,background .15s}\\n.btn:active{transform:translateY(1px)}\\n.btn.primary{background:var(--moss);color:#fff}\\n.btn.primary:hover{background:#25604a}\\n.btn.ghost{background:#fff;color:var(--moss);border:1.5px solid #c9d8cd}\\n.btn.ghost:hover{background:#f6faf6}\\n.btn[disabled]{opacity:.5;cursor:not-allowed}\\n.links{display:flex;justify-content:space-between;margin-top:14px;font-size:13.5px}\\n.links a,.links button{color:var(--muted);background:none;border:0;font:inherit;cursor:pointer;padding:0;text-decoration:underline;text-underline-offset:3px}\\n.trust{display:flex;gap:10px;align-items:center;font-size:12.5px;color:var(--muted);margin-top:14px}\\n.banner{border-radius:16px;padding:18px 20px;margin-bottom:18px;display:flex;gap:14px;align-items:flex-start;border:1px solid}\\n.banner .ic{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:700}\\n.banner.ok{background:#eef7ea;border-color:#cfe5c6}\\n.banner.ok .ic{background:var(--leaf);color:#fff}\\n.banner.info{background:#eef3f7;border-color:#d4e0ea}\\n.banner.info .ic{background:#3e6a8a;color:#fff}\\n.banner.warn{background:var(--warnbg);border-color:#f0dbb0}\\n.banner.warn .ic{background:#d9a03f;color:#fff}\\n.banner.muted{background:#f1efe9;border-color:var(--line)}\\n.banner.muted .ic{background:#b9b3a6;color:#fff}\\n.banner h3{margin:0 0 4px;font-size:16.5px}\\n.banner p{margin:0;color:var(--body)}\\n.banner .act{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}\\n.banner .act .btn{width:auto;display:inline-block;margin:0;padding:11px 18px}\\n.mobilebar{display:none}\\nfooter{text-align:center;color:var(--muted);font-size:12.5px;padding:0 20px 40px}\\ndialog{border:0;border-radius:20px;padding:0;width:min(460px,calc(100vw - 32px));box-shadow:0 30px 80px rgba(0,0,0,.25)}\\ndialog::backdrop{background:rgba(23,40,32,.45)}\\ndialog form{padding:26px 24px 22px}\\ndialog h2{margin-bottom:6px}\\ndialog p{color:var(--body);margin:0 0 14px;font-size:14.5px}\\nlabel.f{display:block;font-weight:600;font-size:14px;margin:12px 0 6px}\\ninput.t,textarea,select{width:100%;border:1.5px solid #d8d2c4;border-radius:12px;padding:12px 14px;font:15px Inter,sans-serif;color:var(--ink);background:#fff}\\ninput.t:focus,textarea:focus,select:focus{outline:0;border-color:var(--moss)}\\ninput.sig{font-family:Fraunces,Georgia,serif;font-size:22px}\\n.check{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--body);margin:14px 0 4px}\\n.check input{width:19px;height:19px;accent-color:var(--moss);flex:none;margin-top:2px}\\n.fine{font-size:12.5px;color:var(--muted);margin-top:10px}\\n.err{color:var(--red);font-size:13.5px;min-height:18px;margin-top:8px}\\n.dlg-actions{display:flex;gap:10px;margin-top:16px}\\n.dlg-actions .btn{margin:0}\\n.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.2);z-index:9}\\n@media (max-width:860px){\\n  .wrap{grid-template-columns:1fr;padding-top:18px}\\n  .side{position:static}\\n  h1{font-size:28px}\\n  .card{padding:20px 18px;border-radius:16px}\\n  .mobilebar{display:flex;position:fixed;left:0;right:0;bottom:0;background:var(--paper);border-top:1px solid var(--line);padding:12px 16px calc(12px + env(safe-area-inset-bottom));align-items:center;justify-content:space-between;gap:12px;box-shadow:0 -8px 24px rgba(0,0,0,.06);z-index:5}\\n  .mobilebar .t{font-size:13px;color:var(--muted)}\\n  .mobilebar .t b{display:block;font-size:19px;color:var(--ink)}\\n  .mobilebar .btn{width:auto;margin:0;padding:12px 20px}\\n}\\n</style>\\n</head>\\n<body>\\n<div class=\\"top\\"><div class=\\"in\\">\\n  <div class=\\"brand\\"><svg width=\\"28\\" height=\\"28\\" viewBox=\\"0 0 34 34\\" aria-hidden=\\"true\\"><path d=\\"M2 32C2 14 14 2 32 2c0 18-12 30-30 30z\\" fill=\\"#7bb661\\"/><path d=\\"M5 29L27 7\\" stroke=\\"#1f4d3a\\" stroke-width=\\"2\\"/></svg><b id=\\"co\\">Mossgrove Landscapes</b></div>\\n  <div class=\\"ref\\" id=\\"ref\\"></div>\\n</div></div>\\n<nav class=\\"steps\\" aria-label=\\"Progress\\"><ol id=\\"steps\\"></ol></nav>\\n<div class=\\"wrap\\">\\n  <main>\\n    <div id=\\"banner\\"></div>\\n    <section class=\\"card\\">\\n      <div class=\\"eyebrow\\" id=\\"eyebrow\\"></div>\\n      <h1 id=\\"title\\"></h1>\\n      <p class=\\"lead\\" id=\\"summary\\"></p>\\n      <div class=\\"meta\\" id=\\"meta\\"></div>\\n    </section>\\n    <section class=\\"card\\">\\n      <h2>What\'s included</h2>\\n      <ul class=\\"lines\\" id=\\"lines\\"></ul>\\n    </section>\\n    <section class=\\"card\\" id=\\"extrasCard\\" hidden>\\n      <h2>Optional extras</h2>\\n      <p style=\\"margin:-6px 0 6px;color:var(--muted);font-size:14px\\" id=\\"extrasHint\\">Tick anything you\'d like added. The total updates as you go.</p>\\n      <div id=\\"extras\\"></div>\\n    </section>\\n    <section class=\\"card\\">\\n      <h2>How it works</h2>\\n      <ol class=\\"howto\\" id=\\"howto\\"></ol>\\n    </section>\\n    <section class=\\"card\\" id=\\"assumeCard\\" hidden>\\n      <h2>Good to know</h2>\\n      <ul class=\\"plain\\" id=\\"assume\\"></ul>\\n    </section>\\n    <section class=\\"card\\">\\n      <details><summary>Terms</summary><ol id=\\"terms\\"></ol></details>\\n    </section>\\n  </main>\\n  <aside class=\\"side\\">\\n    <section class=\\"card sum\\">\\n      <h2 style=\\"margin-bottom:8px\\">Your price</h2>\\n      <div class=\\"row\\"><span>Subtotal</span><span id=\\"sSub\\"></span></div>\\n      <div class=\\"row\\"><span id=\\"sVatL\\">VAT</span><span id=\\"sVat\\"></span></div>\\n      <div class=\\"added\\" id=\\"sAdded\\"></div>\\n      <div class=\\"row total\\"><span>Total</span><span id=\\"sTot\\"></span></div>\\n      <div class=\\"row dep\\"><span id=\\"sDepL\\">Deposit to book</span><span id=\\"sDep\\"></span></div>\\n      <div id=\\"actions\\"></div>\\n      <div class=\\"links\\"><a id=\\"pdfLink\\" href=\\"#\\">Download PDF</a><button type=\\"button\\" id=\\"declineBtn\\">Decline</button></div>\\n      <div class=\\"trust\\"><svg width=\\"16\\" height=\\"16\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\"><rect x=\\"4\\" y=\\"10\\" width=\\"16\\" height=\\"11\\" rx=\\"2\\"/><path d=\\"M8 10V7a4 4 0 0 1 8 0v3\\"/></svg><span>Your signature is recorded with the time and a fingerprint of this exact quote.</span></div>\\n    </section>\\n  </aside>\\n</div>\\n<div class=\\"mobilebar\\" id=\\"mobilebar\\"><div class=\\"t\\">Total<b id=\\"mTot\\"></b></div><button class=\\"btn primary\\" id=\\"mAccept\\">Accept quote</button></div>\\n<footer id=\\"foot\\"></footer>\\n\\n<dialog id=\\"dAccept\\"><form method=\\"dialog\\" id=\\"fAccept\\">\\n  <h2>Accept and sign</h2>\\n  <p id=\\"acceptText\\"></p>\\n  <label class=\\"f\\" for=\\"sigName\\">Type your full name to sign</label>\\n  <input class=\\"t sig\\" id=\\"sigName\\" autocomplete=\\"name\\" placeholder=\\"Your full name\\">\\n  <label class=\\"check\\"><input type=\\"checkbox\\" id=\\"sigAgree\\"><span id=\\"agreeText\\"></span></label>\\n  <div class=\\"err\\" id=\\"acceptErr\\"></div>\\n  <div class=\\"dlg-actions\\"><button class=\\"btn ghost\\" value=\\"cancel\\" formnovalidate>Back</button><button class=\\"btn primary\\" id=\\"acceptGo\\" value=\\"go\\">Sign and accept</button></div>\\n  <div class=\\"fine\\">Typing your name counts as your signature. We record it with the date, time and a SHA-256 fingerprint of this quote, so neither side can change it afterwards.</div>\\n</form></dialog>\\n\\n<dialog id=\\"dAsk\\"><form method=\\"dialog\\" id=\\"fAsk\\">\\n  <h2>Ask a question</h2>\\n  <p>Ask about anything, or tell us what you\'d like changed. We\'ll get back to you, usually the same day.</p>\\n  <textarea id=\\"askText\\" rows=\\"5\\" placeholder=\\"e.g. Could the path be a bit wider?\\"></textarea>\\n  <div class=\\"err\\" id=\\"askErr\\"></div>\\n  <div class=\\"dlg-actions\\"><button class=\\"btn ghost\\" value=\\"cancel\\" formnovalidate>Back</button><button class=\\"btn primary\\" id=\\"askGo\\" value=\\"go\\">Send</button></div>\\n</form></dialog>\\n\\n<dialog id=\\"dDecline\\"><form method=\\"dialog\\" id=\\"fDecline\\">\\n  <h2>Decline this quote</h2>\\n  <p>No problem. It helps us to know why (optional).</p>\\n  <select id=\\"declineReason\\">\\n    <option value=\\"\\">Choose a reason</option>\\n    <option>The price is more than I expected</option>\\n    <option>I went with another company</option>\\n    <option>I\'ve decided not to do the work</option>\\n    <option>The timing doesn\'t work for me</option>\\n    <option>Something else</option>\\n  </select>\\n  <div class=\\"err\\" id=\\"declineErr\\"></div>\\n  <div class=\\"dlg-actions\\"><button class=\\"btn ghost\\" value=\\"cancel\\" formnovalidate>Back</button><button class=\\"btn primary\\" id=\\"declineGo\\" value=\\"go\\">Decline quote</button></div>\\n</form></dialog>\\n\\n<script>\\nvar D = /*__DATA__*/null;\\n(function () {\\n  if (!D) return;\\n  var q = D.quote, $ = function (id) { return document.getElementById(id); };\\n  var gbp = function (n) { return \'£\' + (Math.round(Number(n || 0) * 100) / 100).toLocaleString(\'en-GB\', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };\\n  var esc = function (s) { return String(s == null ? \'\' : s).replace(/[&<>\\"]/g, function (c) { return { \'&\': \'&amp;\', \'<\': \'&lt;\', \'>\': \'&gt;\', \'\\"\': \'&quot;\' }[c]; }); };\\n  var unit = function (l) { var n = Math.round(l.quantity * 10) / 10; return l.unit === \'each\' ? (n + \' × \' + gbp(l.unit_price)) : (n + \' \' + (l.unit === \'metre\' ? (n === 1 ? \'metre\' : \'metres\') : l.unit) + \' × \' + gbp(l.unit_price)); };\\n  var open = q.status === \'sent\' && !q.expired && !D.preview;\\n  var chosen = (q.chosen_extras || []).slice();\\n\\n  document.title = \'Quote \' + q.quote_id + \' · \' + D.company.name;\\n  $(\'co\').textContent = D.company.name;\\n  $(\'ref\').textContent = \'Quote \' + q.quote_id;\\n  $(\'eyebrow\').textContent = \'Quote \' + q.quote_id + \' · for \' + q.client_name;\\n  $(\'title\').textContent = q.job_title;\\n  $(\'summary\').textContent = q.summary;\\n  $(\'meta\').innerHTML = [q.sent_at ? \'Issued <b>\' + esc(q.sent_day) + \'</b>\' : \'\', q.valid_until && [\'sent\', \'draft\'].indexOf(q.status) >= 0 ? \'Valid until <b>\' + esc(q.valid_day) + \'</b>\' : \'\', \'Prepared by <b>\' + esc(q.estimator) + \'</b>\', q.job_days ? \'About <b>\' + q.job_days + \' working day\' + (q.job_days === 1 ? \'\' : \'s\') + \'</b> on site\' : \'\'].filter(Boolean).map(function (x) { return \'<span>\' + x + \'</span>\'; }).join(\'\');\\n  $(\'foot\').textContent = D.company.legal + \' · \' + D.company.address + \' · \' + D.company.phone;\\n  $(\'pdfLink\').href = D.links.pdf;\\n\\n  // Progress\\n  var stages = [[\'Quote\', [\'draft\', \'sent\']], [\'Accepted\', [\'accepted\']], [\'Booked\', [\'scheduled\']], [\'Job done\', [\'completed\']], [\'Paid\', [\'paid\']]];\\n  var at = stages.findIndex(function (s) { return s[1].indexOf(q.status) >= 0; });\\n  $(\'steps\').innerHTML = stages.map(function (s, i) { var c = at < 0 ? \'\' : (i < at || q.status === \'paid\' ? \'done\' : (i === at ? \'now\' : \'\')); return \'<li class=\\"\' + c + \'\\"><span class=\\"dot\\">\' + (c === \'done\' ? \'✓\' : i + 1) + \'</span>\' + s[0] + \'</li>\'; }).join(\'\');\\n\\n  // Lines\\n  var html = q.lines.map(function (l) { return \'<li><span class=\\"nm\\">\' + esc(l.item) + \'</span><span class=\\"am\\">\' + gbp(l.amount) + \'</span><span class=\\"lb\\">\' + esc(l.label) + \'</span><span class=\\"qt\\">\' + esc(unit(l)) + \'</span></li>\'; }).join(\'\');\\n  html += (q.custom || []).map(function (c) { return \'<li><span class=\\"nm\\">\' + esc(c.description) + \'</span><span class=\\"am\\">\' + (c.amount == null ? \'\' : gbp(c.amount)) + \'</span><span class=\\"lb\\"></span><span class=\\"qt\\">\' + (c.unit_price == null ? \'\' : esc(unit(c))) + \'</span></li>\'; }).join(\'\');\\n  html += (q.extras || []).filter(function (x) { return !open && chosen.indexOf(x.code) >= 0; }).map(function (x) { return \'<li><span class=\\"nm\\">\' + esc(x.item) + \'<span class=\\"tag\\">Extra you added</span></span><span class=\\"am\\">\' + gbp(x.amount) + \'</span><span class=\\"lb\\">\' + esc(x.label) + \'</span><span class=\\"qt\\">\' + esc(unit(x)) + \'</span></li>\'; }).join(\'\');\\n  $(\'lines\').innerHTML = html;\\n\\n  // Extras\\n  var offer = (q.extras || []).filter(function (x) { return open || chosen.indexOf(x.code) < 0; });\\n  if (offer.length && (open || D.preview)) {\\n    $(\'extrasCard\').hidden = false;\\n    if (!open) $(\'extrasHint\').textContent = \'Offered with this quote.\';\\n    $(\'extras\').innerHTML = offer.map(function (x) { return \'<label class=\\"extra\' + (open ? \'\' : \' locked\') + \'\\" data-code=\\"\' + esc(x.code) + \'\\"><input type=\\"checkbox\\"\' + (open ? \'\' : \' disabled\') + \'><div class=\\"x\\"><div class=\\"nm\\">\' + esc(x.item) + \'</div><div class=\\"why\\">\' + esc(x.why || x.label) + \'</div></div><div class=\\"am\\">+\' + gbp(x.amount) + \'</div></label>\'; }).join(\'\');\\n    Array.prototype.forEach.call(document.querySelectorAll(\'.extra input\'), function (cb) {\\n      cb.addEventListener(\'change\', function () {\\n        var code = cb.closest(\'.extra\').getAttribute(\'data-code\');\\n        cb.closest(\'.extra\').classList.toggle(\'on\', cb.checked);\\n        chosen = chosen.filter(function (c) { return c !== code; });\\n        if (cb.checked) chosen.push(code);\\n        totals();\\n      });\\n    });\\n  }\\n\\n  // How it works\\n  var dep = D.settings.deposit_pct;\\n  $(\'howto\').innerHTML = [\'Pick any extras, then accept and sign online.\', \'Pay a \' + dep + \'% deposit by card to book your start date.\', \'We book the first free slot for our crew and confirm the date by email.\', \'Pay the balance within \' + D.settings.payment_days + \' days of us finishing.\'].map(function (t) { return \'<li>\' + esc(t) + \'</li>\'; }).join(\'\');\\n  if ((q.assumptions || []).length) { $(\'assumeCard\').hidden = false; $(\'assume\').innerHTML = q.assumptions.map(function (a) { return \'<li>\' + esc(a) + \'</li>\'; }).join(\'\'); }\\n  $(\'terms\').innerHTML = D.terms.map(function (t) { return \'<li>\' + esc(t) + \'</li>\'; }).join(\'\');\\n\\n  function totals() {\\n    var add = (q.extras || []).filter(function (x) { return chosen.indexOf(x.code) >= 0; });\\n    var sub = Math.round((q.subtotal + add.reduce(function (a, x) { return a + x.amount; }, 0)) * 100) / 100;\\n    var vat = Math.round(sub * D.settings.vat_rate * 100) / 100;\\n    var tot = Math.round((sub + vat) * 100) / 100;\\n    var depo = q.accepted_at ? q.deposit_due : Math.round(tot * dep) / 100;\\n    if (q.accepted_at) { sub = q.accepted_subtotal; vat = q.accepted_vat; tot = q.accepted_total; }\\n    $(\'sSub\').textContent = gbp(sub); $(\'sVat\').textContent = gbp(vat); $(\'sVatL\').textContent = \'VAT (\' + Math.round(D.settings.vat_rate * 100) + \'%)\';\\n    $(\'sTot\').textContent = gbp(tot); $(\'mTot\').textContent = gbp(tot);\\n    $(\'sDep\').textContent = gbp(depo); $(\'sDepL\').textContent = (q.deposit_paid_at ? \'Deposit paid\' : \'Deposit to book\') + \' (\' + dep + \'%)\';\\n    $(\'sAdded\').textContent = open && add.length ? \'Includes \' + add.length + \' extra\' + (add.length > 1 ? \'s\' : \'\') + \': \' + add.map(function (x) { return x.item; }).join(\', \') : \'\';\\n    $(\'acceptText\').innerHTML = \'You\\\\\'re accepting <b>\' + esc(q.job_title) + \'</b> for <b>\' + gbp(tot) + \'</b> including VAT\' + (add.length ? \', with \' + add.length + \' extra\' + (add.length > 1 ? \'s\' : \'\') : \'\') + \'. Next you can pay the \' + gbp(depo) + \' deposit to book your start date.\';\\n    $(\'agreeText\').textContent = \'I accept this quote and the terms, including the \' + dep + \'% deposit (\' + gbp(depo) + \').\';\\n  }\\n  totals();\\n\\n  // State banner and buttons\\n  var b = \'\', acts = \'\';\\n  function banner(kind, icon, title, text, buttons) { return \'<div class=\\"banner \' + kind + \'\\"><div class=\\"ic\\">\' + icon + \'</div><div><h3>\' + title + \'</h3><p>\' + text + \'</p>\' + (buttons ? \'<div class=\\"act\\">\' + buttons + \'</div>\' : \'\') + \'</div></div>\'; }\\n  if (D.preview && q.status === \'draft\') b = banner(\'info\', \'i\', \'Preview\', \'This is how the client will see the quote once you send it.\');\\n  else if (q.status === \'sent\' && q.expired) b = banner(\'muted\', \'!\', \'This quote has expired\', \'Prices may have changed since \' + esc(q.sent_day) + \'. Call us on \' + esc(D.company.phone) + \' and we\\\\\'ll update it for you.\');\\n  else if (q.status === \'accepted\') { b = banner(\'ok\', \'✓\', \'Thank you, \' + esc(q.first_name) + \'! You accepted on \' + esc(q.accepted_day), \'Pay the \' + gbp(q.deposit_due) + \' deposit to book your start date.\', \'<a class=\\"btn primary\\" href=\\"\' + esc(D.links.payDeposit) + \'\\">Pay deposit \' + gbp(q.deposit_due) + \'</a>\'); acts = \'<a class=\\"btn primary\\" href=\\"\' + esc(D.links.payDeposit) + \'\\">Pay deposit \' + gbp(q.deposit_due) + \'</a>\'; }\\n  else if (q.status === \'scheduled\') b = banner(\'ok\', \'✓\', \'You\\\\\'re booked in\', q.job_start ? \'We start on <b>\' + esc(q.start_day) + \'</b> and expect to finish by <b>\' + esc(q.end_day) + \'</b>. We\\\\\'ll confirm the arrival time the week before.\' : \'Your deposit is in. We\\\\\'ll be in touch with your start date.\');\\n  else if (q.status === \'completed\') { b = banner(\'warn\', \'£\', \'All done! Your final invoice is ready\', \'Invoice \' + esc(q.invoice_id) + \': <b>\' + gbp(q.balance_due) + \'</b> is due by \' + esc(q.due_day) + \'.\', \'<a class=\\"btn primary\\" href=\\"\' + esc(D.links.payBalance) + \'\\">Pay \' + gbp(q.balance_due) + \'</a><a class=\\"btn ghost\\" href=\\"\' + esc(D.links.invoice) + \'\\">Invoice PDF</a>\'); acts = \'<a class=\\"btn primary\\" href=\\"\' + esc(D.links.payBalance) + \'\\">Pay balance \' + gbp(q.balance_due) + \'</a>\'; }\\n  else if (q.status === \'paid\') b = banner(\'ok\', \'✓\', \'Paid in full. Thank you!\', \'We hope you enjoy the garden. Your receipt is ready.\', \'<a class=\\"btn ghost\\" href=\\"\' + esc(D.links.receipt) + \'\\">Download receipt</a>\');\\n  else if (q.status === \'declined\') b = banner(\'muted\', \'–\', \'You declined this quote\', \'Changed your mind? Call us on \' + esc(D.company.phone) + \'.\');\\n  else if (q.status === \'cancelled\') b = banner(\'muted\', \'–\', \'This quote was withdrawn\', \'Please call us on \' + esc(D.company.phone) + \' if you have any questions.\');\\n  if (D.flash) b = banner(\'ok\', \'✓\', esc(D.flash.title), esc(D.flash.text)) + b;\\n  $(\'banner\').innerHTML = b;\\n  if (open) acts = \'<button class=\\"btn primary\\" id=\\"accept\\">Accept quote</button><button class=\\"btn ghost\\" id=\\"ask\\">Ask a question</button>\';\\n  $(\'actions\').innerHTML = acts;\\n  $(\'declineBtn\').hidden = !open;\\n  if (!open) $(\'mobilebar\').style.display = \'none\';\\n  if ((q.accepted_at || q.status === \'paid\') && !acts) $(\'actions\').innerHTML = \'\';\\n\\n  function post(body, errEl, btn, done) {\\n    btn.disabled = true; $(errEl).textContent = \'\';\\n    fetch(D.links.action, { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify(Object.assign({ t: D.token }, body)) })\\n      .then(function (r) { return r.json().catch(function () { return { ok: false, message: \'Something went wrong.\' }; }); })\\n      .then(function (r) { btn.disabled = false; if (!r.ok) { $(errEl).textContent = r.message || \'Something went wrong. Please try again.\'; return; } done(r); })\\n      .catch(function () { btn.disabled = false; $(errEl).textContent = \'Could not connect. Please check your internet and try again.\'; });\\n  }\\n  function toast(t) { var d = document.createElement(\'div\'); d.className = \'toast\'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 4000); }\\n  var openAccept = function () { $(\'sigName\').value = \'\'; $(\'sigAgree\').checked = false; $(\'acceptErr\').textContent = \'\'; $(\'dAccept\').showModal(); };\\n  if (open) {\\n    $(\'accept\').onclick = openAccept; $(\'mAccept\').onclick = openAccept;\\n    $(\'ask\').onclick = function () { $(\'askErr\').textContent = \'\'; $(\'dAsk\').showModal(); };\\n  }\\n  $(\'declineBtn\').onclick = function () { $(\'dDecline\').showModal(); };\\n  $(\'acceptGo\').onclick = function (e) {\\n    e.preventDefault();\\n    var name = $(\'sigName\').value.trim();\\n    if (name.length < 3 || name.indexOf(\' \') < 0) { $(\'acceptErr\').textContent = \'Please type your first and last name.\'; return; }\\n    if (!$(\'sigAgree\').checked) { $(\'acceptErr\').textContent = \'Please tick the box to accept the terms.\'; return; }\\n    post({ action: \'accept\', name: name, agree: true, extras: chosen }, \'acceptErr\', $(\'acceptGo\'), function () { location.href = D.links.self + \'&done=accepted\'; });\\n  };\\n  $(\'askGo\').onclick = function (e) {\\n    e.preventDefault();\\n    var t = $(\'askText\').value.trim();\\n    if (t.length < 3) { $(\'askErr\').textContent = \'Please write your question.\'; return; }\\n    post({ action: \'question\', message: t }, \'askErr\', $(\'askGo\'), function () { $(\'dAsk\').close(); $(\'askText\').value = \'\'; toast(\'Thanks! We\\\\\'ll get back to you soon.\'); });\\n  };\\n  $(\'declineGo\').onclick = function (e) {\\n    e.preventDefault();\\n    post({ action: \'decline\', reason: $(\'declineReason\').value }, \'declineErr\', $(\'declineGo\'), function () { location.href = D.links.self + \'&done=declined\'; });\\n  };\\n})();\\n</script>\\n</body>\\n</html>\\n"\n' +
          ';\n' +
          'const query = $(\'Quote Request\').first().json.query || {};\n' +
          'const headers = $(\'Quote Request\').first().json.headers || {};\n' +
          'const T = tablesOf($(\'Load Quote\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'const token = String(query.t || \'\');\n' +
          'const q = quoteOf((T.Quotes || []).find(r => token && String(r.token) === token));\n' +
          'const company = { name: s.company || \'Mossgrove Landscapes\', phone: s.company_phone || \'\', address: s.company_address || \'\', legal: s.company_legal || s.company || \'\' };\n' +
          'if (!q || q.status === \'draft\' && query.preview !== \'1\') {\n' +
          '  return [{ json: { code: 404, html: pageHtml(s, \'Quote not found\', \'<p>This link isn\\\'t valid any more. Please use the newest email from us, or call \' + esc(company.phone) + \'.</p>\'), log: false } }];\n' +
          '}\n' +
          'const preview = query.preview === \'1\';\n' +
          'const flashes = {\n' +
          '  accepted: { title: \'Quote accepted\', text: \'We\\\'ve emailed you a copy. Pay the deposit below to book your start date.\' },\n' +
          '  declined: { title: \'Thanks for letting us know\', text: \'We\\\'ve passed this on to the team.\' },\n' +
          '  deposit: { title: \'Payment received\', text: \'Thank you! Your deposit is in and your start date is booked.\' },\n' +
          '  balance: { title: \'Payment received\', text: \'Thank you! Your invoice is paid in full.\' }\n' +
          '};\n' +
          'const data = {\n' +
          '  company, token, preview,\n' +
          '  flash: flashes[String(query.done || query.paid || \'\')] || null,\n' +
          '  settings: { vat_rate: Number(s.vat_rate === \'\' ? 0.2 : s.vat_rate), deposit_pct: Number(s.deposit_pct) || 25, payment_days: Number(s.payment_days) || 7 },\n' +
          '  terms: quoteTerms(q, s),\n' +
          '  links: { self: \'quote?t=\' + token, action: \'quote-action\', pdf: \'pdf?t=\' + token + \'&doc=quote\', invoice: \'pdf?t=\' + token + \'&doc=invoice\', receipt: \'pdf?t=\' + token + \'&doc=receipt\', payDeposit: \'pay?t=\' + token + \'&kind=deposit\', payBalance: \'pay?t=\' + token + \'&kind=balance\' },\n' +
          '  quote: {\n' +
          '    quote_id: q.quote_id, status: q.status, expired: isExpired(q), client_name: q.client_name, first_name: firstName(q.client_name), job_title: q.job_title, summary: q.summary, estimator: q.estimator || s.owner_name,\n' +
          '    lines: q.lines, custom: q.custom, extras: q.extras, assumptions: q.assumptions, chosen_extras: q.chosen_extras,\n' +
          '    subtotal: q.subtotal, vat: q.vat, total: q.total, accepted_at: q.accepted_at, accepted_subtotal: q.accepted_subtotal, accepted_vat: q.accepted_vat, accepted_total: q.accepted_total,\n' +
          '    deposit_due: q.deposit_due, deposit_paid_at: q.deposit_paid_at, balance_due: q.balance_due, invoice_id: q.invoice_id, job_start: q.job_start,\n' +
          '    sent_at: q.sent_at, valid_until: q.valid_until, sent_day: day(q.sent_at), valid_day: day(q.valid_until), accepted_day: day(q.accepted_at),\n' +
          '    start_day: dayLong(q.job_start), end_day: dayLong(q.job_end), due_day: q.completed_at ? day(toDt(q.completed_at).plus({ days: Number(s.payment_days) || 7 }).toISO()) : \'\',\n' +
          '    job_days: jobDays(q.labour_days)\n' +
          '  }\n' +
          '};\n' +
          'const html = PAGE.replace(\'/*__DATA__*/null\', JSON.stringify(data).replace(/</g, \'\\\\u003c\'));\n' +
          '\n' +
          '// View log: count views of a sent quote; the first one tells the owner (a good moment to call)\n' +
          'const plan = emptyPlan(s);\n' +
          'const log = !preview && q.status === \'sent\' && !/bot|crawl|preview|HeadlessChrome/i.test(String(headers[\'user-agent\'] || \'\'));\n' +
          'if (log) {\n' +
          '  const at = nowIso();\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, view_count: q.view_count + 1, viewed_at: q.viewed_at || at, updated_at: at });\n' +
          '  if (!q.viewed_at) {\n' +
          '    plan.events.push(eventRow(q.quote_id, \'viewed\', \'First opened by the client\', \'client\'));\n' +
          '    plan.emails.push(emailItem(s.owner_email, q.client_name + \' just opened quote \' + q.quote_id, emailHtml(s, [\n' +
          '      \'<b>\' + esc(q.client_name) + \'</b> has just opened the quote for <b>\' + esc(q.job_title) + \'</b> (\' + money(q.total) + \').\',\n' +
          '      \'A quick call in the next hour is the best time to answer questions\' + (q.client_phone ? \': \' + esc(q.client_phone) : \'\') + \'.\'\n' +
          '    ], button(dashboardUrl(s) + \'&q=\' + q.quote_id, \'Open the quote\')), \'owner_viewed\', q.quote_id, []));\n' +
          '  }\n' +
          '}\n' +
          'return [{ json: { code: 200, html, log, plan } }];\n'
        )
  } },
  output: [{ code: 200, html: '<html></html>', log: true, plan: {} }]
});

const sendPage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [860, 300], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

const logView = ifElse({
  version: 2.2,
  config: {
    name: 'Count View?',
    position: [1080, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $('Build Page').first().json.log }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const viewPlan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'View Plan', position: [1300, 240], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "return [{ json: { plan: $('Build Page').first().json.plan } }];" } },
  output: [{ plan: {} }]
});

const saveView = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save View', position: [1520, 240], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: false } } }
});

// Actions: accept and sign, ask a question, decline
const actionHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Action Request', position: [200, 700], parameters: { httpMethod: 'POST', path: 'mossgrove/quote-action', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { t: 'abc', action: 'accept', name: 'Grace Whitfield', agree: true, extras: [] }, headers: {} }]
});

const loadAction = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote (Action)',
    position: [420, 700],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const checkAction = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Action', position: [640, 700], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Checks what the client asked for (accept, question, decline) against the quote\'s state, and for an\n' +
          '// acceptance builds the exact text of what they\'re signing, which the next node fingerprints with SHA-256.\n' +
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
          'const body = $(\'Action Request\').first().json.body || {};\n' +
          'const T = tablesOf($(\'Load Quote (Action)\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'const token = String(body.t || \'\');\n' +
          'const q = quoteOf((T.Quotes || []).find(r => token && String(r.token) === token));\n' +
          'const action = String(body.action || \'\');\n' +
          'const no = (message, code) => [{ json: { ok: false, code: code || 400, message } }];\n' +
          'if (!q || q.status === \'draft\') return no(\'This quote link is not valid.\', 404);\n' +
          'if (![\'accept\', \'question\', \'decline\'].includes(action)) return no(\'Unknown action.\');\n' +
          'if (action === \'question\') {\n' +
          '  const message = String(body.message || \'\').trim().slice(0, 2000);\n' +
          '  if (message.length < 3) return no(\'Please write your question.\');\n' +
          '  return [{ json: { ok: true, action, quote_id: q.quote_id, message, canonical: q.quote_id + \'|question|\' + message } }];\n' +
          '}\n' +
          'if (q.status !== \'sent\') return no(q.status === \'declined\' ? \'This quote was declined.\' : (q.status === \'cancelled\' ? \'This quote was withdrawn.\' : \'This quote has already been accepted.\'), 409);\n' +
          'if (isExpired(q)) return no(\'This quote has expired. Please call us on \' + (s.company_phone || \'\') + \' and we\\\'ll update it.\', 409);\n' +
          'if (action === \'decline\') return [{ json: { ok: true, action, quote_id: q.quote_id, reason: String(body.reason || \'\').slice(0, 200), canonical: q.quote_id + \'|decline\' } }];\n' +
          'const name = String(body.name || \'\').replace(/\\s+/g, \' \').trim().slice(0, 80);\n' +
          'if (name.length < 3 || name.indexOf(\' \') < 0) return no(\'Please type your first and last name.\');\n' +
          'if (body.agree !== true) return no(\'Please tick the box to accept the terms.\');\n' +
          'const offered = (q.extras || []).map(x => x.code);\n' +
          'const chosen = [...new Set((Array.isArray(body.extras) ? body.extras : []).map(String))].filter(c => offered.includes(c));\n' +
          'const tot = acceptedTotals(q, chosen, s);\n' +
          'const at = nowIso();\n' +
          'const signed = {\n' +
          '  quote_id: q.quote_id, version: q.version, client: q.client_name, signed_by: name, signed_at: at,\n' +
          '  lines: q.lines.map(l => [l.code, l.quantity, l.unit_price, l.amount]),\n' +
          '  custom: (q.custom || []).map(c => [c.description, c.quantity, c.unit_price, c.amount]),\n' +
          '  extras: tot.chosen.map(x => [x.code, x.quantity, x.unit_price, x.amount]),\n' +
          '  subtotal: tot.subtotal, vat: tot.vat, total: tot.total, deposit: tot.deposit\n' +
          '};\n' +
          'return [{ json: { ok: true, action, quote_id: q.quote_id, name, chosen, at, canonical: JSON.stringify(signed) } }];\n'
        )
  } },
  output: [{ ok: true, action: 'accept', quote_id: 'Q-1005', name: 'Grace Whitfield', chosen: [], canonical: '{}' }]
});

const allowed = ifElse({ version: 2.2, config: { name: 'Allowed?', position: [860, 700], parameters: { conditions: IS_OK } } });

const fingerprint = node({
  type: 'n8n-nodes-base.crypto',
  version: 1,
  config: { name: 'Fingerprint (SHA-256)', position: [1080, 620], parameters: { action: 'hash', type: 'SHA256', value: expr('{{ $json.canonical }}'), dataPropertyName: 'fingerprint', encoding: 'hex' } },
  output: [{ ok: true, action: 'accept', fingerprint: 'a3f1' }]
});

const planAction = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Action', position: [1300, 620], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Turns the client\'s action into a plan: update the quote, log it, email the client and the owner.\n' +
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
          'const c = $input.first().json;\n' +
          'const headers = $(\'Action Request\').first().json.headers || {};\n' +
          'const T = tablesOf($(\'Load Quote (Action)\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'const q = quoteOf((T.Quotes || []).find(r => r.quote_id === c.quote_id));\n' +
          'const plan = emptyPlan(s);\n' +
          'const at = nowIso();\n' +
          'const review = dashboardUrl(s) + \'&q=\' + q.quote_id;\n' +
          'if (c.action === \'accept\') {\n' +
          '  const tot = acceptedTotals(q, c.chosen, s);\n' +
          '  const meta = { fingerprint: c.fingerprint, canonical: c.canonical, ip: String(headers[\'x-forwarded-for\'] || headers[\'x-real-ip\'] || \'direct\').split(\',\')[0].trim(), user_agent: String(headers[\'user-agent\'] || \'\').slice(0, 200), signed_at: c.at, method: \'typed name + checkbox\' };\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, status: \'accepted\', accepted_at: c.at, signed_name: c.name, sign_meta_json: meta, chosen_extras_json: c.chosen, accepted_subtotal: tot.subtotal, accepted_vat: tot.vat, accepted_total: tot.total, deposit_due: tot.deposit, labour_days: tot.labour_days, updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, \'accepted\', \'Signed by \' + c.name + \' for \' + money(tot.total) + (tot.chosen.length ? \' with \' + tot.chosen.map(x => x.item).join(\', \') : \'\') + \'; fingerprint \' + String(c.fingerprint).slice(0, 12), \'client\'));\n' +
          '  plan.emails.push(emailItem(q.client_email, \'Quote accepted: \' + q.job_title, emailHtml(s, [\n' +
          '    \'Hi \' + esc(firstName(q.client_name)) + \',\',\n' +
          '    \'Thank you for accepting our quote for <b>\' + esc(q.job_title) + \'</b> (\' + money(tot.total) + \' including VAT). A signed copy is attached.\',\n' +
          '    \'The last step is the <b>\' + money(tot.deposit) + \'</b> deposit. As soon as it\\\'s paid we book the first free start date and email it to you.\'\n' +
          '  ], button(payUrl(s, q.token, \'deposit\'), \'Pay the deposit\')), \'client_accepted\', q.quote_id, [payUrl(s, q.token, \'deposit\')], \'quote\', q.token));\n' +
          '  plan.emails.push(emailItem(s.owner_email, \'Accepted: \' + q.quote_id + \' \' + q.client_name + \' (\' + money(tot.total) + \')\', emailHtml(s, [\n' +
          '    \'<b>\' + esc(q.client_name) + \'</b> accepted and signed <b>\' + esc(q.job_title) + \'</b> for \' + money(tot.total) + \'.\',\n' +
          '    tot.chosen.length ? \'Extras added: \' + tot.chosen.map(x => esc(x.item) + \' (\' + money(x.amount) + \')\').join(\', \') + \'.\' : \'No extras added.\',\n' +
          '    \'They\\\'ve been sent the \' + money(tot.deposit) + \' deposit link. The job is booked automatically when it\\\'s paid.\'\n' +
          '  ], button(review, \'Open the quote\')), \'owner_accepted\', q.quote_id, [review]));\n' +
          '  plan.result = { ok: true, message: \'Accepted\' };\n' +
          '} else if (c.action === \'question\') {\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, messages_json: (q.messages || []).concat([{ from: \'client\', text: c.message, at }]), updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, \'question\', c.message.slice(0, 300), \'client\'));\n' +
          '  plan.emails.push(emailItem(s.owner_email, \'Question about \' + q.quote_id + \' from \' + q.client_name, emailHtml(s, [\n' +
          '    \'<b>\' + esc(q.client_name) + \'</b> asked about <b>\' + esc(q.job_title) + \'</b>:\',\n' +
          '    \'<i>\' + esc(c.message).replace(/\\n/g, \'<br>\') + \'</i>\',\n' +
          '    q.client_phone ? \'Phone: \' + esc(q.client_phone) + \' · email: \' + esc(q.client_email) : \'Email: \' + esc(q.client_email)\n' +
          '  ], button(review, \'Open the quote\')), \'owner_question\', q.quote_id, [review]));\n' +
          '  plan.result = { ok: true, message: \'Sent\' };\n' +
          '} else {\n' +
          '  plan.quote_updates.push({ quote_id: q.quote_id, status: \'declined\', declined_at: at, decline_reason: c.reason, updated_at: at });\n' +
          '  plan.events.push(eventRow(q.quote_id, \'declined\', c.reason || \'No reason given\', \'client\'));\n' +
          '  plan.emails.push(emailItem(s.owner_email, \'Declined: \' + q.quote_id + \' \' + q.client_name, emailHtml(s, [\n' +
          '    esc(q.client_name) + \' declined <b>\' + esc(q.job_title) + \'</b> (\' + money(q.total) + \').\',\n' +
          '    \'Reason: \' + esc(c.reason || \'not given\') + \'.\'\n' +
          '  ], button(review, \'Open the quote\')), \'owner_declined\', q.quote_id, [review]));\n' +
          '  plan.result = { ok: true, message: \'Declined\' };\n' +
          '}\n' +
          'return [{ json: { plan } }];\n'
        )
  } },
  output: [{ plan: {} }]
});

const saveAction = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save Action', position: [1520, 620], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const sendOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Result', position: [1740, 620], parameters: { respondWith: 'json', responseBody: expr("{{ { ok: true, message: $('Plan Action').first().json.plan.result.message } }}"), options: {} } }
});

const refuse = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Refuse', position: [1080, 800], parameters: { respondWith: 'json', responseBody: expr('{{ { ok: false, message: $json.message } }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

const note = sticky(
  '## Mossgrove 3: Client Quote Page\nThe link in the client\'s email. The page shows the quote, lets them tick optional extras (the total updates live), then **accept and sign** with their typed name. What they sign is fingerprinted with SHA-256 and stored with the time, IP and browser, so neither side can change it later. They can also ask a question or decline. Afterwards the same link shows the next step: pay the deposit, the booked start date, the final invoice and the receipt. The first time a client opens a quote, the owner gets an email.',
  [], { position: [160, -40], width: 1380, height: 190, color: 7 }
);

export default workflow('mossgrove-client-page', 'Mossgrove 3: Client Quote Page')
  .add(pageHook)
  .to(loadQuote)
  .to(buildPage)
  .to(sendPage)
  .to(logView.onTrue(viewPlan.to(saveView)))
  .add(actionHook)
  .to(loadAction)
  .to(checkAction)
  .to(allowed
    .onTrue(fingerprint.to(planAction.to(saveAction.to(sendOk))))
    .onFalse(refuse))
  .add(note);
