// Reviews not tagged yet, as one prompt (ids, product, rating, text).
// @include lib-kettle.js
const reviews = $('Get Reviews').first().json.reviews || [];
const titles = Object.fromEntries(($('Get Products').first().json.products || []).map(p => [p.sku, p.title]));
const todo = reviews.filter(r => !r.analysed_at);
const prompt = todo.map(r => 'review_id: ' + r.review_id + '\nproduct: ' + (titles[r.sku] || r.sku) + '\nrating: ' + r.rating + '/5\ntitle: ' + r.title + '\ntext: ' + r.body).join('\n\n');
return [{ json: { count: todo.length, prompt } }];
