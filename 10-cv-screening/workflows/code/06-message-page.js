// Every other case: a bad or old link, a time that's too soon, or already booked.
// @include lib-ngt.js
const p = $('Check Link').first().json;
const s = p.settings || {};
const company = s.company || 'Northgate Talent';
const c = p.candidate;
const pages = {
  invalid: [404, 'Link not recognised', '<p>This link isn\'t valid. Please use the link in your invitation email.</p>'],
  closed: [410, 'This invitation has closed', '<p>This invitation is no longer open. If you think that\'s a mistake, reply to the email and we\'ll help.</p>'],
  too_late: [409, 'That time is too soon', '<p>Interviews need at least two hours\' notice. Please pick a later time from your email.</p>'],
  already: [200, 'You\'re already booked', '<p>Your interview is booked for <b>' + esc(c && c.interview_at ? whenText(c.interview_at) : '') + '</b>. To change it, reply to your confirmation email.</p>']
};
const [code, title, body] = pages[p.route] || pages.invalid;
return [{ json: { code, html: pageHtml(company, title, body) } }];
