import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'mgvSaveChange007', cachedResultName: 'Mossgrove 7: Save Changes' };
const LOAD_URL = 'https://sheets.googleapis.com/v4/spreadsheets/1754F1Rep-Rg9J3x6Dnga0fjTeSR4zfaLOS_zD7Zp1J4/values:batchGet?ranges=Settings&ranges=Quotes&ranges=Schedule&valueRenderOption=UNFORMATTED_VALUE';
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };
const IS_OK = { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' };

// Payment link: practice checkout (test) or Stripe Checkout (live)
const payHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Pay Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'mossgrove/pay', responseMode: 'responseNode', options: {} } },
  output: [{ query: { t: 'abc', kind: 'deposit' } }]
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

const planCheckout = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Checkout', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Decides what the payment link shows: in test mode a practice checkout (test card), in live mode a\n' +
          '// Stripe Checkout session; a friendly message if there\'s nothing to pay.\n' +
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
          'const PAGE =\n' +
          '"<!doctype html>\\n<html lang=\\"en\\">\\n<head>\\n<meta charset=\\"utf-8\\">\\n<meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\">\\n<meta name=\\"robots\\" content=\\"noindex\\">\\n<title>Pay · Mossgrove Landscapes</title>\\n<link href=\\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap\\" rel=\\"stylesheet\\">\\n<style>\\n:root{--moss:#1f4d3a;--ink:#1d2a24;--body:#3d4b44;--muted:#6f7d75;--line:#e3ddd0}\\n*{box-sizing:border-box}\\nbody{margin:0;background:#f4f1ea;color:var(--ink);font:15px/1.55 Inter,-apple-system,\\"Segoe UI\\",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}\\n.test{background:#fff3d6;color:#7a5410;text-align:center;font-size:13px;font-weight:600;padding:8px 12px;border-bottom:1px solid #f0dbb0}\\n.grid{max-width:920px;margin:40px auto;padding:0 18px;display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start}\\n.order{padding:8px 4px}\\n.brand{display:flex;align-items:center;gap:10px;font-weight:600;color:var(--moss);margin-bottom:26px}\\n.k{font-size:13.5px;color:var(--muted)}\\n.big{font-size:38px;font-weight:700;letter-spacing:-.8px;margin:4px 0 18px}\\n.item{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid var(--line);font-size:14px}\\n.item span:first-child{color:var(--body)}\\n.pay{background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px 24px;box-shadow:0 12px 34px rgba(31,77,58,.07)}\\nh2{font-size:18px;margin:0 0 16px}\\nlabel{display:block;font-size:13.5px;font-weight:600;margin:12px 0 6px;color:var(--body)}\\ninput{width:100%;border:1.5px solid #d8d2c4;border-radius:10px;padding:12px 13px;font:15px Inter,sans-serif;color:var(--ink)}\\ninput:focus{outline:0;border-color:var(--moss)}\\n.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}\\n.card-in{position:relative}\\n.card-in svg{position:absolute;right:12px;top:12px}\\nbutton{width:100%;margin-top:20px;border:0;border-radius:12px;background:var(--moss);color:#fff;font:600 16px Inter,sans-serif;padding:15px;cursor:pointer}\\nbutton:hover{background:#25604a}\\nbutton[disabled]{opacity:.6;cursor:wait}\\n.fine{font-size:12.5px;color:var(--muted);margin-top:14px;display:flex;gap:8px;align-items:center}\\n.err{color:#a23b2a;font-size:13.5px;min-height:18px;margin-top:10px}\\n.back{display:inline-block;margin-top:18px;color:var(--muted);font-size:13.5px}\\n@media (max-width:760px){.grid{grid-template-columns:1fr;margin-top:20px}.big{font-size:32px}}\\n</style>\\n</head>\\n<body>\\n<div class=\\"test\\">Test mode: no real payment is taken. Use the test card that\'s filled in.</div>\\n<div class=\\"grid\\">\\n  <section class=\\"order\\">\\n    <div class=\\"brand\\"><svg width=\\"26\\" height=\\"26\\" viewBox=\\"0 0 34 34\\" aria-hidden=\\"true\\"><path d=\\"M2 32C2 14 14 2 32 2c0 18-12 30-30 30z\\" fill=\\"#7bb661\\"/><path d=\\"M5 29L27 7\\" stroke=\\"#1f4d3a\\" stroke-width=\\"2\\"/></svg><span id=\\"co\\"></span></div>\\n    <div class=\\"k\\" id=\\"what\\"></div>\\n    <div class=\\"big\\" id=\\"amount\\"></div>\\n    <div id=\\"items\\"></div>\\n    <a class=\\"back\\" id=\\"back\\" href=\\"#\\">← Back to your quote</a>\\n  </section>\\n  <section class=\\"pay\\">\\n    <h2>Pay by card</h2>\\n    <form id=\\"f\\">\\n      <label for=\\"email\\">Email</label>\\n      <input id=\\"email\\" type=\\"email\\" autocomplete=\\"email\\">\\n      <label for=\\"num\\">Card number</label>\\n      <div class=\\"card-in\\"><input id=\\"num\\" inputmode=\\"numeric\\" value=\\"4242 4242 4242 4242\\"><svg width=\\"34\\" height=\\"22\\" viewBox=\\"0 0 34 22\\"><rect width=\\"34\\" height=\\"22\\" rx=\\"4\\" fill=\\"#e9eef0\\"/><rect x=\\"4\\" y=\\"6\\" width=\\"26\\" height=\\"3\\" fill=\\"#b9c3c7\\"/><rect x=\\"4\\" y=\\"14\\" width=\\"10\\" height=\\"3\\" rx=\\"1\\" fill=\\"#b9c3c7\\"/></svg></div>\\n      <div class=\\"row\\"><div><label for=\\"exp\\">Expiry</label><input id=\\"exp\\" value=\\"12 / 34\\"></div><div><label for=\\"cvc\\">CVC</label><input id=\\"cvc\\" value=\\"123\\"></div></div>\\n      <label for=\\"nm\\">Name on card</label>\\n      <input id=\\"nm\\" autocomplete=\\"cc-name\\">\\n      <button id=\\"go\\" type=\\"submit\\"></button>\\n      <div class=\\"err\\" id=\\"err\\"></div>\\n      <div class=\\"fine\\"><svg width=\\"14\\" height=\\"14\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\"><rect x=\\"4\\" y=\\"10\\" width=\\"16\\" height=\\"11\\" rx=\\"2\\"/><path d=\\"M8 10V7a4 4 0 0 1 8 0v3\\"/></svg>In live mode this page is Stripe Checkout; card details never touch our systems.</div>\\n    </form>\\n  </section>\\n</div>\\n<script>\\nvar D = /*__DATA__*/null;\\n(function () {\\n  if (!D) return;\\n  var $ = function (id) { return document.getElementById(id); };\\n  var gbp = function (n) { return \'£\' + (Math.round(Number(n || 0) * 100) / 100).toLocaleString(\'en-GB\', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };\\n  document.title = \'Pay \' + gbp(D.amount) + \' · \' + D.company;\\n  $(\'co\').textContent = D.company;\\n  $(\'what\').textContent = D.label;\\n  $(\'amount\').textContent = gbp(D.amount);\\n  $(\'items\').innerHTML = D.items.map(function (i) { return \'<div class=\\"item\\"><span>\' + i[0].replace(/</g, \'&lt;\') + \'</span><span>\' + gbp(i[1]) + \'</span></div>\'; }).join(\'\');\\n  $(\'email\').value = D.email; $(\'nm\').value = D.name;\\n  $(\'go\').textContent = \'Pay \' + gbp(D.amount);\\n  $(\'back\').href = D.back;\\n  $(\'f\').onsubmit = function (e) {\\n    e.preventDefault();\\n    if ($(\'num\').value.replace(/\\\\s/g, \'\') !== \'4242424242424242\') { $(\'err\').textContent = \'In test mode, use the test card 4242 4242 4242 4242.\'; return; }\\n    $(\'go\').disabled = true; $(\'go\').textContent = \'Processing…\'; $(\'err\').textContent = \'\';\\n    fetch(D.confirm, { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify({ t: D.token, kind: D.kind, last4: \'4242\' }) })\\n      .then(function (r) { return r.json(); })\\n      .then(function (r) { if (r.ok) { location.href = r.redirect; } else { $(\'go\').disabled = false; $(\'go\').textContent = \'Pay \' + gbp(D.amount); $(\'err\').textContent = r.message || \'Payment failed.\'; } })\\n      .catch(function () { $(\'go\').disabled = false; $(\'go\').textContent = \'Pay \' + gbp(D.amount); $(\'err\').textContent = \'Could not connect. Please try again.\'; });\\n  };\\n})();\\n</script>\\n</body>\\n</html>\\n"\n' +
          ';\n' +
          'const query = $(\'Pay Request\').first().json.query || {};\n' +
          'const T = tablesOf($(\'Load Quote\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'const token = String(query.t || \'\'), kind = String(query.kind || \'\');\n' +
          'const q = quoteOf((T.Quotes || []).find(r => token && String(r.token) === token));\n' +
          'const p = payable(q, kind);\n' +
          'if (!p.ok) return [{ json: { route: \'message\', html: pageHtml(s, p.message.indexOf(\'Thank you\') >= 0 ? \'All paid\' : \'Nothing to pay\', \'<p>\' + esc(p.message) + \'</p>\' + (q ? \'<a class="btn" href="quote?t=\' + esc(token) + \'">Back to your quote</a>\' : \'\')) } }];\n' +
          'const items = kind === \'deposit\'\n' +
          '  ? [[\'Quote total (accepted \' + day(q.accepted_at) + \')\', q.accepted_total], [\'Deposit \' + (Number(s.deposit_pct) || 25) + \'%\', q.deposit_due]]\n' +
          '  : [[\'Total for the work\', q.accepted_total], [\'Deposit paid\', -q.deposit_due], [\'Balance due\', q.balance_due]];\n' +
          'if (s.mode === \'live\') {\n' +
          '  return [{ json: { route: \'stripe\', pence: Math.round(p.amount * 100), currency: s.currency || \'gbp\', product: s.company + \': \' + p.label, email: q.client_email, token, kind,\n' +
          '    success_url: baseUrl(s) + \'/webhook/mossgrove/quote?t=\' + token + \'&paid=\' + kind, cancel_url: baseUrl(s) + \'/webhook/mossgrove/quote?t=\' + token } }];\n' +
          '}\n' +
          'const data = { company: s.company, label: p.label, amount: p.amount, items, email: q.client_email, name: q.client_name, token, kind, confirm: \'pay-test\', back: \'quote?t=\' + token };\n' +
          'return [{ json: { route: \'page\', html: PAGE.replace(\'/*__DATA__*/null\', JSON.stringify(data).replace(/</g, \'\\\\u003c\')) } }];\n'
        )
  } },
  output: [{ route: 'page', html: '<html></html>' }]
});

