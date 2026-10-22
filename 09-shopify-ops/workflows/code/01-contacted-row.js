// Marks a checkout as contacted (and which offer it got), so it is never emailed twice.
// @include lib-kettle.js
const r = $('Route').first().json;
return [{ json: { checkout_id: r.checkout_id, contacted_at: nowIso(), offer: r.offer || '' } }];
