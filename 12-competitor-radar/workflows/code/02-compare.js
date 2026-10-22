// Compares this check with the last one and lists what changed. Guards against false alarms: if a
// product page suddenly has no products (a bot check, an error page, a redesign the reader can't follow),
// it reports "check this page" instead of "every product was removed", and keeps the last good data.
// @include lib-cs.js
const input = $('When Called').first().json;
const page = input.page;
const read = $('Read Page').first().json;
const hash = $('Fingerprint').first().json.hash;
const at = input.as_of || nowIso();
const base = { page_id: page.page_id, competitor: page.competitor, page_type: page.page_type };
const changes = [];
let items = [], method = read.method, warning = '';

if (page.page_type === 'products') {
  if (read.method === 'json-ld') items = read.products;
  else {
    const ai = aiJson($('Read Products (AI)').first().json);
    if (!ai) warning = 'The AI could not read the products on this page.';
    else if (!ai.is_product_listing) warning = 'This page no longer looks like a product list (' + String(ai.page_looks_like || 'unknown').slice(0, 80) + ').';
    else items = (ai.products || []).filter(p => p.name && Number(p.price) > 0).map(p => ({ name: String(p.name).trim(), price: Number(p.price), was_price: p.was_price ? Number(p.was_price) : null, in_stock: p.in_stock !== false }));
  }
  const prev = parseJson(page.last_items_json, []);
  const now = new Map(items.map(p => [normName(p.name, page.competitor), p]));
  const before = new Map(prev.map(p => [normName(p.name, page.competitor), p]));
  if (!warning && prev.length >= 3 && items.length < prev.length * 0.4) warning = 'Only ' + items.length + ' of the ' + prev.length + ' products were found. The page layout may have changed.';
  if (warning) {
    changes.push(Object.assign({ kind: 'layout_warning', item: page.page_type + ' page', before: prev.length + ' products', after: items.length + ' products', detail: warning }, base));
    items = prev;
  } else if (prev.length) {
    for (const [k, p] of now) {
      const o = before.get(k);
      if (!o) { changes.push(Object.assign({ kind: 'new_product', item: p.name, before: '', after: p.price, detail: p.in_stock ? '' : 'out of stock' }, base)); continue; }
      if (Math.abs(p.price - o.price) >= 0.5) changes.push(Object.assign({ kind: p.price < o.price ? 'price_drop' : 'price_rise', item: p.name, before: o.price, after: p.price, delta_pct: Math.round((p.price - o.price) / o.price * 1000) / 10, detail: p.was_price ? 'shown as reduced from ' + gbp(p.was_price) : '' }, base));
      if (o.in_stock !== p.in_stock) changes.push(Object.assign({ kind: p.in_stock ? 'back_in_stock' : 'out_of_stock', item: p.name, before: o.in_stock ? 'in stock' : 'out of stock', after: p.in_stock ? 'in stock' : 'out of stock', detail: '' }, base));
    }
    for (const [k, o] of before) if (!now.has(k)) changes.push(Object.assign({ kind: 'removed_product', item: o.name, before: o.price, after: '', detail: '' }, base));
  }
} else {
  const prev = String(page.last_text || '').split('\n').filter(Boolean);
  if (prev.length) {
    const was = new Set(prev), is = new Set(read.lines);
    const added = read.lines.filter(l => !was.has(l)), removed = prev.filter(l => !is.has(l));
    if (added.length || removed.length) changes.push(Object.assign({ kind: 'content', item: page.page_type + ' page', before: removed.slice(0, 15).join('\n'), after: added.slice(0, 15).join('\n'), detail: added.length + ' lines added, ' + removed.length + ' removed' }, base));
  }
}
const first = !page.last_hash;
return [{ json: Object.assign({}, base, {
  status: first ? 'baseline' : (warning ? 'warning' : (changes.length ? 'changed' : 'unchanged')), method, at,
  items, changes, ai_used: method === 'ai',
  state: { page_id: page.page_id, last_checked: at, last_status: first ? 'baseline' : (warning ? 'warning' : 'changed'), last_hash: warning ? page.last_hash : hash, last_method: method, fail_count: 0,
    last_items_json: page.page_type === 'products' ? JSON.stringify(items) : '', last_text: page.page_type === 'products' ? '' : read.text.slice(0, 20000) }
}) }];
