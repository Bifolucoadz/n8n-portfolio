// Parks the candidate without contacting them.
// @include lib-ngt.js
const p = $('Plan').first().json;
const c = p.candidate;
const now = nowIso();
return [{ json: {
  candidate_id: c.candidate_id, status: 'hold', slots_json: c.slots_json || '[]', interview_at: '', updated_at: now,
  event: 'hold', detail: 'Put on hold by ' + p.actor, actor: p.actor, at: now,
  emails: [],
  answer: { ok: true, message: 'On hold. The candidate hasn\'t been contacted.' }
} }];
