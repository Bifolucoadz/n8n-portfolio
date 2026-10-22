// Gathers what every page check found and writes the brief for the analyst: each change with the price
// gap to our matching bike (worked out here, not by the AI), plus new products that still need matching.
// @include lib-cs.js
const T = tablesOf($('Load Watchlist').first().json);
const s = settingsOf(T.Settings);
const results = $('Check Each Page').all().map(i => i.json);
const ours = T['Our Products'] || [];
const bySku = Object.fromEntries(ours.map(p => [p.sku, p]));
const matchOf = (competitor, product) => (T.Matches || []).find(m => m.competitor === competitor && normName(m.competitor_product, competitor) === normName(product, competitor) && m.our_sku);
const raw = [];
for (const r of results) for (const c of r.changes || []) raw.push(Object.assign({ ref: 'c' + (raw.length + 1) }, c));
const gapText = (competitor, product, price) => {
  const m = matchOf(competitor, product);
  if (!m || !bySku[m.our_sku] || !price) return '';
  const our = Number(bySku[m.our_sku].price), diff = Number(price) - our;
  return ' | competes with our ' + bySku[m.our_sku].name + ' (' + m.our_sku + ') at ' + gbp(our) + ': theirs is now ' + (diff === 0 ? 'the same price' : gbp(Math.abs(diff)) + ' (' + Math.abs(Math.round(diff / our * 1000) / 10) + '%) ' + (diff < 0 ? 'cheaper' : 'dearer'));
};
const fmt = v => v === '' || v === undefined ? '' : (/^\d+(\.\d+)?$/.test(String(v)) ? gbp(v) : String(v));
const lines = raw.map(c => {
  if (c.kind === 'content') return c.ref + ' | ' + c.competitor + ' | ' + c.item + ' | content | added: ' + JSON.stringify(c.after.split('\n')) + ' | removed: ' + JSON.stringify(c.before.split('\n').filter(Boolean));
  const price = c.kind === 'removed_product' ? '' : c.after;
  return c.ref + ' | ' + c.competitor + ' | ' + c.item + ' | ' + c.kind + ' | ' + fmt(c.before) + (c.before !== '' && c.after !== '' ? ' → ' : '') + fmt(c.after) + (c.delta_pct ? ' (' + (c.delta_pct > 0 ? '+' : '') + c.delta_pct + '%)' : '') + (c.detail ? ' | ' + c.detail : '') + (/price|new_product|stock/.test(c.kind) ? gapText(c.competitor, c.item, price) : '');
});
// Competitor products nobody has matched to one of ours yet
const unmatched = [];
for (const r of results) for (const p of r.items || []) if (!(T.Matches || []).some(m => m.competitor === r.competitor && normName(m.competitor_product, r.competitor) === normName(p.name, r.competitor))) unmatched.push(r.competitor + ' | ' + p.name + ' | ' + gbp(p.price));
const prompt = 'We are ' + (s.company || 'Cobble & Spoke') + ', ' + (s.company_about || 'an online e-bike shop') + '.\nOur bikes (sku | name | type | price | battery | range):\n'
  + ours.map(p => [p.sku, p.name, p.category, gbp(p.price), p.battery_wh + ' Wh', p.range_km + ' km'].join(' | ')).join('\n')
  + '\n\nChanges found on competitor sites (ref | competitor | item | kind | before → after | notes | gap to our bike):\n' + (lines.join('\n') || '(none)')
  + '\n\nProducts to match:\n' + (unmatched.join('\n') || '(none)');
return [{ json: { raw, prompt, needs_ai: raw.length > 0 || unmatched.length > 0, unmatched: unmatched.length } }];
