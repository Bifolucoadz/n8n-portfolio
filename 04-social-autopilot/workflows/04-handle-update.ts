import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1yAp5Z0eIMMvYO9DDx_Gtb_4CCNquU5vxNWaLH-WCzN8' };
const CAL_TAB = { __rl: true, mode: 'id', value: '0', cachedResultName: 'Calendar' };
const SETTINGS_TAB = { __rl: true, mode: 'id', value: '1', cachedResultName: 'Settings' };
const STATE_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const DRAFT_WF = { __rl: true, mode: 'id', value: 'Pw338SAVybgIkdmI', cachedResultName: 'Social Autopilot 5: Draft Post' };
const PUBLISH_WF = { __rl: true, mode: 'id', value: '3bhvmihQquHwukP6', cachedResultName: 'Social Autopilot 6: Publish Post' };
const CAL_SCHEMA = [
          { id: 'post_id', displayName: 'post_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'publish_at', displayName: 'publish_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'topic', displayName: 'topic', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'link', displayName: 'link', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'image', displayName: 'image', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'platforms', displayName: 'platforms', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'linkedin_text', displayName: 'linkedin_text', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'telegram_text', displayName: 'telegram_text', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'image_link', displayName: 'image_link', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'linkedin_url', displayName: 'linkedin_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'telegram_url', displayName: 'telegram_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'error', displayName: 'error', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'drafted_at', displayName: 'drafted_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'approved_at', displayName: 'approved_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'posted_at', displayName: 'posted_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'feedback', displayName: 'feedback', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'image_file_id', displayName: 'image_file_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'preview_message_id', displayName: 'preview_message_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'reminded_at', displayName: 'reminded_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'attempts', displayName: 'attempts', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
];
const COND_OPTS = { caseSensitive: true, leftValue: '', typeValidation: 'loose' };
const BOOL_TRUE = { type: 'boolean', operation: 'true', singleValue: true };
const D = "$('Decide').first().json";

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'When Called', position: [240, 560], parameters: { inputSource: 'passthrough' } },
  output: [{ update_id: 1, kind: 'callback', from_id: '123456', chat_id: '123456', chat_type: 'private', message_id: 11, reply_to_id: 0, text: '', data: 'ap:P-TEST1', callback_id: '99' }]
});

const readState = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read State', position: [460, 560], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: STATE_TABLE, returnAll: true } },
  output: [{ key: 'approver_chat_id', value: '123456' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Settings',
    position: [680, 560],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: SETTINGS_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, key: 'mode', value: 'test' }]
});

const readCalendar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Calendar',
    position: [900, 560],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: CAL_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, post_id: 'P-TEST1', topic: 'Why small businesses lose leads', status: 'in_review', preview_message_id: '11' }]
});

