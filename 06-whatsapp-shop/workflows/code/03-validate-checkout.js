// @include lib-shop.js
// Everything checkout needs, checked in code: items and current prices, name, delivery or pickup,
// zone and address, date and window against opening days and the longest lead time in the cart.
const c = $("Config").first().json;
const products = $("Read Products (Checkout)").all().map(i => i.json).filter(p => p.sku);
const zones = $("Read Zones (Checkout)").all().map(i => i.json).filter(z => z.area);
const orders = $input.all().map(i => i.json).filter(o => o.order_id);
const now = DateTime.now().setZone(SHOP.TZ);
const order = orders.find(o => o.status === "cart") || orders.find(o => o.status === "awaiting_payment");
const fail = result => [{ json: { ok: false, result } }];
if (!order) return fail("There is no cart yet. Add items with update_cart first.");
let items = parseItems(order.items_json);
if (!items.length) return fail("The cart is empty. Add items with update_cart first.");

const problems = [];
items = items.map(i => {
  const p = products.find(x => x.sku === i.sku);
  if (!p || !p.available) { problems.push(i.name + " is no longer available"); return i; }
  return { ...i, name: p.name, unit_ngn: p.price_ngn, lead_hours: p.lead_hours };
});
const name = c.customer_name || order.customer_name;
if (name.length < 2) problems.push("the customer's name");
const fulfilment = c.fulfilment.startsWith("pick") ? "pickup" : c.fulfilment.startsWith("deliv") ? "delivery" : "";
if (!fulfilment) problems.push("delivery or pickup");
let zone = null;
if (fulfilment === "delivery") {
  zone = matchZone(zones, c.area + " " + c.address);
  if (!zone) problems.push("a delivery area we recognise (use delivery_quote)");
  else if (!zone.covered) problems.push("a covered delivery area (" + zone.area + " is not covered; offer pickup)");
  if (c.address.length < 8) problems.push("the full delivery address with a landmark");
}
const lead = Math.max(...items.map(i => Number(i.lead_hours) || 0));
const windows = SHOP.WINDOWS[fulfilment || "delivery"];
const label = Object.keys(windows).find(k => k.replace(/\s/g, "") === c.window.toLowerCase().replace(/\s/g, ""));
const day = DateTime.fromISO(c.deliver_on.slice(0, 10), { zone: SHOP.TZ });
const first = earliestSlot(lead, fulfilment || "delivery", now);
const firstText = first ? sayDay(first.date) + ", " + first.window : "none in the next three weeks";
if (!day.isValid) problems.push("the " + (fulfilment || "delivery") + " date (earliest possible: " + firstText + ")");
if (!label) problems.push("a window: " + Object.keys(windows).join(", "));
if (problems.length) return fail("Can't check out yet. Still need: " + problems.join("; ") + ".");

const start = day.set({ hour: windows[label], minute: 0, second: 0, millisecond: 0 });
if (!isOpenDay(day)) return fail("We're closed on " + sayDay(day) + " (we bake Monday to Saturday). Earliest possible: " + firstText + ".");
if (start < now.plus({ hours: lead })) return fail("Too soon: this order needs " + lead + " hours' notice. Earliest possible: " + firstText + ".");
if (day > now.startOf("day").plus({ days: SHOP.DAYS_AHEAD })) return fail("We take orders up to " + SHOP.DAYS_AHEAD + " days ahead.");

const sub = subtotalOf(items);
const fee = fulfilment === "delivery" ? Number(zone.fee_ngn) : 0;
const total = sub + fee;
const email = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c.email) ? c.email : "wa" + c.phone + "@customers.honeycrumb.example";
const reference = order.order_id + "-" + now.toFormat("HHmmss");
return [{
  json: {
    ok: true,
    mode: c.settings.payments === "paystack" ? "paystack" : "mock",
    row: {
      order_id: order.order_id, phone: c.phone, customer_name: name, status: "awaiting_payment",
      items_json: JSON.stringify(items), subtotal_ngn: sub, delivery_fee_ngn: fee, total_ngn: total,
      fulfilment, area: zone ? zone.area : "", address: fulfilment === "delivery" ? c.address : SHOP.PICKUP,
      deliver_on: day.toISODate(), window: label, note: c.note || order.note || "", email,
      paystack_ref: reference, pay_url: "", turn_id: c.turn_id, reminder_sent: false,
      created_at: order.created_at || now.toISO(), paid_at: "", updated_at: now.toISO(),
    },
    paystack: {
      email, amount: total * 100, currency: "NGN", reference,
      channels: ["card", "bank_transfer", "ussd", "bank"],
      metadata: { order_id: order.order_id, phone: c.phone, custom_fields: [{ display_name: "Order", variable_name: "order_id", value: order.order_id }] },
    },
  },
}];
