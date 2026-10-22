// Turns the client's action into a plan: update the quote, log it, email the client and the owner.
// @include lib-mgv.js
const c = $input.first().json;
const headers = $('Action Request').first().json.headers || {};
const T = tablesOf($('Load Quote (Action)').first().json);
const s = settingsOf(T.Settings);
const q = quoteOf((T.Quotes || []).find(r => r.quote_id === c.quote_id));
const plan = emptyPlan(s);
const at = nowIso();
const review = dashboardUrl(s) + '&q=' + q.quote_id;
if (c.action === 'accept') {
  const tot = acceptedTotals(q, c.chosen, s);
  const meta = { fingerprint: c.fingerprint, canonical: c.canonical, ip: String(headers['x-forwarded-for'] || headers['x-real-ip'] || 'direct').split(',')[0].trim(), user_agent: String(headers['user-agent'] || '').slice(0, 200), signed_at: c.at, method: 'typed name + checkbox' };
  plan.quote_updates.push({ quote_id: q.quote_id, status: 'accepted', accepted_at: c.at, signed_name: c.name, sign_meta_json: meta, chosen_extras_json: c.chosen, accepted_subtotal: tot.subtotal, accepted_vat: tot.vat, accepted_total: tot.total, deposit_due: tot.deposit, labour_days: tot.labour_days, updated_at: at });
  plan.events.push(eventRow(q.quote_id, 'accepted', 'Signed by ' + c.name + ' for ' + money(tot.total) + (tot.chosen.length ? ' with ' + tot.chosen.map(x => x.item).join(', ') : '') + '; fingerprint ' + String(c.fingerprint).slice(0, 12), 'client'));
  plan.emails.push(emailItem(q.client_email, 'Quote accepted: ' + q.job_title, emailHtml(s, [
    'Hi ' + esc(firstName(q.client_name)) + ',',
    'Thank you for accepting our quote for <b>' + esc(q.job_title) + '</b> (' + money(tot.total) + ' including VAT). A signed copy is attached.',
    'The last step is the <b>' + money(tot.deposit) + '</b> deposit. As soon as it\'s paid we book the first free start date and email it to you.'
  ], button(payUrl(s, q.token, 'deposit'), 'Pay the deposit')), 'client_accepted', q.quote_id, [payUrl(s, q.token, 'deposit')], 'quote', q.token));
  plan.emails.push(emailItem(s.owner_email, 'Accepted: ' + q.quote_id + ' ' + q.client_name + ' (' + money(tot.total) + ')', emailHtml(s, [
    '<b>' + esc(q.client_name) + '</b> accepted and signed <b>' + esc(q.job_title) + '</b> for ' + money(tot.total) + '.',
    tot.chosen.length ? 'Extras added: ' + tot.chosen.map(x => esc(x.item) + ' (' + money(x.amount) + ')').join(', ') + '.' : 'No extras added.',
    'They\'ve been sent the ' + money(tot.deposit) + ' deposit link. The job is booked automatically when it\'s paid.'
  ], button(review, 'Open the quote')), 'owner_accepted', q.quote_id, [review]));
  plan.result = { ok: true, message: 'Accepted' };
} else if (c.action === 'question') {
  plan.quote_updates.push({ quote_id: q.quote_id, messages_json: (q.messages || []).concat([{ from: 'client', text: c.message, at }]), updated_at: at });
  plan.events.push(eventRow(q.quote_id, 'question', c.message.slice(0, 300), 'client'));
  plan.emails.push(emailItem(s.owner_email, 'Question about ' + q.quote_id + ' from ' + q.client_name, emailHtml(s, [
    '<b>' + esc(q.client_name) + '</b> asked about <b>' + esc(q.job_title) + '</b>:',
    '<i>' + esc(c.message).replace(/\n/g, '<br>') + '</i>',
    q.client_phone ? 'Phone: ' + esc(q.client_phone) + ' · email: ' + esc(q.client_email) : 'Email: ' + esc(q.client_email)
  ], button(review, 'Open the quote')), 'owner_question', q.quote_id, [review]));
  plan.result = { ok: true, message: 'Sent' };
} else {
  plan.quote_updates.push({ quote_id: q.quote_id, status: 'declined', declined_at: at, decline_reason: c.reason, updated_at: at });
  plan.events.push(eventRow(q.quote_id, 'declined', c.reason || 'No reason given', 'client'));
  plan.emails.push(emailItem(s.owner_email, 'Declined: ' + q.quote_id + ' ' + q.client_name, emailHtml(s, [
    esc(q.client_name) + ' declined <b>' + esc(q.job_title) + '</b> (' + money(q.total) + ').',
    'Reason: ' + esc(c.reason || 'not given') + '.'
  ], button(review, 'Open the quote')), 'owner_declined', q.quote_id, [review]));
  plan.result = { ok: true, message: 'Declined' };
}
return [{ json: { plan } }];