const decide = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Decide',
    position: [1120, 560],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What to do with one Telegram update: the replies to send, the row to change and the workflow to start.\n' +
        'const u = $(\'When Called\').first().json;\n' +
        'const S = Object.fromEntries($(\'Read Settings\').all().map(i => [String(i.json.key || \'\').trim(), String(i.json.value ?? \'\').trim()]));\n' +
        'const state = Object.fromEntries($(\'Read State\').all().map(i => [String(i.json.key), String(i.json.value ?? \'\')]));\n' +
        'const rows = $(\'Read Calendar\').all().map(i => i.json).filter(r => String(r.topic || \'\').trim());\n' +
        'const tz = S.timezone || \'Africa/Lagos\';\n' +
        'const now = DateTime.now().setZone(tz);\n' +
        'const nowText = now.toFormat(\'yyyy-MM-dd HH:mm\');\n' +
        'const approver = state.approver_chat_id || \'\';\n' +
        'const esc = s => String(s ?? \'\').replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\');\n' +
        '\n' +
        'const out = { answer: null, edit: null, reply: null, row: null, new_row: null, claim: \'\', next: \'none\', post_id: \'\', feedback: \'\', approver };\n' +
        'const done = () => [{ json: out }];\n' +
        'if (u.kind === \'none\') return [];\n' +
        '\n' +
        'const HELP = [\n' +
        '  \'<b>Social Autopilot</b>\',\n' +
        '  \'On a draft: ✅ Approve · ✏️ Rewrite (a fresh take) · 🚀 Post now · 🗑 Reject.\',\n' +
        '  \'Reply to a draft with what to change (e.g. "shorter, mention booking") and I\\\'ll rewrite it.\',\n' +
        '  \'\',\n' +
        '  \'/queue – what\\\'s coming up\',\n' +
        '  \'/idea &lt;topic&gt; – add a topic to the calendar\',\n' +
        '  \'/use &lt;post_id&gt; – turn a suggested topic into an idea\',\n' +
        '  \'/help – this message\'\n' +
        '].join(\'\\n\');\n' +
        '\n' +
        'function parseWhen(v) {\n' +
        '  if (v === \'\' || v === null || v === undefined) return null;\n' +
        '  if (typeof v === \'number\') return DateTime.fromMillis(Math.round((v - 25569) * 86400000), { zone: \'UTC\' }).setZone(tz, { keepLocalTime: true });\n' +
        '  const s = String(v).trim().replace(\'T\', \' \');\n' +
        '  for (const f of [\'yyyy-MM-dd HH:mm\', \'yyyy-MM-dd H:mm\', \'yyyy-MM-dd HH:mm:ss\', \'yyyy-MM-dd\']) {\n' +
        '    const d = DateTime.fromFormat(s, f, { zone: tz });\n' +
        '    if (d.isValid) return d;\n' +
        '  }\n' +
        '  return null;\n' +
        '}\n' +
        'const whenLabel = r => { const w = parseWhen(r.publish_at); return w ? w.toFormat(\'ccc d LLL, HH:mm\') : \'no date yet\'; };\n' +
        'const byId = id => rows.find(r => String(r.post_id || \'\').trim().toUpperCase() === String(id || \'\').trim().toUpperCase());\n' +
        'const status = r => String(r.status || \'\').trim().toLowerCase();\n' +
        'const reply = (text, replyTo) => { out.reply = { chat: approver || u.chat_id, text, reply_to: replyTo || 0 }; };\n' +
        '\n' +
        '// ---- nobody has claimed the bot yet: the first /start in a private chat becomes the approver\n' +
        'if (!approver) {\n' +
        '  if (u.kind === \'message\' && u.chat_type === \'private\' && /^\\/start\\b/i.test(u.text)) {\n' +
        '    out.claim = u.chat_id;\n' +
        '    out.reply = { chat: u.chat_id, text: \'👋 Hi \' + esc(u.first_name) + \', you\\\'re now the approver for Social Autopilot. Drafts arrive here for you to approve.\\n\\n\' + HELP, reply_to: 0 };\n' +
        '  } else if (u.kind === \'message\' && u.chat_type === \'private\') {\n' +
        '    out.reply = { chat: u.chat_id, text: \'Send /start to become the approver for this bot.\', reply_to: 0 };\n' +
        '  }\n' +
        '  return done();\n' +
        '}\n' +
        '\n' +
        '// ---- only the approver can do anything\n' +
        'if (u.from_id !== approver) {\n' +
        '  if (u.kind === \'callback\') out.answer = { id: u.callback_id, text: \'Only the owner can do that.\' };\n' +
        '  else if (u.chat_type === \'private\') out.reply = { chat: u.chat_id, text: \'This is a private bot.\', reply_to: 0 };\n' +
        '  return done();\n' +
        '}\n' +
        '\n' +
        '// ---- buttons\n' +
        'if (u.kind === \'callback\') {\n' +
        '  const [action, id] = u.data.split(\':\');\n' +
        '  const r = byId(id);\n' +
        '  out.post_id = id || \'\';\n' +
        '  if (!r) { out.answer = { id: u.callback_id, text: \'I can\\\'t find \' + id + \' in the sheet any more.\' }; return done(); }\n' +
        '  const st = status(r);\n' +
        '  const head = \'<code>\' + esc(r.post_id) + \'</code> · <i>\' + esc(r.topic) + \'</i>\';\n' +
        '  const isPreview = [\'ap\', \'rw\', \'pn\', \'rj\'].includes(action);\n' +
        '  if (isPreview && String(r.preview_message_id || \'\') && String(r.preview_message_id) !== String(u.message_id)) {\n' +
        '    out.answer = { id: u.callback_id, text: \'This is an old version of the draft. Use the newest one.\', show_alert: true };\n' +
        '    return done();\n' +
        '  }\n' +
        '  if (action === \'ap\') {\n' +
        '    if (st !== \'in_review\') { out.answer = { id: u.callback_id, text: \'It\\\'s \' + st + \' now, nothing to approve.\' }; return done(); }\n' +
        '    const when = parseWhen(r.publish_at);\n' +
        '    const late = !when || when <= now;\n' +
        '    out.row = { post_id: r.post_id, status: \'approved\', approved_at: nowText, updated_at: nowText };\n' +
        '    if (!when) out.row.publish_at = nowText;\n' +
        '    out.edit = { message_id: u.message_id, text: \'✅ <b>Approved</b> · \' + head + \'\\n\' + (late ? \'Goes out within 5 minutes.\' : \'Goes out \' + whenLabel(r) + \'.\') + \'\\n\\n\' + esc(String(r.linkedin_text || r.telegram_text || \'\').slice(0, 600)) + (String(r.linkedin_text || \'\').length > 600 ? \'…\' : \'\') };\n' +
        '    out.answer = { id: u.callback_id, text: \'Approved\' };\n' +
        '  } else if (action === \'pn\') {\n' +
        '    if (![\'in_review\', \'approved\'].includes(st)) { out.answer = { id: u.callback_id, text: \'It\\\'s \' + st + \' now, so it can\\\'t be posted.\' }; return done(); }\n' +
        '    out.row = { post_id: r.post_id, status: \'publishing\', publish_at: nowText, approved_at: String(r.approved_at || \'\') || nowText, updated_at: nowText };\n' +
        '    out.next = \'publish\';\n' +
        '    out.edit = { message_id: u.message_id, text: \'🚀 <b>Posting now</b> · \' + head };\n' +
        '    out.answer = { id: u.callback_id, text: \'Posting now\' };\n' +
        '  } else if (action === \'rj\') {\n' +
        '    if ([\'posted\', \'publishing\'].includes(st)) { out.answer = { id: u.callback_id, text: \'It\\\'s already \' + st + \'.\' }; return done(); }\n' +
        '    out.row = { post_id: r.post_id, status: \'rejected\', updated_at: nowText };\n' +
        '    out.edit = { message_id: u.message_id, text: \'🗑 <b>Rejected</b> · \' + head + \'\\nSet its status back to idea in the sheet if you want a new draft later.\' };\n' +
        '    out.answer = { id: u.callback_id, text: \'Rejected\' };\n' +
        '  } else if (action === \'rw\') {\n' +
        '    if (![\'in_review\', \'approved\'].includes(st)) { out.answer = { id: u.callback_id, text: \'It\\\'s \' + st + \' now, so it can\\\'t be rewritten.\' }; return done(); }\n' +
        '    out.row = { post_id: r.post_id, status: \'drafting\', feedback: \'fresh take\', updated_at: nowText };\n' +
        '    out.next = \'draft\';\n' +
        '    out.feedback = \'fresh take\';\n' +
        '    out.edit = { message_id: u.message_id, text: \'↻ <b>Rewriting</b> · \' + head + \'\\nThe new version arrives in about a minute.\' };\n' +
        '    out.answer = { id: u.callback_id, text: \'Rewriting…\' };\n' +
        '  } else if (action === \'rt\') {\n' +
        '    if (![\'failed\', \'partial\'].includes(st)) { out.answer = { id: u.callback_id, text: \'It\\\'s \' + st + \' now, nothing to retry.\' }; return done(); }\n' +
        '    out.row = { post_id: r.post_id, status: \'publishing\', updated_at: nowText };\n' +
        '    out.next = \'publish\';\n' +
        '    out.edit = { message_id: u.message_id, text: \'🔁 <b>Retrying</b> · \' + head + \'\\nOnly the platforms that failed are tried again.\' };\n' +
        '    out.answer = { id: u.callback_id, text: \'Retrying\' };\n' +
        '  } else {\n' +
        '    out.answer = { id: u.callback_id, text: \'\' };\n' +
        '  }\n' +
        '  return done();\n' +
        '}\n' +
        '\n' +
        '// ---- messages from the approver\n' +
        'const text = String(u.text || \'\').trim();\n' +
        'if (!text) return done();\n' +
        '\n' +
        'const rewrite = (r, note) => {\n' +
        '  const st = status(r);\n' +
        '  if (![\'in_review\', \'approved\'].includes(st)) { reply(\'<code>\' + esc(r.post_id) + \'</code> is \' + esc(st) + \' now, so I can\\\'t change it.\', u.message_id); return; }\n' +
        '  out.row = { post_id: r.post_id, status: \'drafting\', feedback: note, updated_at: nowText };\n' +
        '  out.next = \'draft\';\n' +
        '  out.post_id = r.post_id;\n' +
        '  out.feedback = note;\n' +
        '  reply(\'✍️ Rewriting <code>\' + esc(r.post_id) + \'</code> with your note. The new version arrives in about a minute.\', u.message_id);\n' +
        '};\n' +
        '\n' +
        'if (u.reply_to_id) {\n' +
        '  const r = rows.find(x => String(x.preview_message_id || \'\') === String(u.reply_to_id));\n' +
        '  if (r) { rewrite(r, text.slice(0, 500)); return done(); }\n' +
        '}\n' +
        '\n' +
        'const cmd = (text.match(/^\\/(\\w+)(?:@\\w+)?\\s*([\\s\\S]*)$/) || []);\n' +
        'const name = (cmd[1] || \'\').toLowerCase();\n' +
        'const arg = (cmd[2] || \'\').trim();\n' +
        '\n' +
        'if (name === \'start\' || name === \'help\') {\n' +
        '  reply((name === \'start\' ? \'You\\\'re the approver already.\\n\\n\' : \'\') + HELP);\n' +
        '} else if (name === \'queue\') {\n' +
        '  const live = [\'idea\', \'drafting\', \'in_review\', \'approved\', \'publishing\', \'partial\', \'failed\', \'needs_fix\'];\n' +
        '  const upcoming = rows\n' +
        '    .filter(r => live.includes(status(r)))\n' +
        '    .sort((a, b) => String(a.publish_at || \'9999\').localeCompare(String(b.publish_at || \'9999\')))\n' +
        '    .slice(0, 12);\n' +
        '  const lines = upcoming.map(r => \'• \' + whenLabel(r) + \' · \' + status(r) + \' · <code>\' + esc(r.post_id || \'new\') + \'</code> \' + esc(String(r.topic).slice(0, 70)));\n' +
        '  const suggested = rows.filter(r => status(r) === \'suggested\').length;\n' +
        '  reply(\'<b>Coming up</b> (\' + (/^live$/i.test(S.mode || \'\') ? \'live\' : \'test mode\') + \')\\n\' + (lines.join(\'\\n\') || \'Nothing scheduled. Add topics with /idea.\') + (suggested ? \'\\n\\n\' + suggested + \' suggested topic(s) in the sheet; /use &lt;post_id&gt; to schedule one.\' : \'\'));\n' +
        '} else if (name === \'idea\') {\n' +
        '  if (!arg) { reply(\'Write the topic after the command, e.g. <code>/idea Why follow-up emails win deals</code>\'); return done(); }\n' +
        '  const used = new Set(rows.map(r => String(r.post_id || \'\')));\n' +
        '  let id;\n' +
        '  do { id = \'P-\' + Math.random().toString(36).slice(2, 7).toUpperCase(); } while (used.has(id));\n' +
        '  out.new_row = { post_id: id, topic: arg.slice(0, 300), status: \'idea\', updated_at: nowText };\n' +
        '  reply(\'📝 Added <code>\' + id + \'</code>: <i>\' + esc(arg.slice(0, 300)) + \'</i>\\nIt gets the next free slot, and the draft reaches you about \' + (S.draft_hours_ahead || \'48\') + \' hours before it goes out.\');\n' +
        '} else if (name === \'use\') {\n' +
        '  const r = byId(arg);\n' +
        '  if (!r) reply(\'I can\\\'t find <code>\' + esc(arg) + \'</code>. Use the ID from the weekly report.\');\n' +
        '  else if (status(r) !== \'suggested\') reply(\'<code>\' + esc(r.post_id) + \'</code> is \' + esc(status(r)) + \', not suggested.\');\n' +
        '  else {\n' +
        '    out.row = { post_id: r.post_id, status: \'idea\', updated_at: nowText };\n' +
        '    reply(\'👍 <code>\' + esc(r.post_id) + \'</code> is now an idea and gets the next free slot.\');\n' +
        '  }\n' +
        '} else if (name) {\n' +
        '  reply(\'I don\\\'t know /\' + esc(name) + \'.\\n\\n\' + HELP);\n' +
        '} else {\n' +
        '  const waiting = rows.filter(r => status(r) === \'in_review\');\n' +
        '  if (waiting.length === 1) rewrite(waiting[0], text.slice(0, 500));\n' +
        '  else if (waiting.length > 1) reply(\'Several drafts are waiting. Reply to the one you want to change (swipe left on it), or use /queue.\', u.message_id);\n' +
        '  else reply(HELP);\n' +
        '}\n' +
        'return done();\n'
    }
  },
  output: [{ answer: { id: '99', text: 'Approved' }, edit: { message_id: 11, text: 'Approved' }, reply: null, row: { post_id: 'P-TEST1', status: 'approved' }, new_row: null, claim: '', next: 'none', post_id: 'P-TEST1', feedback: '', approver: '123456' }]
});

