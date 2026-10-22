// Logic tests for Honeycrumb Code nodes: node workflows/test/logic.test.js
const assert = require('assert');
const { run, DateTime } = require('./harness');

const TZ = 'Africa/Lagos';
const now = DateTime.now().setZone(TZ);
const products = [
  { sku: 'CK-RV6', name: 'Red Velvet Celebration Cake, 6-inch', category: 'cakes', description: 'Red velvet', price_ngn: 38000, lead_hours: 48, available: true, allergens: 'gluten, egg, dairy', serves: '8-10' },
  { sku: 'CK-RV8', name: 'Red Velvet Celebration Cake, 8-inch', category: 'cakes', description: 'Red velvet', price_ngn: 55000, lead_hours: 48, available: true, allergens: 'gluten, egg, dairy', serves: '15-20' },
  { sku: 'CP-BOX6', name: 'Cupcake box of 6', category: 'cupcakes', description: 'Mixed', price_ngn: 12000, lead_hours: 3, available: true, allergens: 'gluten, egg, dairy', serves: '6' },
  { sku: 'DR-CHAP', name: 'Chapman, 50cl', category: 'drinks', description: 'Chapman', price_ngn: 2000, lead_hours: 1, available: false, allergens: 'none', serves: '1' },
];
const zones = [
  { area: 'Lekki Phase 1', aliases: 'lekki, lekki 1, admiralty', fee_ngn: 2000, eta: '1-2 hours', covered: true },
  { area: 'Victoria Island', aliases: 'vi, v.i, victoria island', fee_ngn: 3000, eta: '1-2 hours', covered: true },
  { area: 'Epe / Ibeju-Lekki', aliases: 'epe, ibeju, lakowe', fee_ngn: 0, eta: '', covered: false },
];
const cfg = (action, extra = {}) => ({ Config: [{ action, phone: '2348010000000', customer_name: 'Ada', turn_id: 't-1', test: true, query: '', category: '', sku: '', qty: 1, op: 'view', cake_message: '', area: '', fulfilment: '', address: '', deliver_on: '', window: '', note: '', email: '', reason: '', settings: { payments: 'mock' }, ...extra }] });
const J = a => a.map(json => ({ json }));

