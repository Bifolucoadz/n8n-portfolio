// ---- lib-dash.js: everything the owner dashboard shows, from the sheet tabs ----
function dashData(T, s) {
  const book = {};
  for (const r of T['Price Book'] || []) if (r.code && (r.active === '' || truthy(r.active))) book[String(r.code).toUpperCase()] = { code: String(r.code).toUpperCase(), category: r.category, item: r.item, unit: r.unit, unit_price: Number(r.unit_price) || 0, labour_days: Number(r.labour_days) || 0, min_qty: Number(r.min_qty) || 0 };
  const events = {};
  for (const e of (T.Events || []).slice().sort((a, b) => String(a.at) < String(b.at) ? -1 : 1)) (events[e.quote_id] = events[e.quote_id] || []).push({ at: e.at, event: e.event, detail: e.detail, actor: e.actor });
  const quotes = (T.Quotes || []).map(quoteOf).map(q => {
    const o = Object.assign({}, q);
    for (const k of Object.keys(o)) if (/_json$/.test(k) || k === '_row') delete o[k];
    if (o.sign_meta) o.sign_meta = { fingerprint: o.sign_meta.fingerprint, signed_at: o.sign_meta.signed_at };
    if (isExpired(q)) o.status = 'expired';
    return o;
  });
  return {
    key: s.dashboard_key, now: nowIso(), today: nowDt().toISODate(), formUrl: '../../form/mossgrove-site-visit',
    settings: { company: s.company, mode: s.mode === 'live' ? 'live' : 'test', vat_rate: Number(s.vat_rate === '' ? 0.2 : s.vat_rate), deposit_pct: Number(s.deposit_pct) || 25, payment_days: Number(s.payment_days) || 7, owner_name: s.owner_name, crews: String(s.crews || 'Crew A').split(',').map(c => c.trim()).filter(Boolean) },
    book, quotes, events,
    schedule: (T.Schedule || []).filter(e => e.start && e.end).map(e => ({ entry_id: e.entry_id, quote_id: e.quote_id, title: e.title, start: String(e.start).slice(0, 10), end: String(e.end).slice(0, 10), crew: e.crew, kind: e.kind }))
  };
}
// ---- end lib-dash.js ----
