// Is the chosen time still free? (Another candidate may have taken it, or the interviewer got busy.)
// @include lib-ngt.js
const p = $('Check Link').first().json;
const free = ($input.first().json.busy || []).length === 0;
const c = p.candidate, job = p.job;
return [{ json: {
  free,
  action: 'book', start: p.slot.start, end: p.slot.end, candidate_id: c.candidate_id,
  title: 'Interview: ' + c.name + ' for ' + job.title,
  description: 'Video interview for ' + job.title + ' (' + job.job_id + '). Candidate ' + c.candidate_id + ', screening score ' + c.score + '. Booked by the candidate from the Northgate invitation.',
  attendees: [c.email, job.interviewer_email].filter(Boolean).join(',')
} }];
