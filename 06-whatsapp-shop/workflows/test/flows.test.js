// Logic tests for Honeycrumb 1, 5, 6, 7 and 8 Code nodes: node workflows/test/flows.test.js
const assert = require('assert');
const { run, DateTime } = require('./harness');
const now = DateTime.now().setZone('Africa/Lagos');
const J = a => a.map(json => ({ json }));
const order = {
  order_id: 'HC-7K2Q', phone: '2348010000000', customer_name: 'Ada Okafor', status: 'awaiting_payment', total_ngn: 57000, delivery_fee_ngn: 2000,
  items_json: JSON.stringify([{ sku: 'CK-RV8', name: 'Red Velvet Celebration Cake, 8-inch', qty: 1, unit_ngn: 55000, cake_message: 'Happy birthday Zainab' }]),
  fulfilment: 'delivery', area: 'Lekki Phase 1', address: '22 Fola Osibo Road', deliver_on: now.plus({ days: 3 }).toISODate(), window: '1pm-4pm', note: '',
  paystack_ref: 'HC-7K2Q-141500', pay_url: 'https://checkout.paystack.com/abc', reminder_sent: false, created_at: now.minus({ minutes: 90 }).toISO(), updated_at: now.minus({ minutes: 90 }).toISO(),
};

(async () => {
  let n = 0;
  const ok = (c, m) => { assert.ok(c, m); n++; };

  // 1: normalise WhatsApp webhook values.
  const value = { contacts: [{ profile: { name: 'Ada' }, wa_id: '2348010000000' }], messages: [
    { from: '2348010000000', id: 'w1', type: 'text', text: { body: 'Hi' } },
    { from: '2348010000000', id: 'w2', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'b1', title: 'Yes' } } },
    { from: '2348010000000', id: 'w3', type: 'audio', audio: { id: 'm1', mime_type: 'audio/ogg' } },
    { from: '2348010000000', id: 'w4', type: 'location', location: { latitude: 6.43, longitude: 3.47, name: 'Mega Plaza' } },
  ] };
  let r = await run('01-normalise.js', {}, J([value]));
  ok(r.length === 4 && r[0].json.name === 'Ada' && r[1].json.text === 'Yes' && r[2].json.media_id === 'm1' && r[3].json.location.name === 'Mega Plaza', 'four message types normalised');

  // 5: Paystack decisions.
  const ev = { 'Paystack Event': [{ body: { event: 'charge.success', data: { reference: 'HC-7K2Q-141500' } } }] };
  r = await run('05-check-event.js', ev);
  ok(r[0].json.reference === 'HC-7K2Q-141500', 'charge.success accepted');
  r = await run('05-check-event.js', { 'Paystack Event': [{ body: { event: 'transfer.success', data: {} } }] });
  ok(r.length === 0, 'other events ignored');
  const verified = amount => ({ 'Check Event': [{ reference: 'HC-7K2Q-141500' }], 'Verify Payment': [{ status: true, data: { status: 'success', currency: 'NGN', amount } }] });
  r = await run('05-decide.js', verified(5700000), J([order]));
  ok(r[0].json.action === 'paid' && r[0].json.order.status === 'paid' && /Payment received/.test(r[0].json.customer_text) && r[0].json.board_row.phone === '+2348010000000', 'exact amount marks paid');
  r = await run('05-decide.js', verified(570000), J([order]));
  ok(r[0].json.action === 'alert' && /didn't verify/.test(r[0].json.text), 'wrong amount is not marked paid');
  r = await run('05-decide.js', verified(5700000), J([{ ...order, status: 'paid' }]));
  ok(r[0].json.action === 'ignore', 'duplicate webhook ignored');
  r = await run('05-decide.js', verified(5700000), J([{}]));
  ok(r[0].json.action === 'alert' && /doesn't match any open order/.test(r[0].json.text), 'unknown reference alerts');

  // 6: kitchen board status changes.
  const paid = { ...order, status: 'paid' };
  const cust = in24 => ({ phone: '2348010000000', last_inbound_at: (in24 ? now.minus({ hours: 2 }) : now.minus({ hours: 30 })).toISO() });
  r = await run('06-status-change.js', { 'Read Board': [{ order_id: 'HC-7K2Q', status: 'Out for delivery' }], 'Read Orders': [paid], 'Read Customers': [cust(true)] });
  ok(r.length === 1 && r[0].json.status === 'out_for_delivery' && r[0].json.in_window && /on its way/.test(r[0].json.text), 'status change messages the customer');
  r = await run('06-status-change.js', { 'Read Board': [{ order_id: 'HC-7K2Q', status: 'paid' }], 'Read Orders': [paid], 'Read Customers': [cust(true)] });
  ok(r.length === 0, 'unchanged rows ignored');
  r = await run('06-status-change.js', { 'Read Board': [{ order_id: 'HC-7K2Q', status: 'delivered' }], 'Read Orders': [paid], 'Read Customers': [cust(false)] });
  ok(r.length === 1 && r[0].json.in_window === false, 'outside 24 hours: saved but not messaged');

  // 7: reminders and expiry.
  r = await run('07-due.js', { 'Read Unpaid': [order], 'Read Customers': [cust(true)] });
  ok(r.length === 1 && r[0].json.action === 'remind' && r[0].json.button_text === 'Pay ₦57,000', 'reminder after an hour');
  r = await run('07-due.js', { 'Read Unpaid': [{ ...order, reminder_sent: true }], 'Read Customers': [cust(true)] });
  ok(r.length === 0, 'only one reminder');
  r = await run('07-due.js', { 'Read Unpaid': [{ ...order, updated_at: now.minus({ hours: 25 }).toISO() }], 'Read Customers': [cust(true)] });
  ok(r[0].json.action === 'expire', 'expires after 24 hours');

  // 8: daily summary.
  const today = { ...order, status: 'paid', paid_at: now.toISO(), deliver_on: now.plus({ days: 1 }).toISODate() };
  r = await run('08-build-summary.js', { 'Read Settings': [{ key: 'owner_chat_id', value: '42' }], 'Read Orders': [today, { ...order, order_id: 'HC-AAAA' }] });
  ok(r[0].json.chat_id === '42' && /Paid orders: <b>1<\/b> · revenue <b>₦57,000<\/b>/.test(r[0].json.text) && /Waiting for payment: 1/.test(r[0].json.text) && /HC-7K2Q/.test(r[0].json.text), 'summary: ' + r[0].json.text);

  console.log('all ' + n + ' checks passed');
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
