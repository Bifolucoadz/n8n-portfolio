// The client's quote page: the quote with live extras, accept-and-sign, questions, and the next step
// (pay the deposit, booking, final invoice, receipt). Also works out the view log (first view emails the owner).
// @include lib-mgv.js
const PAGE =
__HTML_QUOTE__
;
const query = $('Quote Request').first().json.query || {};
const headers = $('Quote Request').first().json.headers || {};
const T = tablesOf($('Load Quote').first().json);
const s = settingsOf(T.Settings);
const token = String(query.t || '');
const q = quoteOf((T.Quotes || []).find(r => token && String(r.token) === token));
const company = { name: s.company || 'Mossgrove Landscapes', phone: s.company_phone || '', address: s.company_address || '', legal: s.company_legal || s.company || '' };
if (!q || q.status === 'draft' && query.preview !== '1') {
  return [{ json: { code: 404, html: pageHtml(s, 'Quote not found', '<p>This link isn\'t valid any more. Please use the newest email from us, or call ' + esc(company.phone) + '.</p>'), log: false } }];
}
const preview = query.preview === '1';
const flashes = {
  accepted: { title: 'Quote accepted', text: 'We\'ve emailed you a copy. Pay the deposit below to book your start date.' },
  declined: { title: 'Thanks for letting us know', text: 'We\'ve passed this on to the team.' },
  deposit: { title: 'Payment received', text: 'Thank you! Your deposit is in and your start date is booked.' },
  balance: { title: 'Payment received', text: 'Thank you! Your invoice is paid in full.' }
};
const data = {
  company, token, preview,
  flash: flashes[String(query.done || query.paid || '')] || null,
  settings: { vat_rate: Number(s.vat_rate === '' ? 0.2 : s.vat_rate), deposit_pct: Number(s.deposit_pct) || 25, payment_days: Number(s.payment_days) || 7 },
  terms: quoteTerms(q, s),
  links: { self: 'quote?t=' + token, action: 'quote-action', pdf: 'pdf?t=' + token + '&doc=quote', invoice: 'pdf?t=' + token + '&doc=invoice', receipt: 'pdf?t=' + token + '&doc=receipt', payDeposit: 'pay?t=' + token + '&kind=deposit', payBalance: 'pay?t=' + token + '&kind=balance' },
  quote: {
    quote_id: q.quote_id, status: q.status, expired: isExpired(q), client_name: q.client_name, first_name: firstName(q.client_name), job_title: q.job_title, summary: q.summary, estimator: q.estimator || s.owner_name,
    lines: q.lines, custom: q.custom, extras: q.extras, assumptions: q.assumptions, chosen_extras: q.chosen_extras,
    subtotal: q.subtotal, vat: q.vat, total: q.total, accepted_at: q.accepted_at, accepted_subtotal: q.accepted_subtotal, accepted_vat: q.accepted_vat, accepted_total: q.accepted_total,
    deposit_due: q.deposit_due, deposit_paid_at: q.deposit_paid_at, balance_due: q.balance_due, invoice_id: q.invoice_id, job_start: q.job_start,
    sent_at: q.sent_at, valid_until: q.valid_until, sent_day: day(q.sent_at), valid_day: day(q.valid_until), accepted_day: day(q.accepted_at),
    start_day: dayLong(q.job_start), end_day: dayLong(q.job_end), due_day: q.completed_at ? day(toDt(q.completed_at).plus({ days: Number(s.payment_days) || 7 }).toISO()) : '',
    job_days: jobDays(q.labour_days)
  }
};
const html = PAGE.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'));

// View log: count views of a sent quote; the first one tells the owner (a good moment to call)
const plan = emptyPlan(s);
const log = !preview && q.status === 'sent' && !/bot|crawl|preview|HeadlessChrome/i.test(String(headers['user-agent'] || ''));
if (log) {
  const at = nowIso();
  plan.quote_updates.push({ quote_id: q.quote_id, view_count: q.view_count + 1, viewed_at: q.viewed_at || at, updated_at: at });
  if (!q.viewed_at) {
    plan.events.push(eventRow(q.quote_id, 'viewed', 'First opened by the client', 'client'));
    plan.emails.push(emailItem(s.owner_email, q.client_name + ' just opened quote ' + q.quote_id, emailHtml(s, [
      '<b>' + esc(q.client_name) + '</b> has just opened the quote for <b>' + esc(q.job_title) + '</b> (' + money(q.total) + ').',
      'A quick call in the next hour is the best time to answer questions' + (q.client_phone ? ': ' + esc(q.client_phone) : '') + '.'
    ], button(dashboardUrl(s) + '&q=' + q.quote_id, 'Open the quote')), 'owner_viewed', q.quote_id, []));
  }
}
return [{ json: { code: 200, html, log, plan } }];
