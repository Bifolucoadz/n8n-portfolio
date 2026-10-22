// What this run did.
const picks = $('Pick Carts').all().map(i => i.json);
const sent = picks.filter(p => !p.none).map(p => ({ checkout_id: p.checkout_id, to: p.email, offer: p.offer ? p.offer.text : 'none', left_hours_ago: p.hours }));
return [{ json: { sent, skipped: picks[0].skipped } }];
