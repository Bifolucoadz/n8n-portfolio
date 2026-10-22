// The week in numbers (code, not AI): reviews and average rating, this week vs the week before,
// complaints per topic, and the complaint quotes behind them.
// @include lib-kettle.js
const reviews = $('Get Reviews').first().json.reviews || [];
const titles = Object.fromEntries(($('Get Products').first().json.products || []).map(p => [p.sku, p.title]));
let fresh = {};
if ($('Tag Reviews').isExecuted) { const x = aiJson($('Tag Reviews').first().json); for (const t of ((x && x.reviews) || [])) fresh[t.review_id] = t; }
const tagged = reviews.map(r => {
  const t = fresh[r.review_id];
  return { ...r, topics: t ? t.topics : parseJson(r.topics_json, []), sentiment: t ? t.sentiment : r.sentiment, issue: t ? t.issue : r.issue };
});
const now = DateTime.now().setZone(TZ);
const weekAgo = now.minus({ days: 7 }).toMillis();
const thisWeek = tagged.filter(r => Date.parse(r.created_at) >= weekAgo);
const lastWeek = tagged.filter(r => Date.parse(r.created_at) < weekAgo);
const avg = a => a.length ? Math.round(10 * a.reduce((t, r) => t + r.rating, 0) / a.length) / 10 : null;
const TOPICS = ['shipping speed', 'packaging damage', 'taste and quality', 'brewing instructions', 'price and value', 'customer service', 'product description', 'gift experience'];
const complaints = (list, topic) => list.filter(r => r.topics.includes(topic) && r.sentiment !== 'positive').length;
const praise = (list, topic) => list.filter(r => r.topics.includes(topic) && r.sentiment === 'positive').length;
const topics = TOPICS.map(t => ({ topic: t, complaints: complaints(thisWeek, t), complaints_before: complaints(lastWeek, t), praise: praise(thisWeek, t) }))
  .filter(t => t.complaints || t.complaints_before || t.praise).sort((a, b) => b.complaints - a.complaints || b.praise - a.praise);
const quotes = thisWeek.filter(r => r.issue).sort((a, b) => a.rating - b.rating).slice(0, 8).map(r => ({ rating: r.rating, product: titles[r.sku] || r.sku, issue: r.issue, quote: r.body.length > 140 ? r.body.slice(0, 137) + '…' : r.body }));
const stats = { period: now.minus({ days: 7 }).toFormat('d LLL') + ' to ' + now.toFormat('d LLL'), reviews: thisWeek.length, reviews_before: lastWeek.length, avg: avg(thisWeek), avg_before: avg(lastWeek),
  negative: thisWeek.filter(r => r.sentiment === 'negative').length, topics, quotes, newly_tagged: Object.keys(fresh).length };
const prompt = 'This week (' + stats.period + '): ' + stats.reviews + ' reviews, average ' + stats.avg + '/5 (week before: ' + stats.reviews_before + ' reviews, ' + stats.avg_before + '/5).\n\n'
  + 'Complaints by topic this week (week before in brackets), and praise this week:\n' + topics.map(t => '- ' + t.topic + ': ' + t.complaints + ' complaints (' + t.complaints_before + '), ' + t.praise + ' praise').join('\n')
  + '\n\nComplaints this week:\n' + quotes.map(q => '- ' + q.rating + '/5, ' + q.product + ': "' + q.quote + '"').join('\n');
return [{ json: { stats, prompt } }];
