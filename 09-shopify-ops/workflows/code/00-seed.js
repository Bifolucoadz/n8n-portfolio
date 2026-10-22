// The demo store, dated relative to today so it always looks current. A seeded random generator makes
// the same store every time. Everything is invented: products, people (example.com emails), tracking.
// Stories in the data:
// - three products are running low (Ceremonial Matcha, Jasmine Pearls, Glass Teapot);
// - one order is stuck in transit (no tracking update for days), one is in transit and on time,
//   one is waiting to ship and one was delivered;
// - six abandoned checkouts that test every recovery rule;
// - shipping complaints jump in the last 7 days.
// @include lib-kettle.js
let seed = 20261021;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const poisson = l => { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= rnd(); } while (p > L); return k - 1; };
const now = DateTime.now().setZone(TZ);
const today = now.startOf('day');

const P = [
  ['EG-100', 'Earl Grey Cream 100g', 'Black tea', 16, 140, 2.1, 14, 50, 'Hillside Tea Imports', 'Bergamot with a vanilla cream finish. Brew 3 min at 95°C.'],
  ['JP-050', 'Jasmine Pearls 50g', 'Green tea', 22, 14, 0.9, 14, 30, 'Fujian Leaf Co.', 'Hand-rolled pearls scented with jasmine. 2-3 min at 80°C; re-steep 3 times.'],
  ['SK-100', 'Sencha Kyoto 100g', 'Green tea', 18, 85, 1.0, 21, 30, 'Uji Valley Trading', 'Grassy and bright. 1-2 min at 75°C.'],
  ['MC-150', 'Masala Chai 150g', 'Black tea', 15, 120, 1.6, 10, 40, 'Hillside Tea Imports', 'Cardamom, ginger and clove. Simmer with milk for 5 min.'],
  ['PM-075', 'Peppermint Leaf 75g', 'Herbal', 12, 95, 0.8, 10, 40, 'Oregon Herb Farm', 'Cool and clean. 5 min at 100°C.'],
  ['CB-200', 'Ceylon Breakfast 200g', 'Black tea', 17, 110, 1.3, 14, 40, 'Hillside Tea Imports', 'Brisk and malty; takes milk well. 4 min at 100°C.'],
  ['RV-100', 'Rooibos Vanilla 100g', 'Herbal', 14, 70, 0.7, 14, 30, 'Cape Botanicals', 'Caffeine-free and sweet. 5-6 min at 100°C.'],
  ['OT-075', 'Tie Guan Yin Oolong 75g', 'Oolong', 24, 40, 0.5, 21, 20, 'Fujian Leaf Co.', 'Floral and creamy. 3 min at 90°C; re-steep 4 times.'],
  ['MA-030', 'Ceremonial Matcha 30g', 'Green tea', 32, 9, 1.2, 21, 24, 'Uji Valley Trading', 'Sift first, then whisk 2 g with 70 ml of 75°C water.'],
  ['CF-050', 'Chamomile Flowers 50g', 'Herbal', 13, 60, 0.6, 10, 30, 'Oregon Herb Farm', 'Whole flowers, honeyed and calm. 5 min at 100°C.'],
  ['GT-600', 'Glass Teapot 600ml', 'Teaware', 38, 4, 0.4, 30, 12, 'Clearbrew Glassworks', 'Borosilicate glass with a steel infuser.'],
  ['CK-800', 'Cast Iron Kettle 0.8L', 'Teaware', 64, 22, 0.2, 45, 6, 'Iwachu Imports', 'Enamel-lined cast iron.'],
  ['IM-350', 'Tea Infuser Mug 350ml', 'Teaware', 24, 35, 0.6, 30, 24, 'Clearbrew Glassworks', 'Mug with lid and a fine-mesh infuser.'],
  ['SB-008', 'Tasting Sampler Box', 'Gift', 29, 50, 0.9, 7, 20, 'In-house', 'Eight 10 g tins of our best sellers.']
];
const products = P.map(p => ({ sku: p[0], title: p[1], category: p[2], price: p[3], inventory: p[4], lead_time_days: p[6], min_order_qty: p[7], supplier: p[8], notes: p[9] }));
const bySku = Object.fromEntries(products.map(p => [p.sku, p]));

