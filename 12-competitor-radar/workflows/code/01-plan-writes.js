// Turns the run into rows for the sheet: changes (AI notes plus rules worked out in code), new product
// matches, price history, the page states, the run log, and one alert email for anything important.
// @include lib-cs.js
const T = tablesOf($('Load Watchlist').first().json);
const s = settingsOf(T.Settings);
const first = $('Plan Run').first().json;
const results = $('Check Each Page').all().map(i => i.json);
const col = $('Collect Results').first().json;
const ai = $('Analyse Changes (GPT-5.4)').isExecuted ? aiJson($('Analyse Changes (GPT-5.4)').first().json) : null;
const plan = emptyPlan(s);
const at = first.as_of || nowIso();
const threshold = Number(s.alert_threshold) || 4, undercut = Number(s.undercut_pct) || 3, bigDrop = Number(s.big_drop_pct) || 15;
const ours = Object.fromEntries((T['Our Products'] || []).map(p => [p.sku, p]));
const matches = (T.Matches || []).slice();
for (const m of (ai && ai.matches) || []) {
  if (!m.our_sku || !ours[m.our_sku] || m.confidence === 'low') continue;
  if (matches.some(x => x.competitor === m.competitor && normName(x.competitor_product, m.competitor) === normName(m.competitor_product, m.competitor))) continue;
  const row = { competitor: m.competitor, competitor_product: m.competitor_product, our_sku: m.our_sku, confidence: m.confidence, matched_by: 'ai', matched_at: at };
  matches.push(row); plan.appends.Matches.push(row);
}
const matchOf = (competitor, product) => matches.find(m => m.competitor === competitor && normName(m.competitor_product, competitor) === normName(product, competitor) && m.our_sku);
const notes = Object.fromEntries(((ai && ai.changes) || []).map(c => [c.ref, c]));
const alerts = [];
for (const c of col.raw) {
  const n = notes[c.ref] || {};
  const m = /price|new_product|stock|removed/.test(c.kind) ? matchOf(c.competitor, c.item) : null;
  const our = m && ours[m.our_sku] ? Number(ours[m.our_sku].price) : null;
  let kind = c.kind === 'content' ? (n.kind || 'other') : c.kind;
  let sig = Math.min(5, Math.max(1, Math.round(Number(n.significance) || 2)));
  const price = Number(c.after) || 0;
  // Rules that don't depend on the AI's judgement
  if (our && price && /price_drop|new_product/.test(kind) && price <= our * (1 - undercut / 100)) sig = Math.max(sig, 4);
  if (kind === 'price_drop' && Math.abs(Number(c.delta_pct) || 0) >= bigDrop) sig = Math.max(sig, 4);
  if (kind === 'layout_warning' || kind === 'fetch_failed') sig = 3;
  const fallback = c.competitor + ': ' + (KIND_LABEL[kind] || kind).toLowerCase() + ' on ' + c.item;
  const row = {
    change_id: newId('CH-', 8), detected_at: at, run_id: first.run_id, competitor: c.competitor, page_id: c.page_id, page_type: c.page_type, kind, item: c.item,
    before: c.before, after: c.after, delta_pct: c.delta_pct || '', our_sku: m ? m.our_sku : '', our_price: our || '', significance: sig,
    headline: n.headline || fallback, why_it_matters: n.why_it_matters || c.detail || '', suggested_action: n.suggested_action || '', alerted: sig >= threshold ? 'yes' : 'no', status: 'new'
  };
  plan.appends.Changes.push(row);
  if (sig >= threshold) alerts.push(row);
}
for (const r of results) {
  if (r.page_type === 'products' && (r.status === 'baseline' || r.status === 'changed')) for (const p of r.items || []) {
    const m = matchOf(r.competitor, p.name);
    plan.appends.Prices.push({ checked_at: at, competitor: r.competitor, product: p.name, price: p.price, was_price: p.was_price || '', in_stock: p.in_stock ? 'yes' : 'no', page_id: r.page_id, our_sku: m ? m.our_sku : '' });
  }
  if (r.state) plan.updates.Watchlist.push(r.state);
}
const count = st => results.filter(r => r.status === st).length;
const aiCalls = results.filter(r => r.ai_used).length + (ai ? 1 : 0);
plan.appends.Runs.push({ run_id: first.run_id, started_at: first.as_of || isoOf(DateTime.fromMillis(first.started_ms).setZone(TZ)), finished_at: first.as_of ? isoOf(toDt(first.as_of).plus({ milliseconds: Date.now() - first.started_ms })) : nowIso(), trigger: first.trigger,
  pages: results.length, unchanged: count('unchanged'), changed: count('changed') + count('baseline'), failed: count('failed') + count('warning'), changes: col.raw.length, alerts: alerts.length, ai_calls: aiCalls, ms: Date.now() - first.started_ms });
if (alerts.length) {
  alerts.sort((a, b) => b.significance - a.significance);
  const card = a => '<div style="border-left:4px solid ' + (a.significance >= 5 ? '#d1382a' : '#e4572e') + ';padding:4px 0 4px 14px;margin:0 0 18px;text-align:left">'
    + '<div style="font-weight:700;font-size:16px">' + esc(a.headline) + '</div>'
    + (a.why_it_matters ? '<div style="color:#475467;margin-top:4px">' + esc(a.why_it_matters) + '</div>' : '')
    + (a.suggested_action ? '<div style="margin-top:6px"><b>Next step:</b> ' + esc(a.suggested_action) + '</div>' : '') + '</div>';
  plan.emails.push(emailItem(s.alert_email, 'Competitor alert: ' + alerts[0].headline + (alerts.length > 1 ? ' (+' + (alerts.length - 1) + ' more)' : ''),
    emailHtml(s, ['The radar checked ' + results.length + ' competitor pages and found ' + alerts.length + ' change' + (alerts.length > 1 ? 's' : '') + ' worth your attention:'], alerts.map(card).join('') + button(dashboardUrl(s), 'Open the radar')), 'alert', [dashboardUrl(s)]));
}
plan.result = { ok: true, run_id: first.run_id, as_of: at, pages: results.length, unchanged: count('unchanged'), changed: count('changed'), baseline: count('baseline'), failed: count('failed'), warnings: count('warning'), changes: col.raw.length, alerts: alerts.length, new_matches: plan.appends.Matches.length, ai_calls: aiCalls, seconds: Math.round((Date.now() - first.started_ms) / 100) / 10,
  headlines: plan.appends.Changes.map(c => c.significance + ' ' + c.headline) };
return [{ json: { plan } }];