const hasAnswer = ifElse({
  version: 2.2,
  config: { name: 'Answer Button?', position: [1340, 80], parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ !!$json.answer }}'), operator: BOOL_TRUE }], combinator: 'and' } } }
});

const answerButton = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Answer Button',
    position: [1560, 80],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'callback',
      operation: 'answerQuery',
      queryId: expr('{{ ' + D + '.answer.id }}'),
      additionalFields: { text: expr('{{ ' + D + '.answer.text }}'), show_alert: expr('{{ !!' + D + '.answer.show_alert }}') }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const hasEdit = ifElse({
  version: 2.2,
  config: { name: 'Edit Message?', position: [1340, 280], parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ !!$json.edit }}'), operator: BOOL_TRUE }], combinator: 'and' } } }
});

const keepButtons = ifElse({
  version: 2.2,
  config: { name: 'Approved?', position: [1560, 280], parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr("{{ $json.row ? $json.row.status === 'approved' : false }}"), operator: BOOL_TRUE }], combinator: 'and' } } }
});

const editApproved = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Show Approved',
    position: [1780, 200],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'editMessageText',
      messageType: 'message',
      chatId: expr('{{ ' + D + '.approver }}'),
      messageId: expr('{{ ' + D + '.edit.message_id }}'),
      text: expr('{{ ' + D + '.edit.text }}'),
      replyMarkup: 'inlineKeyboard',
      inlineKeyboard: { rows: [{ row: { buttons: [
        { text: '🚀 Post now', additionalFields: { callback_data: expr('pn:{{ ' + D + '.post_id }}') } },
        { text: '🗑 Cancel', additionalFields: { callback_data: expr('rj:{{ ' + D + '.post_id }}') } }
      ] } }] },
      additionalFields: { parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const editMessage = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Update Message',
    position: [1780, 360],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'editMessageText',
      messageType: 'message',
      chatId: expr('{{ ' + D + '.approver }}'),
      messageId: expr('{{ ' + D + '.edit.message_id }}'),
      text: expr('{{ ' + D + '.edit.text }}'),
      replyMarkup: 'none',
      additionalFields: { parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const hasReply = ifElse({
  version: 2.2,
  config: { name: 'Reply?', position: [1340, 520], parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ !!$json.reply }}'), operator: BOOL_TRUE }], combinator: 'and' } } }
});

const sendReply = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Reply',
    position: [1560, 520],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ ' + D + '.reply.chat }}'),
      text: expr('{{ ' + D + '.reply.text }}'),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true, reply_to_message_id: expr('{{ ' + D + '.reply.reply_to || 0 }}') }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const hasClaim = ifElse({
  version: 2.2,
  config: { name: 'New Approver?', position: [1340, 720], parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ $json.claim }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } } }
});