const FIRST = ['Olivia', 'Liam', 'Ava', 'Noah', 'Mia', 'Ethan', 'Zoe', 'Lucas', 'Chloe', 'Mateo', 'Grace', 'Owen', 'Isla', 'Caleb', 'Nora', 'Leo', 'Ruby', 'Ezra', 'Ivy', 'Miles', 'Hazel', 'Jonah', 'Clara', 'Felix'];
const LAST = ['Nguyen', 'Patel', 'Garcia', 'Kim', 'Johnson', 'Okafor', 'Rossi', 'Cohen', 'Silva', 'Murphy', 'Haddad', 'Larsen', 'Ito', 'Brennan', 'Moreau', 'Alvarez'];
const CITIES = ['Portland, OR', 'Austin, TX', 'Denver, CO', 'Chicago, IL', 'Brooklyn, NY', 'Seattle, WA', 'Asheville, NC', 'Madison, WI', 'Boise, ID', 'Raleigh, NC'];
const person = () => { const f = pick(FIRST), l = pick(LAST); return { name: f + ' ' + l, email: (f + '.' + l).toLowerCase() + '@example.com' }; };
const trackNo = c => c === 'USPS' ? '9400' + String(Math.floor(rnd() * 1e15)).padStart(15, '0').slice(0, 15) : '1Z' + Array.from({ length: 16 }, () => '0123456789ABCDEFGHJKLMNPRTUVWXY'[Math.floor(rnd() * 31)]).join('');

// Orders for the last 28 days, built from each product's daily sales rate.
const orders = [];
let num = 1601;
for (let d = 28; d >= 0; d--) {
  const day = today.minus({ days: d });
  const lines = [];
  for (const p of P) { const q = poisson(p[5] * (d === 0 ? now.hour / 24 : 1)); for (let k = 0; k < q; k++) lines.push(p[0]); }
  while (lines.length) {
    const take = Math.min(lines.length, 1 + Math.floor(rnd() * 3));
    const items = {};
    for (const s of lines.splice(0, take)) items[s] = (items[s] || 0) + 1;
    const who = person();
    const created = day.set({ hour: 7 + Math.floor(rnd() * 15), minute: Math.floor(rnd() * 60) });
    if (created > now) continue;
    const list = Object.entries(items).map(([sku, qty]) => ({ sku, title: bySku[sku].title, qty, price: bySku[sku].price }));
    const sub = list.reduce((t, l) => t + l.qty * l.price, 0);
    orders.push({ order_number: '#' + (num++), email: who.email, customer_name: who.name, created_at: created.toISO(), total: Math.round((sub + (sub >= 50 ? 0 : 6.95)) * 100) / 100,
      items_json: JSON.stringify(list), ship_city: pick(CITIES) });
  }
}
// Fulfilment: ships the next working day; delivered 2-5 days after shipping.
for (const o of orders) {
  const c = DateTime.fromISO(o.created_at, { zone: TZ });
  let ship = c.plus({ days: 1 }).set({ hour: 15 });
  if (ship.weekday === 6) ship = ship.plus({ days: 2 }); else if (ship.weekday === 7) ship = ship.plus({ days: 1 });
  const carrier = rnd() < 0.6 ? 'USPS' : 'UPS';
  const transit = 2 + Math.floor(rnd() * 4);
  const eta = ship.plus({ days: transit });
  Object.assign(o, { fulfillment_status: 'unfulfilled', shipped_at: '', carrier: '', tracking_number: '', tracking_url: '', tracking_status: '', estimated_delivery: '', last_event: '', last_event_at: '', delivered_at: '' });
  if (ship < now) {
    const tn = trackNo(carrier);
    Object.assign(o, { fulfillment_status: 'fulfilled', shipped_at: ship.toISO(), carrier, tracking_number: tn, tracking_url: 'https://track.kettleandfern.example/' + tn, estimated_delivery: eta.toISODate() });
    if (eta.set({ hour: 14 }) < now) Object.assign(o, { tracking_status: 'delivered', delivered_at: eta.set({ hour: 14 }).toISO(), last_event: 'Delivered, front door', last_event_at: eta.set({ hour: 14 }).toISO() });
    else Object.assign(o, { tracking_status: 'in_transit', last_event: 'In transit to the destination facility', last_event_at: ship.plus({ days: 1 }).set({ hour: 9 }).toISO() });
  }
}
// The four orders the help-chat demo uses (named customers, fixed stories).
const at = days => orders.filter(o => DateTime.fromISO(o.created_at) < now.minus({ days })).slice(-1)[0];
const stuck = at(9), moving = at(3), waiting = orders[orders.length - 2] || at(0), delivered = at(7);
const stuckNo = trackNo('USPS');
Object.assign(stuck, { email: 'marcus.lee@example.com', customer_name: 'Marcus Lee', carrier: 'USPS', tracking_number: stuckNo, tracking_url: 'https://track.kettleandfern.example/' + stuckNo, tracking_status: 'in_transit', delivered_at: '',
  estimated_delivery: now.minus({ days: 3 }).toISODate(), last_event: 'Arrived at USPS regional facility, Memphis TN', last_event_at: now.minus({ days: 6 }).set({ hour: 4, minute: 12 }).toISO() });
