// The Monday email and the saved report.
// @include lib-ilf.js
const s = settingsOf($('Read Settings').all());
const f = $('Flag Changes').first().json;
const x = aiJson($input.first().json) || { headline: f.flags.length ? f.flags.length + ' unusual changes last week.' : 'A normal week.', items: [] };
const cell = 'padding:6px 10px;border-bottom:1px solid #eee;text-align:left;font-size:13px';
const worse = g => /cancellation|failed/.test(g.metric) ? g.change_pct > 0 : g.change_pct < 0;
const rows = f.flags.map(g => '<tr><td style="' + cell + '"><b>' + esc(g.branch) + '</b></td><td style="' + cell + '">' + esc(g.metric) + '</td><td style="' + cell + '">' + g.last_week + '</td><td style="' + cell + '">' + g.usual + '</td><td style="' + cell + ';color:' + (worse(g) ? '#c92a2a' : '#2b8a3e') + '"><b>' + (g.change_pct > 0 ? '+' : '') + g.change_pct + '%</b></td></tr>').join('');
const items = x.items.map(i => '<li style="margin:0 0 8px"><b>' + esc(i.branch) + ', ' + esc(i.metric) + ':</b> ' + esc(i.what) + '<br><span style="color:#666">Worth checking: ' + esc(i.check) + '</span></li>').join('');
const link = (s.base_url || 'http://localhost:5678') + '/webhook/ironleaf/chat';
const html = emailHtml(s.company || 'Ironleaf Fitness', [
  'Good morning ' + esc((s.owner_name || '').split(' ')[0]) + '. Here\'s what stood out in the week of ' + esc(f.week_label) + '.',
  '<b>' + esc(x.headline) + '</b>'
], (rows ? '<table style="border-collapse:collapse;margin:0 0 16px"><tr>' + ['Branch', 'Metric', 'Last week', 'Usual', 'Change'].map(h => '<th style="' + cell + ';color:#999;font-size:12px">' + h + '</th>').join('') + '</tr>' + rows + '</table>' : '')
  + (items ? '<ul style="padding-left:18px;margin:0 0 16px;text-align:left">' + items + '</ul>' : '')
  + '<p style="font-size:12px;color:#999;text-align:left">"Usual" is the average of the 8 weeks before. Flagged when at least 2 standard deviations and 15% away from it. <a href="' + esc(link) + '" style="color:#d9480f">Ask the data assistant</a> to dig in.</p>');
return [{ json: {
  email: { to: s.owner_email, subject: 'Week of ' + f.week_label + ': ' + clip(x.headline, 70), html, kind: 'weekly_anomalies', ref: f.week },
  report: { kind: 'weekly_anomalies', period: f.week, summary: x.headline, data_json: JSON.stringify({ flags: f.flags, totals: f.totals, items: x.items }), created_at: nowIso() }
} }];
