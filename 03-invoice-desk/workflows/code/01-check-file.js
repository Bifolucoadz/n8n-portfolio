// Normalise the incoming file: one binary property called "data", what kind of file it is, and where it came from.
const cfg = $('Config').first().json;
const input = $('When Called').first();
const bin = input.binary || {};
const key = bin.data ? 'data' : Object.keys(bin)[0];
const file = key ? bin[key] : null;
const j = input.json || {};

const name = String(j.original_filename || (file && file.fileName) || 'document').slice(0, 200);
const ext = ((name.match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
const mime = String((file && file.mimeType) || '').toLowerCase();
const bytes = file ? Number(file.bytes || 0) : 0;

let kind = 'unsupported';
if (mime === 'application/pdf' || ext === 'pdf') kind = 'pdf';
else if (/^image\/(png|jpe?g|webp|gif)$/.test(mime) || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) kind = 'image';
if (!file) kind = 'missing';
else if (bytes > cfg.MAX_FILE_MB * 1024 * 1024) kind = 'too_large';

const now = DateTime.now().setZone(cfg.TIMEZONE);
const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

return [{
  json: {
    doc_id: 'SK-' + now.toFormat('yyMMdd') + '-' + code,
    source: String(j.source || 'unknown'),
    sender: String(j.sender || '').slice(0, 200),
    subject: String(j.subject || '').slice(0, 200),
    note: String(j.note || '').slice(0, 500),
    received_at: String(j.received_at || now.toISO()),
    message_id: String(j.message_id || ''),
    drive_file_id: String(j.drive_file_id || ''),
    original_filename: name,
    mime_type: mime,
    ext: ext || (kind === 'pdf' ? 'pdf' : ''),
    bytes,
    kind
  },
  binary: file ? { data: file } : {}
}];
