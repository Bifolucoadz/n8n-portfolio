// Stock check in code (no AI). For each product: units sold per day over the last 28 days, days of
// stock left, the date it runs out, and whether that is inside the supplier lead time plus a safety
// buffer. Reorder quantity covers the lead time plus N more days of sales, at least the supplier minimum.
// @include lib-kettle.js
const s = settingsOf($('Read Settings').all());
const products = $('Get Inventory').first().json.products || [];
const orders = $('Get Orders').first().json.orders || [];
const safety = Number(s.safety_days || 7), after = Number(s.cover_days_after_restock || 30);
const sold = {};
for (const o of orders) for (const l of parseJson(o.items_json, [])) sold[l.sku] = (sold[l.sku] || 0) + Number(l.qty || 0);
const today = DateTime.now().setZone(TZ).startOf('day');
const rows = products.map(p => {
  const perDay = (sold[p.sku] || 0) / 28;
  const cover = perDay > 0 ? p.inventory / perDay : Infinity;
  const need = p.lead_time_days + safety;
  const low = cover < need;
  const qty = low ? Math.max(p.min_order_qty || 1, Math.ceil(perDay * (p.lead_time_days + after) - p.inventory)) : 0;
  const runsOut = isFinite(cover) ? today.plus({ days: Math.floor(cover) }) : null;
  const orderBy = runsOut ? runsOut.minus({ days: p.lead_time_days }) : null;
  return { sku: p.sku, title: p.title, inventory: p.inventory, sold_28d: sold[p.sku] || 0, per_day: Math.round(perDay * 10) / 10,
    days_left: isFinite(cover) ? Math.round(cover) : null, lead_time_days: p.lead_time_days, low, reorder_qty: qty, supplier: p.supplier,
    runs_out: runsOut ? runsOut.toISODate() : '', order_by: orderBy ? (orderBy < today ? 'today (already late)' : orderBy.toISODate()) : '' };
}).sort((a, b) => (a.days_left ?? 1e9) - (b.days_left ?? 1e9));
const low = rows.filter(r => r.low);
const cell = 'padding:6px 8px;border-bottom:1px solid #ebe6dc;text-align:left;font-family:Helvetica,Arial,sans-serif;font-size:13px';
const table = '<table style="border-collapse:collapse;margin:0 0 16px"><tr>' + ['Product', 'In stock', 'Sells/day', 'Days left', 'Lead time', 'Order by', 'Reorder'].map(h => '<th style="' + cell + ';color:#8a857a;font-size:12px">' + h + '</th>').join('') + '</tr>'
  + low.map(r => '<tr><td style="' + cell + '"><b>' + esc(r.title) + '</b><br><span style="color:#8a857a">' + esc(r.supplier) + '</span></td><td style="' + cell + '">' + r.inventory + '</td><td style="' + cell + '">' + r.per_day + '</td><td style="' + cell + ';color:#b42318"><b>' + r.days_left + '</b></td><td style="' + cell + '">' + r.lead_time_days + ' d</td><td style="' + cell + '">' + esc(/^\d{4}-/.test(r.order_by) ? day(r.order_by) : r.order_by) + '</td><td style="' + cell + '"><b>' + r.reorder_qty + '</b></td></tr>').join('') + '</table>';
const period = today.toISODate();
const html = emailHtml(s.store_name || 'Kettle & Fern', [
  low.length + ' product' + (low.length === 1 ? ' is' : 's are') + ' running low. Each will sell out before a new delivery could arrive unless you reorder now (supplier lead time plus ' + safety + ' days\' safety).'
], table + '<p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8a857a;text-align:left">Based on ' + orders.length + ' orders in the last 28 days. Reorder quantities cover the lead time plus ' + after + ' days of sales, never below the supplier\'s minimum.</p>');
return [{ json: {
  any: low.length > 0,
  email: { to: s.owner_email, subject: 'Low stock: ' + low.map(r => r.title.replace(/ \d+(g|ml|L)$/, '')).join(', '), html, kind: 'low_stock', ref: period },
  report: { kind: 'low_stock', period, summary: low.length + ' low: ' + low.map(r => r.sku + ' (' + r.days_left + ' days left)').join(', '), data_json: JSON.stringify(rows), created_at: nowIso() }
} }];
