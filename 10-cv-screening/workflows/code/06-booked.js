// The interview is in the calendar: update the candidate, write the history line, email both sides and
// show the candidate a confirmation page.
// @include lib-ngt.js
const p = $('Check Link').first().json;
const ev = $input.first().json || {};
const c = p.candidate, job = p.job, s = p.settings, slot = p.slot;
const company = s.company || 'Northgate Talent';
const when = whenText(slot.start);
const now = nowIso();
return [{ json: {
  candidate_id: c.candidate_id, status: 'interview_booked', slots_json: c.slots_json, interview_at: slot.start, updated_at: now,
  event: 'interview_booked', detail: 'Booked an interview for ' + when, actor: 'candidate', at: now,
  emails: [
    { to: c.email, kind: 'interview_confirmed', candidate_id: c.candidate_id, subject: 'Confirmed: your interview on ' + DateTime.fromISO(slot.start, { zone: TZ }).toFormat('ccc d LLL'),
      html: emailHtml(company, [
        'Hi ' + esc(firstName(c.name)) + ',',
        'You\'re booked in for your <b>' + esc(job.title) + '</b> interview with ' + esc(job.interviewer) + ' on <b>' + esc(when) + '</b> (UK time).',
        'It\'s a video call of about ' + (s.interview_minutes || 45) + ' minutes; the link will be in the calendar invitation. If you need to change the time, just reply to this email.',
        'Good luck!<br>' + esc(s.recruiter_name || 'The Northgate team')
      ]) },
    { to: job.interviewer_email || s.recruiter_email, kind: 'interviewer_notice', candidate_id: c.candidate_id, subject: 'Interview booked: ' + c.name + ', ' + job.title,
      html: emailHtml(company, [
        '<b>' + esc(c.name) + '</b> booked an interview for <b>' + esc(job.title) + '</b> on <b>' + esc(when) + '</b>.',
        'Screening score ' + c.score + '. ' + esc(c.summary)
      ]) }
  ],
  page: pageHtml(company, 'You\'re booked in', '<p class="big">' + esc(when) + '</p><p>Your ' + esc(job.title) + ' interview with ' + esc(job.interviewer) + ' is confirmed. We\'ve emailed you the details.</p><p class="muted">Need a different time? Reply to the email and we\'ll sort it out.</p>'),
  event_id: ev.event_id || ''
} }];
