// Totals for a manual run, plus every question that missed on any check.
const rows = $input.all().map(i => i.json);
const n = rows.length || 1;
const pct = k => Math.round(rows.filter(r => r[k] === 1).length / n * 100);
const avg = k => Math.round(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0) / n * 100) / 100;
const lat = rows.map(r => r.latency_ms).filter(Boolean).sort((a, b) => a - b);
return [{
  json: {
    questions: rows.length,
    route_ok_pct: pct('route_ok'),
    retrieval_hit_pct: pct('retrieval_hit'),
    access_ok_pct: pct('access_ok'),
    correctness_avg: avg('correctness'),
    grounded_avg: avg('grounded'),
    median_latency_ms: lat.length ? lat[Math.floor(lat.length / 2)] : null,
    p90_latency_ms: lat.length ? lat[Math.floor(lat.length * 0.9)] : null,
    misses: rows
      .filter(r => !r.route_ok || !r.retrieval_hit || !r.access_ok || r.correctness < 4 || r.grounded < 4)
      .map(r => ({ qid: r.qid, role: r.role, route: r.actual_route, sources: r.actual_sources, route_ok: r.route_ok, retrieval_hit: r.retrieval_hit, access_ok: r.access_ok, correctness: r.correctness, grounded: r.grounded, reason: r.judge_reason })),
    all: rows.map(r => ({ qid: r.qid, route: r.actual_route, c: r.correctness, g: r.grounded, ms: r.latency_ms })),
  },
}];
