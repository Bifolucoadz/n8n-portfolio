// One row per question for the log (and for follow-ups in the same chat).
// @include lib-ilf.js
const r = $('Answer Question').first().json;
const q = $('Question').first().json;
return [{ json: { session_id: q.session_id, question: q.question, sql: r.sql || '', ok: !!r.ok, row_count: r.row_count || 0, answer: r.answer || '', error: r.ok ? '' : (r.kind || 'error'), attempts: r.attempts || 1, ms: r.ms || 0, at: nowIso() } }];
