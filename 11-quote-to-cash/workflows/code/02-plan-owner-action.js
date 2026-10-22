// The owner's buttons: save edits (repriced from the price book), send, withdraw, record a bank transfer,
// and "job done" (final invoice). Checks the key and that the action fits the quote's status.
// @include lib-mgv.js
// @include lib-pay.js
const body = $('Owner Action').first().json.body || {};
const T = tablesOf($('Load All (Action)').first().json);
const s = settingsOf(T.Settings);
const no = (message, code) => [{ json: { ok: false, code: code || 400, message } }];
if (!s.dashboard_key || String(body.key || '') !== String(s.dashboard_key)) return no('Not allowed.', 403);
const q = quoteOf((T.Quotes || []).find(r => r.quote_id === body.quote_id));
if (!q) return no('Quote not found.', 404);
if (isExpired(q)) q.status = 'expired';
const plan = emptyPlan(s);
const at = nowIso();
const actor = s.owner_name || 'owner';
const action = String(body.action || '');
const clientLink = quoteUrl(s, q.token);

if (action === 'save') {
  if (!['draft', 'sent'].includes(q.status)) return no('Only drafts and sent quotes can be edited.', 409);
  const priced = priceQuote({ lines: body.lines || [], extras: body.extras || [], custom_items: body.custom || [] }, bookOf(T['Price Book']), s);
  const version = q.status === 'sent' ? q.version + 1 : q.version;
  plan.quote_updates.push({ quote_id: q.quote_id, job_title: String(body.job_title || q.job_title).slice(0, 120), summary: String(body.summary === undefined ? q.summary : body.summary).slice(0, 1200),
    lines_json: priced.lines, extras_json: priced.extras, custom_json: priced.custom, flags_json: priced.flags, subtotal: priced.subtotal, vat: priced.vat, total: priced.total, deposit: priced.deposit, labour_days: priced.labour_days, version, updated_at: at });
  plan.events.push(eventRow(q.quote_id, 'edited', priced.lines.length + priced.custom.length + ' lines, ' + money(priced.total) + (version > q.version ? ' (version ' + version + ')' : ''), actor));
  plan.result = { message: 'Saved: ' + money(priced.total) + ' including VAT' };
} else if (action === 'send') {
  if (!['draft', 'sent', 'expired'].includes(q.status)) return no('This quote can\'t be sent in its current state.', 409);
  if (!q.lines.length && !q.custom.length) return no('Add at least one line first.');
  if (q.custom.some(c => c.unit_price === null || c.unit_price === '' || isNaN(Number(c.unit_price)))) return no('Price the custom items first.');
  const validUntil = nowDt().plus({ days: Number(s.validity_days) || 30 }).endOf('day').toISO({ suppressMilliseconds: true });
  plan.quote_updates.push({ quote_id: q.quote_id, status: 'sent', sent_at: at, valid_until: validUntil, reminders_sent: 0, updated_at: at });
  plan.events.push(eventRow(q.quote_id, q.status === 'sent' ? 'resent' : 'sent', 'To ' + q.client_email + ', valid until ' + day(validUntil), actor));
  plan.emails.push(emailItem(q.client_email, 'Your quote from ' + s.company + ': ' + q.job_title, emailHtml(s, [
    'Hi ' + esc(firstName(q.client_name)) + ',',
    'Thanks for having us round. Here\'s your quote for <b>' + esc(q.job_title) + '</b>: <b>' + money(q.total) + '</b> including VAT.',
    esc(q.summary),
    'On the page you can add optional extras, ask us a question, or accept and sign in a minute. The quote is valid until ' + day(validUntil) + (s.mode === 'live' ? ' and the PDF is attached.' : '.')
  ], button(clientLink, 'View your quote') + '<p style="margin:0;color:#6b7a72;font-size:13px;text-align:left">' + esc(q.estimator || s.owner_name) + ', ' + esc(s.company) + ' · ' + esc(s.company_phone) + '</p>'), 'quote_sent', q.quote_id, [clientLink, pdfUrl(s, q.token, 'quote')], 'quote', q.token));
  plan.result = { message: (q.status === 'sent' ? 'Sent again to ' : 'Sent to ') + q.client_email };
} else if (action === 'cancel') {
  if (!['draft', 'sent', 'accepted', 'expired'].includes(q.status)) return no('This quote can\'t be cancelled now.', 409);
  plan.quote_updates.push({ quote_id: q.quote_id, status: 'cancelled', updated_at: at });
  plan.events.push(eventRow(q.quote_id, 'cancelled', 'Withdrawn by the owner', actor));
  plan.result = { message: q.quote_id + ' cancelled' };
} else if (action === 'complete') {
  if (q.status !== 'scheduled') return no('Only booked jobs can be marked done.', 409);
  const invoiceId = q.quote_id.replace('Q-', 'INV-');
  const balance = round2(q.accepted_total - q.deposit_due);
  const due = day(nowDt().plus({ days: Number(s.payment_days) || 7 }).toISO());
  plan.quote_updates.push({ quote_id: q.quote_id, status: 'completed', completed_at: at, invoice_id: invoiceId, balance_due: balance, updated_at: at });
  plan.events.push(eventRow(q.quote_id, 'completed', 'Invoice ' + invoiceId + ': balance ' + money(balance) + ' due ' + due, actor));
  plan.emails.push(emailItem(q.client_email, 'Your final invoice ' + invoiceId + ' from ' + s.company, emailHtml(s, [
    'Hi ' + esc(firstName(q.client_name)) + ',',
    'Thank you for having us. We\'ve finished <b>' + esc(q.job_title) + '</b> and hope you love it.',
    'Your final invoice ' + invoiceId + ' is for <b>' + money(balance) + '</b> (the ' + money(q.accepted_total) + ' total less your ' + money(q.deposit_due) + ' deposit), due by ' + due + '. You can pay by card below or by bank transfer using the details on the invoice.'
  ], button(payUrl(s, q.token, 'balance'), 'Pay ' + money(balance))), 'invoice', q.quote_id, [payUrl(s, q.token, 'balance'), pdfUrl(s, q.token, 'invoice')], 'invoice', q.token));
  plan.result = { message: 'Invoice ' + invoiceId + ' sent: ' + money(balance) };
} else if (action === 'record_payment') {
  const kind = String(body.kind || '');
  if (kind === 'balance' && q.status === 'completed') q.balance_due = q.balance_due || round2(q.accepted_total - q.deposit_due);
  const p = payable(q, kind);
  if (!p.ok) return no(p.message, 409);
  const slot = planPayment(plan, q, kind, 'bank transfer', String(body.ref || ''), T, s, actor);
  plan.result = { message: kind === 'deposit' ? 'Deposit recorded' + (slot ? '; booked ' + slot.crew + ' from ' + day(slot.start) : '') : 'Payment recorded; job closed' };
} else {
  return no('Unknown action.');
}
plan.result.ok = true;
return [{ json: { ok: true, plan } }];
