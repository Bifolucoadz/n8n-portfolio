// A confirmation to the applicant, and a heads-up to the recruiter when someone lands on the shortlist.
// @include lib-ngt.js
const c = $('Decide').first().json;
const s = $('Prepare').first().json.settings;
const company = s.company || 'Northgate Talent';
const out = [{
  to: c.email,
  subject: 'We\'ve received your application: ' + c.job_title,
  html: emailHtml(company, [
    'Hi ' + esc(firstName(c.name)) + ',',
    'Thanks for applying for <b>' + esc(c.job_title) + '</b>. A recruiter reads every application, and we\'ll be in touch within 3 working days either way.',
    'Your reference is <b>' + esc(c.candidate_id) + '</b>.',
    'Best wishes,<br>' + esc(s.recruiter_name || 'The Northgate team') + '<br>' + esc(company)
  ]),
  kind: 'acknowledgement',
  candidate_id: c.candidate_id
}];
if (c.band === 'shortlist') {
  const link = (s.base_url || 'http://localhost:5678') + '/webhook/northgate/dashboard?key=' + encodeURIComponent(s.dashboard_key || '') + '&job=' + c.job_id + '&c=' + c.candidate_id;
  out.push({
    to: s.recruiter_email,
    subject: 'Shortlist: ' + c.job_title + ' (score ' + c.score + ')',
    html: emailHtml(company, [
      'A new application for <b>' + esc(c.job_title) + '</b> scored <b>' + c.score + '</b> and is on the shortlist.',
      esc(c.summary),
      '<a href="' + esc(link) + '" style="color:#0b6e4f;font-weight:600">Open it in the dashboard</a>'
    ]),
    kind: 'recruiter_alert',
    candidate_id: c.candidate_id
  });
}
return out.map(json => ({ json }));
