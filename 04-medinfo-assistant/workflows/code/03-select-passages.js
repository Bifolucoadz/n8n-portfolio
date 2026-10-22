// Keep the passages the reranker scored 2 or 3, best 6, most relevant first. If the reranker
// failed, fall back to the top 6 from the hybrid search.
const q = $('Prepare Query').first().json;
const results = $('Hybrid Search').first().json.results ?? [];
const scores = {};
for (const o of $input.first().json.output ?? []) {
  for (const c of o.content ?? []) {
    let d = c.text;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
    for (const s of d?.scores ?? []) scores[s.id] = Number(s.score);
  }
}
const reranked = Object.keys(scores).length > 0;
const kept = results
  .map((r, i) => ({ r, score: reranked ? (scores[r.id] ?? 0) : (i < 6 ? 2 : 0), rank: i }))
  .filter(x => x.score >= 2)
  .sort((a, b) => b.score - a.score || a.rank - b.rank)
  .slice(0, 6)
  .map(({ r, score }) => ({
    id: r.id, relevance: score, doc_code: r.doc_code, title: r.title, version: r.version,
    effective_date: r.effective_date, status: r.status, access_level: r.access_level,
    section: r.section, page: r.page, url: r.url, parse_flags: r.parse_flags, text: r.text,
  }));
return [{
  json: {
    query: q.query,
    status: kept.length ? 'ok' : 'no_relevant_passages',
    reranked,
    candidates: results.length,
    results: kept,
    note: kept.length
      ? 'Cite passages by their id in square brackets, for example [' + kept[0].id + '].'
      : 'Nothing in the documents this user may see answers this query. Try different words once; if there is still nothing, say it is not in the documents.',
  },
}];
