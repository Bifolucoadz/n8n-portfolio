// The agent's prompt: today's date, the conversation so far and the new message.
// @include lib-kettle.js
const b = $('Chat Request').first().json.body || {};
const session = String(b.session_id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
const message = String(b.message || '').trim().slice(0, 1000);
const history = $('Read History').all().map(i => i.json).filter(m => m && m.text).sort((a, c) => String(a.at).localeCompare(String(c.at))).slice(-12);
const convo = history.map(m => (m.role === 'user' ? 'Customer: ' : 'Assistant: ') + m.text).join('\n');
const now = DateTime.now().setZone(TZ);
return [{ json: {
  ok: !!(session && message), session_id: session, message, at: now.toISO(),
  prompt: 'Today is ' + now.toFormat('cccc d LLLL yyyy') + ' (Pacific time).\n\n' + (convo ? 'Conversation so far:\n' + convo + '\n\n' : '') + 'Customer: ' + message
} }];
