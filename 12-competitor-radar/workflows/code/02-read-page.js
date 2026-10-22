// Cleans the fetched page: pulls any JSON-LD product data, turns the rest into lines of readable text
// (dropping lines that change on every visit, like cookie banners), and builds the text to fingerprint.
// @include lib-cs.js
const input = $('When Called').first().json;
const page = input.page;
const res = $input.first().json;
const status = Number(res.statusCode || 0);
const body = typeof res.body === 'string' ? res.body : (typeof res.data === 'string' ? res.data : '');
const ignore = String(input.ignore_lines || '').split('|').map(s => s.trim()).filter(Boolean);
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&#8217;/g, '\'').replace(/&pound;/g, '£').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)));

// JSON-LD products, wherever they sit (ItemList, @graph, arrays)
const products = [];
const seen = new Set();
function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach(walk); return; }
  const type = [].concat(o['@type'] || []).join(',');
  if (/Product/.test(type) && o.name) {
    const offer = [].concat(o.offers || [])[0] || {};
    const price = Number(offer.price || offer.lowPrice || 0);
    const key = String(o.name).toLowerCase();
    if (price && !seen.has(key)) { seen.add(key); products.push({ name: String(o.name).trim(), price, was_price: null, in_stock: !/OutOfStock|SoldOut/i.test(String(offer.availability || '')) }); }
  }
  for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
}
for (const m of body.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(m[1])); } catch (e) { /* bad JSON-LD is ignored */ } }

const text = decode(body
  .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer|\/a)\b[^>]*>/gi, '\n')
  .replace(/<\/t[dh]>/gi, ' | ')
  .replace(/<[^>]+>/g, ' '))
  .split('\n').map(l => l.replace(/\s+/g, ' ').replace(/^\|\s*|\s*\|\s*$/g, '').trim())
  .filter(l => l.length > 1 && !ignore.some(p => l.toLowerCase().indexOf(p.toLowerCase()) >= 0));
const lines = [...new Set(text)].slice(0, 400);
const ok = status >= 200 && status < 300 && lines.length > 0;
const method = page.page_type === 'products' ? (products.length ? 'json-ld' : 'ai') : 'text';
const sorted = products.slice().sort((a, b) => a.name < b.name ? -1 : 1);
return [{ json: {
  ok, http_status: status, error: ok ? '' : (res.error ? String(res.error.message || res.error) : 'HTTP ' + status),
  method, products: sorted, lines, text: lines.join('\n').slice(0, 20000),
  hash_input: ok ? (method === 'json-ld' ? JSON.stringify(sorted) : lines.join('\n')) : ''
} }];
