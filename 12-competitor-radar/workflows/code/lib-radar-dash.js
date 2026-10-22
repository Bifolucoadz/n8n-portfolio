// ---- lib-radar-dash.js: everything the radar dashboard shows ----
function radarData(T, s) {
  const num = v => v === '' || v === null || v === undefined || isNaN(Number(v)) ? v : Number(v);
  const watch = (T.Watchlist || []).map(w => { const o = Object.assign({}, w); delete o.last_items_json; delete o.last_text; delete o._row; o.fail_count = Number(o.fail_count) || 0; return o; });
  const competitors = [...new Set(watch.map(w => w.competitor))];
  return {
    key: s.dashboard_key, now: nowIso(),
    settings: { company: s.company || 'Cobble & Spoke', mode: s.mode === 'live' ? 'live' : 'test', alert_threshold: Number(s.alert_threshold) || 4 },
    competitors,
    ours: (T['Our Products'] || []).map(p => ({ sku: p.sku, name: p.name, category: p.category, price: Number(p.price) })),
    matches: (T.Matches || []).filter(m => m.our_sku).map(m => ({ competitor: m.competitor, competitor_product: m.competitor_product, our_sku: m.our_sku, confidence: m.confidence, matched_by: m.matched_by })),
    prices: (() => { const cur = currentPrices(T.Prices); return (T.Prices || []).map(p => ({ checked_at: String(p.checked_at), competitor: p.competitor, product: p.product, price: Number(p.price), in_stock: p.in_stock, current: cur[p.competitor + '|' + p.product] === p })); })(),
    changes: (T.Changes || []).map(c => ({ change_id: c.change_id, detected_at: String(c.detected_at), competitor: c.competitor, page_type: c.page_type, kind: c.kind, item: c.item, before: num(c.before), after: num(c.after), delta_pct: num(c.delta_pct), our_sku: c.our_sku, our_price: num(c.our_price), significance: Number(c.significance) || 1, headline: c.headline, why_it_matters: c.why_it_matters, suggested_action: c.suggested_action, status: c.status })),
    runs: (T.Runs || []).slice().sort((a, b) => String(a.started_at) < String(b.started_at) ? 1 : -1).slice(0, 30).map(r => ({ run_id: r.run_id, started_at: String(r.started_at), pages: Number(r.pages), changes: Number(r.changes), alerts: Number(r.alerts), ai_calls: Number(r.ai_calls), ms: Number(r.ms) })),
    watchlist: watch
  };
}
// ---- end lib-radar-dash.js ----
