// The row to draft, its settings and everything the next nodes need, as one item.
const input = $('When Called').first().json;
const postId = String(input.post_id || '').trim();
const feedback = String(input.feedback || '').trim();
const S = Object.fromEntries($('Read Settings').all().map(i => [String(i.json.key || '').trim(), String(i.json.value ?? '').trim()]));
const state = Object.fromEntries($('Read State').all().map(i => [String(i.json.key), String(i.json.value ?? '')]));
const rows = $('Read Calendar').all().map(i => i.json);
const row = rows.find(r => String(r.post_id || '').trim() === postId);
if (!row) throw new Error('No calendar row with post_id ' + postId);
// The caller sets the row to drafting first; anything else means it changed meanwhile.
if (String(row.status || '').trim() !== 'drafting') return [];

const tz = S.timezone || 'Africa/Lagos';
const now = DateTime.now().setZone(tz);

function parseWhen(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return DateTime.fromMillis(Math.round((v - 25569) * 86400000), { zone: 'UTC' }).setZone(tz, { keepLocalTime: true });
  const s = String(v).trim().replace('T', ' ');
  for (const f of ['yyyy-MM-dd HH:mm', 'yyyy-MM-dd H:mm', 'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd']) {
    const d = DateTime.fromFormat(s, f, { zone: tz });
    if (d.isValid) return d;
  }
  return null;
}

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

const imageCell = String(row.image || S.default_image || 'none').trim();
let image = { mode: 'none' };
if (/^none$/i.test(imageCell) || imageCell === '') image = { mode: 'none' };
else if (row.image_file_id) image = { mode: 'drive', file_id: String(row.image_file_id) };
else if (/^ai$/i.test(imageCell)) image = { mode: 'ai' };
else if (/^https?:\/\//i.test(imageCell)) {
  const m = imageCell.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
  image = m ? { mode: 'drive', file_id: m[1] } : { mode: 'url', url: imageCell };
}

const when = parseWhen(row.publish_at);
const recent = rows
  .filter(r => ['posted', 'test_posted'].includes(String(r.status || '').trim()) && r.post_id !== postId)
  .sort((a, b) => String(b.posted_at || '').localeCompare(String(a.posted_at || '')))
  .slice(0, 5)
  .map(r => '- ' + r.topic + ': "' + String(r.linkedin_text || r.telegram_text || '').split('\n')[0].slice(0, 160) + '"');

return [{
  json: {
    post_id: postId,
    topic: String(row.topic || '').trim(),
    notes: String(row.notes || '').trim(),
    link: String(row.link || S.default_link || '').trim(),
    platforms,
    image,
    feedback,
    previous: feedback ? { linkedin: row.linkedin_text || '', telegram: row.telegram_text || '' } : null,
    when_label: when ? when.toFormat('cccc d LLLL yyyy, HH:mm') : 'as soon as approved',
    when_short: when ? when.toFormat('ccc d LLL, HH:mm') : 'as soon as approved',
    today_label: now.toFormat('cccc d LLLL yyyy'),
    now_text: now.toFormat('yyyy-MM-dd HH:mm'),
    old_preview_id: String(row.preview_message_id || '').trim(),
    attempts: Number(row.attempts) || 0,
    auto_approve: /^(no|false|n)$/i.test(S.require_approval || 'yes'),
    test_mode: !/^live$/i.test(S.mode || 'test'),
    approver: state.approver_chat_id || '',
    recent,
    settings: S
  }
}];
