// One item per email (items without a recipient are skipped), with the sending mode from Settings
// (test writes to the Outbox table).
// @include lib-tdw.js
const s = settingsOf($('Read Settings').all());
return $('When Called').all().filter(i => i.json.to).map(i => ({ json: {
  to: String(i.json.to || ''),
  subject: String(i.json.subject || ''),
  html: String(i.json.html || ''),
  kind: String(i.json.kind || ''),
  call_id: String(i.json.call_id || ''),
  live: s.mode === 'live',
  sender: s.rep_name ? s.rep_name + ' (' + (s.company || 'Tidewater Software') + ')' : 'Tidewater Software',
  reply_to: s.rep_email || '',
  at: nowIso()
} }));
