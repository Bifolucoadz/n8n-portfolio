import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const LOAD_URL = 'https://sheets.googleapis.com/v4/spreadsheets/1754F1Rep-Rg9J3x6Dnga0fjTeSR4zfaLOS_zD7Zp1J4/values:batchGet?ranges=Settings&ranges=Quotes&ranges=Payments&valueRenderOption=UNFORMATTED_VALUE';
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };

const pdfHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'PDF Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'mossgrove/pdf', responseMode: 'responseNode', options: {} } },
  output: [{ query: { t: 'abc', doc: 'quote' } }]
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

const makePdf = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Make PDF', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Draws the PDF from the quote\'s row (no template service): quote, invoice or receipt.\n' +
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
          '// ---- lib-pdf.js (included by build.py): a small PDF writer, so documents need no outside service ----\n' +
          '// A4 pages, Helvetica and Helvetica-Bold (built into every PDF reader), boxes, lines, paths and links.\n' +
          '// Positions are in points from the top-left corner; the writer flips them for PDF.\n' +
          'const PDF_W = 595.28, PDF_H = 841.89;\n' +
          'const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];\n' +
          'const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];\n' +
          '// Characters outside ASCII that WinAnsiEncoding has: [code, width regular, width bold]\n' +
          'const WIN_EXTRA = { \'£\': [0xA3, 556, 556], \'€\': [0x80, 556, 556], \'–\': [0x96, 556, 556], \'—\': [0x97, 1000, 1000], \'•\': [0x95, 350, 350], \'×\': [0xD7, 584, 584], \'’\': [0x92, 222, 278], \'‘\': [0x91, 222, 278], \'“\': [0x93, 333, 500], \'”\': [0x94, 333, 500], \'é\': [0xE9, 556, 556], \'²\': [0xB2, 333, 333], \'°\': [0xB0, 400, 400], \'·\': [0xB7, 278, 278], \'…\': [0x85, 1000, 1000], \' \': [0x20, 278, 278] };\n' +
          '\n' +
          'function pdfChar(ch, bold) {\n' +
          '  const c = ch.charCodeAt(0);\n' +
          '  if (c >= 32 && c <= 126) return [c, (bold ? HELV_B : HELV)[c - 32]];\n' +
          '  const x = WIN_EXTRA[ch];\n' +
          '  if (x) return [x[0], bold ? x[2] : x[1]];\n' +
          '  return [63, bold ? 611 : 556];\n' +
          '}\n' +
          'function textWidth(s, size, bold) {\n' +
          '  let w = 0;\n' +
          '  for (const ch of String(s)) w += pdfChar(ch, bold)[1];\n' +
          '  return w * size / 1000;\n' +
          '}\n' +
          'function pdfText(s, bold) {\n' +
          '  let out = \'\';\n' +
          '  for (const ch of String(s)) {\n' +
          '    const t = String.fromCharCode(pdfChar(ch, bold)[0]);\n' +
          '    out += (t === \'(\' || t === \')\' || t === \'\\\\\') ? \'\\\\\' + t : t;\n' +
          '  }\n' +
          '  return \'(\' + out + \')\';\n' +
          '}\n' +
          '// Word-wrap to a width; keeps the writer\'s line breaks.\n' +
          'function wrapText(s, size, bold, maxW) {\n' +
          '  const lines = [];\n' +
          '  for (const para of String(s === null || s === undefined ? \'\' : s).replace(/\\t/g, \' \').split(\'\\n\')) {\n' +
          '    let line = \'\';\n' +
          '    for (const word of para.split(/\\s+/).filter(Boolean)) {\n' +
          '      const t = line ? line + \' \' + word : word;\n' +
          '      if (!line || textWidth(t, size, bold) <= maxW) line = t;\n' +
          '      else { lines.push(line); line = word; }\n' +
          '    }\n' +
          '    lines.push(line);\n' +
          '  }\n' +
          '  return lines;\n' +
          '}\n' +
          'const pdfNum = n => (Math.round(n * 100) / 100).toString();\n' +
          'function rgb(hex) {\n' +
          '  const h = String(hex).replace(\'#\', \'\');\n' +
          '  return [0, 2, 4].map(i => pdfNum(parseInt(h.slice(i, i + 2), 16) / 255)).join(\' \');\n' +
          '}\n' +
          '\n' +
          'function newPdf(title) {\n' +
          '  const doc = { title: title || \'Document\', pages: [], cur: null };\n' +
          '  doc.addPage = () => { const p = { ops: [], links: [] }; doc.pages.push(p); doc.cur = p; return p; };\n' +
          '  doc.rect = (x, y, w, h, fill) => doc.cur.ops.push(rgb(fill) + \' rg \' + pdfNum(x) + \' \' + pdfNum(PDF_H - y - h) + \' \' + pdfNum(w) + \' \' + pdfNum(h) + \' re f\');\n' +
          '  doc.box = (x, y, w, h, stroke, width) => doc.cur.ops.push(rgb(stroke) + \' RG \' + pdfNum(width || 0.75) + \' w \' + pdfNum(x) + \' \' + pdfNum(PDF_H - y - h) + \' \' + pdfNum(w) + \' \' + pdfNum(h) + \' re S\');\n' +
          '  doc.line = (x1, y1, x2, y2, color, width) => doc.cur.ops.push(rgb(color) + \' RG \' + pdfNum(width || 0.5) + \' w \' + pdfNum(x1) + \' \' + pdfNum(PDF_H - y1) + \' m \' + pdfNum(x2) + \' \' + pdfNum(PDF_H - y2) + \' l S\');\n'
        ) +
        (
          '  // y is the text baseline. align: left (x = start), right (x = end), center (x = middle)\n' +
          '  doc.text = (x, y, s, o) => {\n' +
          '    o = o || {};\n' +
          '    const size = o.size || 10, bold = !!o.bold;\n' +
          '    const w = textWidth(s, size, bold);\n' +
          '    const left = o.align === \'right\' ? x - w : (o.align === \'center\' ? x - w / 2 : x);\n' +
          '    doc.cur.ops.push(\'BT /\' + (bold ? \'F2\' : \'F1\') + \' \' + pdfNum(size) + \' Tf \' + rgb(o.color || \'#1d2a24\') + \' rg \' + pdfNum(left) + \' \' + pdfNum(PDF_H - y) + \' Td \' + pdfText(s, bold) + \' Tj ET\');\n' +
          '    return w;\n' +
          '  };\n' +
          '  // A closed shape from moves, lines and curves: [[\'M\',x,y], [\'C\',x1,y1,x2,y2,x,y], [\'L\',x,y]]\n' +
          '  doc.shape = (cmds, fill) => {\n' +
          '    const parts = cmds.map(c => c[0] === \'M\' ? pdfNum(c[1]) + \' \' + pdfNum(PDF_H - c[2]) + \' m\'\n' +
          '      : c[0] === \'L\' ? pdfNum(c[1]) + \' \' + pdfNum(PDF_H - c[2]) + \' l\'\n' +
          '      : [c[1], PDF_H - c[2], c[3], PDF_H - c[4], c[5], PDF_H - c[6]].map(pdfNum).join(\' \') + \' c\');\n' +
          '    doc.cur.ops.push(rgb(fill) + \' rg \' + parts.join(\' \') + \' h f\');\n' +
          '  };\n' +
          '  doc.link = (x, y, w, h, url) => doc.cur.links.push({ rect: [x, PDF_H - y - h, x + w, PDF_H - y].map(pdfNum).join(\' \'), url: String(url) });\n' +
          '  doc.render = () => {\n' +
          '    const objs = [];\n' +
          '    const add = s => { objs.push(s); return objs.length; };\n' +
          '    add(\'<< /Type /Catalog /Pages 2 0 R >>\');\n' +
          '    add(\'PAGES\');\n' +
          '    add(\'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\');\n' +
          '    add(\'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\');\n' +
          '    const kids = [];\n' +
          '    for (const p of doc.pages) {\n' +
          '      const stream = p.ops.join(\'\\n\');\n' +
          '      const contents = add(\'<< /Length \' + stream.length + \' >>\\nstream\\n\' + stream + \'\\nendstream\');\n' +
          '      const annots = p.links.map(l => add(\'<< /Type /Annot /Subtype /Link /Rect [\' + l.rect + \'] /Border [0 0 0] /A << /S /URI /URI \' + pdfText(l.url) + \' >> >>\'));\n' +
          '      kids.push(add(\'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 \' + PDF_W + \' \' + PDF_H + \'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents \' + contents + \' 0 R\' + (annots.length ? \' /Annots [\' + annots.map(a => a + \' 0 R\').join(\' \') + \']\' : \'\') + \' >>\'));\n' +
          '    }\n' +
          '    objs[1] = \'<< /Type /Pages /Kids [\' + kids.map(k => k + \' 0 R\').join(\' \') + \'] /Count \' + kids.length + \' >>\';\n' +
          '    const info = add(\'<< /Title \' + pdfText(doc.title) + \' /Producer (n8n workflow) >>\');\n' +
          '    let out = \'%PDF-1.4\\n%âãÏÓ\\n\';\n' +
          '    const offsets = [];\n' +
          '    objs.forEach((o, i) => { offsets.push(out.length); out += (i + 1) + \' 0 obj\\n\' + o + \'\\nendobj\\n\'; });\n' +
          '    const xref = out.length;\n' +
          '    out += \'xref\\n0 \' + (objs.length + 1) + \'\\n0000000000 65535 f \\n\' + offsets.map(o => String(o).padStart(10, \'0\') + \' 00000 n \\n\').join(\'\');\n' +
          '    out += \'trailer\\n<< /Size \' + (objs.length + 1) + \' /Root 1 0 R /Info \' + info + \' 0 R >>\\nstartxref\\n\' + xref + \'\\n%%EOF\\n\';\n' +
          '    return Buffer.from(out, \'latin1\');\n' +
          '  };\n' +
          '  return doc;\n' +
          '}\n' +
          '// ---- end lib-pdf.js ----\n' +
          '// ---- lib-docs.js (included by build.py): the quote, invoice and receipt PDFs (needs lib-pdf and lib-mgv) ----\n' +
          'const C = { brand: \'#1f4d3a\', leaf: \'#7bb661\', ink: \'#1d2a24\', body: \'#3d4b44\', muted: \'#76847c\', line: \'#e1e7e2\', soft: \'#eef3ef\', pale: \'#f4f8f4\', white: \'#ffffff\', tint: \'#cfe3d3\' };\n' +
          'const L = 48, R = PDF_W - 48, W = R - L, BOTTOM = PDF_H - 64;\n' +
          '\n' +
          'function documentPdf(q, s, docType, payments) {\n' +
          '  const isQuote = docType === \'quote\', isInvoice = docType === \'invoice\', isReceipt = docType === \'receipt\';\n' +
          '  const number = isQuote ? q.quote_id : (q.invoice_id || q.quote_id.replace(\'Q-\', \'INV-\'));\n' +
          '  const title = isQuote ? \'QUOTE\' : (isInvoice ? \'INVOICE\' : \'RECEIPT\');\n' +
          '  const doc = newPdf(s.company + \' \' + title.toLowerCase() + \' \' + number);\n' +
          '  const accepted = !!q.accepted_at;\n' +
          '  const chosen = accepted ? (q.chosen_extras || []) : [];\n' +
          '  const vatPct = Math.round(Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate) * 100);\n' +
          '  let y = 0;\n' +
          '\n' +
          '  function leaf(x, top, size, color, vein) {\n' +
          '    const k = size / 34, X = u => x + u * k, Y = v => top + v * k;\n' +
          '    doc.shape([[\'M\', X(2), Y(32)], [\'C\', X(2), Y(14), X(14), Y(2), X(32), Y(2)], [\'C\', X(32), Y(20), X(20), Y(32), X(2), Y(32)]], color);\n' +
          '    doc.line(X(5), Y(29), X(27), Y(7), vein, 1.4 * k);\n' +
          '  }\n' +
          '  function header() {\n' +
          '    doc.addPage();\n' +
          '    doc.rect(0, 0, PDF_W, 92, C.brand);\n' +
          '    leaf(L, 27, 38, C.leaf, C.brand);\n' +
          '    doc.text(L + 50, 49, s.company || \'Mossgrove Landscapes\', { size: 18, bold: true, color: C.white });\n' +
          '    doc.text(L + 50, 65, \'Garden design · patios · fencing · lawns\', { size: 9, color: C.tint });\n' +
          '    doc.text(R, 47, title, { size: 22, bold: true, color: C.white, align: \'right\' });\n' +
          '    doc.text(R, 65, number, { size: 11, color: C.tint, align: \'right\' });\n' +
          '    y = 92;\n' +
          '  }\n' +
          '  function continuation() {\n' +
          '    doc.addPage();\n' +
          '    doc.rect(0, 0, PDF_W, 34, C.brand);\n' +
          '    leaf(L, 9, 16, C.leaf, C.brand);\n' +
          '    doc.text(L + 24, 21.5, s.company || \'Mossgrove Landscapes\', { size: 10, bold: true, color: C.white });\n' +
          '    doc.text(R, 21.5, title + \' \' + number + \' (continued)\', { size: 9, color: C.tint, align: \'right\' });\n' +
          '    y = 58;\n' +
          '  }\n' +
          '  const room = h => { if (y + h > BOTTOM) { continuation(); return true; } return false; };\n' +
          '\n' +
          '  header();\n' +
          '  // Who and when\n' +
          '  y += 34;\n' +
          '  doc.text(L, y, isQuote ? \'PREPARED FOR\' : \'BILL TO\', { size: 7.5, bold: true, color: C.muted });\n' +
          '  let ly = y + 16;\n' +
          '  doc.text(L, ly, q.client_name, { size: 11.5, bold: true });\n' +
          '  for (const line of wrapText(String(q.site_address || \'\') + (q.postcode && String(q.site_address || \'\').indexOf(q.postcode) < 0 ? \', \' + q.postcode : \'\'), 9.5, false, 250)) { ly += 13.5; doc.text(L, ly, line, { size: 9.5, color: C.body }); }\n' +
          '  if (q.client_email) { ly += 13.5; doc.text(L, ly, q.client_email, { size: 9, color: C.muted }); }\n' +
          '  if (q.client_phone) { ly += 12.5; doc.text(L, ly, String(q.client_phone), { size: 9, color: C.muted }); }\n' +
          '  const meta = isQuote\n' +
          '    ? [[\'Quote number\', q.quote_id], [\'Date\', day(q.sent_at || q.created_at)], [\'Valid until\', day(q.valid_until) || day(toDt(q.created_at).plus({ days: Number(s.validity_days) || 30 }).toISO())], [\'Prepared by\', q.estimator || s.owner_name]]\n' +
          '    : isInvoice\n' +
          '      ? [[\'Invoice number\', number], [\'Invoice date\', day(q.completed_at)], [\'Due date\', day(toDt(q.completed_at).plus({ days: Number(s.payment_days) || 7 }).toISO())], [\'Quote\', q.quote_id]]\n' +
          '      : [[\'Receipt for\', number], [\'Paid on\', day(q.balance_paid_at)], [\'Quote\', q.quote_id], [\'Job\', day(q.job_start) + \' to \' + day(q.job_end)]];\n' +
          '  let my = y;\n' +
          '  for (const [k, v] of meta) { doc.text(338, my + 4, k, { size: 9, color: C.muted }); doc.text(R, my + 4, String(v || \'\'), { size: 9.5, bold: true, align: \'right\' }); my += 17; }\n' +
          '  y = Math.max(ly, my) + 16;\n'
        ) +
        (
          '  doc.line(L, y, R, y, C.line, 0.75);\n' +
          '\n' +
          '  // The job\n' +
          '  y += 27;\n' +
          '  doc.text(L, y, q.job_title || \'Garden works\', { size: 15.5, bold: true });\n' +
          '  y += 8;\n' +
          '  if (isQuote && q.summary) for (const line of wrapText(q.summary, 10, false, W)) { y += 14.5; doc.text(L, y, line, { size: 10, color: C.body }); }\n' +
          '  y += 16;\n' +
          '\n' +
          '  // Table\n' +
          '  const COL_QTY = 392, COL_PRICE = 470, COL_AMT = R - 10, DESC_W = 290;\n' +
          '  function tableHead() {\n' +
          '    doc.rect(L, y, W, 22, C.soft);\n' +
          '    doc.text(L + 10, y + 14.5, \'DESCRIPTION\', { size: 7.5, bold: true, color: C.muted });\n' +
          '    doc.text(COL_QTY, y + 14.5, \'QUANTITY\', { size: 7.5, bold: true, color: C.muted, align: \'right\' });\n' +
          '    doc.text(COL_PRICE, y + 14.5, \'UNIT PRICE\', { size: 7.5, bold: true, color: C.muted, align: \'right\' });\n' +
          '    doc.text(COL_AMT, y + 14.5, \'AMOUNT\', { size: 7.5, bold: true, color: C.muted, align: \'right\' });\n' +
          '    y += 22;\n' +
          '  }\n' +
          '  function row(name, note, qty, unit, price, amount, muted) {\n' +
          '    const nameLines = wrapText(name, 9.5, true, DESC_W);\n' +
          '    const noteLines = note ? wrapText(note, 8.5, false, DESC_W) : [];\n' +
          '    const h = 9 + nameLines.length * 12 + noteLines.length * 10.5 + 5;\n' +
          '    if (room(h)) tableHead();\n' +
          '    let ty = y + 15;\n' +
          '    nameLines.forEach((t, i) => doc.text(L + 10, ty + i * 12, t, { size: 9.5, bold: true, color: muted ? C.body : C.ink }));\n' +
          '    const ny = ty + nameLines.length * 12 - 1.5;\n' +
          '    noteLines.forEach((t, i) => doc.text(L + 10, ny + i * 10.5, t, { size: 8.5, color: C.muted }));\n' +
          '    doc.text(COL_QTY, ty, qty, { size: 9.5, color: C.body, align: \'right\' });\n' +
          '    doc.text(COL_PRICE, ty, price, { size: 9.5, color: C.body, align: \'right\' });\n' +
          '    doc.text(COL_AMT, ty, amount, { size: 9.5, bold: !muted, color: muted ? C.body : C.ink, align: \'right\' });\n' +
          '    y += h;\n' +
          '    doc.line(L, y, R, y, C.line, 0.5);\n' +
          '  }\n' +
          '  const qtyCell = l => l.unit === \'each\' ? qtyText(l.quantity) : qtyText(l.quantity) + \' \' + unitText(l.unit, l.quantity);\n' +
          '  const priceCell = l => money(l.unit_price) + (l.unit === \'each\' ? \'\' : \' / \' + (l.unit === \'metre\' ? \'m\' : l.unit));\n' +
          '  room(60);\n' +
          '  tableHead();\n' +
          '  for (const l of q.lines || []) row(l.item, l.label, qtyCell(l), l.unit, priceCell(l), money(l.amount));\n' +
          '  for (const c of q.custom || []) row(c.description, \'\', qtyCell(c), c.unit, c.unit_price === null ? \'to price\' : money(c.unit_price), c.amount === null || c.amount === undefined ? \'to price\' : money(c.amount));\n' +
          '  for (const x of (q.extras || []).filter(x => chosen.includes(x.code))) row(x.item, \'Optional extra you added\' + (x.label ? \': \' + x.label : \'\'), qtyCell(x), x.unit, priceCell(x), money(x.amount));\n' +
          '\n' +
          '  // Optional extras still on offer (quote only)\n' +
          '  const offer = isQuote && !accepted ? (q.extras || []) : [];\n' +
          '  if (offer.length) {\n' +
          '    y += 22;\n' +
          '    room(40);\n' +
          '    doc.text(L, y, \'Optional extras\', { size: 10.5, bold: true });\n' +
          '    doc.text(L + textWidth(\'Optional extras\', 10.5, true) + 8, y, \'(not included in the total; tick them when you accept online)\', { size: 8.5, color: C.muted });\n' +
          '    y += 8;\n' +
          '    for (const x of offer) row(x.item, x.why || x.label, qtyCell(x), x.unit, priceCell(x), money(x.amount), true);\n' +
          '  }\n' +
          '\n' +
          '  // Totals\n' +
          '  const subtotal = accepted ? q.accepted_subtotal : q.subtotal, vat = accepted ? q.accepted_vat : q.vat, total = accepted ? q.accepted_total : q.total;\n' +
          '  const deposit = accepted ? q.deposit_due : q.deposit;\n' +
          '  const depositPaid = (payments || []).find(p => p.kind === \'deposit\' && p.status === \'paid\');\n' +
          '  const balancePaid = (payments || []).find(p => p.kind === \'balance\' && p.status === \'paid\');\n' +
          '  const rows = [[\'Subtotal\', money(subtotal)], [\'VAT (\' + vatPct + \'%)\', money(vat)], [\'Total\', money(total), \'total\']];\n' +
          '  if (isQuote) rows.push([\'Deposit to book (\' + (Number(s.deposit_pct) || 25) + \'%)\', money(deposit), \'note\']);\n' +
          '  if (isInvoice || isReceipt) rows.push([\'Deposit paid\' + (depositPaid ? \' \' + day(depositPaid.paid_at) : \'\'), \'-\' + money(q.deposit_due)]);\n' +
          '  if (isReceipt) rows.push([\'Balance paid \' + day(q.balance_paid_at), \'-\' + money(q.balance_due)]);\n' +
          '  rows.push(isInvoice ? [\'Balance due\', money(q.balance_due), \'total\'] : isReceipt ? [\'Still to pay\', money(0), \'total\'] : null);\n' +
          '  // Totals on the right; what the price assumes on the left\n' +
          '  const assumptions = isQuote ? (q.assumptions || []) : [];\n' +
          '  const aLines = assumptions.map(a => wrapText(a, 8.5, false, 262));\n' +
          '  const totalsH = rows.filter(Boolean).length * 18 + 14;\n' +
          '  const notesH = assumptions.length ? 22 + aLines.reduce((n, l) => n + l.length * 11.5, 0) : 0;\n' +
          '  y += 12;\n' +
          '  room(Math.max(totalsH, notesH) + 10);\n' +
          '  const top = y;\n' +
          '  for (const r of rows.filter(Boolean)) {\n' +
          '    if (r[2] === \'total\') { doc.line(330, y + 4, R, y + 4, C.ink, 0.9); y += 6; }\n' +
          '    y += 18;\n' +
          '    doc.text(340, y, r[0], { size: r[2] === \'total\' ? 11 : 9.5, bold: r[2] === \'total\', color: r[2] === \'note\' ? C.brand : C.body });\n' +
          '    doc.text(COL_AMT, y, r[1], { size: r[2] === \'total\' ? 12 : 9.5, bold: r[2] === \'total\' || r[2] === \'note\', color: r[2] === \'note\' ? C.brand : C.ink, align: \'right\' });\n' +
          '  }\n' +
          '  if (assumptions.length) {\n' +
          '    let ay = top + 18;\n' +
          '    doc.text(L, ay, \'What this price assumes\', { size: 9.5, bold: true });\n' +
          '    ay += 3;\n' +
          '    aLines.forEach(lines => lines.forEach((t, i) => { ay += 11.5; if (!i) doc.text(L + 1, ay, \'•\', { size: 8.5, color: C.leaf }); doc.text(L + 12, ay, t, { size: 8.5, color: C.body }); }));\n' +
          '    y = Math.max(y, ay);\n' +
          '  }\n' +
          '  y += 24;\n' +
          '\n' +
          '  // Accept / pay / paid box\n' +
          '  const boxLines = [];\n' +
          '  let boxTitle = \'\', link = \'\';\n' +
          '  if (isQuote && accepted) {\n' +
          '    boxTitle = \'Accepted online\';\n' +
          '    boxLines.push(\'Signed by \' + q.signed_name + \' on \' + toDt(q.accepted_at).toFormat("d LLL yyyy \'at\' HH:mm") + \'.\');\n' +
          '    if (q.sign_meta && q.sign_meta.fingerprint) boxLines.push(\'Quote fingerprint (SHA-256): \' + String(q.sign_meta.fingerprint).slice(0, 32) + \'…\');\n' +
          '  } else if (isQuote) {\n' +
          '    boxTitle = \'Accept online\';\n' +
          '    boxLines.push(\'Choose any extras, sign and book your start date at:\');\n' +
          '    link = quoteUrl(s, q.token);\n' +
          '  } else if (isInvoice) {\n' +
          '    boxTitle = \'How to pay \' + money(q.balance_due);\n' +
          '    boxLines.push(\'By card: use the link below (or the button in our email).\');\n'
        ) +
        (
          '    boxLines.push(\'By bank transfer: \' + (s.bank_name || s.company_legal) + \' · sort code \' + (s.bank_sort_code || \'\') + \' · account \' + (s.bank_account || \'\') + \' · reference \' + number);\n' +
          '    link = payUrl(s, q.token, \'balance\');\n' +
          '  } else {\n' +
          '    boxTitle = \'Paid in full. Thank you!\';\n' +
          '    boxLines.push(\'Received \' + money(Number(q.deposit_due) + Number(q.balance_due)) + \' in total. Your plants and turf are guaranteed for 3 months if watered as advised.\');\n' +
          '  }\n' +
          '  const wrapped = boxLines.flatMap(t => wrapText(t, 9, false, W - 32));\n' +
          '  const boxH = 27 + wrapped.length * 12.5 + (link ? 15 : 0) + 6;\n' +
          '  room(boxH + 10);\n' +
          '  doc.rect(L, y, W, boxH, C.pale);\n' +
          '  doc.rect(L, y, 4, boxH, C.leaf);\n' +
          '  doc.text(L + 18, y + 19, boxTitle, { size: 11, bold: true, color: C.brand });\n' +
          '  let by = y + 19;\n' +
          '  for (const t of wrapped) { by += 12.5; doc.text(L + 18, by, t, { size: 9, color: C.body }); }\n' +
          '  if (link) { by += 15; const lw = doc.text(L + 18, by, link, { size: 9, bold: true, color: C.brand }); doc.link(L + 16, by - 10, lw + 4, 14, link); }\n' +
          '  y += boxH + 22;\n' +
          '\n' +
          '  // Terms\n' +
          '  if (!isReceipt) {\n' +
          '    const terms = isInvoice ? [\n' +
          '      \'Payment is due by \' + day(toDt(q.completed_at).plus({ days: Number(s.payment_days) || 7 }).toISO()) + \'. For bank transfers please use the reference \' + number + \'.\',\n' +
          '      \'New plants and turf are guaranteed for 3 months if watered as advised; paving and fencing workmanship for 5 years.\'\n' +
          '    ] : quoteTerms(q, s);\n' +
          '    const termLines = terms.map(t => wrapText(t, 8, false, W - 16));\n' +
          '    room(16 + termLines.reduce((n, l) => n + l.length * 11, 0));\n' +
          '    doc.text(L, y, \'Terms\', { size: 9, bold: true, color: C.body });\n' +
          '    termLines.forEach((lines, i) => lines.forEach((l, j) => { y += 11; if (!j) doc.text(L, y, (i + 1) + \'.\', { size: 8, color: C.muted }); doc.text(L + 14, y, l, { size: 8, color: C.muted }); }));\n' +
          '  }\n' +
          '\n' +
          '  // Footers\n' +
          '  doc.pages.forEach((p, i) => {\n' +
          '    doc.cur = p;\n' +
          '    doc.line(L, PDF_H - 52, R, PDF_H - 52, C.line, 0.5);\n' +
          '    doc.text(L, PDF_H - 38, (s.company_legal || s.company) + \' · Company no. \' + (s.company_number || \'\') + \' · VAT \' + (s.vat_number || \'\'), { size: 7.5, color: C.muted });\n' +
          '    doc.text(L, PDF_H - 27, (s.company_address || \'\') + \' · \' + (s.company_phone || \'\') + \' · \' + (s.company_email || \'\'), { size: 7.5, color: C.muted });\n' +
          '    doc.text(R, PDF_H - 38, \'Page \' + (i + 1) + \' of \' + doc.pages.length, { size: 7.5, color: C.muted, align: \'right\' });\n' +
          '  });\n' +
          '  return { buffer: doc.render(), fileName: number + (isReceipt ? \'-receipt\' : \'\') + \'.pdf\', title: doc.title };\n' +
          '}\n' +
          '// ---- end lib-docs.js ----\n' +
          '// ---- lib-pdf-request.js: find the quote for a token and make the requested PDF (quote, invoice, receipt) ----\n' +
          'async function pdfFor(helpers, T, token, doc) {\n' +
          '  const s = settingsOf(T.Settings);\n' +
          '  const row = (T.Quotes || []).find(r => token && String(r.token) === String(token));\n' +
          '  const q = quoteOf(row);\n' +
          '  doc = [\'quote\', \'invoice\', \'receipt\'].includes(doc) ? doc : \'quote\';\n' +
          '  if (!q) return { json: { ok: false, code: 404, message: \'This link is not valid.\' } };\n' +
          '  if (doc === \'invoice\' && !q.completed_at) return { json: { ok: false, code: 404, message: \'There is no invoice for this job yet.\' } };\n' +
          '  if (doc === \'receipt\' && !q.balance_paid_at) return { json: { ok: false, code: 404, message: \'This job has not been paid in full yet.\' } };\n' +
          '  const payments = (T.Payments || []).filter(p => p.quote_id === q.quote_id);\n' +
          '  const d = documentPdf(q, s, doc, payments);\n' +
          '  const data = await helpers.prepareBinaryData(d.buffer, d.fileName, \'application/pdf\');\n' +
          '  return { json: { ok: true, code: 200, quote_id: q.quote_id, doc, fileName: d.fileName, bytes: d.buffer.length }, binary: { data } };\n' +
          '}\n' +
          '// ---- end lib-pdf-request.js ----\n' +
          'const query = $(\'PDF Request\').first().json.query || {};\n' +
          'return [await pdfFor(this.helpers, tablesOf($(\'Load Quote\').first().json), String(query.t || \'\'), String(query.doc || \'quote\'))];\n'
        )
  } },
  output: [{ ok: true, code: 200, quote_id: 'Q-1005', doc: 'quote', fileName: 'Q-1005.pdf' }]
});

