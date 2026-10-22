// Last 7 days, next 7 days and empty slots, plus the brief for the topic ideas.
const S = Object.fromEntries($('Read Settings').all().map(i => [String(i.json.key || '').trim(), String(i.json.value ?? '').trim()]));
const state = Object.fromEntries($('Read State').all().map(i => [String(i.json.key), String(i.json.value ?? '')]));
const rows = $('Read Calendar').all().map(i => i.json).filter(r => String(r.topic || '').trim());
const tz = S.timezone || 'Africa/Lagos';
const now = DateTime.now().setZone(tz);
const status = r => String(r.status || '').trim().toLowerCase();

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
const short = d => d.toFormat('ccc d LLL');

const weekAgo = now.minus({ days: 7 });
const weekAhead = now.plus({ days: 7 });
const posted = rows
  .filter(r => ['posted', 'partial', 'test_posted'].includes(status(r)))
  .map(r => ({ r, at: parseWhen(r.posted_at) }))
  .filter(x => x.at && x.at >= weekAgo)
  .sort((a, b) => a.at - b.at);

const last = posted.map(({ r, at }) => ({
  post_id: r.post_id, topic: r.topic, day: short(at), status: status(r),
  linkedin_url: r.linkedin_url || '', telegram_url: r.telegram_url || ''
}));

const live = ['idea', 'drafting', 'in_review', 'approved', 'publishing'];
const next = rows
  .map(r => ({ r, when: parseWhen(r.publish_at) }))
  .filter(x => live.includes(status(x.r)) && x.when && x.when >= now && x.when <= weekAhead)
  .sort((a, b) => a.when - b.when)
  .map(({ r, when }) => ({ post_id: r.post_id, topic: r.topic, when: when.toFormat('ccc d LLL, HH:mm'), status: status(r) }));

const dayNum = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
let days = String(S.post_days || 'Mon, Wed, Fri').toLowerCase().split(/[\s,;]+/).map(d => dayNum[d.slice(0, 3)]).filter(Boolean);
if (!days.length) days = [1, 3, 5];
const [hh, mm] = (String(S.post_time || '09:00').match(/^(\d{1,2}):(\d{2})/) || [0, '9', '00']).slice(1).map(Number);
const taken = new Set(rows.filter(r => status(r) !== 'rejected').map(r => parseWhen(r.publish_at)).filter(Boolean).map(d => d.toFormat('yyyy-MM-dd HH:mm')));
const empty = [];
for (let i = 0; i <= 7; i++) {
  const c = now.startOf('day').plus({ days: i }).set({ hour: hh, minute: mm });
  if (days.includes(c.weekday) && c > now && c <= weekAhead && !taken.has(c.toFormat('yyyy-MM-dd HH:mm'))) empty.push(c.toFormat('ccc d LLL, HH:mm'));
}
const backlog = rows.filter(r => status(r) === 'idea' && (!parseWhen(r.publish_at) || parseWhen(r.publish_at) > weekAhead)).length;

const brief = [
  'BRAND NAME: ' + (S.brand_name || ''),
  'WHAT THEY DO: ' + (S.what_you_do || ''),
  'AUDIENCE: ' + (S.audience || ''),
  'VOICE: ' + (S.voice || ''),
  'FACTS: ' + (S.facts || '(none)'),
  '',
  'TOPICS ALREADY IN THE CALENDAR (do not repeat):',
  rows.map(r => '- ' + r.topic).join('\n') || '(none)',
  '',
  'LAST WEEK: ' + (last.length ? last.map(x => x.topic).join('; ') : 'nothing posted')
].join('\n');

return [{ json: {
  range: weekAgo.toFormat('d LLL') + ' – ' + now.toFormat('d LLL'),
  test_mode: !/^live$/i.test(S.mode || 'test'),
  last, next, empty, backlog,
  waiting: rows.filter(r => status(r) === 'in_review').length,
  suggested: rows.filter(r => status(r) === 'suggested').length,
  problems: rows.filter(r => ['failed', 'partial', 'needs_fix'].includes(status(r))).map(r => ({ post_id: r.post_id, topic: r.topic, status: status(r), error: String(r.error || '').slice(0, 160) })),
  used_ids: rows.map(r => String(r.post_id || '')).filter(Boolean),
  now_text: now.toFormat('yyyy-MM-dd HH:mm'),
  approver: state.approver_chat_id || '',
  brief
} }];
