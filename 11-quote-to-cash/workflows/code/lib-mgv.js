// ---- lib-mgv.js (included by build.py): shared helpers for the Mossgrove workflows ----
const TZ = 'Europe/London';
const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parseJson = (s, d) => { try { return typeof s === 'string' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };
const nowDt = () => DateTime.now().setZone(TZ);
const nowIso = () => nowDt().set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });
const toDt = iso => DateTime.fromISO(String(iso), { zone: TZ });
const newToken = n => Array.from({ length: n || 24 }, () => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 56)]).join('');
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const money = n => '£' + round2(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = iso => iso ? toDt(iso).toFormat('d LLL yyyy') : '';
const dayLong = iso => iso ? toDt(iso).toFormat('cccc d LLLL') : '';
const firstName = name => String(name || '').trim().split(/\s+/)[0] || 'there';
const qtyText = n => (Math.round(Number(n) * 10) / 10).toLocaleString('en-GB');
const unitText = (u, n) => u === 'each' ? '' : (u === 'metre' ? (Number(n) === 1 ? 'metre' : 'metres') : u);
const COLUMNS = __TABLES__;

// Sheets API values:batchGet response → { 'Tab name': [ { column: value, _row } ] } (blank rows dropped)
function tablesOf(res) {
  const out = {};
  for (const vr of (res && res.valueRanges) || []) {
    const name = String(vr.range || '').split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'");
    const rows = vr.values || [];
    const head = (rows[0] || []).map(h => String(h).trim());
    out[name] = rows.slice(1).map((r, i) => {
      const o = { _row: i + 2 };
      head.forEach((h, j) => { if (h) o[h] = r[j] === undefined || r[j] === null ? '' : r[j]; });
      return o;
    }).filter(o => Object.keys(o).some(k => k !== '_row' && o[k] !== ''));
  }
  return out;
}
const settingsOf = rows => Object.fromEntries((rows || []).filter(r => r.key).map(r => [String(r.key).trim(), r.value === undefined ? '' : r.value]));
const truthy = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());
function bookOf(rows) {
  const b = {};
  for (const r of rows || []) if (r.code && (r.active === '' || truthy(r.active))) b[String(r.code).trim().toUpperCase()] = r;
  return b;
}

// A quote row with its JSON columns parsed
function quoteOf(row) {
  if (!row) return null;
  const q = Object.assign({}, row);
  for (const k of ['lines', 'extras', 'custom', 'assumptions', 'questions', 'flags', 'chosen_extras', 'messages', 'sign_meta']) q[k] = parseJson(row[k + '_json'], k === 'sign_meta' ? {} : []);
  for (const k of ['subtotal', 'vat', 'total', 'deposit', 'labour_days', 'view_count', 'accepted_subtotal', 'accepted_vat', 'accepted_total', 'deposit_due', 'balance_due', 'reminders_sent', 'version']) q[k] = Number(row[k]) || 0;
  return q;
}

// ---- Pricing: the AI picks items and quantities; prices always come from the price book ----
function priceEntry(e, book) {
  const b = book[String(e.code || '').trim().toUpperCase()];
  if (!b) return null;
  let qty = Math.max(Number(e.quantity) || 0, 0);
  const min = Number(b.min_qty) || 0;
  const minApplied = qty > 0 && min > 0 && qty < min;
  if (minApplied) qty = min;
  qty = Math.round(qty * 10) / 10;
  const unitPrice = Number(b.unit_price) || 0;
  return {
    code: String(b.code).toUpperCase(), item: b.item, category: b.category, unit: b.unit, quantity: qty,
    unit_price: unitPrice, amount: round2(qty * unitPrice), labour_days: round2(qty * (Number(b.labour_days) || 0)),
    label: String(e.label || ''), evidence: String(e.evidence || ''), why: String(e.why || ''), min_applied: minApplied
  };
}

