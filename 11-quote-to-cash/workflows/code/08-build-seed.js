// Builds every tab of the demo sheet: settings, the price book and nine sample quotes at every stage
// (dates relative to today), their history, payments and the crews' calendar. Real quotes have random
// tokens; the samples use fixed ones so the demo links stay the same.
// @include lib-mgv.js
// @include seed-mgv.js
const s = Object.fromEntries(SETTINGS_ROWS.map(r => [r[0], r[1]]));
const book = bookOf(PRICE_BOOK.map(r => ({ code: r[0], category: r[1], item: r[2], unit: r[3], unit_price: r[4], labour_days: r[5], min_qty: r[6], notes: r[7], active: true })));
const now = nowDt();
const at = (d, h, m) => d === undefined ? '' : now.plus({ days: d }).set({ hour: h || 10, minute: m || 0, second: 0, millisecond: 0 }).toISO({ suppressMilliseconds: true });
const weekday = d => { let x = now.plus({ days: d }).startOf('day'); while (x.weekday > 5) x = x.plus({ days: 1 }); return x; };
const hex = n => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
const quotes = [], events = [], payments = [], schedule = [];
const ev = (id, d, h, event, detail, actor) => events.push({ at: at(d, h, 15), quote_id: id, event, detail, actor });

for (const sq of SAMPLE_QUOTES) {
  const priced = priceQuote({
    lines: sq.lines.map(l => ({ code: l[0], quantity: l[1], label: l[2] })),
    extras: (sq.extras || []).map(l => ({ code: l[0], quantity: l[1], label: l[2], why: l[3] })),
    custom_items: (sq.custom || []).map(c => ({ description: c[0], quantity: c[1], unit: c[2], why: c[3] }))
  }, book, s);
  const [name, email, phone, address, postcode] = sq.client;
  const q = {
    quote_id: sq.id, token: 'demo-' + sq.id.toLowerCase() + '-mg7k2p', status: sq.status, client_name: name, client_email: email, client_phone: phone, site_address: address, postcode,
    job_title: sq.title, summary: sq.summary, visit_notes: sq.notes || '', transcript: '',
    lines_json: priced.lines, extras_json: priced.extras, custom_json: priced.custom, assumptions_json: sq.assumptions || [], questions_json: sq.questions || [], flags_json: priced.flags,
    subtotal: priced.subtotal, vat: priced.vat, total: priced.total, deposit: priced.deposit, labour_days: priced.labour_days, version: 1, estimator: sq.est,
    created_at: at(sq.created, 15, 40), build_ms: 17000 + Math.floor(Math.random() * 9000), view_count: sq.views || (sq.viewed !== undefined ? 1 : 0), reminders_sent: sq.reminders || 0, last_reminder_at: at(sq.lastReminder, 9),
    messages_json: [], updated_at: at(Math.max(...[sq.created, sq.sent, sq.viewed, sq.accepted, sq.deposit, sq.completed, sq.balance, sq.declined].filter(x => x !== undefined)), 12)
  };
  ev(sq.id, sq.created, 15, 'drafted', 'AI draft: ' + priced.lines.length + ' lines, ' + money(priced.total), sq.est);
  if (sq.sent !== undefined) {
    Object.assign(q, { sent_at: at(sq.sent, 9, 5), valid_until: now.plus({ days: sq.sent + (Number(s.validity_days) || 30) }).endOf('day').toISO({ suppressMilliseconds: true }) });
    ev(sq.id, sq.sent, 9, 'sent', 'To ' + email, sq.est);
  }
  if (sq.viewed !== undefined) { q.viewed_at = at(sq.viewed, 19, 12); ev(sq.id, sq.viewed, 19, 'viewed', 'First opened by the client', 'client'); }
  for (let r = 1; r <= (sq.reminders || 0); r++) ev(sq.id, sq.sent + (r === 1 ? 3 : 7), 8, 'reminder', 'Reminder ' + r, 'system');
  if (sq.accepted !== undefined) {
    const tot = acceptedTotals(Object.assign({}, priced), sq.chosen || [], s);
    Object.assign(q, { accepted_at: at(sq.accepted, 20, 41), signed_name: name, sign_meta_json: { fingerprint: hex(64), signed_at: at(sq.accepted, 20, 41), method: 'typed name + checkbox', ip: 'demo' },
      chosen_extras_json: sq.chosen || [], accepted_subtotal: tot.subtotal, accepted_vat: tot.vat, accepted_total: tot.total, deposit_due: tot.deposit, labour_days: tot.labour_days });
    ev(sq.id, sq.accepted, 20, 'accepted', 'Signed by ' + name + ' for ' + money(tot.total) + (tot.chosen.length ? ' with ' + tot.chosen.map(x => x.item).join(', ') : ''), 'client');
    q.balance_due = round2(tot.total - tot.deposit);
  }
  if (sq.deposit !== undefined) {
    const start = weekday(sq.start), end = addWorkdays(start, sq.days);
    Object.assign(q, { deposit_paid_at: at(sq.deposit, 11, 3), job_start: start.toISODate(), job_end: end.toISODate(), crew: sq.crew });
    payments.push({ payment_id: 'PAY-' + sq.id.slice(2) + 'D', quote_id: sq.id, kind: 'deposit', amount: q.deposit_due, status: 'paid', provider: 'card (Stripe)', provider_ref: 'pi_demo_' + hex(10), created_at: q.deposit_paid_at, paid_at: q.deposit_paid_at });
    schedule.push({ entry_id: 'JOB-' + sq.id, quote_id: sq.id, title: name.split(' ').slice(-1)[0] + ': ' + sq.title, start: q.job_start, end: q.job_end, crew: sq.crew, kind: 'job', notes: address });
    ev(sq.id, sq.deposit, 11, 'deposit_paid', money(q.deposit_due) + ' via card (Stripe); booked ' + sq.crew + ' from ' + q.job_start + ' to ' + q.job_end, 'client');
  }
  if (sq.completed !== undefined) {
    Object.assign(q, { completed_at: at(sq.completed, 16, 30), invoice_id: sq.id.replace('Q-', 'INV-') });
    ev(sq.id, sq.completed, 16, 'completed', 'Invoice ' + q.invoice_id + ': balance ' + money(q.balance_due), 'Tom Hale');
  }
  if (sq.balance !== undefined) {
    q.balance_paid_at = at(sq.balance, 13, 20);
    payments.push({ payment_id: 'PAY-' + sq.id.slice(2) + 'B', quote_id: sq.id, kind: 'balance', amount: q.balance_due, status: 'paid', provider: 'bank transfer', provider_ref: '', created_at: q.balance_paid_at, paid_at: q.balance_paid_at });
    ev(sq.id, sq.balance, 13, 'balance_paid', money(q.balance_due) + ' via bank transfer', 'Tom Hale');
  }
  if (sq.review !== undefined) { q.review_sent_at = at(sq.review, 9); ev(sq.id, sq.review, 9, 'review_requested', 'Two days after paying', 'system'); }
  if (sq.declined !== undefined) { Object.assign(q, { declined_at: at(sq.declined, 18), decline_reason: sq.reason }); ev(sq.id, sq.declined, 18, 'declined', sq.reason, 'client'); }
  if (sq.status === 'expired') ev(sq.id, sq.sent + 30, 7, 'expired', 'Not accepted in 30 days', 'system');
  quotes.push(q);
}
for (const [title, d, n, crew] of BOOKED) {
  const start = weekday(d);
  schedule.push({ entry_id: 'JOB-' + title.split(':')[0].toUpperCase(), quote_id: '', title, start: start.toISODate(), end: addWorkdays(start, n).toISODate(), crew, kind: 'job', notes: 'Booked before the quote system' });
}
events.sort((a, b) => a.at < b.at ? -1 : 1);

const rows = (tab, objs) => [COLUMNS[tab]].concat(objs.map(o => COLUMNS[tab].map(c => { const v = o[c]; return v === undefined || v === null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v); })));
const tabs = {
  'Settings': [COLUMNS.Settings].concat(SETTINGS_ROWS),
  'Price Book': [COLUMNS['Price Book']].concat(PRICE_BOOK.map(r => r.concat([true]))),
  'Quotes': rows('Quotes', quotes),
  'Events': rows('Events', events),
  'Payments': rows('Payments', payments),
  'Schedule': rows('Schedule', schedule),
  'Outbox': [COLUMNS.Outbox]
};
const q = n => "'" + n.replace(/'/g, "''") + "'";
return [{ json: {
  clear: { ranges: Object.keys(tabs).map(q) },
  write: { valueInputOption: 'RAW', data: Object.entries(tabs).map(([n, v]) => ({ range: q(n) + '!A1', values: v })) },
  summary: Object.fromEntries(Object.entries(tabs).map(([n, v]) => [n, v.length - 1]))
} }];
