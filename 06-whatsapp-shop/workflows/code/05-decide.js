// @include lib-shop.js
// Verified transaction + our order -> paid, duplicate, or mismatch.
const ref = $("Check Event").first().json.reference;
const v = $("Verify Payment").first().json;
const order = $input.all().map(i => i.json).find(o => o && o.order_id);
const tx = v?.data ?? {};
const now = DateTime.now().setZone(SHOP.TZ);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
if (!order) return [{ json: { action: "alert", text: "⚠️ Paystack payment " + esc(ref) + " (" + naira((tx.amount || 0) / 100) + ") doesn't match any open order. Check the Paystack dashboard." } }];
if (order.status !== "awaiting_payment") return [{ json: { action: "ignore", reason: "order already " + order.status } }];
const okTx = v?.status === true && tx.status === "success" && tx.currency === "NGN" && Number(tx.amount) === Math.round(Number(order.total_ngn) * 100);
if (!okTx) return [{ json: { action: "alert", text: "⚠️ Payment for " + esc(order.order_id) + " didn't verify: Paystack says " + esc(tx.status) + ", " + naira((tx.amount || 0) / 100) + " vs order total " + naira(order.total_ngn) + ". Not marked paid." } }];
const items = parseItems(order.items_json);
const when = sayDay(DateTime.fromISO(order.deliver_on, { zone: SHOP.TZ })) + ", " + order.window;
return [{
  json: {
    action: "paid",
    order: { ...order, status: "paid", paid_at: now.toISO(), updated_at: now.toISO() },
    customer_text: "Payment received, thank you " + (order.customer_name.split(" ")[0] || "") + "! 🎉\n\n" +
      "*Order " + order.order_id + "* is confirmed:\n" + items.map(i => "• " + i.qty + " × " + i.name + (i.cake_message ? ' ("' + i.cake_message + '")' : "")).join("\n") +
      "\n\n" + (order.fulfilment === "delivery" ? "🚚 Delivery " + when + " to " + order.address : "🛍️ Pickup " + when + " at " + SHOP.PICKUP) +
      "\nTotal paid: " + naira(order.total_ngn) + "\n\nWe'll message you here when it's on its way.",
    owner_text: "🧁 <b>New paid order " + esc(order.order_id) + "</b> · " + naira(order.total_ngn) + "\n" +
      esc(order.customer_name) + ", +" + esc(order.phone) + "\n" + items.map(i => "• " + i.qty + " × " + esc(i.name) + (i.cake_message ? ' ("' + esc(i.cake_message) + '")' : "")).join("\n") +
      "\n" + (order.fulfilment === "delivery" ? "🚚 " + esc(when) + ", " + esc(order.area) + ": " + esc(order.address) : "🛍️ Pickup " + esc(when)) + (order.note ? "\n📝 " + esc(order.note) : ""),
    board_row: {
      order_id: order.order_id, status: "paid", deliver_on: order.deliver_on, window: order.window,
      fulfilment: order.fulfilment, area: order.area, address: order.address, customer: order.customer_name, phone: "+" + order.phone,
      items: items.map(i => i.qty + " × " + i.name + (i.cake_message ? ' ("' + i.cake_message + '")' : "")).join("; "),
      total_ngn: String(order.total_ngn), note: order.note, paid_at: now.toFormat("yyyy-MM-dd HH:mm"),
    },
  },
}];
