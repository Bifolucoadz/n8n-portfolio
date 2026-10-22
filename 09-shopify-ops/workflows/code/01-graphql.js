// The Shopify Admin GraphQL query for a read (live mode).
// @include lib-kettle.js
const r = $('Route').first().json;
const since = DateTime.now().setZone(TZ).minus({ days: Number(r.days || 30) }).toISODate();
const Q = {
  abandoned_checkouts: '{ abandonedCheckouts(first: 100, sortKey: CREATED_AT, reverse: true) { nodes { id name createdAt completedAt abandonedCheckoutUrl subtotalPriceSet { shopMoney { amount } } customer { firstName email numberOfOrders emailMarketingConsent { marketingState } } lineItems(first: 20) { nodes { title quantity variant { sku } originalUnitPriceSet { shopMoney { amount } } } } } } }',
  orders_since: '{ orders(first: 250, query: "created_at:>=' + since + '") { nodes { name email createdAt totalPriceSet { shopMoney { amount } } lineItems(first: 20) { nodes { sku title quantity } } } } }',
  find_order: '{ orders(first: 1, query: "name:' + String(r.order_number || '').replace(/[^0-9#]/g, '') + '") { nodes { name email createdAt displayFulfillmentStatus totalPriceSet { shopMoney { amount } } lineItems(first: 20) { nodes { title quantity } } fulfillments { createdAt displayStatus estimatedDeliveryAt deliveredAt trackingInfo { company number url } } } } }',
  inventory: '{ productVariants(first: 250) { nodes { sku title price inventoryQuantity product { title productType } } } }'
};
return [{ json: { url: 'https://' + r.shop + '/admin/api/' + r.api_version + '/graphql.json', body: { query: Q[r.action] } } }];
