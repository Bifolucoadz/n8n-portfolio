// A polite, fixed rejection. The wording is a template, never AI-written, and it gives no score.
// @include lib-ngt.js
const p = $('Plan').first().json;
const c = p.candidate, job = p.job, s = p.settings;
const now = nowIso();
return [{ json: {
  candidate_id: c.candidate_id, status: 'rejected', slots_json: c.slots_json || '[]', interview_at: '', updated_at: now,
  event: 'rejected', detail: 'Rejected by ' + p.actor + '; rejection email sent', actor: p.actor, at: now,
  emails: [{
    to: c.email, kind: 'rejection', candidate_id: c.candidate_id,
    subject: 'Your application for ' + job.title,
    html: emailHtml(s.company || 'Northgate Talent', [
      'Hi ' + esc(firstName(c.name)) + ',',
      'Thank you for applying for <b>' + esc(job.title) + '</b> and for the time you put into your application.',
      'We\'ve read it carefully, and on this occasion we won\'t be taking it further. We know that\'s disappointing to hear.',
      'We keep applications for six months unless you ask us not to, and we\'d be glad to hear from you about future roles.',
      'Best wishes,<br>' + esc(s.recruiter_name || 'The Northgate team') + '<br>' + esc(s.company || 'Northgate Talent')
    ])
  }],
  answer: { ok: true, message: 'Rejected. A polite email is on its way.' }
} }];
