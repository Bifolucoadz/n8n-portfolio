// One item per email (items without a recipient are skipped), with the sending mode from Settings
// (test writes to the Outbox table).
// @include lib-ngt.js
const s = settingsOf($('Read Settings').all());
return $('When Called').all().filter(i => i.json.to).map(i => ({ json: {
  to: String(i.json.to || ''),
  subject: String(i.json.subject || ''),
  html: String(i.json.html || ''),
  kind: String(i.json.kind || ''),
  candidate_id: String(i.json.candidate_id || ''),
  live: s.mode === 'live',
  sender: s.company || 'Northgate Talent',
  reply_to: s.recruiter_email || '',
  at: nowIso()
} }));
