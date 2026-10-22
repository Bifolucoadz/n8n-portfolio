// The weekly message for the owner, and the three suggested topics as new calendar rows.
const g = $('Gather Week').first().json;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

let ideas = [];
try {
  const msg = ($json.output || []).find(o => o.type === 'message') || ($json.output || [])[0] || {};
  const c = (msg.content || []).find(x => x.type === 'output_text') || (msg.content || [])[0] || {};
  const parsed = typeof c.text === 'string' ? JSON.parse(c.text) : c.text;
  ideas = (parsed.ideas || []).filter(i => i && i.topic).slice(0, 3);
} catch (e) {
  ideas = [];
}
const used = new Set(g.used_ids);
const suggestions = ideas.map(i => {
  let id;
  do { id = 'P-' + Math.random().toString(36).slice(2, 7).toUpperCase(); } while (used.has(id));
  used.add(id);
  return { post_id: id, topic: String(i.topic).trim().slice(0, 300), notes: String(i.notes || '').trim().slice(0, 600), status: 'suggested', updated_at: g.now_text };
});

const L = ['📊 <b>Weekly report</b> · ' + esc(g.range) + (g.test_mode ? ' · 🧪 test mode' : '')];
L.push('');
L.push('<b>Last 7 days</b>: ' + (g.last.length ? g.last.length + ' post' + (g.last.length > 1 ? 's' : '') : 'nothing went out'));
for (const p of g.last) {
  const links = [['LinkedIn', p.linkedin_url], ['Telegram', p.telegram_url]]
    .filter(([, u]) => /^https?:/.test(u)).map(([n, u]) => '<a href="' + esc(u) + '">' + n + '</a>').join(' ');
  L.push('• ' + p.day + ' · ' + esc(cut(p.topic, 60)) + (links ? ' · ' + links : '') + (p.status === 'test_posted' ? ' (test)' : p.status === 'partial' ? ' (partly)' : ''));
}

if (g.problems.length) {
  L.push('');
  L.push('<b>Needs attention</b>');
  for (const p of g.problems) L.push('• <code>' + esc(p.post_id) + '</code> ' + p.status + ': ' + esc(cut(p.topic, 50)) + (p.error ? ' – ' + esc(p.error) : ''));
}
if (g.waiting) L.push('\n⏳ ' + g.waiting + ' draft' + (g.waiting > 1 ? 's are' : ' is') + ' waiting for your approval.');

L.push('');
L.push('<b>Next 7 days</b>');
if (g.next.length) for (const p of g.next) L.push('• ' + p.when + ' · ' + p.status + ' · ' + esc(cut(p.topic, 60)));
else L.push('Nothing scheduled.');
if (g.empty.length) L.push('Empty slots: ' + g.empty.join(', ') + '. Add a topic with /idea or /use one below.');
L.push('Backlog: ' + g.backlog + ' idea' + (g.backlog === 1 ? '' : 's') + ' waiting for a later slot' + (g.suggested ? ', ' + g.suggested + ' older suggestion' + (g.suggested === 1 ? '' : 's') : '') + '.');

if (suggestions.length) {
  L.push('');
  L.push('💡 <b>New ideas</b> (in the sheet as <i>suggested</i>)');
  for (const s of suggestions) L.push('• <code>/use ' + s.post_id + '</code> ' + esc(s.topic));
}

return [{ json: { report: L.join('\n').slice(0, 4000), approver: g.approver, suggestions } }];
