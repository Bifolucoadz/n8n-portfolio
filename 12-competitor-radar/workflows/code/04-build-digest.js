// Monday's digest: what changed this week by importance, where we stand on price against the cheapest
// matching rival bike, and any pages the radar couldn't read.
// @include lib-cs.js
const T = tablesOf($('Load All').first().json);
const s = settingsOf(T.Settings);
const now = nowDt();
const week = (T.Changes || []).filter(c => now.diff(toDt(c.detected_at), 'days').days <= 7.5).map(c => Object.assign({}, c, { significance: Number(c.significance) || 1 }));
const alerts = week.filter(c => c.significance >= (Number(s.alert_threshold) || 4));
const top = week.filter(c => c.significance >= 3).sort((a, b) => b.significance - a.significance).slice(0, 8);
const latest = currentPrices(T.Prices);
const rows = (T['Our Products'] || []).map(o => {
  const rivals = (T.Matches || []).filter(m => m.our_sku === o.sku).map(m => latest[m.competitor + '|' + m.competitor_product]).filter(Boolean).filter(p => p.in_stock !== 'no');
  const cheapest = rivals.sort((a, b) => Number(a.price) - Number(b.price))[0];
  return { o, cheapest, gap: cheapest ? Number(cheapest.price) - Number(o.price) : null };
});
const under = rows.filter(r => r.gap !== null && r.gap < 0);
const issues = (T.Watchlist || []).filter(w => /fail|warn/.test(String(w.last_status)));
const colour = n => n >= 5 ? '#d1382a' : (n >= 4 ? '#e4572e' : '#b7791f');
const td = 'padding:7px 10px;border-bottom:1px solid #eceef3;text-align:left;font-size:14px';
const h = t => '<p style="margin:24px 0 8px;font-weight:700;font-size:16px;text-align:left">' + t + '</p>';
let html = h('The week in ' + top.length + ' changes') + (top.length ? top.map(c => '<div style="border-left:4px solid ' + colour(c.significance) + ';padding:2px 0 2px 12px;margin:0 0 14px;text-align:left"><div style="font-weight:700">' + esc(c.headline) + '</div><div style="color:#475467;font-size:14px">' + esc(c.why_it_matters) + '</div>' + (c.suggested_action && !/^no action/i.test(c.suggested_action) ? '<div style="font-size:14px;margin-top:3px"><b>Next step:</b> ' + esc(c.suggested_action) + '</div>' : '') + '</div>').join('') : '<p style="color:#7a8496;text-align:left">A quiet week: nothing important changed.</p>');
html += h('Where we stand on price') + '<table style="border-collapse:collapse;width:100%"><tr><th style="' + td + ';color:#7a8496;font-size:12px">Our bike</th><th style="' + td + ';color:#7a8496;font-size:12px">Ours</th><th style="' + td + ';color:#7a8496;font-size:12px">Cheapest rival in stock</th><th style="' + td + ';color:#7a8496;font-size:12px">Gap</th></tr>'
  + rows.map(r => '<tr><td style="' + td + '">' + esc(r.o.name) + '</td><td style="' + td + '">' + gbp(r.o.price) + '</td><td style="' + td + '">' + (r.cheapest ? esc(r.cheapest.competitor + ' ' + r.cheapest.product) + ' ' + gbp(r.cheapest.price) : '–') + '</td><td style="' + td + ';font-weight:700;color:' + (r.gap === null ? '#7a8496' : (r.gap < 0 ? '#d1382a' : '#2f7d4f')) + '">' + (r.gap === null ? '' : (r.gap < 0 ? '−' : '+') + gbp(Math.abs(r.gap))) + '</td></tr>').join('') + '</table>';
if (issues.length) html += h('Pages to look at') + '<ul style="padding-left:20px;margin:0;text-align:left">' + issues.map(w => '<li>' + esc(w.competitor) + ' ' + esc(w.page_type) + ': ' + esc(w.last_status) + '</li>').join('') + '</ul>';
html += button(dashboardUrl(s), 'Open the radar');
const intro = 'This week the radar found <b>' + week.length + ' changes</b> across ' + new Set(week.map(c => c.competitor)).size + ' competitors' + (alerts.length ? ', ' + alerts.length + ' of them important enough to alert you at the time' : '') + '. A rival is cheaper than us on <b>' + under.length + ' of our ' + rows.length + ' bikes</b>.';
const plan = emptyPlan(s);
plan.emails.push(emailItem(s.alert_email, 'Competitor digest, week of ' + now.startOf('week').toFormat('d LLLL') + ': ' + week.length + ' changes, ' + alerts.length + ' alerts', emailHtml(s, ['Good morning,', intro], html), 'digest', [dashboardUrl(s)]));
plan.result = { ok: true, changes: week.length, alerts: alerts.length, undercut: under.length };
return [{ json: { plan } }];
