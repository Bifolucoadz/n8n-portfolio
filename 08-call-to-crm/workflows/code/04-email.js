// The follow-up email, if the rep chose to send it.
const p = $('Plan').first().json;
return [{ json: p.email || { to: '' } }];
