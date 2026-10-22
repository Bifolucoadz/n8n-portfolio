// Plain-English order status for the help agent, worked out in code: late means the delivery estimate
// has passed, or tracking hasn't moved for stale_tracking_days. Only orders that matched number and
// email get here; everything else gets "not found".
// @include lib-kettle.js
const s = settingsOf($('Read Settings').all());
const res = $input.first().json || {};
if (!res.found) return [{ json: { found: false, message: 'No order matches that order number and email.' } }];
const o = res.order;
const now = DateTime.now().setZone(TZ);
const items = parseJson(o.items_json, []).map(i => i.qty + ' × ' + i.title).join(', ');
const out = { found: true, order_number: o.order_number, ordered: day(o.created_at), items, total: usd(o.total) };
if (o.fulfillment_status !== 'fulfilled') {
  return [{ json: { ...out, status: 'Being packed. It hasn\'t shipped yet; orders ship within 1 business day (Monday to Friday).', late: false } }];
}
if (o.tracking_status === 'delivered') {
  return [{ json: { ...out, status: 'Delivered ' + day(o.delivered_at) + ' (' + o.last_event + ').', carrier: o.carrier, tracking_url: o.tracking_url, late: false } }];
}
const eta = o.estimated_delivery ? DateTime.fromISO(o.estimated_delivery, { zone: TZ }).endOf('day') : null;
const quietDays = o.last_event_at ? Math.floor(now.diff(DateTime.fromISO(o.last_event_at), 'days').days) : 0;
const pastEta = eta && eta < now;
const stale = quietDays >= Number(s.stale_tracking_days || 4);
const late = !!(pastEta || stale);
return [{ json: { ...out,
  status: 'Shipped ' + day(o.shipped_at) + ' with ' + o.carrier + '. Last tracking update: "' + o.last_event + '" on ' + day(o.last_event_at) + '. Estimated delivery: ' + day(o.estimated_delivery) + '.',
  carrier: o.carrier, tracking_number: o.tracking_number, tracking_url: o.tracking_url, late,
  late_reason: late ? [pastEta ? 'the estimated delivery date (' + day(o.estimated_delivery) + ') has passed' : '', stale ? 'tracking hasn\'t updated for ' + quietDays + ' days' : ''].filter(Boolean).join(' and ') : ''
} }];