Object.assign(moving, { email: 'sarah.chen@example.com', customer_name: 'Sarah Chen', tracking_status: 'in_transit', delivered_at: '',
  estimated_delivery: now.plus({ days: 1 }).toISODate(), last_event: 'Departed USPS facility, Denver CO', last_event_at: now.minus({ hours: 10 }).toISO() });
Object.assign(waiting, { email: 'priya.nair@example.com', customer_name: 'Priya Nair', fulfillment_status: 'unfulfilled', shipped_at: '', carrier: '', tracking_number: '', tracking_url: '', tracking_status: '', estimated_delivery: '', last_event: '', last_event_at: '', delivered_at: '' });
Object.assign(delivered, { email: 'tom.becker@example.com', customer_name: 'Tom Becker' });

// Abandoned checkouts: each one tests a recovery rule.
const ck = (id, who, hoursAgo, items, opts) => {
  const list = items.map(([sku, qty]) => ({ sku, title: bySku[sku].title, qty, price: bySku[sku].price }));
  return { checkout_id: id, email: who[1], first_name: who[0], created_at: now.minus({ minutes: Math.round(hoursAgo * 60) }).toISO(), items_json: JSON.stringify(list),
    subtotal: list.reduce((t, l) => t + l.qty * l.price, 0), recovery_url: 'https://kettleandfern.example/checkouts/' + id + '/recover', completed: false, accepts_marketing: true,
    orders_count: 0, contacted_at: '', offer: '', ...opts };
};
const checkouts = [
  ck('CK-7001', ['Ava', 'ava.morgan@example.com'], 3, [['MA-030', 1], ['IM-350', 1], ['CF-050', 1]], { orders_count: 0 }),
  ck('CK-7002', ['Leo', 'leo.haddad@example.com'], 2, [['EG-100', 1], ['MC-150', 1], ['CF-050', 1]], { orders_count: 4 }),
  ck('CK-7003', ['Nora', 'nora.ito@example.com'], 5, [['SB-008', 1], ['GT-600', 1]], { accepts_marketing: false }),
  ck('CK-7004', ['Felix', 'felix.larsen@example.com'], 0.4, [['OT-075', 2]], {}),
  ck('CK-7005', ['Isla', 'isla.brennan@example.com'], 6, [['JP-050', 1], ['SK-100', 1]], { completed: true }),
  ck('CK-7006', ['Owen', 'owen.silva@example.com'], 120, [['CK-800', 1]], {})
];

