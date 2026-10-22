import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const FORM_CRED = { httpBasicAuth: { id: 'mgvEstimatorAuth', name: 'Mossgrove estimator login' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'mgvSaveChange007', cachedResultName: 'Mossgrove 7: Save Changes' };
const FORM_CSS =
  ':root {\n' +
  '  --font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;\n' +
  '  --color-background: #f4f1ea;\n' +
  '  --color-card-bg: #ffffff;\n' +
  '  --color-card-border: #e3ddd0;\n' +
  '  --color-header: #1d2a24;\n' +
  '  --color-label: #3d4b44;\n' +
  '  --color-focus-border: #1f4d3a;\n' +
  '  --color-submit-btn-bg: #1f4d3a;\n' +
  '  --color-submit-btn-text: #ffffff;\n' +
  '  --border-radius-card: 16px;\n' +
  '  --border-radius-input: 10px;\n' +
  '  --font-size-header: 24px;\n' +
  '}\n' +
  '.form-header h1 { letter-spacing: -0.3px; }\n' +
  'button[type="submit"] { font-weight: 600; }\n';

const form = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: {
    name: 'Site Visit Form',
    position: [200, 300],
    parameters: {
      authentication: 'basicAuth',
      formTitle: 'Site visit',
      formDescription: 'Fill this in on your phone before you leave the garden. Type the measurements or record a voice memo; add up to three photos. A priced draft is ready in under a minute and nothing goes to the client until the owner sends it.<br><small>Mossgrove Landscapes is a demo company.</small>',
      formFields: { values: [
        { fieldLabel: 'Client name', fieldName: 'client_name', fieldType: 'text', requiredField: true },
        { fieldLabel: 'Client email', fieldName: 'client_email', fieldType: 'email', requiredField: true },
        { fieldLabel: 'Client phone', fieldName: 'client_phone', fieldType: 'text', placeholder: 'Optional' },
        { fieldLabel: 'Site address', fieldName: 'site_address', fieldType: 'text', requiredField: true },
        { fieldLabel: 'Postcode', fieldName: 'postcode', fieldType: 'text', placeholder: 'e.g. BS6 5DN' },
        { fieldLabel: 'Estimator', fieldName: 'estimator', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [{ option: 'Tom Hale' }, { option: 'Priya Nair' }] } },
        { fieldLabel: 'What does the client want? Measurements, materials, access', fieldName: 'notes', fieldType: 'textarea', placeholder: 'e.g. Sandstone patio off the kitchen, 6 m x 4 m, on lawn. Replace 12 m of fence on the left with closeboard. Maybe lights later.' },
        { fieldLabel: 'Voice memo (instead of or as well as notes)', fieldName: 'voice_memo', fieldType: 'file', multipleFiles: false, acceptFileTypes: '.m4a,.mp3,.wav,.webm,.ogg,.mp4' },
        { fieldLabel: 'Photos (up to 3)', fieldName: 'photos', fieldType: 'file', multipleFiles: true, acceptFileTypes: '.jpg,.jpeg,.png,.webp' }
      ] },
      responseMode: 'lastNode',
      options: { appendAttribution: false, buttonLabel: 'Draft the quote', path: 'mossgrove-site-visit', customCss: FORM_CSS, ignoreBots: true, useWorkflowTimezone: true }
    },
    credentials: FORM_CRED
  },
  output: [{ client_name: 'Grace Whitfield', client_email: 'grace.whitfield@example.com', client_phone: '', site_address: '41 Chesterfield Road, Bristol', postcode: 'BS6 5DN', estimator: 'Tom Hale', notes: 'Patio 6 x 4 on lawn' }]
});