const route = switchCase({
  version: 3.2,
  config: {
    name: 'Route',
    position: [860, 300],
    parameters: { rules: { values: [
      { outputKey: 'page', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'page' }], combinator: 'and' } },
      { outputKey: 'stripe', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'stripe' }], combinator: 'and' } },
      { outputKey: 'message', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'message' }], combinator: 'and' } }
    ] }, options: {} }
  }
});

const sendCheckout = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Test Checkout', position: [1080, 160], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseHeaders: HTML_HEADERS } } }
});

const createSession = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Stripe Session',
    position: [1080, 300],
    parameters: {
      method: 'POST',
      url: 'https://api.stripe.com/v1/checkout/sessions',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'stripeApi',
      sendBody: true, contentType: 'form-urlencoded',
      bodyParameters: { parameters: [
        { name: 'mode', value: 'payment' },
        { name: 'success_url', value: expr('{{ $json.success_url }}') },
        { name: 'cancel_url', value: expr('{{ $json.cancel_url }}') },
        { name: 'customer_email', value: expr('{{ $json.email }}') },
        { name: 'line_items[0][quantity]', value: '1' },
        { name: 'line_items[0][price_data][currency]', value: expr('{{ $json.currency }}') },
        { name: 'line_items[0][price_data][unit_amount]', value: expr('{{ $json.pence }}') },
        { name: 'line_items[0][price_data][product_data][name]', value: expr('{{ $json.product }}') },
        { name: 'metadata[token]', value: expr('{{ $json.token }}') },
        { name: 'metadata[kind]', value: expr('{{ $json.kind }}') }
      ] },
      options: {}
    }
  },
  output: [{ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' }]
});