// Reviews: the last 14 days. Shipping complaints jump in the last 7.
const R = [
  // [days ago, sku, rating, title, body]
  [1, 'EG-100', 2, 'Great tea, very slow delivery', 'The Earl Grey is lovely but my order took 9 days to arrive and tracking didn\'t update for most of that time.'],
  [1, 'MA-030', 3, 'Clumpy unless you sift', 'Good colour and flavour, but it clumps badly. The tin doesn\'t say to sift it, I only found that on your website.'],
  [2, 'MC-150', 2, 'Still waiting', 'Ordered over a week ago and it\'s still "in transit". No reply to my email yet either.'],
  [2, 'SB-008', 5, 'Perfect gift', 'Bought the sampler for my sister and she loved every tin. Beautiful packaging.'],
  [2, 'CB-200', 5, 'My new everyday tea', 'Strong, malty and great with milk. Already reordered.'],
  [3, 'JP-050', 2, 'Shipping took forever', 'Jasmine pearls are beautiful but delivery was 10 days. I\'d order more if shipping were faster.'],
  [3, 'GT-600', 4, 'Nice teapot', 'Looks great and the infuser works well. A little smaller than I expected.'],
  [3, 'RV-100', 5, 'Dessert in a cup', 'Sweet, smooth and caffeine-free. Perfect at night.'],
  [4, 'OT-075', 3, 'Confusing brewing instructions', 'The label says 3 minutes but the leaflet says 45 seconds for the first steep. Which is it? Tastes great once you get it right.'],
  [4, 'EG-100', 1, 'Tin arrived dented', 'The tin was crushed in the box and some tea spilled out. Needs better packing.'],
  [4, 'PM-075', 5, 'So fresh', 'Really fresh peppermint, much better than supermarket bags.'],
  [5, 'MA-030', 2, 'Late and expensive', 'Arrived a week late, and $32 for 30 g is a lot when it shows up after my event.'],
  [5, 'CF-050', 5, 'Helps me sleep', 'Whole flowers, lovely honey taste.'],
  [5, 'IM-350', 4, 'Handy mug', 'Use it every day at work. The lid gets hot though.'],
  [6, 'SK-100', 4, 'Bright and grassy', 'Great sencha. Wish it came in a bigger size.'],
  [6, 'MC-150', 2, 'Delivery delay', 'Took 8 days. The chai itself is good.'],
  [6, 'CB-200', 5, 'Excellent breakfast tea', 'Exactly what I was looking for.'],
  [7, 'SB-008', 4, 'Good variety', 'Nice way to try things. Two tins were half empty though.'],
  [8, 'EG-100', 5, 'Best Earl Grey', 'The cream note is amazing. Fast delivery too.'],
  [8, 'JP-050', 5, 'Beautiful', 'Watching the pearls unfurl is half the fun.'],
  [9, 'MA-030', 4, 'Good matcha', 'Smooth with no bitterness. Sift it first!'],
  [9, 'GT-600', 5, 'Lovely teapot', 'Heat-proof and easy to clean.'],
  [10, 'MC-150', 5, 'Proper chai', 'Simmered with oat milk, perfect.'],
  [10, 'OT-075', 4, 'Floral', 'Lovely, and it re-steeps well.'],
  [11, 'RV-100', 5, 'Kids love it', 'Caffeine-free so the kids can have it too.'],
  [11, 'CK-800', 3, 'Heavy but nice', 'Beautiful kettle but pricey for what it is.'],
  [12, 'PM-075', 4, 'Good mint', 'Nice and strong.'],
  [12, 'EG-100', 3, 'Slow shipping', 'Took about a week. Tea is great.'],
  [13, 'SK-100', 5, 'Superb', 'One of the best senchas I\'ve had in the US.'],
  [13, 'CB-200', 4, 'Solid', 'Good value for 200 g.']
];
const reviews = R.map((r, i) => ({ review_id: 'RV-' + (5100 + i), sku: r[1], rating: r[2], title: r[3], body: r[4], author: pick(FIRST) + ' ' + pick(LAST)[0] + '.',
  created_at: now.minus({ days: r[0], hours: Math.floor(rnd() * 10) }).toISO(), topics_json: '', sentiment: '', issue: '', analysed_at: '' }));

return [
  ...products.map(r => ({ json: { table: 'products', ...r } })),
  ...orders.map(r => ({ json: { table: 'orders', ...r } })),
  ...checkouts.map(r => ({ json: { table: 'checkouts', ...r } })),
  ...reviews.map(r => ({ json: { table: 'reviews', ...r } }))
];
