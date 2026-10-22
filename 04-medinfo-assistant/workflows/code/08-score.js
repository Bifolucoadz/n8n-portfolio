// Deterministic checks (route, retrieval, access control) plus the judge's two scores.
const row = $('Eval Input').item.json;
const ans = $('Answer').item.json;
let j = null;
for (const o of $json.output ?? []) {
  for (const c of o.content ?? []) {
    let d = c.text;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
    if (d && typeof d === 'object') j = d;
  }
}
const cited = (ans.sources ?? []).map(s => s.doc_code);
const routes = row.expected_route.split('|').map(s => s.trim()).filter(Boolean);
return {
  json: {
    qid: row.qid,
    role: row.role,
    question: row.question,
    actual_route: ans.route ?? 'error',
    actual_answer: ans.answer ?? '',
    actual_sources: [...new Set(cited)].join(', '),
    route_ok: routes.includes(ans.route) ? 1 : 0,
    // Rows without an expected or forbidden document count as a pass for that check.
    retrieval_hit: row.expected_doc ? (cited.includes(row.expected_doc) ? 1 : 0) : 1,
    access_ok: row.must_not_cite ? (cited.includes(row.must_not_cite) ? 0 : 1) : 1,
    correctness: j ? Number(j.correctness) : 0,
    grounded: j ? Number(j.grounded) : 0,
    judge_reason: j?.reason ?? 'The judge did not return a score.',
    latency_ms: ans.latency_ms ?? null,
  },
};
