// Picks interview times and writes the invitation. Working days only, the hours in Settings, one time
// a day (rotating through the hours so the choice varies), never over the interviewer's busy periods.
// @include lib-ngt.js
const p = $('Plan').first().json;
const c = p.candidate, job = p.job, s = p.settings;
const busy = ($input.first().json.busy || []).map(b => [Date.parse(b.start), Date.parse(b.end)]);
const hours = String(s.interview_hours || '10,11,14,15').split(',').map(Number).filter(n => n >= 7 && n <= 19);
const minutes = Number(s.interview_minutes || 45);
const want = Number(s.slots_offered || 5);
const slots = [];
let day = DateTime.fromISO(p.from, { zone: TZ });
const end = DateTime.fromISO(p.to, { zone: TZ });
let turn = 0;
while (slots.length < want && day < end) {
  if (day.weekday <= 5) {
    for (let k = 0; k < hours.length; k++) {
      const h = hours[(turn + k) % hours.length];
      const st = day.set({ hour: h, minute: 0, second: 0, millisecond: 0 });
      const en = st.plus({ minutes });
      if (busy.some(([a, b]) => st.toMillis() < b && en.toMillis() > a)) continue;
      slots.push({ start: st.toISO(), end: en.toISO(), label: st.toFormat("cccc d LLLL, h:mm a").replace(':00 ', ' ') });
      break;
    }
    turn++;
  }
  day = day.plus({ days: 1 });
}
if (!slots.length) {
  const at = nowIso();
  return [{ json: { candidate_id: c.candidate_id, status: c.status, slots_json: c.slots_json || '[]', interview_at: c.interview_at || '', updated_at: at,
    event: 'invite_failed', detail: 'No free interview times in the next three weeks', actor: p.actor, at, emails: [],
    answer: { ok: false, message: 'No free interview times in the next three weeks. Check the calendar.' } } }];
}
const base = (s.base_url || 'http://localhost:5678') + '/webhook/northgate/book?c=' + c.candidate_id + '&t=' + c.token + '&s=';
const buttons = slots.map((t, i) => '<a href="' + esc(base + i) + '" style="display:block;padding:11px 14px;border:1px solid #cfe0d7;border-radius:10px;margin:0 0 8px;color:#0b6e4f;font-weight:600;text-decoration:none">' + esc(t.label) + '</a>').join('');
const now = nowIso();
return [{ json: {
  candidate_id: c.candidate_id, status: 'invited', slots_json: JSON.stringify(slots), interview_at: '', updated_at: now,
  event: 'invited', detail: 'Invited to interview; offered ' + slots.length + ' times (first ' + slots[0].label + ')', actor: p.actor, at: now,
  emails: [{
    to: c.email, kind: 'interview_invite', candidate_id: c.candidate_id,
    subject: 'Interview invitation: ' + job.title,
    html: emailHtml(s.company || 'Northgate Talent', [
      'Hi ' + esc(firstName(c.name)) + ',',
      'Thanks for applying for <b>' + esc(job.title) + '</b>. We\'d like to invite you to a ' + minutes + '-minute video interview with ' + esc(job.interviewer || s.recruiter_name) + '.',
      'Please pick the time that suits you best. The first person to choose a time gets it, so it\'s worth booking soon:'
    ], buttons + '<p style="margin:14px 0 0;color:#6b7c72;font-size:13px;text-align:left">None of these work? Just reply and we\'ll find another time.</p>')
  }],
  answer: { ok: true, message: 'Invite sent with ' + slots.length + ' times to choose from.' }
} }];