const goStripe = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Go to Stripe', position: [1300, 300], parameters: { respondWith: 'redirect', redirectURL: expr('{{ $json.url }}'), options: {} } }
});

const sendMessage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Message', position: [1080, 440], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseHeaders: HTML_HEADERS } } }
});

// Test checkout "pays"
const testHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Test Payment', position: [200, 720], parameters: { httpMethod: 'POST', path: 'mossgrove/pay-test', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { t: 'abc', kind: 'deposit', last4: '4242' } }]
});

const loadTest = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote (Test)',
    position: [420, 720],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const planTest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Test Payment', position: [640, 720], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Test mode only: the practice checkout "pays". Records it exactly like a real card payment would be.\n' +
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
          'const body = $(\'Test Payment\').first().json.body || {};\n' +
          'const T = tablesOf($(\'Load Quote (Test)\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'const token = String(body.t || \'\'), kind = String(body.kind || \'\');\n' +
          'const q = quoteOf((T.Quotes || []).find(r => token && String(r.token) === token));\n' +
          'if (s.mode === \'live\') return [{ json: { ok: false, code: 403, message: \'Test payments are switched off.\' } }];\n' +
          'const p = payable(q, kind);\n' +
          'if (!p.ok) return [{ json: { ok: false, code: 409, message: p.message } }];\n' +
          'const plan = emptyPlan(s);\n' +
          'planPayment(plan, q, kind, \'test card\', \'test_\' + newToken(14), T, s, \'client\');\n' +
          'plan.result = { ok: true, redirect: \'quote?t=\' + token + \'&paid=\' + kind };\n' +
          'return [{ json: { ok: true, plan } }];\n'
        )
  } },
  output: [{ ok: true, plan: {} }]
});