const checkVisit = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Visit', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Checks the site visit form and gathers what the AI needs: the notes, the voice memo (if any) and up to\n' +
          '// three photos (as data URLs for the model). The binary files stay on the item for the transcription step.\n' +
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
          'const item = $input.first();\n' +
          'const f = item.json;\n' +
          'const bin = item.binary || {};\n' +
          'const str = v => String(v === null || v === undefined ? \'\' : v).trim();\n' +
          'const errors = [];\n' +
          'const name = str(f.client_name), email = str(f.client_email).toLowerCase(), address = str(f.site_address);\n' +
          'const notes = str(f.notes);\n' +
          'const keys = Object.keys(bin);\n' +
          'const voiceKey = keys.find(k => /^voice/i.test(k)) || \'\';\n' +
          'const photoKeys = keys.filter(k => /^photo/i.test(k));\n' +
          'if (name.length < 2) errors.push(\'Add the client\\\'s name.\');\n' +
          'if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) errors.push(\'The client email doesn\\\'t look right.\');\n' +
          'if (!address) errors.push(\'Add the site address.\');\n' +
          'if (notes.length < 15 && !voiceKey) errors.push(\'Add notes about the job or attach a voice memo.\');\n' +
          'if (voiceKey && Number(bin[voiceKey].fileSize || 0) > 24e6) errors.push(\'The voice memo is over 24 MB; record a shorter one.\');\n' +
          'const images = [];\n' +
          'let skipped = 0;\n' +
          'for (const k of photoKeys) {\n' +
          '  const b = bin[k];\n' +
          '  if (images.length >= 3 || !/^image\\/(jpeg|png|webp)$/.test(String(b.mimeType || \'\'))) { skipped++; continue; }\n' +
          '  const buf = await this.helpers.getBinaryDataBuffer(0, k);\n' +
          '  if (buf.length > 8e6) { skipped++; continue; }\n' +
          '  images.push(\'data:\' + b.mimeType + \';base64,\' + buf.toString(\'base64\'));\n' +
          '}\n' +
          'return [{ json: {\n' +
          '  ok: !errors.length, errors,\n' +
          '  client_name: name, client_email: email, client_phone: str(f.client_phone), site_address: address,\n' +
          '  postcode: str(f.postcode).toUpperCase(), estimator: str(f.estimator) || \'Tom Hale\', notes,\n' +
          '  has_voice: !!voiceKey, voice_key: voiceKey, images, photo_count: images.length, photos_skipped: skipped,\n' +
          '  started_ms: Date.now()\n' +
          '}, binary: bin }];\n'
        )
  } },
  output: [{ ok: true, errors: [], client_name: 'Grace Whitfield', has_voice: false, voice_key: '', images: [], started_ms: 0 }]
});

const valid = ifElse({
  version: 2.2,
  config: {
    name: 'Valid?',
    position: [640, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const problemPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Problem Page', position: [860, 540], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// The form answers had a problem: list what to fix.\n' +
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
          'const v = $(\'Check Visit\').first().json;\n' +
          'return [{ json: { html: formPage(\'Please check the form\', \'<p class="sub">Nothing was saved. Go back, fix these and send it again:</p><ul>\' + v.errors.map(e => \'<li>\' + esc(e) + \'</li>\').join(\'\') + \'</ul>\') } }];\n'
        )
  } },
  output: [{ html: '<html></html>' }]
});

const showProblem = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Show Problem', position: [1080, 540], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') } }
});

const hasVoice = ifElse({
  version: 2.2,
  config: {
    name: 'Voice Memo?',
    position: [860, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.has_voice }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const transcribe = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Transcribe',
    position: [1080, 160],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/audio/transcriptions',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi',
      sendBody: true, contentType: 'multipart-form-data',
      bodyParameters: { parameters: [
        { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: expr('{{ $json.voice_key }}') },
        { parameterType: 'formData', name: 'model', value: 'gpt-4o-transcribe' },
        { parameterType: 'formData', name: 'response_format', value: 'json' },
        { parameterType: 'formData', name: 'prompt', value: 'Landscaping site visit: patio, porcelain, sandstone, sub-base, closeboard fence, gravel boards, sleepers, turf, m², metres.' }
      ] },
      options: { timeout: 180000 }
    },
    credentials: OPENAI_CRED
  },
  output: [{ text: 'Back garden, patio six by four metres on the lawn.' }]
});

