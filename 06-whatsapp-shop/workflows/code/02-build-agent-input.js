// @include lib-shop.js
// Everything the agent needs this turn in one prompt: who, when, cart, recent orders, the last
// 12 messages, and the new message (transcribed if it was a voice note).
const t = $("Check Pause").first().json;
let text = t.text;
let voice = false;
if ($("Transcribe Voice Note").isExecuted) {
  const tr = $("Transcribe Voice Note").first().json;
  text = String(tr.text ?? "").trim();
  voice = true;
}
const history = $("Read History").all().map(i => i.json).filter(r => r && r.text).reverse();
const orders = $("Read Orders").all().map(i => i.json).filter(o => o && o.order_id);
const now = DateTime.now().setZone(SHOP.TZ);
const cart = orders.find(o => o.status === "cart" && parseItems(o.items_json).length) || orders.find(o => o.status === "awaiting_payment");
const paidCount = orders.filter(o => ["paid", "baking", "out_for_delivery", "ready_for_pickup", "delivered"].includes(o.status)).length;
const placed = orders.filter(o => !["cart"].includes(o.status)).slice(0, 3);
const slot = (hours, how) => { const s = earliestSlot(hours, how, now); return s ? sayDay(s.date) + " " + s.window : "none in 3 weeks"; };
const lines = [
  "Customer: " + (t.name || "unknown name") + " (WhatsApp +" + t.phone + ")" + (paidCount ? ", returning customer with " + paidCount + " paid order(s)" : ""),
  "Now: " + now.toFormat("cccc d LLLL yyyy, h:mm a") + " in Lagos",
  "Earliest possible right now, delivery / pickup: same-day items " + slot(3, "delivery") + " / " + slot(3, "pickup") +
    "; small chops tray (24h) " + slot(24, "delivery") + " / " + slot(24, "pickup") +
    "; celebration cakes (48h) " + slot(48, "delivery") + " / " + slot(48, "pickup"),
  "Open cart: " + (cart ? cart.order_id + " (" + cart.status + "): " + parseItems(cart.items_json).map(itemLine).join("; ") : "none"),
  "Recent orders: " + (placed.length ? placed.map(o => o.order_id + " " + o.status + " " + naira(o.total_ngn) + " for " + o.deliver_on + " " + o.window).join("; ") : "none"),
  "",
  "Conversation so far (oldest first):",
  ...(history.length ? history.map(h => (h.role === "user" ? "Customer: " : "Honey: ") + String(h.text).slice(0, 600)) : ["(new conversation)"]),
  "",
  "New message from the customer" + (voice ? " (voice note, transcribed)" : "") + ":",
  text || "(empty message)",
];
return [{ json: { ...t, text, voice, prompt: lines.join("\n") } }];