const testOk = ifElse({ version: 2.2, config: { name: 'Can Pay?', position: [860, 720], parameters: { conditions: IS_OK } } });

const saveTest = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Record Payment', position: [1080, 640], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const sendPaid = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Paid', position: [1300, 640], parameters: { respondWith: 'json', responseBody: expr('{{ { ok: true, redirect: $json.redirect } }}'), options: {} } }
});

const refuseTest = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Refuse Payment', position: [1080, 820], parameters: { respondWith: 'json', responseBody: expr('{{ { ok: false, message: $json.message } }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

// Stripe webhook (live)
const stripeHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Stripe Webhook', position: [200, 1120], parameters: { httpMethod: 'POST', path: 'mossgrove/stripe-webhook', responseMode: 'responseNode', options: {} } },
  output: [{ body: { type: 'checkout.session.completed', data: { object: { id: 'cs_test_123' } } } }]
});

const checkEvent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Event', position: [420, 1120], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Stripe tells us a checkout finished. We don\'t trust the message itself: the next node asks Stripe for\n' +
        '// the session by its ID (with our secret key) and only that answer is used.\n' +
        'const body = $(\'Stripe Webhook\').first().json.body || {};\n' +
        'const obj = (body.data && body.data.object) || {};\n' +
        'const ok = body.type === \'checkout.session.completed\' && /^cs_/.test(String(obj.id || \'\'));\n' +
        'return [{ json: { ok, session_id: ok ? obj.id : \'\' } }];\n'
  } },
  output: [{ ok: true, session_id: 'cs_test_123' }]
});

