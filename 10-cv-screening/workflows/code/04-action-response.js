// What the dashboard gets back: the outcome and the candidate's new state.
// @include lib-ngt.js
const answer = $('Run Action').first().json || {};
const c = $('Read Candidate Again').all().map(i => i.json).find(r => r.candidate_id === $('Check Key').first().json.candidate_id) || {};
return [{ json: {
  code: answer.ok ? 200 : 409,
  body: { ok: !!answer.ok, message: answer.message || 'Something went wrong.', candidate: { status: c.status, slots: parseJson(c.slots_json, []), interview_at: c.interview_at } }
} }];