function priceQuote(draft, book, s) {
  const flags = [];
  const lines = [], extras = [], custom = [];
  for (const e of draft.lines || []) {
    const p = priceEntry(e, book);
    if (!p) { custom.push({ description: String(e.label || e.code), quantity: Number(e.quantity) || 1, unit: 'each', unit_price: null, why: 'Code ' + e.code + ' is not in the price book' }); flags.push({ level: 'warn', text: 'Code ' + e.code + ' is not in the price book, so it was moved to custom items.' }); continue; }
    if (!p.quantity) { flags.push({ level: 'warn', text: p.item + ' had no quantity and was left out.' }); continue; }
    if (p.min_applied) flags.push({ level: 'info', text: p.item + ': minimum of ' + qtyText(p.quantity) + ' ' + unitText(p.unit, p.quantity) + ' applied.' });
    lines.push(p);
  }
  for (const e of draft.extras || []) { const p = priceEntry(e, book); if (p && p.quantity) extras.push(p); }
  for (const c of draft.custom_items || draft.custom || []) {
    const price = c.unit_price === null || c.unit_price === undefined || c.unit_price === '' ? null : Number(c.unit_price);
    const qty = Number(c.quantity) || 1;
    custom.push({ description: String(c.description || ''), quantity: qty, unit: String(c.unit || 'each'), unit_price: price, amount: price === null ? null : round2(qty * price), labour_days: Number(c.labour_days) || 0, why: String(c.why || '') });
  }
  const unpriced = custom.filter(c => c.unit_price === null || isNaN(c.unit_price));
  if (unpriced.length) flags.push({ level: 'warn', text: unpriced.length + (unpriced.length === 1 ? ' item isn\'t' : ' items aren\'t') + ' in the price book. Add a price before sending.' });
  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0) + custom.reduce((a, c) => a + (c.amount || 0), 0));
  const vatRate = Number(s.vat_rate === '' || s.vat_rate === undefined ? 0.2 : s.vat_rate);
  const vat = round2(subtotal * vatRate);
  const total = round2(subtotal + vat);
  const deposit = round2(total * (Number(s.deposit_pct) || 25) / 100);
  const labour = round2(lines.reduce((a, l) => a + l.labour_days, 0) + custom.reduce((a, c) => a + (c.labour_days || 0), 0));
  if (total >= (Number(s.big_job) || 15000)) flags.push({ level: 'info', text: 'Large job (' + money(total) + '). Double-check the measurements before sending.' });
  if (!lines.length && !custom.length) flags.push({ level: 'warn', text: 'No priced lines yet. Add items before sending.' });
  return { lines, extras, custom, subtotal, vat, total, deposit, labour_days: labour, flags };
}

// Totals once the client has picked optional extras
function acceptedTotals(q, chosenCodes, s) {
  const chosen = (q.extras || []).filter(x => chosenCodes.includes(x.code));
  const subtotal = round2(Number(q.subtotal) + chosen.reduce((a, x) => a + x.amount, 0));
  const vat = round2(subtotal * Number(s.vat_rate === '' || s.vat_rate === undefined ? 0.2 : s.vat_rate));
  const total = round2(subtotal + vat);
  return { chosen, subtotal, vat, total, deposit: round2(total * (Number(s.deposit_pct) || 25) / 100), labour_days: round2(Number(q.labour_days) + chosen.reduce((a, x) => a + x.labour_days, 0)) };
}
const jobDays = labour => Math.max(1, Math.ceil(Number(labour) - 0.25));

// ---- Links ----
const baseUrl = s => String(s.base_url || 'http://localhost:5678').replace(/\/$/, '');
const quoteUrl = (s, token) => baseUrl(s) + '/webhook/mossgrove/quote?t=' + token;
const pdfUrl = (s, token, doc) => baseUrl(s) + '/webhook/mossgrove/pdf?t=' + token + '&doc=' + (doc || 'quote');
const payUrl = (s, token, kind) => baseUrl(s) + '/webhook/mossgrove/pay?t=' + token + '&kind=' + kind;
const dashboardUrl = s => baseUrl(s) + '/webhook/mossgrove/dashboard?key=' + encodeURIComponent(s.dashboard_key || '');