const isCheckout = ifElse({ version: 2.2, config: { name: 'Checkout Completed?', position: [640, 1120], parameters: { conditions: IS_OK } } });

const getSession = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Stripe Session',
    position: [860, 1040],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: expr('https://api.stripe.com/v1/checkout/sessions/{{ $json.session_id }}'), authentication: 'predefinedCredentialType', nodeCredentialType: 'stripeApi', options: {} },
  },
  output: [{ id: 'cs_test_123', payment_status: 'paid', amount_total: 50220, metadata: { token: 'abc', kind: 'deposit' }, payment_intent: 'pi_123' }]
});

const loadStripe = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote (Stripe)',
    position: [1080, 1040],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const planCard = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Card Payment', position: [1300, 1040], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Records a Stripe card payment once Stripe confirms the session is paid. Safe to receive twice.\n' +
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
          'const session = $(\'Get Stripe Session\').first().json;\n' +
          'const T = tablesOf($(\'Load Quote (Stripe)\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'const meta = session.metadata || {};\n' +
          'const q = quoteOf((T.Quotes || []).find(r => meta.token && String(r.token) === String(meta.token)));\n' +
          'const p = payable(q, String(meta.kind || \'\'));\n' +
          'if (session.payment_status !== \'paid\' || !p.ok) return [{ json: { ok: false, message: session.payment_status !== \'paid\' ? \'Not paid\' : p.message } }];\n' +
          'if (Math.round(p.amount * 100) !== Number(session.amount_total)) return [{ json: { ok: false, message: \'Amount does not match the quote\' } }];\n' +
          'const plan = emptyPlan(s);\n' +
          'planPayment(plan, q, meta.kind, \'card (Stripe)\', String(session.payment_intent || session.id), T, s, \'client\');\n' +
          'plan.result = { ok: true };\n' +
          'return [{ json: { ok: true, plan } }];\n'
        )
  } },
  output: [{ ok: true, plan: {} }]
});

const cardOk = ifElse({ version: 2.2, config: { name: 'Paid?', position: [1520, 1040], parameters: { conditions: IS_OK } } });

const saveCard = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Record Card Payment', position: [1740, 960], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const ack = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Acknowledge', position: [1960, 960], parameters: { respondWith: 'json', responseBody: '{ "received": true }', options: {} } }
});

const ackIgnored = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Acknowledge (Ignored)', position: [1740, 1200], parameters: { respondWith: 'json', responseBody: '{ "received": true, "recorded": false }', options: {} } }
});

const note = sticky(
  '## Mossgrove 4: Payments and Booking\nThe client\'s **Pay** link. In test mode it shows a practice checkout (test card 4242…); in live mode it creates a **Stripe Checkout** session and redirects to it (add a Stripe credential and enable the two Stripe nodes). Stripe\'s webhook is never trusted on its own: the session is fetched back from Stripe and the amount checked. When a **deposit** is paid, the job is booked into the first crew with enough free working days after the lead time (from the **Schedule** tab) and the client gets the start date. When the **balance** is paid, the job is closed and a receipt goes out.',
  [], { position: [160, -60], width: 1360, height: 200, color: 7 }
);

export default workflow('mossgrove-payments', 'Mossgrove 4: Payments and Booking')
  .add(payHook)
  .to(loadQuote)
  .to(planCheckout)
  .to(route
    .onCase(0, sendCheckout)
    .onCase(1, createSession.to(goStripe))
    .onCase(2, sendMessage))
  .add(testHook)
  .to(loadTest)
  .to(planTest)
  .to(testOk
    .onTrue(saveTest.to(sendPaid))
    .onFalse(refuseTest))
  .add(stripeHook)
  .to(checkEvent)
  .to(isCheckout
    .onTrue(getSession.to(loadStripe.to(planCard.to(cardOk
      .onTrue(saveCard.to(ack))
      .onFalse(ackIgnored)))))
    .onFalse(ackIgnored))
  .add(note);