const saveApprover = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Approver',
    position: [1560, 720],
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: STATE_TABLE,
      filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'approver_chat_id' }] },
      columns: { mappingMode: 'defineBelow', value: { key: 'approver_chat_id', value: expr('{{ ' + D + '.claim }}') }, schema: [
        { id: 'key', displayName: 'key', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'value', displayName: 'value', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ key: 'approver_chat_id', value: '123456' }]
});

const hasIdea = ifElse({
  version: 2.2,
  config: { name: 'New Idea?', position: [1340, 900], parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ !!$json.new_row }}'), operator: BOOL_TRUE }], combinator: 'and' } } }
});

const ideaRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Idea Row', position: [1560, 900], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The new calendar row from /idea.\n' +
        'return [{ json: $(\'Decide\').first().json.new_row }];\n'
  } },
  output: [{ post_id: 'P-ABCDE', topic: 'New idea', status: 'idea' }]
});

const addIdea = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add To Calendar',
    position: [1780, 900],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'append', documentId: SHEET_DOC, sheetName: CAL_TAB, columns: { mappingMode: 'autoMapInputData', value: {}, schema: CAL_SCHEMA }, options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' } },
    credentials: SHEETS_CRED
  },
  output: [{ post_id: 'P-ABCDE' }]
});

