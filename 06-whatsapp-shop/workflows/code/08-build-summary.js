// @include lib-shop.js
const now = DateTime.now().setZone(SHOP.TZ);
const today = now.toISODate();
const tomorrow = now.plus({ days: 1 }).toISODate();
const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
const orders = $("Read Orders").all().map(i => i.json).filter(o => o.order_id);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const paidToday = orders.filter(o => o.paid_at && DateTime.fromISO(o.paid_at).setZone(SHOP.TZ).toISODate() === today);
const revenue = paidToday.reduce((s, o) => s + Number(o.total_ngn || 0), 0);
const counts = {};
for (const o of paidToday) for (const i of parseItems(o.items_json)) counts[i.name] = (counts[i.name] || 0) + i.qty;
const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
const unpaid = orders.filter(o => o.status === "awaiting_payment");
const tmr = orders.filter(o => o.deliver_on === tomorrow && ["paid", "baking"].includes(o.status))
  .sort((a, b) => String(a.window).localeCompare(String(b.window)));
const lines = [
  "🍰 <b>Honeycrumb today</b> (" + now.toFormat("ccc d LLL") + ")",
  "",
  "Paid orders: <b>" + paidToday.length + "</b> · revenue <b>" + naira(revenue) + "</b>",
  top.length ? "Best sellers: " + top.map(([n, q]) => esc(n) + " ×" + q).join(", ") : "Best sellers: none yet",
  "Waiting for payment: " + unpaid.length,
  "",
  "<b>Tomorrow (" + DateTime.fromISO(tomorrow).toFormat("ccc d LLL") + ")</b>: " + (tmr.length ? tmr.length + " order" + (tmr.length > 1 ? "s" : "") : "nothing scheduled"),
  ...tmr.map(o => "• " + esc(o.window) + " " + esc(o.order_id) + " " + (o.fulfilment === "delivery" ? "🚚 " + esc(o.area) : "🛍️ pickup") + ": " + parseItems(o.items_json).map(i => i.qty + "× " + esc(i.name)).join(", ")),
];
return [{ json: { chat_id: settings.owner_chat_id, text: lines.join("\n") } }];