const found = ifElse({
  version: 2.2,
  config: {
    name: 'Found?',
    position: [860, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const sendPdf = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send PDF', position: [1080, 200], parameters: { respondWith: 'binary', responseDataSource: 'set', inputFieldName: 'data', options: { responseHeaders: { entries: [
    { name: 'Content-Type', value: 'application/pdf' },
    { name: 'Content-Disposition', value: expr('inline; filename="{{ $json.fileName }}"') },
    { name: 'Cache-Control', value: 'no-store' },
    { name: 'X-Robots-Tag', value: 'noindex' }
  ] } } } }
});

const notFound = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Not Found Page', position: [1080, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// A friendly page when the link is wrong or the document doesn\'t exist yet.\n' +
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
          'const s = settingsOf(tablesOf($(\'Load Quote\').first().json).Settings);\n' +
          'return [{ json: { html: pageHtml(s, \'Document not available\', \'<p>\' + esc($input.first().json.message || \'This link is not valid.\') + \'</p><p class="muted">If you think this is a mistake, call us on \' + esc(s.company_phone || \'\') + \'.</p>\') } }];\n'
        )
  } },
  output: [{ html: '<html></html>' }]
});

const sendNotFound = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Not Found', position: [1300, 400], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: 404, responseHeaders: HTML_HEADERS } } }
});

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 640], parameters: { inputSource: 'passthrough' } },
  output: [{ token: 'abc', attach: 'quote' }]
});

