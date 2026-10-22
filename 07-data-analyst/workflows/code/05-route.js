// One item per email (items without a recipient are skipped), with the sending mode from Settings
// (test writes to the Outbox table).
// @include lib-ilf.js
const s = settingsOf($('Read Settings').all());
return $('When Called').all().filter(i => i.json.to).map(i => ({ json: {
  to: String(i.json.to || ''),
  subject: String(i.json.subject || ''),
  html: String(i.json.html || ''),
  kind: String(i.json.kind || ''),
  ref: String(i.json.ref || ''),
  live: s.mode === 'live',
  sender: s.company || 'Ironleaf Fitness',
  reply_to: s.owner_email || '',
  at: nowIso()
} }));
