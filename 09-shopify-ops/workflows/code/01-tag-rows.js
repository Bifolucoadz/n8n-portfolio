// One item per review with the AI's tags.
// @include lib-kettle.js
const r = $('Route').first().json;
const at = nowIso();
return parseJson(r.tags_json, []).map(t => ({ json: { review_id: t.review_id, topics_json: JSON.stringify(t.topics || []), sentiment: t.sentiment || '', issue: t.issue || '', analysed_at: at } }));
