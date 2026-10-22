// Shapes the table rows into the answer for each read. Order lookups need the number AND the email to
// match; a wrong email gets the same answer as a wrong number, so nothing leaks.
// @include lib-kettle.js
const r = $('Route').first().json;
const rows = $input.all().map(i => i.json).filter(x => x && Object.keys(x).length > 1);
const since = d => DateTime.now().setZone(TZ).minus({ days: Number(d || 7) }).toMillis();
const strip = x => { const { id, createdAt, updatedAt, ...rest } = x; return rest; };
let out;
if (r.action === 'abandoned_checkouts') out = { checkouts: rows.map(strip) };
else if (r.action === 'orders_since') out = { orders: rows.filter(o => Date.parse(o.created_at) >= since(r.days)).map(strip) };
else if (r.action === 'inventory') out = { products: rows.map(strip) };
else if (r.action === 'reviews_since') out = { reviews: rows.filter(v => Date.parse(v.created_at) >= since(r.days)).map(strip) };
else if (r.action === 'find_order') {
  const num = String(r.order_number || '').replace(/[^0-9]/g, '');
  const email = String(r.email || '').trim().toLowerCase();
  const o = rows.find(x => x.order_number.replace(/[^0-9]/g, '') === num && num);
  out = o && email && o.email.toLowerCase() === email ? { found: true, order: strip(o) } : { found: false };
}
return [{ json: out || {} }];
