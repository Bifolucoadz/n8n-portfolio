// @include lib-shop.js
// add / set / remove / clear / view on the customer's open cart. Prices come from the menu.
const c = $("Config").first().json;
const products = $("Read Products (Cart)").all().map(i => i.json).filter(p => p.sku);
const orders = $input.all().map(i => i.json).filter(o => o.order_id);
const now = DateTime.now().setZone(SHOP.TZ);
const reply = (result, extra = {}) => [{ json: { write: false, result, ...extra } }];
const order = orders.find(o => o.status === "cart") || orders.find(o => o.status === "awaiting_payment");
let items = order ? parseItems(order.items_json) : [];
const notes = [];
const op = ["add", "set", "remove", "clear", "view"].includes(c.op) ? c.op : "view";

if (op === "add" || op === "set" || op === "remove") {
  const p = findProduct(products, c.sku);
  if (!p) return reply('No single menu item matches "' + c.sku + '". Call search_menu and use the exact SKU.');
  if (op !== "remove" && !p.available) return reply(p.name + " is sold out today. Suggest something similar from search_menu.");
  const qty = Math.max(0, Math.min(SHOP.MAX_QTY, Math.round(Number.isFinite(c.qty) ? c.qty : 1)));
  let msg = p.category === "cakes" ? c.cake_message : "";
  if (c.cake_message && p.category !== "cakes") notes.push("Messages can only go on cakes, so none was added.");
  if (msg.length > SHOP.CAKE_MESSAGE_MAX) { msg = msg.slice(0, SHOP.CAKE_MESSAGE_MAX); notes.push('Cake message shortened to 30 characters: "' + msg + '".'); }
  const idx = items.findIndex(i => i.sku === p.sku && (op === "remove" || (i.cake_message || "") === msg));
  const fresh = q => ({ sku: p.sku, name: p.name, qty: q, unit_ngn: p.price_ngn, lead_hours: p.lead_hours, cake_message: msg });
  if (op === "add") {
    if (idx >= 0) items[idx].qty = Math.min(SHOP.MAX_QTY, items[idx].qty + (qty || 1));
    else items.push(fresh(qty || 1));
  } else if (op === "set") {
    if (idx >= 0) { if (qty === 0) items.splice(idx, 1); else items[idx].qty = qty; }
    else if (qty > 0) items.push(fresh(qty));
  } else {
    if (idx < 0) return reply(p.name + " isn't in the cart.");
    items.splice(idx, 1);
  }
} else if (op === "clear") {
  items = [];
}

const sub = subtotalOf(items);
const fee = Number(order?.delivery_fee_ngn) || 0;
const summary = items.length
  ? "Cart " + (order?.order_id ?? "(new)") + ":\n" + items.map(itemLine).join("\n") + "\nSubtotal: " + naira(sub) + (fee ? "\nDelivery: " + naira(fee) + "\nTotal: " + naira(sub + fee) : "")
  : "The cart is empty.";
if (op === "view") return reply(summary);

const reverted = order?.status === "awaiting_payment";
const row = {
  order_id: order?.order_id ?? newId("HC-"),
  phone: c.phone,
  customer_name: order?.customer_name || c.customer_name,
  status: "cart",
  items_json: JSON.stringify(items),
  subtotal_ngn: sub,
  delivery_fee_ngn: fee,
  total_ngn: sub + fee,
  fulfilment: order?.fulfilment ?? "",
  area: order?.area ?? "",
  address: order?.address ?? "",
  deliver_on: order?.deliver_on ?? "",
  window: order?.window ?? "",
  note: order?.note ?? "",
  email: order?.email ?? "",
  paystack_ref: "",
  pay_url: "",
  turn_id: c.turn_id,
  reminder_sent: false,
  created_at: order?.created_at || now.toISO(),
  paid_at: "",
  updated_at: now.toISO(),
};
const result = summary.replace("Cart (new)", "Cart " + row.order_id) +
  (notes.length ? "\n" + notes.join(" ") : "") +
  (reverted ? "\nThe cart changed after checkout, so the earlier payment link no longer applies. Checkout again for a new link." : "");
return [{ json: { write: true, result, row } }];