const loadEmail = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote (Email)',
    position: [420, 640],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const makePdfEmail = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Make PDF (Email)', position: [640, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Same PDF for an email attachment (called by Mossgrove 7 in live mode, one item per email).\n' +
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
          '// ---- lib-pdf.js (included by build.py): a small PDF writer, so documents need no outside service ----\n' +
          '// A4 pages, Helvetica and Helvetica-Bold (built into every PDF reader), boxes, lines, paths and links.\n' +
          '// Positions are in points from the top-left corner; the writer flips them for PDF.\n' +
          'const PDF_W = 595.28, PDF_H = 841.89;\n' +
          'const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];\n' +
          'const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];\n' +
          '// Characters outside ASCII that WinAnsiEncoding has: [code, width regular, width bold]\n' +
          'const WIN_EXTRA = { \'£\': [0xA3, 556, 556], \'€\': [0x80, 556, 556], \'–\': [0x96, 556, 556], \'—\': [0x97, 1000, 1000], \'•\': [0x95, 350, 350], \'×\': [0xD7, 584, 584], \'’\': [0x92, 222, 278], \'‘\': [0x91, 222, 278], \'“\': [0x93, 333, 500], \'”\': [0x94, 333, 500], \'é\': [0xE9, 556, 556], \'²\': [0xB2, 333, 333], \'°\': [0xB0, 400, 400], \'·\': [0xB7, 278, 278], \'…\': [0x85, 1000, 1000], \' \': [0x20, 278, 278] };\n' +
          '\n' +
          'function pdfChar(ch, bold) {\n' +
          '  const c = ch.charCodeAt(0);\n' +
          '  if (c >= 32 && c <= 126) return [c, (bold ? HELV_B : HELV)[c - 32]];\n' +
          '  const x = WIN_EXTRA[ch];\n' +
          '  if (x) return [x[0], bold ? x[2] : x[1]];\n' +
          '  return [63, bold ? 611 : 556];\n' +
          '}\n' +
          'function textWidth(s, size, bold) {\n' +
          '  let w = 0;\n' +
          '  for (const ch of String(s)) w += pdfChar(ch, bold)[1];\n' +
          '  return w * size / 1000;\n' +
          '}\n' +
          'function pdfText(s, bold) {\n' +
          '  let out = \'\';\n' +
          '  for (const ch of String(s)) {\n' +
          '    const t = String.fromCharCode(pdfChar(ch, bold)[0]);\n' +
          '    out += (t === \'(\' || t === \')\' || t === \'\\\\\') ? \'\\\\\' + t : t;\n' +
          '  }\n' +
          '  return \'(\' + out + \')\';\n' +
          '}\n' +
          '// Word-wrap to a width; keeps the writer\'s line breaks.\n' +
          'function wrapText(s, size, bold, maxW) {\n' +
          '  const lines = [];\n' +
          '  for (const para of String(s === null || s === undefined ? \'\' : s).replace(/\\t/g, \' \').split(\'\\n\')) {\n' +
          '    let line = \'\';\n' +
          '    for (const word of para.split(/\\s+/).filter(Boolean)) {\n' +
          '      const t = line ? line + \' \' + word : word;\n' +
          '      if (!line || textWidth(t, size, bold) <= maxW) line = t;\n' +
          '      else { lines.push(line); line = word; }\n' +
          '    }\n' +
          '    lines.push(line);\n' +
          '  }\n' +
          '  return lines;\n' +
          '}\n' +
          'const pdfNum = n => (Math.round(n * 100) / 100).toString();\n' +
          'function rgb(hex) {\n' +
          '  const h = String(hex).replace(\'#\', \'\');\n' +
          '  return [0, 2, 4].map(i => pdfNum(parseInt(h.slice(i, i + 2), 16) / 255)).join(\' \');\n' +
          '}\n' +
          '\n' +
          'function newPdf(title) {\n' +
          '  const doc = { title: title || \'Document\', pages: [], cur: null };\n' +
          '  doc.addPage = () => { const p = { ops: [], links: [] }; doc.pages.push(p); doc.cur = p; return p; };\n' +
          '  doc.rect = (x, y, w, h, fill) => doc.cur.ops.push(rgb(fill) + \' rg \' + pdfNum(x) + \' \' + pdfNum(PDF_H - y - h) + \' \' + pdfNum(w) + \' \' + pdfNum(h) + \' re f\');\n' +
          '  doc.box = (x, y, w, h, stroke, width) => doc.cur.ops.push(rgb(stroke) + \' RG \' + pdfNum(width || 0.75) + \' w \' + pdfNum(x) + \' \' + pdfNum(PDF_H - y - h) + \' \' + pdfNum(w) + \' \' + pdfNum(h) + \' re S\');\n' +
          '  doc.line = (x1, y1, x2, y2, color, width) => doc.cur.ops.push(rgb(color) + \' RG \' + pdfNum(width || 0.5) + \' w \' + pdfNum(x1) + \' \' + pdfNum(PDF_H - y1) + \' m \' + pdfNum(x2) + \' \' + pdfNum(PDF_H - y2) + \' l S\');\n'
        ) +
        (
          '  // y is the text baseline. align: left (x = start), right (x = end), center (x = middle)\n' +
          '  doc.text = (x, y, s, o) => {\n' +
          '    o = o || {};\n' +
          '    const size = o.size || 10, bold = !!o.bold;\n' +
          '    const w = textWidth(s, size, bold);\n' +
          '    const left = o.align === \'right\' ? x - w : (o.align === \'center\' ? x - w / 2 : x);\n' +
          '    doc.cur.ops.push(\'BT /\' + (bold ? \'F2\' : \'F1\') + \' \' + pdfNum(size) + \' Tf \' + rgb(o.color || \'#1d2a24\') + \' rg \' + pdfNum(left) + \' \' + pdfNum(PDF_H - y) + \' Td \' + pdfText(s, bold) + \' Tj ET\');\n' +
          '    return w;\n' +
          '  };\n' +
          '  // A closed shape from moves, lines and curves: [[\'M\',x,y], [\'C\',x1,y1,x2,y2,x,y], [\'L\',x,y]]\n' +
          '  doc.shape = (cmds, fill) => {\n' +
          '    const parts = cmds.map(c => c[0] === \'M\' ? pdfNum(c[1]) + \' \' + pdfNum(PDF_H - c[2]) + \' m\'\n' +
          '      : c[0] === \'L\' ? pdfNum(c[1]) + \' \' + pdfNum(PDF_H - c[2]) + \' l\'\n' +
          '      : [c[1], PDF_H - c[2], c[3], PDF_H - c[4], c[5], PDF_H - c[6]].map(pdfNum).join(\' \') + \' c\');\n' +
          '    doc.cur.ops.push(rgb(fill) + \' rg \' + parts.join(\' \') + \' h f\');\n' +
          '  };\n' +
          '  doc.link = (x, y, w, h, url) => doc.cur.links.push({ rect: [x, PDF_H - y - h, x + w, PDF_H - y].map(pdfNum).join(\' \'), url: String(url) });\n' +
          '  doc.render = () => {\n' +
          '    const objs = [];\n' +
          '    const add = s => { objs.push(s); return objs.length; };\n' +
          '    add(\'<< /Type /Catalog /Pages 2 0 R >>\');\n' +
          '    add(\'PAGES\');\n' +
          '    add(\'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\');\n' +
          '    add(\'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\');\n' +
          '    const kids = [];\n' +
          '    for (const p of doc.pages) {\n' +
          '      const stream = p.ops.join(\'\\n\');\n' +
          '      const contents = add(\'<< /Length \' + stream.length + \' >>\\nstream\\n\' + stream + \'\\nendstream\');\n' +
          '      const annots = p.links.map(l => add(\'<< /Type /Annot /Subtype /Link /Rect [\' + l.rect + \'] /Border [0 0 0] /A << /S /URI /URI \' + pdfText(l.url) + \' >> >>\'));\n' +
          '      kids.push(add(\'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 \' + PDF_W + \' \' + PDF_H + \'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents \' + contents + \' 0 R\' + (annots.length ? \' /Annots [\' + annots.map(a => a + \' 0 R\').join(\' \') + \']\' : \'\') + \' >>\'));\n' +
          '    }\n' +
          '    objs[1] = \'<< /Type /Pages /Kids [\' + kids.map(k => k + \' 0 R\').join(\' \') + \'] /Count \' + kids.length + \' >>\';\n' +
          '    const info = add(\'<< /Title \' + pdfText(doc.title) + \' /Producer (n8n workflow) >>\');\n' +
          '    let out = \'%PDF-1.4\\n%âãÏÓ\\n\';\n' +
          '    const offsets = [];\n' +
          '    objs.forEach((o, i) => { offsets.push(out.length); out += (i + 1) + \' 0 obj\\n\' + o + \'\\nendobj\\n\'; });\n' +
          '    const xref = out.length;\n' +
          '    out += \'xref\\n0 \' + (objs.length + 1) + \'\\n0000000000 65535 f \\n\' + offsets.map(o => String(o).padStart(10, \'0\') + \' 00000 n \\n\').join(\'\');\n' +
          '    out += \'trailer\\n<< /Size \' + (objs.length + 1) + \' /Root 1 0 R /Info \' + info + \' 0 R >>\\nstartxref\\n\' + xref + \'\\n%%EOF\\n\';\n' +
          '    return Buffer.from(out, \'latin1\');\n' +
          '  };\n' +
          '  return doc;\n' +
          '}\n' +
          '// ---- end lib-pdf.js ----\n' +
          '// ---- lib-docs.js (included by build.py): the quote, invoice and receipt PDFs (needs lib-pdf and lib-mgv) ----\n' +
          'const C = { brand: \'#1f4d3a\', leaf: \'#7bb661\', ink: \'#1d2a24\', body: \'#3d4b44\', muted: \'#76847c\', line: \'#e1e7e2\', soft: \'#eef3ef\', pale: \'#f4f8f4\', white: \'#ffffff\', tint: \'#cfe3d3\' };\n' +
          'const L = 48, R = PDF_W - 48, W = R - L, BOTTOM = PDF_H - 64;\n' +
          '\n' +
          'function documentPdf(q, s, docType, payments) {\n' +
          '  const isQuote = docType === \'quote\', isInvoice = docType === \'invoice\', isReceipt = docType === \'receipt\';\n' +
          '  const number = isQuote ? q.quote_id : (q.invoice_id || q.quote_id.replace(\'Q-\', \'INV-\'));\n' +
          '  const title = isQuote ? \'QUOTE\' : (isInvoice ? \'INVOICE\' : \'RECEIPT\');\n' +
          '  const doc = newPdf(s.company + \' \' + title.toLowerCase() + \' \' + number);\n' +
          '  const accepted = !!q.accepted_at;\n' +
          '  const chosen = accepted ? (q.chosen_extras || []) : [];\n' +
          '  const vatPct = Math.round(Number(s.vat_rate === \'\' || s.vat_rate === undefined ? 0.2 : s.vat_rate) * 100);\n' +
          '  let y = 0;\n' +
          '\n' +
          '  function leaf(x, top, size, color, vein) {\n' +
          '    const k = size / 34, X = u => x + u * k, Y = v => top + v * k;\n' +
          '    doc.shape([[\'M\', X(2), Y(32)], [\'C\', X(2), Y(14), X(14), Y(2), X(32), Y(2)], [\'C\', X(32), Y(20), X(20), Y(32), X(2), Y(32)]], color);\n' +
          '    doc.line(X(5), Y(29), X(27), Y(7), vein, 1.4 * k);\n' +
          '  }\n' +
          '  function header() {\n' +
          '    doc.addPage();\n' +
          '    doc.rect(0, 0, PDF_W, 92, C.brand);\n' +
          '    leaf(L, 27, 38, C.leaf, C.brand);\n' +
          '    doc.text(L + 50, 49, s.company || \'Mossgrove Landscapes\', { size: 18, bold: true, color: C.white });\n' +
          '    doc.text(L + 50, 65, \'Garden design · patios · fencing · lawns\', { size: 9, color: C.tint });\n' +
          '    doc.text(R, 47, title, { size: 22, bold: true, color: C.white, align: \'right\' });\n' +
          '    doc.text(R, 65, number, { size: 11, color: C.tint, align: \'right\' });\n' +
          '    y = 92;\n' +
          '  }\n' +
          '  function continuation() {\n' +
          '    doc.addPage();\n' +
          '    doc.rect(0, 0, PDF_W, 34, C.brand);\n' +
          '    leaf(L, 9, 16, C.leaf, C.brand);\n' +
          '    doc.text(L + 24, 21.5, s.company || \'Mossgrove Landscapes\', { size: 10, bold: true, color: C.white });\n' +
          '    doc.text(R, 21.5, title + \' \' + number + \' (continued)\', { size: 9, color: C.tint, align: \'right\' });\n' +
          '    y = 58;\n' +
          '  }\n' +
          '  const room = h => { if (y + h > BOTTOM) { continuation(); return true; } return false; };\n' +
          '\n' +
          '  header();\n' +
          '  // Who and when\n' +
          '  y += 34;\n' +
          '  doc.text(L, y, isQuote ? \'PREPARED FOR\' : \'BILL TO\', { size: 7.5, bold: true, color: C.muted });\n' +
          '  let ly = y + 16;\n' +
          '  doc.text(L, ly, q.client_name, { size: 11.5, bold: true });\n' +
          '  for (const line of wrapText(String(q.site_address || \'\') + (q.postcode && String(q.site_address || \'\').indexOf(q.postcode) < 0 ? \', \' + q.postcode : \'\'), 9.5, false, 250)) { ly += 13.5; doc.text(L, ly, line, { size: 9.5, color: C.body }); }\n' +
          '  if (q.client_email) { ly += 13.5; doc.text(L, ly, q.client_email, { size: 9, color: C.muted }); }\n' +
          '  if (q.client_phone) { ly += 12.5; doc.text(L, ly, String(q.client_phone), { size: 9, color: C.muted }); }\n' +
          '  const meta = isQuote\n' +
          '    ? [[\'Quote number\', q.quote_id], [\'Date\', day(q.sent_at || q.created_at)], [\'Valid until\', day(q.valid_until) || day(toDt(q.created_at).plus({ days: Number(s.validity_days) || 30 }).toISO())], [\'Prepared by\', q.estimator || s.owner_name]]\n' +
          '    : isInvoice\n' +
          '      ? [[\'Invoice number\', number], [\'Invoice date\', day(q.completed_at)], [\'Due date\', day(toDt(q.completed_at).plus({ days: Number(s.payment_days) || 7 }).toISO())], [\'Quote\', q.quote_id]]\n' +
          '      : [[\'Receipt for\', number], [\'Paid on\', day(q.balance_paid_at)], [\'Quote\', q.quote_id], [\'Job\', day(q.job_start) + \' to \' + day(q.job_end)]];\n' +
          '  let my = y;\n' +
          '  for (const [k, v] of meta) { doc.text(338, my + 4, k, { size: 9, color: C.muted }); doc.text(R, my + 4, String(v || \'\'), { size: 9.5, bold: true, align: \'right\' }); my += 17; }\n' +
          '  y = Math.max(ly, my) + 16;\n'
        ) +
        (
          '  doc.line(L, y, R, y, C.line, 0.75);\n' +
          '\n' +
          '  // The job\n' +
          '  y += 27;\n' +
          '  doc.text(L, y, q.job_title || \'Garden works\', { size: 15.5, bold: true });\n' +
          '  y += 8;\n' +
          '  if (isQuote && q.summary) for (const line of wrapText(q.summary, 10, false, W)) { y += 14.5; doc.text(L, y, line, { size: 10, color: C.body }); }\n' +
          '  y += 16;\n' +
          '\n' +
          '  // Table\n' +
          '  const COL_QTY = 392, COL_PRICE = 470, COL_AMT = R - 10, DESC_W = 290;\n' +
          '  function tableHead() {\n' +
          '    doc.rect(L, y, W, 22, C.soft);\n' +
          '    doc.text(L + 10, y + 14.5, \'DESCRIPTION\', { size: 7.5, bold: true, color: C.muted });\n' +
          '    doc.text(COL_QTY, y + 14.5, \'QUANTITY\', { size: 7.5, bold: true, color: C.muted, align: \'right\' });\n' +
          '    doc.text(COL_PRICE, y + 14.5, \'UNIT PRICE\', { size: 7.5, bold: true, color: C.muted, align: \'right\' });\n' +
          '    doc.text(COL_AMT, y + 14.5, \'AMOUNT\', { size: 7.5, bold: true, color: C.muted, align: \'right\' });\n' +
          '    y += 22;\n' +
          '  }\n' +
          '  function row(name, note, qty, unit, price, amount, muted) {\n' +
          '    const nameLines = wrapText(name, 9.5, true, DESC_W);\n' +
          '    const noteLines = note ? wrapText(note, 8.5, false, DESC_W) : [];\n' +
          '    const h = 9 + nameLines.length * 12 + noteLines.length * 10.5 + 5;\n' +
          '    if (room(h)) tableHead();\n' +
          '    let ty = y + 15;\n' +
          '    nameLines.forEach((t, i) => doc.text(L + 10, ty + i * 12, t, { size: 9.5, bold: true, color: muted ? C.body : C.ink }));\n' +
          '    const ny = ty + nameLines.length * 12 - 1.5;\n' +
          '    noteLines.forEach((t, i) => doc.text(L + 10, ny + i * 10.5, t, { size: 8.5, color: C.muted }));\n' +
          '    doc.text(COL_QTY, ty, qty, { size: 9.5, color: C.body, align: \'right\' });\n' +
          '    doc.text(COL_PRICE, ty, price, { size: 9.5, color: C.body, align: \'right\' });\n' +
          '    doc.text(COL_AMT, ty, amount, { size: 9.5, bold: !muted, color: muted ? C.body : C.ink, align: \'right\' });\n' +
          '    y += h;\n' +
          '    doc.line(L, y, R, y, C.line, 0.5);\n' +
          '  }\n' +
          '  const qtyCell = l => l.unit === \'each\' ? qtyText(l.quantity) : qtyText(l.quantity) + \' \' + unitText(l.unit, l.quantity);\n' +
          '  const priceCell = l => money(l.unit_price) + (l.unit === \'each\' ? \'\' : \' / \' + (l.unit === \'metre\' ? \'m\' : l.unit));\n' +
          '  room(60);\n' +
          '  tableHead();\n' +
          '  for (const l of q.lines || []) row(l.item, l.label, qtyCell(l), l.unit, priceCell(l), money(l.amount));\n' +
          '  for (const c of q.custom || []) row(c.description, \'\', qtyCell(c), c.unit, c.unit_price === null ? \'to price\' : money(c.unit_price), c.amount === null || c.amount === undefined ? \'to price\' : money(c.amount));\n' +
          '  for (const x of (q.extras || []).filter(x => chosen.includes(x.code))) row(x.item, \'Optional extra you added\' + (x.label ? \': \' + x.label : \'\'), qtyCell(x), x.unit, priceCell(x), money(x.amount));\n' +
          '\n' +
          '  // Optional extras still on offer (quote only)\n' +
          '  const offer = isQuote && !accepted ? (q.extras || []) : [];\n' +
          '  if (offer.length) {\n' +
          '    y += 22;\n' +
          '    room(40);\n' +
          '    doc.text(L, y, \'Optional extras\', { size: 10.5, bold: true });\n' +
          '    doc.text(L + textWidth(\'Optional extras\', 10.5, true) + 8, y, \'(not included in the total; tick them when you accept online)\', { size: 8.5, color: C.muted });\n' +
          '    y += 8;\n' +
          '    for (const x of offer) row(x.item, x.why || x.label, qtyCell(x), x.unit, priceCell(x), money(x.amount), true);\n' +
          '  }\n' +
          '\n' +
          '  // Totals\n' +
          '  const subtotal = accepted ? q.accepted_subtotal : q.subtotal, vat = accepted ? q.accepted_vat : q.vat, total = accepted ? q.accepted_total : q.total;\n' +
          '  const deposit = accepted ? q.deposit_due : q.deposit;\n' +
          '  const depositPaid = (payments || []).find(p => p.kind === \'deposit\' && p.status === \'paid\');\n' +
          '  const balancePaid = (payments || []).find(p => p.kind === \'balance\' && p.status === \'paid\');\n' +
          '  const rows = [[\'Subtotal\', money(subtotal)], [\'VAT (\' + vatPct + \'%)\', money(vat)], [\'Total\', money(total), \'total\']];\n' +
          '  if (isQuote) rows.push([\'Deposit to book (\' + (Number(s.deposit_pct) || 25) + \'%)\', money(deposit), \'note\']);\n' +
          '  if (isInvoice || isReceipt) rows.push([\'Deposit paid\' + (depositPaid ? \' \' + day(depositPaid.paid_at) : \'\'), \'-\' + money(q.deposit_due)]);\n' +
          '  if (isReceipt) rows.push([\'Balance paid \' + day(q.balance_paid_at), \'-\' + money(q.balance_due)]);\n' +
          '  rows.push(isInvoice ? [\'Balance due\', money(q.balance_due), \'total\'] : isReceipt ? [\'Still to pay\', money(0), \'total\'] : null);\n' +
          '  // Totals on the right; what the price assumes on the left\n' +
          '  const assumptions = isQuote ? (q.assumptions || []) : [];\n' +
          '  const aLines = assumptions.map(a => wrapText(a, 8.5, false, 262));\n' +
          '  const totalsH = rows.filter(Boolean).length * 18 + 14;\n' +
          '  const notesH = assumptions.length ? 22 + aLines.reduce((n, l) => n + l.length * 11.5, 0) : 0;\n' +
          '  y += 12;\n' +
          '  room(Math.max(totalsH, notesH) + 10);\n' +
          '  const top = y;\n' +
          '  for (const r of rows.filter(Boolean)) {\n' +
          '    if (r[2] === \'total\') { doc.line(330, y + 4, R, y + 4, C.ink, 0.9); y += 6; }\n' +
          '    y += 18;\n' +
          '    doc.text(340, y, r[0], { size: r[2] === \'total\' ? 11 : 9.5, bold: r[2] === \'total\', color: r[2] === \'note\' ? C.brand : C.body });\n' +
          '    doc.text(COL_AMT, y, r[1], { size: r[2] === \'total\' ? 12 : 9.5, bold: r[2] === \'total\' || r[2] === \'note\', color: r[2] === \'note\' ? C.brand : C.ink, align: \'right\' });\n' +
          '  }\n' +
          '  if (assumptions.length) {\n' +
          '    let ay = top + 18;\n' +
          '    doc.text(L, ay, \'What this price assumes\', { size: 9.5, bold: true });\n' +
          '    ay += 3;\n' +
          '    aLines.forEach(lines => lines.forEach((t, i) => { ay += 11.5; if (!i) doc.text(L + 1, ay, \'•\', { size: 8.5, color: C.leaf }); doc.text(L + 12, ay, t, { size: 8.5, color: C.body }); }));\n' +
          '    y = Math.max(y, ay);\n' +
          '  }\n' +
          '  y += 24;\n' +
          '\n' +
          '  // Accept / pay / paid box\n' +
          '  const boxLines = [];\n' +
          '  let boxTitle = \'\', link = \'\';\n' +
          '  if (isQuote && accepted) {\n' +
          '    boxTitle = \'Accepted online\';\n' +
          '    boxLines.push(\'Signed by \' + q.signed_name + \' on \' + toDt(q.accepted_at).toFormat("d LLL yyyy \'at\' HH:mm") + \'.\');\n' +
          '    if (q.sign_meta && q.sign_meta.fingerprint) boxLines.push(\'Quote fingerprint (SHA-256): \' + String(q.sign_meta.fingerprint).slice(0, 32) + \'…\');\n' +
          '  } else if (isQuote) {\n' +
          '    boxTitle = \'Accept online\';\n' +
          '    boxLines.push(\'Choose any extras, sign and book your start date at:\');\n' +
          '    link = quoteUrl(s, q.token);\n' +
          '  } else if (isInvoice) {\n' +
          '    boxTitle = \'How to pay \' + money(q.balance_due);\n' +
          '    boxLines.push(\'By card: use the link below (or the button in our email).\');\n'
        ) +
        (
          '    boxLines.push(\'By bank transfer: \' + (s.bank_name || s.company_legal) + \' · sort code \' + (s.bank_sort_code || \'\') + \' · account \' + (s.bank_account || \'\') + \' · reference \' + number);\n' +
          '    link = payUrl(s, q.token, \'balance\');\n' +
          '  } else {\n' +
          '    boxTitle = \'Paid in full. Thank you!\';\n' +
          '    boxLines.push(\'Received \' + money(Number(q.deposit_due) + Number(q.balance_due)) + \' in total. Your plants and turf are guaranteed for 3 months if watered as advised.\');\n' +
          '  }\n' +
          '  const wrapped = boxLines.flatMap(t => wrapText(t, 9, false, W - 32));\n' +
          '  const boxH = 27 + wrapped.length * 12.5 + (link ? 15 : 0) + 6;\n' +
          '  room(boxH + 10);\n' +
          '  doc.rect(L, y, W, boxH, C.pale);\n' +
          '  doc.rect(L, y, 4, boxH, C.leaf);\n' +
          '  doc.text(L + 18, y + 19, boxTitle, { size: 11, bold: true, color: C.brand });\n' +
          '  let by = y + 19;\n' +
          '  for (const t of wrapped) { by += 12.5; doc.text(L + 18, by, t, { size: 9, color: C.body }); }\n' +
          '  if (link) { by += 15; const lw = doc.text(L + 18, by, link, { size: 9, bold: true, color: C.brand }); doc.link(L + 16, by - 10, lw + 4, 14, link); }\n' +
          '  y += boxH + 22;\n' +
          '\n' +
          '  // Terms\n' +
          '  if (!isReceipt) {\n' +
          '    const terms = isInvoice ? [\n' +
          '      \'Payment is due by \' + day(toDt(q.completed_at).plus({ days: Number(s.payment_days) || 7 }).toISO()) + \'. For bank transfers please use the reference \' + number + \'.\',\n' +
          '      \'New plants and turf are guaranteed for 3 months if watered as advised; paving and fencing workmanship for 5 years.\'\n' +
          '    ] : quoteTerms(q, s);\n' +
          '    const termLines = terms.map(t => wrapText(t, 8, false, W - 16));\n' +
          '    room(16 + termLines.reduce((n, l) => n + l.length * 11, 0));\n' +
          '    doc.text(L, y, \'Terms\', { size: 9, bold: true, color: C.body });\n' +
          '    termLines.forEach((lines, i) => lines.forEach((l, j) => { y += 11; if (!j) doc.text(L, y, (i + 1) + \'.\', { size: 8, color: C.muted }); doc.text(L + 14, y, l, { size: 8, color: C.muted }); }));\n' +
          '  }\n' +
          '\n' +
          '  // Footers\n' +
          '  doc.pages.forEach((p, i) => {\n' +
          '    doc.cur = p;\n' +
          '    doc.line(L, PDF_H - 52, R, PDF_H - 52, C.line, 0.5);\n' +
          '    doc.text(L, PDF_H - 38, (s.company_legal || s.company) + \' · Company no. \' + (s.company_number || \'\') + \' · VAT \' + (s.vat_number || \'\'), { size: 7.5, color: C.muted });\n' +
          '    doc.text(L, PDF_H - 27, (s.company_address || \'\') + \' · \' + (s.company_phone || \'\') + \' · \' + (s.company_email || \'\'), { size: 7.5, color: C.muted });\n' +
          '    doc.text(R, PDF_H - 38, \'Page \' + (i + 1) + \' of \' + doc.pages.length, { size: 7.5, color: C.muted, align: \'right\' });\n' +
          '  });\n' +
          '  return { buffer: doc.render(), fileName: number + (isReceipt ? \'-receipt\' : \'\') + \'.pdf\', title: doc.title };\n' +
          '}\n' +
          '// ---- end lib-docs.js ----\n' +
          '// ---- lib-pdf-request.js: find the quote for a token and make the requested PDF (quote, invoice, receipt) ----\n' +
          'async function pdfFor(helpers, T, token, doc) {\n' +
          '  const s = settingsOf(T.Settings);\n' +
          '  const row = (T.Quotes || []).find(r => token && String(r.token) === String(token));\n' +
          '  const q = quoteOf(row);\n' +
          '  doc = [\'quote\', \'invoice\', \'receipt\'].includes(doc) ? doc : \'quote\';\n' +
          '  if (!q) return { json: { ok: false, code: 404, message: \'This link is not valid.\' } };\n' +
          '  if (doc === \'invoice\' && !q.completed_at) return { json: { ok: false, code: 404, message: \'There is no invoice for this job yet.\' } };\n' +
          '  if (doc === \'receipt\' && !q.balance_paid_at) return { json: { ok: false, code: 404, message: \'This job has not been paid in full yet.\' } };\n' +
          '  const payments = (T.Payments || []).filter(p => p.quote_id === q.quote_id);\n' +
          '  const d = documentPdf(q, s, doc, payments);\n' +
          '  const data = await helpers.prepareBinaryData(d.buffer, d.fileName, \'application/pdf\');\n' +
          '  return { json: { ok: true, code: 200, quote_id: q.quote_id, doc, fileName: d.fileName, bytes: d.buffer.length }, binary: { data } };\n' +
          '}\n' +
          '// ---- end lib-pdf-request.js ----\n' +
          'const T = tablesOf($(\'Load Quote (Email)\').first().json);\n' +
          'const out = [];\n' +
          'for (const item of $(\'When Called\').all()) out.push(await pdfFor(this.helpers, T, String(item.json.token || \'\'), String(item.json.attach || \'quote\')));\n' +
          'return out;\n'
        )
  } },
  output: [{ ok: true, fileName: 'Q-1005.pdf' }]
});

const note = sticky(
  '## Mossgrove 5: PDF Documents\nQuotes, invoices and receipts are drawn straight from the quote row by a small PDF writer in the **Make PDF** code node, so there is no template service to pay for and the PDF always matches the sheet. The web link (`/webhook/mossgrove/pdf?t=…&doc=quote|invoice|receipt`) works only with the client\'s secret token. **When Called** makes the same PDF for email attachments in live mode.',
  [], { position: [160, 0], width: 1180, height: 170, color: 7 }
);

export default workflow('mossgrove-documents', 'Mossgrove 5: PDF Documents')
  .add(pdfHook)
  .to(loadQuote)
  .to(makePdf)
  .to(found
    .onTrue(sendPdf)
    .onFalse(notFound.to(sendNotFound)))
  .add(whenCalled)
  .to(loadEmail)
  .to(makePdfEmail)
  .add(note);
