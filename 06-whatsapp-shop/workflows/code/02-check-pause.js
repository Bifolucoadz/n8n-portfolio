// Is a person handling this chat right now (request_human)? Then the bot stays quiet.
const t = $("Prepare Turn").first().json;
const cust = $input.all().map(i => i.json).find(r => r && r.phone) || {};
const until = cust.handoff_until ? DateTime.fromISO(cust.handoff_until) : null;
const paused = Boolean(until && until.isValid && until > DateTime.now());
return [{ json: { ...t, paused, customer: { name: cust.name || "", orders_count: Number(cust.orders_count) || 0, handoff_until: cust.handoff_until || "" } } }];
