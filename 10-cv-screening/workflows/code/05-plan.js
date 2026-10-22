// Checks that the decision makes sense for where the candidate is now, and picks the branch.
// invite: new or on hold (never a knockout) · hold: new · reject: new, on hold or invited.
// @include lib-ngt.js
const req = $('When Called').first().json;
const s = settingsOf($('Read Settings').all());
const c = $('Read Candidate').all().map(i => i.json).find(r => r.candidate_id === req.candidate_id) || null;
const job = c ? ($('Read Jobs').all().map(i => i.json).find(j => j.job_id === c.job_id) || {}) : {};
const allowed = { invite: ['new', 'hold'], hold: ['new'], reject: ['new', 'hold', 'invited'] };
const said = { invited: 'invited', interview_booked: 'booked for interview', rejected: 'rejected', hold: 'on hold', new: 'new' };
let route = req.action, message = '';
if (!c) { route = 'refuse'; message = 'Candidate not found.'; }
else if (!allowed[req.action]) { route = 'refuse'; message = 'Unknown action.'; }
else if (!allowed[req.action].includes(c.status)) { route = 'refuse'; message = 'This candidate is already ' + (said[c.status] || c.status) + '.'; }
else if (req.action === 'invite' && c.band === 'knockout') { route = 'refuse'; message = 'This candidate needs visa sponsorship, which the role can\'t offer.'; }
const from = DateTime.now().setZone(TZ).plus({ days: 1 }).startOf('day');
return [{ json: { route, message, candidate: c, job, settings: s, actor: req.actor || 'recruiter', action: 'busy', from: from.toISO(), to: from.plus({ days: 21 }).toISO() } }];