const hasRow = ifElse({
  version: 2.2,
  config: { name: 'Change Row?', position: [1340, 1080], parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ !!$json.row }}'), operator: BOOL_TRUE }], combinator: 'and' } } }
});

const rowUpdate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Row Update', position: [1560, 1080], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The sheet change decided above, as one flat row.\n' +
        'return [{ json: $(\'Decide\').first().json.row }];\n'
  } },
  output: [{ post_id: 'P-TEST1', status: 'approved' }]
});

const saveRow = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Save Row',
    position: [1780, 1080],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'update', documentId: SHEET_DOC, sheetName: CAL_TAB, columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['post_id'], schema: CAL_SCHEMA }, options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' } },
    credentials: SHEETS_CRED
  },
  output: [{ post_id: 'P-TEST1' }]
});

const nextStep = switchCase({
  version: 3.2,
  config: {
    name: 'Next Step',
    position: [2000, 1080],
    parameters: {
      rules: { values: [
        { outputKey: 'draft', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ ' + D + '.next }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'draft' }], combinator: 'and' } },
        { outputKey: 'publish', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ ' + D + '.next }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'publish' }], combinator: 'and' } }
      ] },
      options: {}
    }
  }
});

const startDraft = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Start Draft',
    position: [2220, 1000],
    parameters: {
      mode: 'each',
      source: 'database',
      workflowId: DRAFT_WF,
      workflowInputs: { mappingMode: 'defineBelow', value: { post_id: expr('{{ ' + D + '.post_id }}'), feedback: expr('{{ ' + D + '.feedback }}') }, schema: [
        { id: 'post_id', displayName: 'post_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        { id: 'feedback', displayName: 'feedback', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { waitForSubWorkflow: false }
    }
  },
  output: [{}]
});