(async () => {
  let n = 0;
  const ok = (c, m) => { assert.ok(c, m); n++; };

  let r = await run('03-search-menu.js', cfg('search_menu', { query: 'red velvet' }), J(products));
  ok(/CK-RV6/.test(r[0].json.result) && /CK-RV8/.test(r[0].json.result) && /₦38,000/.test(r[0].json.result) && !/Cupcake/.test(r[0].json.result), 'search by words: ' + r[0].json.result);
  r = await run('03-search-menu.js', cfg('search_menu'), J(products));
  ok(/Menu categories/.test(r[0].json.result) && /cakes \(2 items, from ₦38,000\)/.test(r[0].json.result), 'category overview');
  r = await run('03-search-menu.js', cfg('search_menu', { query: 'chapman' }), J(products));
  ok(/SOLD OUT/.test(r[0].json.result), 'sold out flagged');

  // Cart: add cake with long message, add cupcakes, set, sold out item, unknown sku.
  const cartNodes = extra => ({ ...cfg('update_cart', extra), 'Read Products (Cart)': J(products) });
  r = await run('03-apply-cart.js', cartNodes({ op: 'add', sku: 'CK-RV8', qty: 1, cake_message: 'Happy 30th Birthday Chiamaka from all of us!!' }), J([]));
  const row1 = r[0].json.row;
  ok(r[0].json.write && /^HC-[A-Z2-9]{4}$/.test(row1.order_id) && row1.subtotal_ngn === 55000 && /shortened/.test(r[0].json.result), 'new cart with trimmed message');
  ok(JSON.parse(row1.items_json)[0].cake_message.length === 30, 'message is 30 chars');
  r = await run('03-apply-cart.js', cartNodes({ op: 'add', sku: 'cupcake box of 6', qty: 2 }), J([row1]));
  const row2 = r[0].json.row;
  ok(row2.order_id === row1.order_id && row2.subtotal_ngn === 79000 && JSON.parse(row2.items_json).length === 2, 'add by name to same cart: ' + r[0].json.result);
  r = await run('03-apply-cart.js', cartNodes({ op: 'set', sku: 'CP-BOX6', qty: 0 }), J([row2]));
  ok(r[0].json.row.subtotal_ngn === 55000, 'set qty 0 removes');
  r = await run('03-apply-cart.js', cartNodes({ op: 'add', sku: 'DR-CHAP' }), J([row2]));
  ok(!r[0].json.write && /sold out/.test(r[0].json.result), 'sold out refused');
  r = await run('03-apply-cart.js', cartNodes({ op: 'add', sku: 'red velvet' }), J([row2]));
  ok(!r[0].json.write && /No single menu item/.test(r[0].json.result), 'ambiguous name refused');
  r = await run('03-apply-cart.js', cartNodes({ op: 'view' }), J([row2]));
  ok(!r[0].json.write && /Subtotal: ₦79,000/.test(r[0].json.result), 'view');
  r = await run('03-apply-cart.js', cartNodes({ op: 'add', sku: 'CP-BOX6' }), J([{ ...row2, status: 'awaiting_payment', pay_url: 'https://x' }]));
  ok(r[0].json.row.status === 'cart' && r[0].json.row.pay_url === '' && /no longer applies/.test(r[0].json.result), 'changing after checkout drops the link');

  // Delivery quotes.
  r = await run('03-delivery-quote.js', cfg('delivery_quote', { area: 'VI' }), J(zones));
  ok(/Victoria Island: ₦3,000/.test(r[0].json.result), 'VI alias');
  r = await run('03-delivery-quote.js', cfg('delivery_quote', { area: 'Lakowe lakes' }), J(zones));
  ok(/don't deliver to Epe/.test(r[0].json.result), 'not covered');
  r = await run('03-delivery-quote.js', cfg('delivery_quote', { area: 'Abuja' }), J(zones));
  ok(/not recognised/.test(r[0].json.result), 'unknown area');

  // Checkout.
  const chk = extra => ({ ...cfg('checkout', extra), 'Read Products (Checkout)': J(products), 'Read Zones (Checkout)': J(zones) });
  let day = now.startOf('day').plus({ days: 3 });
  while (day.weekday === 7) day = day.plus({ days: 1 });
  r = await run('03-validate-checkout.js', chk({ fulfilment: 'delivery', area: 'Lekki', address: '12 Fola Osibo Road, near the bank', deliver_on: day.toISODate(), window: '1pm-4pm' }), J([row2]));
  const v = r[0].json;
  ok(v.ok && v.row.total_ngn === 81000 && v.paystack.amount === 8100000 && v.row.area === 'Lekki Phase 1' && v.mode === 'mock', 'valid checkout: ' + JSON.stringify(v).slice(0, 200));
  ok(/^wa2348010000000@/.test(v.paystack.email), 'placeholder email');
  const tomorrow = now.startOf('day').plus({ days: 1 });
  r = await run('03-validate-checkout.js', chk({ fulfilment: 'delivery', area: 'Lekki', address: '12 Fola Osibo Road', deliver_on: tomorrow.toISODate(), window: '10am-1pm' }), J([row2]));
  ok(!r[0].json.ok && (/Too soon|closed/.test(r[0].json.result)) && /Earliest possible/.test(r[0].json.result), 'cake needs 48h: ' + r[0].json.result);
  let sunday = now.startOf('day').plus({ days: 3 });
  while (sunday.weekday !== 7) sunday = sunday.plus({ days: 1 });
  r = await run('03-validate-checkout.js', chk({ fulfilment: 'pickup', deliver_on: sunday.toISODate(), window: '9am-12pm' }), J([row2]));
  ok(!r[0].json.ok && /closed on Sunday/.test(r[0].json.result), 'closed Sunday');
  r = await run('03-validate-checkout.js', chk({ fulfilment: 'delivery', area: 'Lekki', address: 'x', deliver_on: day.toISODate(), window: 'evening' }), J([row2]));
  ok(!r[0].json.ok && /full delivery address/.test(r[0].json.result) && /a window/.test(r[0].json.result), 'missing address and window listed');
  r = await run('03-validate-checkout.js', chk({ fulfilment: 'pickup', deliver_on: day.toISODate(), window: '12pm - 3pm' }), J([row2]));
  ok(r[0].json.ok && r[0].json.row.delivery_fee_ngn === 0 && r[0].json.row.window === '12pm-3pm', 'pickup, spaced window accepted');

  // Mock payment and result text.
  r = await run('03-attach-payment.js', { 'Validate Checkout': [v] }, J([v]));
  ok(r[0].json._ok && /checkout\.paystack\.com\/mock-/.test(r[0].json.pay_url) && r[0].json.status === 'awaiting_payment', 'mock link');
  const res = await run('03-checkout-result.js', { 'Validate Checkout': [v], 'Attach Payment': r }, r);
  ok(/ready for payment/.test(res[0].json.result) && /Total ₦81,000/.test(res[0].json.result), 'checkout result');

  // Send payloads.
  const settingsRows = [{ key: 'graph_version', value: 'v23.0' }, { key: 'whatsapp_phone_number_id', value: '999' }];
  let p = await run('04-build-payload.js', { 'Read Settings': J(settingsRows), 'When Called': [{ to: '+234 801 000 0000', kind: 'cta', body: 'Pay now', url: 'https://pay', button_text: 'Pay ₦81,000 for your order', test: false }] });
  ok(p[0].json.payload.interactive.action.parameters.display_text.length <= 20 && p[0].json.payload.to === '2348010000000' && /999\/messages$/.test(p[0].json.url), 'cta payload');
  p = await run('04-build-payload.js', { 'Read Settings': J(settingsRows), 'When Called': [{ kind: 'read', message_id: 'w1', test: true }] });
  ok(p.length === 0, 'no read receipts in test mode');

  console.log('all ' + n + ' checks passed');
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
