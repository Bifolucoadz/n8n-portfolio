// Marks each answer right or wrong against the reference SQL: every value in the reference result must
// appear in the assistant's result (numbers within 0.6% or 0.11 for rounding, text ignoring case, dates
// by day). Column names and order don't matter.
// @include lib-ilf.js
const qs = $('Questions').all().map(i => i.json);
const refs = $('Reference').all().map(i => i.json);
const gots = $('Ask Assistant').all().map(i => i.json);
const runId = 'E' + DateTime.now().setZone(TZ).toFormat('LLdd-HHmm');
const asList = r => Array.isArray(r) ? r : (typeof r === 'string' ? JSON.parse(r) : []);
const cells = rows => rows.flatMap(r => Object.values(r));
const isNum = v => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()));
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
const at = nowIso();
return qs.map((q, i) => {
  const expected = asList((refs[i] || {}).rows);
  const g = gots[i] || {};
  const got = g.ok ? asList(g.rows) : [];
  const gotCells = cells(got);
  const missing = [];
  for (const v of cells(expected)) {
    if (v === null) continue;
    let found;
    if (isNum(v)) { const n = Number(v); found = gotCells.some(x => isNum(x) && Math.abs(Number(x) - n) <= Math.max(0.11, Math.abs(n) * 0.006)); }
    else if (isDate(v)) found = gotCells.some(x => String(x).slice(0, 10) === v.slice(0, 10) || String(x).slice(0, 7) === v.slice(0, 7) && v.slice(8, 10) === '01');
    else found = gotCells.some(x => String(x).toLowerCase() === String(v).toLowerCase());
    if (!found) missing.push(v);
  }
  const pass = !!g.ok && expected.length > 0 && missing.length === 0;
  return { json: { run_id: runId, qid: q.qid, question: q.question, expected_json: JSON.stringify(expected), got_json: JSON.stringify(got.slice(0, 20)), sql: g.sql || '',
    pass, note: !g.ok ? (g.answer || 'no answer').slice(0, 200) : missing.length ? 'missing: ' + missing.slice(0, 5).join(', ') : '', ms: g.ms || 0, at } };
});
