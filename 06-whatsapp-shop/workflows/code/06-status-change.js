// @include lib-shop.js
// Kitchen board rows whose status differs from the order (staff changed it) -> order update + customer message.
// WhatsApp only allows free-form messages within 24 hours of the customer's last message.
const STATUS = {
  baking: "👩‍🍳 Your order {id} is in the oven now!",
  out_for_delivery: "🚚 Your order {id} is on its way! The rider will call you when they're close.",
  ready_for_pickup: "🛍️ Your order {id} is ready for pickup at " + SHOP.PICKUP + ".",
  delivered: "✅ Order {id} delivered. Enjoy, and thank you for choosing Honeycrumb! 🧡",
  cancelled: "Your order {id} has been cancelled. Our team will contact you about the refund.",
};
const orders = Object.fromEntries($("Read Orders").all().map(i => i.json).filter(o => o.order_id).map(o => [o.order_id, o]));
const customers = Object.fromEntries($("Read Customers").all().map(i => i.json).filter(c => c.phone).map(c => [c.phone, c]));
const now = DateTime.now().setZone(SHOP.TZ);
const out = [];
for (const r of $("Read Board").all().map(i => i.json)) {
  const status = String(r.status ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const o = orders[String(r.order_id ?? "").trim()];
  if (!o || !STATUS[status] || o.status === status) continue;
  const last = customers[o.phone]?.last_inbound_at ? DateTime.fromISO(customers[o.phone].last_inbound_at) : null;
  const inWindow = Boolean(last && last.isValid && now.diff(last, "hours").hours < 23.5);
  out.push({ json: {
    order_id: o.order_id, phone: o.phone, status, in_window: inWindow,
    text: STATUS[status].replace("{id}", o.order_id),
    updated_at: now.toISO(),
  } });
}
return out;
