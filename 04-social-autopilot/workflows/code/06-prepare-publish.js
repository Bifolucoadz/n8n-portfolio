// The row to publish and what still has to go out. The caller sets it to publishing first.
const postId = String($('When Called').first().json.post_id || '').trim();
const S = Object.fromEntries($('Read Settings').all().map(i => [String(i.json.key || '').trim(), String(i.json.value ?? '').trim()]));
const state = Object.fromEntries($('Read State').all().map(i => [String(i.json.key), String(i.json.value ?? '')]));
const row = $('Read Calendar').all().map(i => i.json).find(r => String(r.post_id || '').trim() === postId);
if (!row) throw new Error('No calendar row with post_id ' + postId);
if (String(row.status || '').trim() !== 'publishing') return [];

function platformList(v) {
  const alias = { linkedin: 'linkedin', li: 'linkedin', 'linked in': 'linkedin', telegram: 'telegram', tg: 'telegram' };
  const out = [];
  for (const p of String(v || '').toLowerCase().split(/[,;/]+/)) {
    const k = alias[p.trim()];
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}
let platforms = platformList(row.platforms);
if (!platforms.length) platforms = platformList(S.default_platforms || 'linkedin, telegram');
// A platform that already has a link was posted on an earlier try; never post it twice.
const urlCol = { linkedin: 'linkedin_url', telegram: 'telegram_url' };
const needs = platforms.filter(p => !String(row[urlCol[p]] || '').trim());

const imageCell = String(row.image || S.default_image || 'none').trim();
let image = { mode: 'none' };
if (!/^none$/i.test(imageCell) && imageCell !== '') {
  if (row.image_file_id) image = { mode: 'drive', file_id: String(row.image_file_id) };
  else if (/^https?:\/\//i.test(imageCell)) {
    const m = imageCell.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
    image = m ? { mode: 'drive', file_id: m[1] } : { mode: 'url', url: imageCell };
  }
}

let channel = String(S.telegram_channel || '').trim();
const tme = channel.match(/t\.me\/([\w]+)/i);
if (tme) channel = '@' + tme[1];
else if (channel && !channel.startsWith('@') && !/^-?\d+$/.test(channel)) channel = '@' + channel;

const tz = S.timezone || 'Africa/Lagos';
return [{ json: {
  post_id: postId,
  topic: String(row.topic || '').trim(),
  linkedin_text: String(row.linkedin_text || '').trim(),
  telegram_text: String(row.telegram_text || '').trim(),
  link: String(row.link || S.default_link || '').trim(),
  platforms,
  needs,
  need_li: needs.includes('linkedin'),
  need_tg: needs.includes('telegram'),
  already: platforms.filter(p => !needs.includes(p)),
  image,
  image_alt: 'Illustration for: ' + String(row.topic || '').trim(),
  test_mode: !/^live$/i.test(S.mode || 'test'),
  approver: state.approver_chat_id || '',
  channel,
  linkedin_person: state.linkedin_person_id || '',
  visibility: /^connections$/i.test(S.linkedin_visibility || '') ? 'CONNECTIONS' : 'PUBLIC',
  attempts: Number(row.attempts) || 0,
  now_text: DateTime.now().setZone(tz).toFormat('yyyy-MM-dd HH:mm')
} }];
