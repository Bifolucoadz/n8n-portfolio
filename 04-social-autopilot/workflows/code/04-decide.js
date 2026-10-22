// What to do with one Telegram update: the replies to send, the row to change and the workflow to start.
const u = $('When Called').first().json;
const S = Object.fromEntries($('Read Settings').all().map(i => [String(i.json.key || '').trim(), String(i.json.value ?? '').trim()]));
const state = Object.fromEntries($('Read State').all().map(i => [String(i.json.key), String(i.json.value ?? '')]));
const rows = $('Read Calendar').all().map(i => i.json).filter(r => String(r.topic || '').trim());
const tz = S.timezone || 'Africa/Lagos';
const now = DateTime.now().setZone(tz);
const nowText = now.toFormat('yyyy-MM-dd HH:mm');
const approver = state.approver_chat_id || '';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const out = { answer: null, edit: null, reply: null, row: null, new_row: null, claim: '', next: 'none', post_id: '', feedback: '', approver };
const done = () => [{ json: out }];
if (u.kind === 'none') return [];

const HELP = [
  '<b>Social Autopilot</b>',
  'On a draft: ✅ Approve · ✏️ Rewrite (a fresh take) · 🚀 Post now · 🗑 Reject.',
  'Reply to a draft with what to change (e.g. "shorter, mention booking") and I\'ll rewrite it.',
  '',
  '/queue – what\'s coming up',
  '/idea &lt;topic&gt; – add a topic to the calendar',
  '/use &lt;post_id&gt; – turn a suggested topic into an idea',
  '/help – this message'
].join('\n');

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
const whenLabel = r => { const w = parseWhen(r.publish_at); return w ? w.toFormat('ccc d LLL, HH:mm') : 'no date yet'; };
const byId = id => rows.find(r => String(r.post_id || '').trim().toUpperCase() === String(id || '').trim().toUpperCase());
const status = r => String(r.status || '').trim().toLowerCase();
const reply = (text, replyTo) => { out.reply = { chat: approver || u.chat_id, text, reply_to: replyTo || 0 }; };

// ---- nobody has claimed the bot yet: the first /start in a private chat becomes the approver
if (!approver) {
  if (u.kind === 'message' && u.chat_type === 'private' && /^\/start\b/i.test(u.text)) {
    out.claim = u.chat_id;
    out.reply = { chat: u.chat_id, text: '👋 Hi ' + esc(u.first_name) + ', you\'re now the approver for Social Autopilot. Drafts arrive here for you to approve.\n\n' + HELP, reply_to: 0 };
  } else if (u.kind === 'message' && u.chat_type === 'private') {
    out.reply = { chat: u.chat_id, text: 'Send /start to become the approver for this bot.', reply_to: 0 };
  }
  return done();
}

// ---- only the approver can do anything
if (u.from_id !== approver) {
  if (u.kind === 'callback') out.answer = { id: u.callback_id, text: 'Only the owner can do that.' };
  else if (u.chat_type === 'private') out.reply = { chat: u.chat_id, text: 'This is a private bot.', reply_to: 0 };
  return done();
}

// ---- buttons
if (u.kind === 'callback') {
  const [action, id] = u.data.split(':');
  const r = byId(id);
  out.post_id = id || '';
  if (!r) { out.answer = { id: u.callback_id, text: 'I can\'t find ' + id + ' in the sheet any more.' }; return done(); }
  const st = status(r);
  const head = '<code>' + esc(r.post_id) + '</code> · <i>' + esc(r.topic) + '</i>';
  const isPreview = ['ap', 'rw', 'pn', 'rj'].includes(action);
  if (isPreview && String(r.preview_message_id || '') && String(r.preview_message_id) !== String(u.message_id)) {
    out.answer = { id: u.callback_id, text: 'This is an old version of the draft. Use the newest one.', show_alert: true };
    return done();
  }
  if (action === 'ap') {
    if (st !== 'in_review') { out.answer = { id: u.callback_id, text: 'It\'s ' + st + ' now, nothing to approve.' }; return done(); }
    const when = parseWhen(r.publish_at);
    const late = !when || when <= now;
    out.row = { post_id: r.post_id, status: 'approved', approved_at: nowText, updated_at: nowText };
    if (!when) out.row.publish_at = nowText;
    out.edit = { message_id: u.message_id, text: '✅ <b>Approved</b> · ' + head + '\n' + (late ? 'Goes out within 5 minutes.' : 'Goes out ' + whenLabel(r) + '.') + '\n\n' + esc(String(r.linkedin_text || r.telegram_text || '').slice(0, 600)) + (String(r.linkedin_text || '').length > 600 ? '…' : '') };
    out.answer = { id: u.callback_id, text: 'Approved' };
  } else if (action === 'pn') {
    if (!['in_review', 'approved'].includes(st)) { out.answer = { id: u.callback_id, text: 'It\'s ' + st + ' now, so it can\'t be posted.' }; return done(); }
    out.row = { post_id: r.post_id, status: 'publishing', publish_at: nowText, approved_at: String(r.approved_at || '') || nowText, updated_at: nowText };
    out.next = 'publish';
    out.edit = { message_id: u.message_id, text: '🚀 <b>Posting now</b> · ' + head };
    out.answer = { id: u.callback_id, text: 'Posting now' };
  } else if (action === 'rj') {
    if (['posted', 'publishing'].includes(st)) { out.answer = { id: u.callback_id, text: 'It\'s already ' + st + '.' }; return done(); }
    out.row = { post_id: r.post_id, status: 'rejected', updated_at: nowText };
    out.edit = { message_id: u.message_id, text: '🗑 <b>Rejected</b> · ' + head + '\nSet its status back to idea in the sheet if you want a new draft later.' };
    out.answer = { id: u.callback_id, text: 'Rejected' };
  } else if (action === 'rw') {
    if (!['in_review', 'approved'].includes(st)) { out.answer = { id: u.callback_id, text: 'It\'s ' + st + ' now, so it can\'t be rewritten.' }; return done(); }
    out.row = { post_id: r.post_id, status: 'drafting', feedback: 'fresh take', updated_at: nowText };
    out.next = 'draft';
    out.feedback = 'fresh take';
    out.edit = { message_id: u.message_id, text: '↻ <b>Rewriting</b> · ' + head + '\nThe new version arrives in about a minute.' };
    out.answer = { id: u.callback_id, text: 'Rewriting…' };
  } else if (action === 'rt') {
    if (!['failed', 'partial'].includes(st)) { out.answer = { id: u.callback_id, text: 'It\'s ' + st + ' now, nothing to retry.' }; return done(); }
    out.row = { post_id: r.post_id, status: 'publishing', updated_at: nowText };
    out.next = 'publish';
    out.edit = { message_id: u.message_id, text: '🔁 <b>Retrying</b> · ' + head + '\nOnly the platforms that failed are tried again.' };
    out.answer = { id: u.callback_id, text: 'Retrying' };
  } else {
    out.answer = { id: u.callback_id, text: '' };
  }
  return done();
}

