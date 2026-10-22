// One item per usable attachment, oldest email first, so a re-sent invoice is always checked after the original.
// Small inline images (signature logos, tracking pixels) and calendar or vCard files are skipped.
const tz = 'America/New_York';
const out = [];
const emails = $input.all().slice().sort((a, b) => new Date(a.json.date || 0) - new Date(b.json.date || 0));
for (const email of emails) {
  const j = email.json;
  const from = (j.from && j.from.text) || (j.from && j.from.value && j.from.value[0] && j.from.value[0].address) || '';
  const received = j.date ? DateTime.fromJSDate(new Date(j.date)).setZone(tz).toISO() : DateTime.now().setZone(tz).toISO();
  for (const [key, file] of Object.entries(email.binary || {})) {
    const mime = String(file.mimeType || '').toLowerCase();
    const bytes = Number(file.bytes || 0);
    if (/^image\//.test(mime) && bytes > 0 && bytes < 15 * 1024) continue;
    if (/^(text\/calendar|application\/ics|text\/x?-?vcard|application\/pkcs7-signature)$/.test(mime)) continue;
    out.push({
      json: { source: 'email', sender: from, subject: String(j.subject || ''), received_at: received, original_filename: file.fileName || key, message_id: j.id },
      binary: { data: file }
    });
  }
}
return out;
