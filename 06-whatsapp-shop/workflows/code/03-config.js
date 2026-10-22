// One tool call from the Honeycrumb agent, plus the shop settings.
const c = $("When Called by Agent").first().json;
const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
const s = v => String(v ?? "").trim();
return [{
  json: {
    action: s(c.action), phone: s(c.phone).replace(/\D/g, ""), customer_name: s(c.customer_name), turn_id: s(c.turn_id),
    test: c.test === true || s(c.test) === "true",
    query: s(c.query), category: s(c.category).toLowerCase(), sku: s(c.sku), qty: Number(c.qty ?? 1), op: s(c.op).toLowerCase() || "view",
    cake_message: s(c.cake_message), area: s(c.area), fulfilment: s(c.fulfilment).toLowerCase(), address: s(c.address),
    deliver_on: s(c.deliver_on), window: s(c.window), note: s(c.note), email: s(c.email), reason: s(c.reason),
    settings,
  },
}];