// ---- Emails and plain pages ----
function button(url, label) {
  return '<p style="margin:22px 0;text-align:left"><a href="' + esc(url) + '" style="display:inline-block;background:#1f4d3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">' + esc(label) + '</a></p>';
}
function emailHtml(s, paragraphs, extraHtml) {
  const p = paragraphs.filter(Boolean).map(t => '<p style="margin:0 0 14px;text-align:left">' + t + '</p>').join('');
  return '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1d2a24;max-width:560px;text-align:left">'
    + '<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin:0 0 18px">' + esc(s.company || 'Mossgrove Landscapes') + '</div>'
    + p + (extraHtml || '')
    + '<p style="margin:26px 0 0;color:#6b7a72;font-size:12px;text-align:left">' + esc(s.company_legal || s.company || '') + ' · ' + esc(s.company_phone || '') + '</p></div>';
}
function pageHtml(s, title, bodyHtml) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>' + esc(title) + ' · ' + esc(s.company || 'Mossgrove Landscapes') + '</title>'
    + '<style>body{margin:0;background:#f4f1ea;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2a24}'
    + '.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #e3ddd0;border-radius:18px;padding:32px 30px;box-shadow:0 8px 28px rgba(31,77,58,.07)}'
    + '.brand{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin-bottom:20px}'
    + 'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4b44;margin:0 0 12px}a.btn{display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;margin-top:8px}'
    + '.muted{color:#6b7a72;font-size:14px}</style></head><body><div class="card">'
    + '<div class="brand"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M2 32C2 14 14 2 32 2c0 18-12 30-30 30z" fill="#7bb661"/><path d="M5 29L27 7" stroke="#1f4d3a" stroke-width="2"/></svg>' + esc(s.company || 'Mossgrove Landscapes') + '</div>'
    + '<h1>' + esc(title) + '</h1>' + bodyHtml + '</div></body></html>';
}

// ---- Plans: decide everything in code, then Mossgrove 7: Save Changes writes it ----
function emptyPlan(s) { return { mode: s.mode === 'live' ? 'live' : 'test', quote_inserts: [], quote_updates: [], events: [], payments: [], schedule: [], emails: [], result: { ok: true } }; }
const eventRow = (quote_id, event, detail, actor) => ({ at: nowIso(), quote_id, event, detail: String(detail || ''), actor: actor || 'system' });
const emailItem = (to, subject, html, kind, quote_id, links, attach, token) => ({ to, subject, html, kind, quote_id, links: (links || []).join(' '), attach: attach || '', token: token || '' });
// Arrays and objects go to the sheet as JSON text
function sheetRow(o) {
  const r = {};
  for (const [k, v] of Object.entries(o)) if (k !== '_row') r[k] = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
  return r;
}

// Working days (Mon–Fri) from a date, inclusive of the start
function addWorkdays(start, n) {
  let d = start, left = n - 1;
  while (left > 0) { d = d.plus({ days: 1 }); if (d.weekday <= 5) left--; }
  return d;
}
// Earliest start (after the lead time) where one crew has the whole job free
function nextSlot(schedule, s, days) {
  const crews = String(s.crews || 'Crew A').split(',').map(c => c.trim()).filter(Boolean);
  const busy = (schedule || []).filter(e => e.start && e.end).map(e => ({ crew: String(e.crew), start: String(e.start).slice(0, 10), end: String(e.end).slice(0, 10) }));
  let d = nowDt().startOf('day').plus({ days: Number(s.lead_days) || 7 });
  for (let i = 0; i < 180; i++, d = d.plus({ days: 1 })) {
    if (d.weekday > 5) continue;
    const end = addWorkdays(d, days);
    const a = d.toISODate(), b = end.toISODate();
    for (const crew of crews) {
      if (!busy.some(x => x.crew === crew && !(x.end < a || x.start > b))) return { crew, start: a, end: b };
    }
  }
  return null;
}

