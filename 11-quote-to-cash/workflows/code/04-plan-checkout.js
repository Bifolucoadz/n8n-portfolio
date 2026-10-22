// Decides what the payment link shows: in test mode a practice checkout (test card), in live mode a
// Stripe Checkout session; a friendly message if there's nothing to pay.
// @include lib-mgv.js
// @include lib-pay.js
const PAGE =
__HTML_CHECKOUT__
;
const query = $('Pay Request').first().json.query || {};
const T = tablesOf($('Load Quote').first().json);
const s = settingsOf(T.Settings);
const token = String(query.t || ''), kind = String(query.kind || '');
const q = quoteOf((T.Quotes || []).find(r => token && String(r.token) === token));
const p = payable(q, kind);
if (!p.ok) return [{ json: { route: 'message', html: pageHtml(s, p.message.indexOf('Thank you') >= 0 ? 'All paid' : 'Nothing to pay', '<p>' + esc(p.message) + '</p>' + (q ? '<a class="btn" href="quote?t=' + esc(token) + '">Back to your quote</a>' : '')) } }];
const items = kind === 'deposit'
  ? [['Quote total (accepted ' + day(q.accepted_at) + ')', q.accepted_total], ['Deposit ' + (Number(s.deposit_pct) || 25) + '%', q.deposit_due]]
  : [['Total for the work', q.accepted_total], ['Deposit paid', -q.deposit_due], ['Balance due', q.balance_due]];
if (s.mode === 'live') {
  return [{ json: { route: 'stripe', pence: Math.round(p.amount * 100), currency: s.currency || 'gbp', product: s.company + ': ' + p.label, email: q.client_email, token, kind,
    success_url: baseUrl(s) + '/webhook/mossgrove/quote?t=' + token + '&paid=' + kind, cancel_url: baseUrl(s) + '/webhook/mossgrove/quote?t=' + token } }];
}
const data = { company: s.company, label: p.label, amount: p.amount, items, email: q.client_email, name: q.client_name, token, kind, confirm: 'pay-test', back: 'quote?t=' + token };
return [{ json: { route: 'page', html: PAGE.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c')) } }];
