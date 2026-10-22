// The score.
const rows = $('Compare').all().map(i => i.json);
const passed = rows.filter(r => r.pass);
const ms = rows.map(r => r.ms).sort((a, b) => a - b);
return [{ json: { run_id: rows[0].run_id, questions: rows.length, passed: passed.length, accuracy_pct: Math.round(1000 * passed.length / rows.length) / 10,
  median_s: Math.round(ms[Math.floor(ms.length / 2)] / 100) / 10, failed: rows.filter(r => !r.pass).map(r => r.qid + ': ' + r.question + ' (' + r.note + ')') } }];
