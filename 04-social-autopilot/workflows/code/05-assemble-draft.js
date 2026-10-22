// Everything for the preview message and the sheet row, plus the image binary if there is one.
const b = $('Prepare Brief').first().json;
const d = $('Check Drafts').first().json;
const item = $input.first();
const notes = [...d.notes];

let binary = item.binary && item.binary.data ? { data: item.binary.data } : null;

let imageFileId = '';
let imageLink = '';
if (b.image.mode === 'ai') { imageFileId = item.json.image_file_id || ''; imageLink = item.json.image_link || ''; }
if (b.image.mode === 'drive') { imageFileId = b.image.file_id; imageLink = 'https://drive.google.com/file/d/' + b.image.file_id + '/view'; }
if (b.image.mode === 'url') imageLink = b.image.url;

const problem = item.json.image_error || (item.json.error ? String(item.json.error.message || item.json.error) : '');
if (b.image.mode !== 'none' && !binary) notes.push('Image problem: ' + (problem || 'no image data') + '. The post goes out without an image unless you fix the image cell and tap Rewrite.');
else if (problem) notes.push(problem + '.');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const header = [
  (b.auto_approve ? '✅ <b>Scheduled</b> (auto-approved)' : (b.feedback ? '↻ <b>Rewritten draft</b>' : '📝 <b>New draft</b>')) + ' · <code>' + b.post_id + '</code>',
  '🗓 ' + esc(b.when_short) + ' · ' + b.platforms.join(', '),
  '<i>' + esc(b.topic) + '</i>'
];
if (b.feedback) header.push('Change asked: "' + esc(b.feedback.slice(0, 200)) + '"');

const footer = [];
for (const n of notes) footer.push('⚠️ ' + esc(n));
if (b.test_mode) footer.push('🧪 Test mode: at post time you get the final posts here instead of them going public.');
footer.push(b.auto_approve ? 'Tap Reject to cancel it.' : 'Reply to this message to ask for changes, e.g. "shorter, end with a question".');

function build(liText) {
  const parts = [header.join('\n')];
  if (b.platforms.includes('linkedin')) parts.push('<b>LinkedIn</b>\n' + esc(liText));
  if (b.platforms.includes('telegram')) parts.push('<b>Telegram</b>\n' + esc(d.telegram));
  parts.push(footer.join('\n'));
  return parts.join('\n\n');
}
let preview = build(d.linkedin);
if (preview.length > 4000) {
  const over = preview.length - 4000 + 40;
  preview = build(d.linkedin.slice(0, Math.max(200, d.linkedin.length - over)) + '… (full text in the sheet)');
}

const now = DateTime.now().setZone(b.settings.timezone || 'Africa/Lagos').toFormat('yyyy-MM-dd HH:mm');
const out = {
  json: {
    post_id: b.post_id,
    approver: b.approver,
    preview,
    has_image: !!binary,
    old_preview_id: b.old_preview_id,
    row: {
      post_id: b.post_id,
      status: b.auto_approve ? 'approved' : 'in_review',
      linkedin_text: d.linkedin,
      telegram_text: d.telegram,
      image_file_id: imageFileId,
      image_link: imageLink,
      error: notes.join(' '),
      feedback: b.feedback,
      drafted_at: now,
      approved_at: b.auto_approve ? now : '',
      reminded_at: '',
      attempts: '0',
      updated_at: now
    }
  }
};
if (binary) out.binary = binary;
return [out];
