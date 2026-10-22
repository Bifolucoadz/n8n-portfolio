// Fills the review page with the call, its analysis and the deal as it is now.
// @include lib-tdw.js
const s = settingsOf($('Read Settings').all());
const q = $('Review Link').first().json.query || {};
const c = $('Read Call').all().map(i => i.json).find(r => r.call_id === q.call);
const crm = $('Get Deal').first().json || {};
const TEMPLATE =
__HTML_REVIEW__
;
const contact = (crm.contacts || []).find(p => p.email === c.email_to) || {};
const data = {
  mode: s.mode, call_id: c.call_id, token: c.token, status: c.status, rep: c.rep, duration_s: c.duration_s,
  when: DateTime.fromISO(c.created_at).setZone(TZ).toFormat('ccc d LLL, h:mm a'),
  deal: crm.deal || {}, company: (crm.company || {}).name || '', stage_label: stageLabel((crm.deal || {}).stage),
  analysis: parseJson(c.analysis_json, {}), applied: parseJson(c.applied_json, { changes: [], tasks: [] }), pending: parseJson(c.pending_json, []),
  transcript: parseJson(c.transcript_json, { segments: [] }),
  email_to: c.email_to, email_to_name: contact.name || '', email_subject: c.email_subject, email_body: c.email_body
};
return [{ json: { code: 200, html: TEMPLATE.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c')) } }];
