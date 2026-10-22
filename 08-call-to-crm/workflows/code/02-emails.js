// Tells the rep the call is processed and what is waiting for them.
// @include lib-tdw.js
const r = $('Call Row').first().json;
const d = $('Decide').first().json;
const p = $('Prepare').first().json;
const s = p.settings;
const link = (s.base_url || 'http://localhost:5678') + '/webhook/tidewater/review?call=' + r.call_id + '&t=' + r.token;
const waiting = d.pending.length;
return [{ json: {
  to: s.rep_email, kind: 'review_ready', call_id: r.call_id,
  subject: 'Call processed: ' + p.crm.deal.name + ' (' + waiting + ' to review)',
  html: emailHtml(s.company || 'Tidewater Software', [
    'Your call for <b>' + esc(p.crm.deal.name) + '</b> is in the CRM: a call note' + (d.tasks.length ? ', ' + d.tasks.length + ' task' + (d.tasks.length > 1 ? 's' : '') : '') + (d.applied.filter(c => c.field !== 'next_step').length ? ' and ' + d.applied.filter(c => c.field !== 'next_step').map(c => c.label.toLowerCase()).join(', ') : '') + '.',
    esc(d.analysis.summary),
    '<b>' + waiting + ' thing' + (waiting === 1 ? '' : 's') + ' need your OK</b>, including the follow-up email to ' + esc(d.email_to || 'the prospect') + '.',
    '<a href="' + esc(link) + '" style="color:#1d4ed8;font-weight:600">Review and send</a>'
  ])
} }];