const loadBook = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Price Book',
    position: [1300, 300],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: 'GET',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/1754F1Rep-Rg9J3x6Dnga0fjTeSR4zfaLOS_zD7Zp1J4/values:batchGet?ranges=Settings&ranges=%27Price%20Book%27&ranges=Quotes&valueRenderOption=UNFORMATTED_VALUE',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc', valueRanges: [] }]
});

const buildRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Request', position: [1520, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Builds the OpenAI request. The model gets the price book without prices (codes, items, units, notes),\n' +
          '// the estimator\'s notes, the voice memo transcript and any photos. It picks items and quantities only.\n' +
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
          'const PROMPT =\n' +
          '"You are the estimating assistant for a landscaping company. An estimator has visited a client\'s garden and written or dictated notes. Turn the notes into a draft quote using ONLY the codes in the price book you are given. The owner checks every draft before the client sees it.\\n\\nRules\\n1. lines: one line per price book item the job needs, with the exact code. Work out quantities from the measurements in the notes and show the sum in `label`, for example \\"Patio 6 m × 4 m = 24 m²\\". Round areas to one decimal place. Lengths are in metres.\\n2. Add the groundwork a good landscaper always includes, even when the notes don\'t mention it, and say \\"(standard groundwork)\\" in the label:\\n   - new paving, a patio or a path on lawn or soil: EXC-DIG and SUB-BASE for the same area (a gravel path needs EXC-DIG only);\\n   - one SKIP for every 20 m² of dig-out, at least one;\\n   - replacing a fence: FEN-REMOVE for the old length;\\n   - new turf or artificial grass over an old lawn: TURF-STRIP for the same area.\\n   Follow any other notes in the price book.\\n3. Never invent a measurement. If a size is missing and the notes give no clue, leave the item out and ask in `questions`. If the notes give a rough clue (\\"about the width of the house, roughly 7 metres\\"), use it and add an assumption.\\n4. Work the client wants that is not in the price book goes in `custom_items` (description, quantity, unit, why). The owner will price it.\\n5. extras: at most 3 optional upgrades that suit this job, only from the price book, each with one short sentence in `why`. Anything the client definitely asked for is a line, not an extra; something they were unsure about (\\"maybe some lights later\\") is an extra.\\n6. client_summary: 2 or 3 sentences to the client starting with \\"We\'ll\\", in plain English, with no prices and no codes.\\n7. assumptions: what the price relies on (access, ground conditions, who moves what). Short, at most 4.\\n8. questions: what the estimator should confirm before the quote is sent. Empty if nothing.\\n9. confidence: \\"high\\" if every measurement is clear, \\"medium\\" if you assumed something, \\"low\\" if key measurements are missing.\\n10. evidence: the few words from the notes that the line is based on, copied exactly.\\n\\nThe notes may be a voice memo transcript, so expect filler words and spoken numbers (\\"six by four metres\\"). Photos, if any, are for context such as access and slope; take measurements from the notes."\n' +
          ';\n' +
          'const SCHEMA = JSON.parse(\n' +
          '"{\\"type\\": \\"object\\", \\"additionalProperties\\": false, \\"required\\": [\\"job_title\\", \\"client_summary\\", \\"lines\\", \\"extras\\", \\"custom_items\\", \\"assumptions\\", \\"questions\\", \\"confidence\\"], \\"properties\\": {\\"job_title\\": {\\"type\\": \\"string\\", \\"description\\": \\"Short title for the job, e.g. \'Sandstone patio and side fence\'\\"}, \\"client_summary\\": {\\"type\\": \\"string\\"}, \\"lines\\": {\\"type\\": \\"array\\", \\"items\\": {\\"type\\": \\"object\\", \\"additionalProperties\\": false, \\"required\\": [\\"code\\", \\"quantity\\", \\"label\\", \\"evidence\\"], \\"properties\\": {\\"code\\": {\\"type\\": \\"string\\"}, \\"quantity\\": {\\"type\\": \\"number\\"}, \\"label\\": {\\"type\\": \\"string\\"}, \\"evidence\\": {\\"type\\": \\"string\\"}}}}, \\"extras\\": {\\"type\\": \\"array\\", \\"items\\": {\\"type\\": \\"object\\", \\"additionalProperties\\": false, \\"required\\": [\\"code\\", \\"quantity\\", \\"label\\", \\"why\\"], \\"properties\\": {\\"code\\": {\\"type\\": \\"string\\"}, \\"quantity\\": {\\"type\\": \\"number\\"}, \\"label\\": {\\"type\\": \\"string\\"}, \\"why\\": {\\"type\\": \\"string\\"}}}}, \\"custom_items\\": {\\"type\\": \\"array\\", \\"items\\": {\\"type\\": \\"object\\", \\"additionalProperties\\": false, \\"required\\": [\\"description\\", \\"quantity\\", \\"unit\\", \\"why\\"], \\"properties\\": {\\"description\\": {\\"type\\": \\"string\\"}, \\"quantity\\": {\\"type\\": \\"number\\"}, \\"unit\\": {\\"type\\": \\"string\\"}, \\"why\\": {\\"type\\": \\"string\\"}}}}, \\"assumptions\\": {\\"type\\": \\"array\\", \\"items\\": {\\"type\\": \\"string\\"}}, \\"questions\\": {\\"type\\": \\"array\\", \\"items\\": {\\"type\\": \\"string\\"}}, \\"confidence\\": {\\"type\\": \\"string\\", \\"enum\\": [\\"high\\", \\"medium\\", \\"low\\"]}}}"\n' +
          ');\n' +
          'const v = $(\'Check Visit\').first().json;\n' +
          'const T = tablesOf($(\'Load Price Book\').first().json);\n' +
          'const transcript = $(\'Transcribe\').isExecuted ? String($(\'Transcribe\').first().json.text || \'\').trim() : \'\';\n' +
          'const book = (T[\'Price Book\'] || []).filter(r => r.code && (r.active === \'\' || truthy(r.active)));\n' +
          'const lines = book.map(r => [r.code, r.category, r.item, \'per \' + r.unit, r.notes].filter(Boolean).join(\' | \'));\n' +
          'const text = \'Price book (code | category | item | unit | notes):\\n\' + lines.join(\'\\n\')\n' +
          '  + \'\\n\\nClient: \' + v.client_name + \', \' + v.site_address + (v.postcode ? \' \' + v.postcode : \'\')\n' +
          '  + \'\\nEstimator: \' + v.estimator\n' +
          '  + \'\\n\\nEstimator\\\'s notes:\\n\' + (v.notes || \'(none, see the voice memo)\')\n' +
          '  + (transcript ? \'\\n\\nVoice memo transcript:\\n\' + transcript : \'\')\n' +
          '  + (v.images.length ? \'\\n\\n\' + v.images.length + \' site photo(s) attached.\' : \'\');\n' +
          'const content = [{ type: \'input_text\', text }].concat(v.images.map(u => ({ type: \'input_image\', image_url: u, detail: \'low\' })));\n' +
          'return [{ json: {\n' +
          '  transcript,\n' +
          '  body: {\n' +
          '    model: \'gpt-5.4\', reasoning: { effort: \'low\' }, store: false, max_output_tokens: 8000,\n' +
          '    instructions: PROMPT,\n' +
          '    input: [{ role: \'user\', content }],\n' +
          '    text: { format: { type: \'json_schema\', name: \'draft_quote\', strict: true, schema: SCHEMA } }\n' +
          '  }\n' +
          '} }];\n'
        )
  } },
  output: [{ transcript: '', body: {} }]
});

