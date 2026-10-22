// The final answer for the chat page, in one shape for every outcome: answered, needs a different
// question, or failed.
// @include lib-ilf.js
const p0 = $('Prompt').first().json;
const chk = $('Check SQL').first().json;
const ms = Date.now() - p0.started_ms;
if (chk.plan && !chk.can_answer) {
  return [{ json: { ok: false, kind: 'clarify', answer: chk.plan.clarification || 'I can\'t answer that from the gym data.', sql: '', columns: [], rows: [], row_count: 0, chart: { type: 'table' }, note: '', attempts: 1, ms } }];
}
const r = $('Write Answer').isExecuted ? $('Answer Input').first().json : ($('Result (Fixed)').isExecuted ? $('Result (Fixed)').first().json : ($('Result').isExecuted ? $('Result').first().json : chk));
const attempts = $('Fix SQL').isExecuted ? 2 : 1;
if (!r.ok) {
  return [{ json: { ok: false, kind: 'error', answer: 'Sorry, I couldn\'t get that from the data (' + (r.error || 'unknown error').slice(0, 200) + '). Try asking it another way.', sql: r.sql || '', columns: [], rows: [], row_count: 0, chart: { type: 'table' }, note: '', attempts, ms } }];
}
const a = aiJson($('Write Answer').first().json) || { answer: r.rows.length ? 'Here is what the data shows.' : 'Nothing matched.', note: '' };
const plan = r.plan || {};
return [{ json: { ok: true, kind: 'answer', answer: a.answer, note: a.note, explanation: plan.explanation || '', assumptions: plan.assumptions || [],
  sql: r.sql, columns: r.rows.length ? Object.keys(r.rows[0]) : [], rows: r.rows.slice(0, 200), row_count: r.rows.length, chart: plan.chart || { type: 'table' }, attempts, ms } }];
