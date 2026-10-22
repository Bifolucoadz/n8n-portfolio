// Which store: the Shopify Admin API in live mode, the Kettle tables in test mode. Reads go to one
// table; the two writes (checkout contacted, review tags) always go to our own tables.
// @include lib-kettle.js
const s = settingsOf($('Read Settings').all());
const i = $('When Called').first().json;
const TABLES = { abandoned_checkouts: 'XluYD3lO9tEeAhBS', find_order: 'KVudLSbZlietFc9a', orders_since: 'KVudLSbZlietFc9a', inventory: 'Ep9njyaWF13y9SHL', reviews_since: 'D2bbJsHicEHPMugS' };
const writes = ['mark_contacted', 'tag_reviews'];
let route = writes.includes(i.action) ? i.action : (s.mode === 'live' && i.action !== 'reviews_since' ? 'live_read' : 'test_read');
return [{ json: { ...i, route, table_id: TABLES[i.action] || '', shop: s.shopify_domain || '', api_version: s.shopify_api_version || '2025-10' } }];
