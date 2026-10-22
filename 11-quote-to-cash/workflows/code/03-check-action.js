// Checks what the client asked for (accept, question, decline) against the quote's state, and for an
// acceptance builds the exact text of what they're signing, which the next node fingerprints with SHA-256.
// @include lib-mgv.js
const body = $('Action Request').first().json.body || {};
const T = tablesOf($('Load Quote (Action)').first().json);
const s = settingsOf(T.Settings);
const token = String(body.t || '');
const q = quoteOf((T.Quotes || []).find(r => token && String(r.token) === token));
const action = String(body.action || '');
const no = (message, code) => [{ json: { ok: false, code: code || 400, message } }];
if (!q || q.status === 'draft') return no('This quote link is not valid.', 404);
if (!['accept', 'question', 'decline'].includes(action)) return no('Unknown action.');
if (action === 'question') {
  const message = String(body.message || '').trim().slice(0, 2000);
  if (message.length < 3) return no('Please write your question.');
  return [{ json: { ok: true, action, quote_id: q.quote_id, message, canonical: q.quote_id + '|question|' + message } }];
}
if (q.status !== 'sent') return no(q.status === 'declined' ? 'This quote was declined.' : (q.status === 'cancelled' ? 'This quote was withdrawn.' : 'This quote has already been accepted.'), 409);
if (isExpired(q)) return no('This quote has expired. Please call us on ' + (s.company_phone || '') + ' and we\'ll update it.', 409);
if (action === 'decline') return [{ json: { ok: true, action, quote_id: q.quote_id, reason: String(body.reason || '').slice(0, 200), canonical: q.quote_id + '|decline' } }];
const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
if (name.length < 3 || name.indexOf(' ') < 0) return no('Please type your first and last name.');
if (body.agree !== true) return no('Please tick the box to accept the terms.');
const offered = (q.extras || []).map(x => x.code);
const chosen = [...new Set((Array.isArray(body.extras) ? body.extras : []).map(String))].filter(c => offered.includes(c));
const tot = acceptedTotals(q, chosen, s);
const at = nowIso();
const signed = {
  quote_id: q.quote_id, version: q.version, client: q.client_name, signed_by: name, signed_at: at,
  lines: q.lines.map(l => [l.code, l.quantity, l.unit_price, l.amount]),
  custom: (q.custom || []).map(c => [c.description, c.quantity, c.unit_price, c.amount]),
  extras: tot.chosen.map(x => [x.code, x.quantity, x.unit_price, x.amount]),
  subtotal: tot.subtotal, vat: tot.vat, total: tot.total, deposit: tot.deposit
};
return [{ json: { ok: true, action, quote_id: q.quote_id, name, chosen, at, canonical: JSON.stringify(signed) } }];
