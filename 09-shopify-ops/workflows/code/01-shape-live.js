// Turns Shopify's answer into the same shapes as test mode. Lead times and minimum orders aren't in
// Shopify, so they come from the Kettle Products table (by SKU) when it has them.
// @include lib-kettle.js
const r = $('Route').first().json;
const d = ($input.first().json || {}).data || {};
let out = {};
if (r.action === 'abandoned_checkouts') out = { checkouts: (d.abandonedCheckouts?.nodes || []).map(c => ({
  checkout_id: c.id, email: c.customer?.email || '', first_name: c.customer?.firstName || '', created_at: c.createdAt, completed: !!c.completedAt,
  accepts_marketing: c.customer?.emailMarketingConsent?.marketingState === 'SUBSCRIBED', orders_count: Number(c.customer?.numberOfOrders || 0),
  subtotal: Number(c.subtotalPriceSet?.shopMoney?.amount || 0), recovery_url: c.abandonedCheckoutUrl,
  items_json: JSON.stringify((c.lineItems?.nodes || []).map(l => ({ sku: l.variant?.sku || '', title: l.title, qty: l.quantity, price: Number(l.originalUnitPriceSet?.shopMoney?.amount || 0) })))
})) };
else if (r.action === 'orders_since') out = { orders: (d.orders?.nodes || []).map(o => ({ order_number: o.name, email: o.email, created_at: o.createdAt, total: Number(o.totalPriceSet?.shopMoney?.amount || 0),
  items_json: JSON.stringify((o.lineItems?.nodes || []).map(l => ({ sku: l.sku, title: l.title, qty: l.quantity }))) })) };
else if (r.action === 'inventory') out = { products: (d.productVariants?.nodes || []).map(v => ({ sku: v.sku, title: v.product?.title + (v.title && v.title !== 'Default Title' ? ' ' + v.title : ''), category: v.product?.productType || '', price: Number(v.price), inventory: Number(v.inventoryQuantity || 0), lead_time_days: 14, min_order_qty: 1, supplier: '' })) };
else if (r.action === 'find_order') {
  const o = (d.orders?.nodes || [])[0];
  const f = (o?.fulfillments || [])[0] || {};
  const ok = o && String(o.email || '').toLowerCase() === String(r.email || '').trim().toLowerCase();
  out = ok ? { found: true, order: { order_number: o.name, email: o.email, created_at: o.createdAt, total: Number(o.totalPriceSet?.shopMoney?.amount || 0),
    items_json: JSON.stringify((o.lineItems?.nodes || []).map(l => ({ title: l.title, qty: l.quantity }))), fulfillment_status: o.displayFulfillmentStatus === 'FULFILLED' ? 'fulfilled' : 'unfulfilled',
    shipped_at: f.createdAt || '', carrier: f.trackingInfo?.[0]?.company || '', tracking_number: f.trackingInfo?.[0]?.number || '', tracking_url: f.trackingInfo?.[0]?.url || '',
    tracking_status: f.deliveredAt ? 'delivered' : f.createdAt ? 'in_transit' : '', estimated_delivery: (f.estimatedDeliveryAt || '').slice(0, 10), last_event: f.displayStatus || '', last_event_at: '', delivered_at: f.deliveredAt || '' } } : { found: false };
}
return [{ json: out }];