const startPublish = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Start Publish',
    position: [2220, 1160],
    parameters: {
      mode: 'each',
      source: 'database',
      workflowId: PUBLISH_WF,
      workflowInputs: { mappingMode: 'defineBelow', value: { post_id: expr('{{ ' + D + '.post_id }}') }, schema: [
        { id: 'post_id', displayName: 'post_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { waitForSubWorkflow: false }
    }
  },
  output: [{}]
});

const note = sticky(
  '## Handle Telegram Update\n' +
  'Started by the Listener for every button tap or message. **Decide** works out everything in one place:\n\n' +
  '- Only the approver (from the data table) can act. The first `/start` in a private chat claims the bot.\n' +
  '- Buttons on a draft: Approve, Rewrite, Post now, Reject. On a failure: Retry. Old previews are refused.\n' +
  '- A reply to a draft = change request: the row goes back to `drafting` and Draft Post rewrites it with your note.\n' +
  '- Commands: `/queue`, `/idea <topic>`, `/use <post_id>`, `/help`.\n\n' +
  'The row is saved before Draft or Publish starts, so they see the new status.',
  [], { position: [200, 120], width: 860, height: 330, color: 4 }
);

export default workflow('social-autopilot-handle-update', 'Social Autopilot 4: Handle Telegram Update')
  .add(whenCalled)
  .to(readState)
  .to(readSettings)
  .to(readCalendar)
  .to(decide)
  .to(hasAnswer.onTrue(answerButton))
  .add(decide.to(hasEdit.onTrue(keepButtons.onTrue(editApproved).onFalse(editMessage))))
  .add(decide.to(hasReply.onTrue(sendReply)))
  .add(decide.to(hasClaim.onTrue(saveApprover)))
  .add(decide.to(hasIdea.onTrue(ideaRow.to(addIdea))))
  .add(decide.to(hasRow.onTrue(rowUpdate.to(saveRow.to(nextStep
    .onCase(0, startDraft)
    .onCase(1, startPublish))))))
  .add(note);
