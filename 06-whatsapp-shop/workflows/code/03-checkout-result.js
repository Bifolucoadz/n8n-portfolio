// @include lib-shop.js
const v = $("Validate Checkout").first().json;
if (!v.ok) return [{ json: { result: v.result } }];
const o = $("Attach Payment").first().json;
if (!o._ok) return [{ json: { result: "The payment link couldn't be created (" + o._error + "). Apologise and use request_human so the team can help." } }];
const items = parseItems(o.items_json);
return [{
  json: {
    result: "Order " + o.order_id + " is ready for payment. " + items.map(itemLine).join("; ") +
      (o.fulfilment === "delivery" ? "; delivery to " + o.area + " " + naira(o.delivery_fee_ngn) : "; pickup at " + SHOP.PICKUP) +
      ". Total " + naira(o.total_ngn) + ". " + (o.fulfilment === "delivery" ? "Delivery" : "Pickup") + " on " + sayDay(DateTime.fromISO(o.deliver_on, { zone: SHOP.TZ })) + ", " + o.window + "." +
      " A Pay button for this amount is sent automatically under your reply; don't paste the link. The order starts once payment is confirmed.",
  },
}];
