// Checks the booking link (candidate, private token, one of the times offered) before anything is booked.
// @include lib-ngt.js
const q = $('Booking Link').first().json.query || {};
const s = settingsOf($('Read Settings').all());
const c = $('Read Candidate').all().map(i => i.json).find(r => r.candidate_id === q.c) || null;
const job = c ? ($('Read Jobs').all().map(i => i.json).find(j => j.job_id === c.job_id) || {}) : {};
const slots = c ? parseJson(c.slots_json, []) : [];
const n = Number(q.s);
const slot = Number.isInteger(n) && n >= 0 ? slots[n] || null : null;
let route = 'ok';
if (!c || !q.t || q.t !== c.token) route = 'invalid';
else if (c.status === 'interview_booked') route = 'already';
else if (c.status !== 'invited' || !slot) route = 'closed';
else if (Date.parse(slot.start) < Date.now() + 2 * 3600 * 1000) route = 'too_late';
return [{ json: { route, candidate: c, job, slot, slot_index: n, slots, settings: s, action: 'busy', from: slot ? slot.start : '', to: slot ? slot.end : '' } }];
