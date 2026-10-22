// The owner's email and the saved report.
// @include lib-kettle.js
const s = settingsOf($('Read Settings').all());
const { stats } = $('Week in Numbers').first().json;
const x = aiJson($input.first().json) || { headline: '', fixes: [] };
const cell = 'padding:6px 10px;border-bottom:1px solid #ebe6dc;text-align:left;font-family:Helvetica,Arial,sans-serif;font-size:14px';
const arrow = (a, b) => a > b ? '<span style="color:#b42318">▲ ' + (a - b) + '</span>' : a < b ? '<span style="color:#067647">▼ ' + (b - a) + '</span>' : '<span style="color:#8a857a">same</span>';
const rows = stats.topics.map(t => '<tr><td style="' + cell + '">' + esc(t.topic) + '</td><td style="' + cell + '">' + t.complaints + ' ' + arrow(t.complaints, t.complaints_before) + '</td><td style="' + cell + '">' + t.praise + '</td></tr>').join('');
const fixes = x.fixes.map((f, i) => '<div style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:14px;text-align:left"><b>' + (i + 1) + '. ' + esc(f.title) + '</b><br><span style="color:#6b665c">' + esc(f.why) + '</span><br>' + esc(f.action) + '</div>').join('');
const quotes = stats.quotes.slice(0, 4).map(q => '<li style="margin:4px 0">' + q.rating + '★ ' + esc(q.product) + ': <i>“' + esc(q.quote) + '”</i></li>').join('');
const html = emailHtml(s.store_name || 'Kettle & Fern', [
  'Good morning ' + esc((s.owner_name || '').split(' ')[0]) + '. Here\'s what customers said this week (' + esc(stats.period) + ').',
  '<b>' + esc(x.headline) + '</b>',
  stats.reviews + ' reviews, average <b>' + stats.avg + '/5</b> (week before: ' + stats.reviews_before + ' reviews, ' + stats.avg_before + '/5).'
], '<table style="border-collapse:collapse;margin:0 0 18px"><tr><th style="' + cell + ';color:#8a857a;font-size:12px">Topic</th><th style="' + cell + ';color:#8a857a;font-size:12px">Complaints (vs last week)</th><th style="' + cell + ';color:#8a857a;font-size:12px">Praise</th></tr>' + rows + '</table>'
  + '<p style="font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;text-align:left">Three things to fix</p>' + fixes
  + (quotes ? '<p style="font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;text-align:left">In their words</p><ul style="font-family:Helvetica,Arial,sans-serif;font-size:13px;padding-left:18px;text-align:left">' + quotes + '</ul>' : ''));
return [{ json: {
  email: { to: s.owner_email, subject: 'Reviews this week: ' + clip(x.headline, 80), html, kind: 'review_report', ref: stats.period },
  report: { kind: 'reviews', period: stats.period, summary: x.headline, data_json: JSON.stringify({ stats, fixes: x.fixes }), created_at: nowIso() }
} }];
