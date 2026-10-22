// A support ticket for the team: who, which order, what the tracking says, and the customer's words.
// Only created when the order number and email matched.
// @include lib-kettle.js
const s = settingsOf($('Read Settings').all());
const req = $('When Called').first().json;
const res = $input.first().json || {};
if (!res.found) return [{ json: { skip: true, answer: { ok: false, message: 'No order matches that order number and email, so no ticket was opened.' } } }];
const o = res.order;
const id = newId('KF-', 5);
const html = emailHtml(s.store_name || 'Kettle & Fern', [
  '<b>Ticket ' + id + '</b> from the help chat.',
  'Customer: ' + esc(o.customer_name) + ' &lt;' + esc(o.email) + '&gt;<br>Order: ' + esc(o.order_number) + ', placed ' + esc(day(o.created_at)) + ', ' + esc(usd(o.total)),
  'Carrier: ' + esc(o.carrier) + ' ' + esc(o.tracking_number) + '<br>Last tracking: ' + esc(o.last_event) + ' (' + esc(day(o.last_event_at)) + ')<br>Estimated delivery: ' + esc(day(o.estimated_delivery)),
  'Summary: ' + esc(req.summary || '')
]);
return [{ json: {
  to: s.support_email, subject: 'Ticket ' + id + ': order ' + o.order_number + ' (' + clip(req.summary || 'help chat', 60) + ')', html, kind: 'support_ticket', ref: id,
  answer: { ok: true, ticket_id: id, message: 'Ticket ' + id + ' opened. The team will reply by email within 1 business day.' }
} }];
