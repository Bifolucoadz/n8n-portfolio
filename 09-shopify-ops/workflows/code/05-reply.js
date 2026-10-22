// The reply, plus both sides of this turn for the Messages table.
// @include lib-kettle.js
const inp = $('Build Input').first().json;
const out = $input.first().json || {};
const reply = String(out.output || '').trim() || 'Sorry, something went wrong on our side. Please email help@kettleandfern.example and we\'ll sort it out.';
return [{ json: { reply, rows: [
  { session_id: inp.session_id, role: 'user', text: inp.message, order_number: '', at: inp.at },
  { session_id: inp.session_id, role: 'assistant', text: reply, order_number: (reply.match(/#\d{4}/) || [''])[0], at: nowIso() }
] } }];
