// @include lib-shop.js
// Unpaid orders: one reminder after 60 minutes (inside the 24-hour window), expire after 24 hours.
const now = DateTime.now().setZone(SHOP.TZ);
const customers = Object.fromEntries($("Read Customers").all().map(i => i.json).filter(c => c.phone).map(c => [c.phone, c]));
const out = [];
for (const o of $("Read Unpaid").all().map(i => i.json).filter(o => o.order_id && o.status === "awaiting_payment")) {
  const age = now.diff(DateTime.fromISO(o.updated_at || o.created_at), "minutes").minutes;
  if (age >= 24 * 60) { out.push({ json: { action: "expire", order_id: o.order_id, phone: o.phone } }); continue; }
  const last = customers[o.phone]?.last_inbound_at ? DateTime.fromISO(customers[o.phone].last_inbound_at) : null;
  const inWindow = Boolean(last && last.isValid && now.diff(last, "hours").hours < 23.5);
  if (age >= 60 && !o.reminder_sent && inWindow) {
    out.push({ json: { action: "remind", order_id: o.order_id, phone: o.phone, url: o.pay_url, button_text: "Pay " + naira(o.total_ngn),
      body: "Hi " + (String(o.customer_name).split(" ")[0] || "there") + ", your order *" + o.order_id + "* is still waiting for payment. Tap below to pay and we'll start baking. If you'd like to change anything, just reply here." } });
  }
}
return out;