const draftQuote = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Draft Quote (GPT-5.4)',
    position: [1740, 300],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/responses',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: { timeout: 180000 }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [] }]
});

const readNumbers = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Read Quote Numbers',
    position: [1960, 300],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/1754F1Rep-Rg9J3x6Dnga0fjTeSR4zfaLOS_zD7Zp1J4/values/Quotes!A:A', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ values: [['quote_id'], ['Q-1009']] }]
});

const priceQuote = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Price Quote', position: [2180, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Prices the AI draft from the price book (quantities × unit prices, VAT, deposit, days of work) and adds\n' +
          '// checks for the owner. Builds the plan that Mossgrove 7: Save Changes writes, and the estimator\'s page.\n' +
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
          'const v = $(\'Check Visit\').first().json;\n' +
          'const req = $(\'Build Request\').first().json;\n' +
          'const T = tablesOf($(\'Load Price Book\').first().json);\n' +
          'const s = settingsOf(T.Settings);\n' +
          'const res = $(\'Draft Quote (GPT-5.4)\').first().json;\n' +
          'const draft = aiJson(res);\n' +
          'const priced = priceQuote(draft || { lines: [] }, bookOf(T[\'Price Book\']), s);\n' +
          'if (!draft) priced.flags.unshift({ level: \'warn\', text: \'The AI could not draft this quote (\' + (res && res.error ? String(res.error.message || res.error).slice(0, 120) : \'no answer\') + \'). Add the lines by hand.\' });\n' +
          'else if (draft.confidence === \'low\') priced.flags.unshift({ level: \'warn\', text: \'Low confidence: key measurements are missing. Check the questions below.\' });\n' +
          'if (v.photos_skipped) priced.flags.push({ level: \'info\', text: v.photos_skipped + \' photo(s) skipped (only 3 JPEG, PNG or WebP photos under 8 MB are read).\' });\n' +
          'const at = nowIso();\n' +
          'const buildMs = Date.now() - v.started_ms;\n' +
          '// The quote number is taken from a fresh read of the Quotes tab just before saving, so two estimators\n' +
          '// sending forms at the same time don\'t get the same number\n' +
          'const ids = ((($(\'Read Quote Numbers\').first().json.values) || []).slice(1)).map(r => Number(String(r[0] || \'\').replace(/\\D/g, \'\')) || 0);\n' +
          'const quoteId = \'Q-\' + (Math.max(1000, ...ids) + 1);\n' +
          'const row = {\n' +
          '  quote_id: quoteId, token: newToken(24), status: \'draft\',\n' +
          '  client_name: v.client_name, client_email: v.client_email, client_phone: v.client_phone, site_address: v.site_address, postcode: v.postcode,\n' +
          '  job_title: draft ? draft.job_title : \'Site visit \' + day(at), summary: draft ? draft.client_summary : \'\',\n' +
          '  visit_notes: v.notes, transcript: req.transcript,\n' +
          '  lines_json: priced.lines, extras_json: priced.extras, custom_json: priced.custom,\n' +
          '  assumptions_json: draft ? draft.assumptions : [], questions_json: draft ? draft.questions : [], flags_json: priced.flags,\n' +
          '  subtotal: priced.subtotal, vat: priced.vat, total: priced.total, deposit: priced.deposit, labour_days: priced.labour_days,\n' +
          '  version: 1, estimator: v.estimator, created_at: at, build_ms: buildMs, view_count: 0, reminders_sent: 0, messages_json: [], updated_at: at\n' +
          '};\n' +
          'const plan = emptyPlan(s);\n' +
          'plan.quote_inserts.push(sheetRow(row));\n' +
          'plan.events.push(eventRow(row.quote_id, \'drafted\', \'AI draft in \' + (buildMs / 1000).toFixed(1) + \' s: \' + priced.lines.length + \' lines, \' + money(priced.total) + (v.has_voice ? \', from a voice memo\' : \'\') + (v.photo_count ? \', \' + v.photo_count + \' photo(s)\' : \'\'), v.estimator));\n' +
          'const review = dashboardUrl(s) + \'&q=\' + row.quote_id;\n' +
          'plan.emails.push(emailItem(s.owner_email, \'Draft quote ready: \' + row.quote_id + \' \' + row.client_name + \' (\' + money(priced.total) + \')\', emailHtml(s, [\n' +
          '  esc(v.estimator) + \' visited <b>\' + esc(row.client_name) + \'</b> at \' + esc(row.site_address) + \'. The draft is ready for you to check:\',\n' +
          '  \'<b>\' + esc(row.job_title) + \'</b>, \' + priced.lines.length + \' lines, \' + money(priced.total) + \' including VAT.\' + (priced.flags.some(f => f.level === \'warn\') ? \' It needs your attention before it can go out.\' : \'\')\n' +
          '], button(review, \'Review and send\')), \'owner_draft\', row.quote_id, [review]));\n' +
          'plan.result = { ok: true, quote_id: row.quote_id };\n' +
          '\n' +
          'const rowsHtml = priced.lines.map(l => \'<tr><td>\' + esc(l.item) + \'<div class="lbl">\' + esc(l.label) + \'</div></td><td class="r">\' + money(l.amount) + \'</td></tr>\').join(\'\')\n' +
          '  + priced.custom.map(c => \'<tr><td>\' + esc(c.description) + \'<div class="lbl">Not in the price book</div></td><td class="r">\' + (c.amount === null ? \'to price\' : money(c.amount)) + \'</td></tr>\').join(\'\');\n' +
          'const flagsHtml = priced.flags.map(f => \'<div class="flag \' + f.level + \'">\' + esc(f.text) + \'</div>\').join(\'\');\n' +
          'const qs = row.questions_json.length ? \'<p style="margin:16px 0 4px"><b>Check before sending</b></p><ul>\' + row.questions_json.map(q => \'<li>\' + esc(q) + \'</li>\').join(\'\') + \'</ul>\' : \'\';\n' +
          'const page = formPage(\'Draft \' + row.quote_id + \' is ready\',\n' +
          '  \'<p class="sub">\' + esc(row.client_name) + \' · \' + esc(row.job_title) + \' · drafted in \' + (buildMs / 1000).toFixed(0) + \' seconds</p>\'\n' +
          '  + (row.summary ? \'<p>\' + esc(row.summary) + \'</p>\' : \'\') + flagsHtml\n' +
          '  + \'<table>\' + rowsHtml + \'<tr class="tot"><td>Total with VAT</td><td class="r">\' + money(priced.total) + \'</td></tr></table>\'\n' +
          '  + (priced.extras.length ? \'<p class="lbl">Optional extras offered: \' + priced.extras.map(x => esc(x.item) + \' (\' + money(x.amount) + \')\').join(\', \') + \'</p>\' : \'\')\n' +
          '  + qs\n' +
          '  + \'<a class="btn" href="\' + esc(review) + \'">Review and send</a><a class="btn ghost" href="\' + esc(pdfUrl(s, row.token, \'quote\')) + \'">Preview PDF</a>\');\n' +
          'return [{ json: { plan, page } }];\n'
        )
  } },
  output: [{ plan: {}, page: '<html></html>' }]
});

const saveDraft = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save Draft', position: [2400, 300], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const draftReady = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Draft Ready', position: [2620, 300], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr("{{ $('Price Quote').first().json.page }}") } }
});

const note = sticky(
  '## Mossgrove 1: Site Visit → Draft Quote\nThe estimator fills in the form in the garden (notes, a voice memo, photos). The memo is transcribed, then **GPT-5.4 picks items and quantities from the price book** (it never sees or sets prices). **Price Quote** works out every amount, VAT, the deposit and the days of work in code, and flags anything to check. The draft is saved to Google Sheets and the owner gets an email; nothing goes to the client until the owner sends it from the dashboard.',
  [], { position: [160, -60], width: 1140, height: 180, color: 7 }
);

export default workflow('mossgrove-site-visit', 'Mossgrove 1: Site Visit to Draft Quote')
  .add(form)
  .to(checkVisit)
  .to(valid
    .onTrue(hasVoice
      .onTrue(transcribe.to(loadBook))
      .onFalse(loadBook))
    .onFalse(problemPage.to(showProblem)))
  .add(loadBook)
  .to(buildRequest)
  .to(draftQuote)
  .to(readNumbers)
  .to(priceQuote)
  .to(saveDraft)
  .to(draftReady)
  .add(note);