// ---- messages from the approver
const text = String(u.text || '').trim();
if (!text) return done();

const rewrite = (r, note) => {
  const st = status(r);
  if (!['in_review', 'approved'].includes(st)) { reply('<code>' + esc(r.post_id) + '</code> is ' + esc(st) + ' now, so I can\'t change it.', u.message_id); return; }
  out.row = { post_id: r.post_id, status: 'drafting', feedback: note, updated_at: nowText };
  out.next = 'draft';
  out.post_id = r.post_id;
  out.feedback = note;
  reply('✍️ Rewriting <code>' + esc(r.post_id) + '</code> with your note. The new version arrives in about a minute.', u.message_id);
};

if (u.reply_to_id) {
  const r = rows.find(x => String(x.preview_message_id || '') === String(u.reply_to_id));
  if (r) { rewrite(r, text.slice(0, 500)); return done(); }
}

const cmd = (text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/) || []);
const name = (cmd[1] || '').toLowerCase();
const arg = (cmd[2] || '').trim();

if (name === 'start' || name === 'help') {
  reply((name === 'start' ? 'You\'re the approver already.\n\n' : '') + HELP);
} else if (name === 'queue') {
  const live = ['idea', 'drafting', 'in_review', 'approved', 'publishing', 'partial', 'failed', 'needs_fix'];
  const upcoming = rows
    .filter(r => live.includes(status(r)))
    .sort((a, b) => String(a.publish_at || '9999').localeCompare(String(b.publish_at || '9999')))
    .slice(0, 12);
  const lines = upcoming.map(r => '• ' + whenLabel(r) + ' · ' + status(r) + ' · <code>' + esc(r.post_id || 'new') + '</code> ' + esc(String(r.topic).slice(0, 70)));
  const suggested = rows.filter(r => status(r) === 'suggested').length;
  reply('<b>Coming up</b> (' + (/^live$/i.test(S.mode || '') ? 'live' : 'test mode') + ')\n' + (lines.join('\n') || 'Nothing scheduled. Add topics with /idea.') + (suggested ? '\n\n' + suggested + ' suggested topic(s) in the sheet; /use &lt;post_id&gt; to schedule one.' : ''));
} else if (name === 'idea') {
  if (!arg) { reply('Write the topic after the command, e.g. <code>/idea Why follow-up emails win deals</code>'); return done(); }
  const used = new Set(rows.map(r => String(r.post_id || '')));
  let id;
  do { id = 'P-' + Math.random().toString(36).slice(2, 7).toUpperCase(); } while (used.has(id));
  out.new_row = { post_id: id, topic: arg.slice(0, 300), status: 'idea', updated_at: nowText };
  reply('📝 Added <code>' + id + '</code>: <i>' + esc(arg.slice(0, 300)) + '</i>\nIt gets the next free slot, and the draft reaches you about ' + (S.draft_hours_ahead || '48') + ' hours before it goes out.');
} else if (name === 'use') {
  const r = byId(arg);
  if (!r) reply('I can\'t find <code>' + esc(arg) + '</code>. Use the ID from the weekly report.');
  else if (status(r) !== 'suggested') reply('<code>' + esc(r.post_id) + '</code> is ' + esc(status(r)) + ', not suggested.');
  else {
    out.row = { post_id: r.post_id, status: 'idea', updated_at: nowText };
    reply('👍 <code>' + esc(r.post_id) + '</code> is now an idea and gets the next free slot.');
  }
} else if (name) {
  reply('I don\'t know /' + esc(name) + '.\n\n' + HELP);
} else {
  const waiting = rows.filter(r => status(r) === 'in_review');
  if (waiting.length === 1) rewrite(waiting[0], text.slice(0, 500));
  else if (waiting.length > 1) reply('Several drafts are waiting. Reply to the one you want to change (swipe left on it), or use /queue.', u.message_id);
  else reply(HELP);
}
return done();
