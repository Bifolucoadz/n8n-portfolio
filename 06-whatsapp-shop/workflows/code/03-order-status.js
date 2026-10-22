// @include lib-shop.js
const orders = $input.all().map(i => i.json).filter(o => o.order_id && o.status !== "cart");
const words = { awaiting_payment: "waiting for payment", paid: "paid, queued for baking", baking: "being baked", out_for_delivery: "out for delivery", ready_for_pickup: "ready for pickup", delivered: "delivered", cancelled: "cancelled", expired: "expired (not paid in time)" };
if (!orders.length) return [{ json: { result: "This customer has no placed orders yet." } }];
const lines = orders.slice(0, 3).map(o => o.order_id + ": " + (words[o.status] || o.status) + ", " + naira(o.total_ngn) + ", " +
  (o.fulfilment === "delivery" ? "delivery to " + o.area : "pickup") + " on " + (o.deliver_on ? sayDay(DateTime.fromISO(o.deliver_on, { zone: SHOP.TZ })) : "?") + ", " + o.window + ".");
return [{ json: { result: lines.join("\n") } }];