// A payment arrived (card, test checkout or bank transfer the owner recorded)
function planPayment(plan, q, kind, provider, ref, T, s, actor) {
  const amount = kind === 'deposit' ? q.deposit_due : q.balance_due;
  const at = nowIso();
  plan.payments.push({ payment_id: 'PAY-' + newToken(8).toUpperCase(), quote_id: q.quote_id, kind, amount, status: 'paid', provider, provider_ref: ref || '', created_at: at, paid_at: at });
  const links = [quoteUrl(s, q.token)];
  if (kind === 'deposit') {
    const slot = nextSlot(T.Schedule, s, jobDays(q.labour_days));
    const upd = { quote_id: q.quote_id, status: 'scheduled', deposit_paid_at: at, updated_at: at };
    let when = 'We\'ll be in touch shortly with your start date.';
    if (slot) {
      Object.assign(upd, { job_start: slot.start, job_end: slot.end, crew: slot.crew });
      plan.schedule.push({ entry_id: 'JOB-' + q.quote_id, quote_id: q.quote_id, title: q.client_name.split(' ').slice(-1)[0] + ': ' + q.job_title, start: slot.start, end: slot.end, crew: slot.crew, kind: 'job', notes: q.site_address });
      const n = jobDays(q.labour_days);
      when = 'We\'ve booked you in to start on <b>' + esc(dayLong(slot.start)) + '</b>, for about ' + n + ' working day' + (n === 1 ? '' : 's') + '. We\'ll confirm the arrival time the week before.';
    }
    plan.quote_updates.push(upd);
    plan.events.push(eventRow(q.quote_id, 'deposit_paid', money(amount) + ' via ' + provider + (slot ? '; booked ' + slot.crew + ' from ' + slot.start + ' to ' + slot.end : '; no free slot found'), actor));
    plan.emails.push(emailItem(q.client_email, 'You\'re booked in: ' + q.job_title, emailHtml(s, [
      'Hi ' + esc(firstName(q.client_name)) + ',',
      'Thank you, we\'ve received your deposit of <b>' + money(amount) + '</b>.',
      when
    ], button(quoteUrl(s, q.token), 'View your booking')), 'deposit_receipt', q.quote_id, links, 'quote', q.token));
    plan.emails.push(emailItem(s.owner_email, 'Deposit paid: ' + q.quote_id + ' ' + q.client_name + ' (' + money(amount) + ')', emailHtml(s, [
      esc(q.client_name) + ' paid the ' + money(amount) + ' deposit for <b>' + esc(q.job_title) + '</b>.',
      slot ? 'Booked for ' + esc(slot.crew) + ', ' + esc(day(slot.start)) + ' to ' + esc(day(slot.end)) + '.' : '<b>No free slot was found in the next six months.</b> Please book it by hand.'
    ], button(dashboardUrl(s), 'Open the dashboard')), 'owner_deposit', q.quote_id, links));
    return slot;
  }
  plan.quote_updates.push({ quote_id: q.quote_id, status: 'paid', balance_paid_at: at, updated_at: at });
  plan.events.push(eventRow(q.quote_id, 'balance_paid', money(amount) + ' via ' + provider, actor));
  plan.emails.push(emailItem(q.client_email, 'Payment received, thank you (' + q.invoice_id + ')', emailHtml(s, [
    'Hi ' + esc(firstName(q.client_name)) + ',',
    'Thank you for your payment of <b>' + money(amount) + '</b>. Your invoice ' + esc(q.invoice_id) + ' is now paid in full; the receipt is attached.',
    'Enjoy the garden!'
  ], button(pdfUrl(s, q.token, 'receipt'), 'Download your receipt')), 'balance_receipt', q.quote_id, [pdfUrl(s, q.token, 'receipt')], 'receipt', q.token));
  plan.emails.push(emailItem(s.owner_email, 'Paid in full: ' + q.quote_id + ' ' + q.client_name + ' (' + money(amount) + ')', emailHtml(s, [
    esc(q.client_name) + ' paid the final ' + money(amount) + ' for <b>' + esc(q.job_title) + '</b>. The job is closed; a review request goes out in two days.'
  ]), 'owner_paid', q.quote_id, links));
  return null;
}

