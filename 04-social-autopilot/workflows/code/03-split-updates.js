// One item per Telegram update, reduced to what the handler needs, plus the next offset to confirm them.
const res = $json;
const updates = Array.isArray(res.result) ? res.result : [];
if (!updates.length) return [];
const next = Math.max(...updates.map(u => Number(u.update_id) || 0)) + 1;
const out = [];
for (const u of updates) {
  const cb = u.callback_query;
  const msg = cb ? cb.message : u.message;
  if (!msg && !cb) continue;
  const from = cb ? cb.from : msg.from || {};
  out.push({ json: {
    update_id: u.update_id,
    next_offset: String(next),
    kind: cb ? 'callback' : 'message',
    from_id: String(from.id || ''),
    first_name: from.first_name || '',
    chat_id: String((msg && msg.chat && msg.chat.id) || from.id || ''),
    chat_type: (msg && msg.chat && msg.chat.type) || '',
    message_id: msg ? msg.message_id : 0,
    reply_to_id: (!cb && msg && msg.reply_to_message) ? msg.reply_to_message.message_id : 0,
    text: (!cb && msg) ? String(msg.text || msg.caption || '') : '',
    data: cb ? String(cb.data || '') : '',
    callback_id: cb ? String(cb.id) : ''
  } });
}
// Updates nobody handles (e.g. channel posts) are still confirmed through next_offset.
if (!out.length) out.push({ json: { next_offset: String(next), kind: 'none' } });
return out;
