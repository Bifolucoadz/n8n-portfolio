// node workflows/test/logic.test.js : scenario checks for Plan Work (Clock) and Decide (handler).
const { run, DateTime } = require('./harness');
const assert = require('assert');
const tz = 'Africa/Lagos';
const now = DateTime.now().setZone(tz);
const fmt = d => d.toFormat('yyyy-MM-dd HH:mm');
const settings = [
  ['post_days', 'Mon, Wed, Fri'], ['post_time', '09:00'], ['timezone', tz], ['draft_hours_ahead', '48'], ['mode', 'test'], ['require_approval', 'yes']
].map(([key, value]) => ({ key, value }));
const state = a => [{ key: 'approver_chat_id', value: a }, { key: 'telegram_offset', value: '0' }];
let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; };

(async () => {
  // ---- Clock
  const rows = [
    { row_number: 2, post_id: '', topic: 'A', status: 'idea', publish_at: '' },
    { row_number: 3, post_id: 'P-B', topic: 'B', status: 'idea', publish_at: fmt(now.plus({ hours: 10 })) },
    { row_number: 4, post_id: 'P-C', topic: 'C', status: 'idea', publish_at: 'next tuesday' },
    { row_number: 5, post_id: 'P-D', topic: 'D', status: 'approved', publish_at: fmt(now.minus({ minutes: 2 })) },
    { row_number: 6, post_id: 'P-E', topic: 'E', status: 'in_review', publish_at: fmt(now.minus({ minutes: 1 })), preview_message_id: '77', reminded_at: '' },
    { row_number: 7, post_id: 'P-F', topic: 'F', status: 'drafting', updated_at: fmt(now.minus({ minutes: 45 })), attempts: '2' },
    { row_number: 8, post_id: 'P-G', topic: 'G', status: 'publishing', updated_at: fmt(now.minus({ minutes: 40 })) },
    { row_number: 9, post_id: 'P-H', topic: 'H', status: 'idea', publish_at: fmt(now.plus({ days: 20 })) },
    { row_number: 10, post_id: '', topic: '', status: '' },
    { row_number: 11, post_id: 'P-J', topic: 'J', status: 'posted', publish_at: fmt(now.minus({ days: 2 })) }
  ];
  const out = await run('02-plan-work.js', { 'Read Settings': settings, 'Read State': state('42'), 'Read Calendar': rows });
  const by = (k, f) => out.map(i => i.json).filter(j => j.kind === k && (!f || f(j)));
  const upd = n => by('update', j => j.row_number === n)[0];
  ok(out.findIndex(i => i.json.kind !== 'update') > out.map(i => i.json.kind).lastIndexOf('update'), 'updates come first');
  ok(upd(2) && /^P-[A-Z0-9]{5}$/.test(upd(2).post_id) && upd(2).publish_at, 'new row gets id and slot');
  const slot = DateTime.fromFormat(upd(2).publish_at, 'yyyy-MM-dd HH:mm', { zone: tz });
  ok([1, 3, 5].includes(slot.weekday) && slot.hour === 9 && slot > now, 'slot is a future Mon/Wed/Fri 09:00');
  ok(upd(3).status === 'drafting' && by('draft', j => j.post_id === 'P-B').length === 1, 'due idea starts drafting');
  ok(upd(4).status === 'needs_fix', 'bad date flagged');
  ok(upd(5).status === 'publishing' && by('publish', j => j.post_id === 'P-D').length === 1, 'due approved post publishes');
  ok(upd(6).reminded_at && by('remind', j => j.reply_to === 77).length === 1, 'late in_review gets one reminder');
  ok(upd(7).status === 'needs_fix' && upd(7).attempts === '3', 'stuck drafting gives up after 3');
  ok(upd(8).status === 'failed' && by('remind').length === 2, 'stuck publishing marked failed with a message');
  ok(!upd(9) && !upd(10) && !upd(11), 'far-off, empty and posted rows untouched');
  const again = await run('02-plan-work.js', { 'Read Settings': settings, 'Read State': state('42'), 'Read Calendar': rows.map(r => r.row_number === 6 ? { ...r, reminded_at: 'x' } : r) });
  ok(again.filter(i => i.json.kind === 'remind').length === 1, 'reminder not repeated');

  // ---- Handler
  const cal = [
    { post_id: 'P-TEST1', topic: 'Leads', status: 'in_review', publish_at: fmt(now.plus({ days: 1 })), preview_message_id: '11', linkedin_text: 'Hello <b>' },
    { post_id: 'P-OLD', topic: 'Old', status: 'posted', preview_message_id: '5' },
    { post_id: 'P-FAIL', topic: 'Fail', status: 'partial', preview_message_id: '20' },
    { post_id: 'P-SUG', topic: 'Suggested one', status: 'suggested' }
  ];
  const decide = async (update, approver = '42', calendar = cal) => (await run('04-decide.js', {
    'When Called': [update], 'Read Settings': settings, 'Read State': state(approver), 'Read Calendar': calendar
  }))[0].json;
  const cb = (data, message_id = 11, from = '42') => ({ kind: 'callback', from_id: from, chat_id: from, chat_type: 'private', message_id, data, callback_id: 'q1', text: '', reply_to_id: 0 });
  const msg = (text, reply_to_id = 0, from = '42') => ({ kind: 'message', from_id: from, chat_id: from, chat_type: 'private', message_id: 50, text, reply_to_id, first_name: 'Sam' });

  let d = await decide(msg('/start'), '');
  ok(d.claim === '42' && /approver/.test(d.reply.text), '/start claims an unclaimed bot');
  d = await decide(msg('hi'), '');
  ok(!d.claim && /\/start/.test(d.reply.text), 'other messages before claiming ask for /start');
  d = await decide(cb('ap:P-TEST1', 11, '99'));
  ok(!d.row && /owner/.test(d.answer.text), 'strangers cannot approve');
  d = await decide(cb('ap:P-TEST1'));
  ok(d.row.status === 'approved' && d.edit.message_id === 11 && d.answer.text === 'Approved' && d.next === 'none', 'approve');
  ok(d.edit.text.includes('&lt;b&gt;'), 'post text is escaped in the edited message');
  d = await decide(cb('ap:P-TEST1', 10));
  ok(!d.row && d.answer.show_alert, 'old preview refused');
  d = await decide(cb('pn:P-TEST1'));
  ok(d.row.status === 'publishing' && d.next === 'publish' && d.post_id === 'P-TEST1', 'post now');
  d = await decide(cb('rw:P-TEST1'));
  ok(d.row.status === 'drafting' && d.next === 'draft' && d.feedback === 'fresh take', 'rewrite button');
  d = await decide(cb('rj:P-TEST1'));
  ok(d.row.status === 'rejected', 'reject');
  d = await decide(cb('rj:P-OLD', 5));
  ok(!d.row, 'cannot reject a posted post');
  d = await decide(cb('rt:P-FAIL', 99));
  ok(d.row.status === 'publishing' && d.next === 'publish', 'retry after partial');
  d = await decide(msg('make it shorter', 11));
  ok(d.row.status === 'drafting' && d.feedback === 'make it shorter' && d.next === 'draft', 'reply to preview = rewrite with note');
  d = await decide(msg('shorter please'));
  ok(d.next === 'draft' && d.post_id === 'P-TEST1', 'plain message goes to the only draft in review');
  d = await decide(msg('/idea Why follow-ups matter'));
  ok(d.new_row && d.new_row.status === 'idea' && d.new_row.topic === 'Why follow-ups matter', '/idea adds a row');
  d = await decide(msg('/use P-SUG'));
  ok(d.row && d.row.status === 'idea', '/use promotes a suggestion');
  d = await decide(msg('/queue'));
  ok(/Coming up/.test(d.reply.text) && d.reply.text.includes('P-TEST1') && !d.reply.text.includes('P-OLD'), '/queue lists upcoming only');
  d = await decide(msg('/nope'));
  ok(/don't know/.test(d.reply.text), 'unknown command');
  console.log('all', pass, 'checks passed');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
