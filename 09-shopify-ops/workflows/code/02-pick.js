// Which abandoned checkouts get an email, and what offer each one gets. Rules, not AI:
// - only checkouts that weren't completed, have an email, have marketing consent, haven't been
//   contacted, and were left between abandoned_min_hours and abandoned_max_hours ago;
// - first-time customers with a cart of welcome_min_subtotal or more get the welcome code;
// - carts within free_shipping_nudge of the free-shipping threshold get a free-shipping nudge;
// - everyone else gets a friendly reminder with no offer.
// @include lib-kettle.js
const s = settingsOf($('Read Settings').all());
const all = ($('Get Checkouts').first().json.checkouts || []);
const notes = Object.fromEntries(($('Get Products').first().json.products || []).map(p => [p.sku, p.notes]));
const now = Date.now();
const minH = Number(s.abandoned_min_hours || 1), maxH = Number(s.abandoned_max_hours || 48);
const threshold = Number(s.free_shipping_threshold || 50), nudge = Number(s.free_shipping_nudge || 15), welcomeMin = Number(s.welcome_min_subtotal || 60);
const skipped = [], send = [];
for (const c of all) {
  const hours = (now - Date.parse(c.created_at)) / 3600000;
  const why = c.completed ? 'completed the order' : !c.email ? 'no email' : !c.accepts_marketing ? 'no marketing consent' : c.contacted_at ? 'already contacted' : hours < minH ? 'too recent (' + Math.round(hours * 60) + ' min)' : hours > maxH ? 'too old (' + Math.round(hours / 24) + ' days)' : '';
  if (why) { skipped.push({ checkout_id: c.checkout_id, reason: why }); continue; }
  const items = parseJson(c.items_json, []);
  let offer = null;
  if (Number(c.orders_count || 0) === 0 && c.subtotal >= welcomeMin) offer = { type: 'code', code: s.welcome_code || 'WELCOME10', text: '10% off your first order with the code ' + (s.welcome_code || 'WELCOME10') };
  else if (c.subtotal < threshold && threshold - c.subtotal <= nudge) offer = { type: 'free_shipping', text: 'add ' + usd(threshold - c.subtotal) + ' more and shipping is free' };
  const prompt = 'Customer first name: ' + c.first_name + '\n\nItems in the cart:\n'
    + items.map(i => '- ' + i.qty + ' × ' + i.title + ' (shop notes: ' + (notes[i.sku] || 'none') + ')').join('\n')
    + '\n\nOffer: ' + (offer ? offer.text : 'none');
  send.push({ ...c, items, offer, prompt, hours: Math.round(hours * 10) / 10 });
}
return send.length ? send.map(json => ({ json: { ...json, skipped } })) : [{ json: { none: true, skipped } }];