// OpenAI Responses API result → the JSON object the model returned, or null
function aiJson(res) {
  if (!res || res.error) return null;
  const msg = (res.output || []).find(o => o && o.type === 'message');
  const part = msg && (msg.content || []).find(c => c && c.type === 'output_text');
  let t = part ? part.text : null;
  if (typeof t === 'string') { try { t = JSON.parse(t); } catch (e) { t = null; } }
  return t && typeof t === 'object' ? t : null;
}

// Full page for the estimator's form results (the n8n form shows it instead of its own page)
function formPage(title, bodyHtml) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + '</title>'
    + '<style>body{margin:0;background:#f4f1ea;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2a24}'
    + '.wrap{max-width:640px;margin:36px auto;padding:0 16px}.card{background:#fff;border:1px solid #e3ddd0;border-radius:18px;padding:28px 26px;box-shadow:0 8px 28px rgba(31,77,58,.07)}'
    + '.brand{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1f4d3a;margin-bottom:16px}'
    + 'h1{font-size:22px;margin:0 0 6px;letter-spacing:-.3px}.sub{color:#5c6b63;margin:0 0 18px}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:8px 0;border-bottom:1px solid #eee8dc;vertical-align:top}td.r{text-align:right;white-space:nowrap;padding-left:12px}'
    + '.lbl{color:#76847c;font-size:13px}.tot td{border:0;font-weight:700;font-size:17px;padding-top:12px}.flag{background:#fff7e6;border:1px solid #f3dfb2;border-radius:10px;padding:9px 12px;margin:8px 0;font-size:14px}.flag.info{background:#eef5f0;border-color:#d3e6d8}'
    + 'a.btn{display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;margin:14px 10px 0 0}a.ghost{background:#fff;color:#1f4d3a;border:1px solid #c9d8cd}ul{padding-left:20px;margin:6px 0}'
    + '</style></head><body><div class="wrap"><div class="card"><div class="brand"><svg width="20" height="20" viewBox="0 0 34 34"><path d="M2 32C2 14 14 2 32 2c0 18-12 30-30 30z" fill="#7bb661"/><path d="M5 29L27 7" stroke="#1f4d3a" stroke-width="2"/></svg>Mossgrove Landscapes</div>'
    + '<h1>' + esc(title) + '</h1>' + bodyHtml + '</div></div></body></html>';
}

// The client's terms, also printed on the PDF
function quoteTerms(q, s) {
  return [
    'Prices include VAT at ' + Math.round(Number(s.vat_rate === '' || s.vat_rate === undefined ? 0.2 : s.vat_rate) * 100) + '% and are valid until ' + (day(q.valid_until) || 'the date shown') + '. A ' + (Number(s.deposit_pct) || 25) + '% deposit books your start date; the balance is due within ' + (Number(s.payment_days) || 7) + ' days of completion.',
    'We remove all waste from the job. If we find something we could not see at the survey (such as buried concrete or old drains), we agree any extra cost with you before doing the work.',
    'New plants and turf are guaranteed for 3 months if watered as advised; paving and fencing workmanship for 5 years.'
  ];
}
const isExpired = q => q.status === 'sent' && q.valid_until && toDt(q.valid_until) < nowDt();

const STATUS_LABEL = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', scheduled: 'Booked', completed: 'Invoiced', paid: 'Paid', declined: 'Declined', expired: 'Expired', cancelled: 'Cancelled' };
// ---- end lib-mgv.js ----
