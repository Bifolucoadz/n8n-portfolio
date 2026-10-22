import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1yAp5Z0eIMMvYO9DDx_Gtb_4CCNquU5vxNWaLH-WCzN8' };
const CAL_TAB = { __rl: true, mode: 'id', value: '0', cachedResultName: 'Calendar' };
const SETTINGS_TAB = { __rl: true, mode: 'id', value: '1', cachedResultName: 'Settings' };
const STATE_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
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

const everyMonday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Monday 08:00', position: [240, 300], parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 8, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const sendNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Now', position: [240, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Settings',
    position: [480, 400],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: SETTINGS_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, key: 'brand_name', value: 'Samuel Oladele' }]
});

const readCalendar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Calendar',
    position: [700, 400],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: CAL_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, post_id: 'P-TEST1', topic: 'Leads', status: 'posted', posted_at: '2026-10-05 09:01' }]
});

const readState = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read State', position: [920, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: STATE_TABLE, returnAll: true } },
  output: [{ key: 'approver_chat_id', value: '123456' }]
});

const gather = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Gather Week', position: [1140, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Last 7 days, next 7 days and empty slots, plus the brief for the topic ideas.\n' +
        'const S = Object.fromEntries($(\'Read Settings\').all().map(i => [String(i.json.key || \'\').trim(), String(i.json.value ?? \'\').trim()]));\n' +
        'const state = Object.fromEntries($(\'Read State\').all().map(i => [String(i.json.key), String(i.json.value ?? \'\')]));\n' +
        'const rows = $(\'Read Calendar\').all().map(i => i.json).filter(r => String(r.topic || \'\').trim());\n' +
        'const tz = S.timezone || \'Africa/Lagos\';\n' +
        'const now = DateTime.now().setZone(tz);\n' +
        'const status = r => String(r.status || \'\').trim().toLowerCase();\n' +
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
        'const short = d => d.toFormat(\'ccc d LLL\');\n' +
        '\n' +
        'const weekAgo = now.minus({ days: 7 });\n' +
        'const weekAhead = now.plus({ days: 7 });\n' +
        'const posted = rows\n' +
        '  .filter(r => [\'posted\', \'partial\', \'test_posted\'].includes(status(r)))\n' +
        '  .map(r => ({ r, at: parseWhen(r.posted_at) }))\n' +
        '  .filter(x => x.at && x.at >= weekAgo)\n' +
        '  .sort((a, b) => a.at - b.at);\n' +
        '\n' +
        'const last = posted.map(({ r, at }) => ({\n' +
        '  post_id: r.post_id, topic: r.topic, day: short(at), status: status(r),\n' +
        '  linkedin_url: r.linkedin_url || \'\', telegram_url: r.telegram_url || \'\'\n' +
        '}));\n' +
        '\n' +
        'const live = [\'idea\', \'drafting\', \'in_review\', \'approved\', \'publishing\'];\n' +
        'const next = rows\n' +
        '  .map(r => ({ r, when: parseWhen(r.publish_at) }))\n' +
        '  .filter(x => live.includes(status(x.r)) && x.when && x.when >= now && x.when <= weekAhead)\n' +
        '  .sort((a, b) => a.when - b.when)\n' +
        '  .map(({ r, when }) => ({ post_id: r.post_id, topic: r.topic, when: when.toFormat(\'ccc d LLL, HH:mm\'), status: status(r) }));\n' +
        '\n' +
        'const dayNum = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };\n' +
        'let days = String(S.post_days || \'Mon, Wed, Fri\').toLowerCase().split(/[\\s,;]+/).map(d => dayNum[d.slice(0, 3)]).filter(Boolean);\n' +
        'if (!days.length) days = [1, 3, 5];\n' +
        'const [hh, mm] = (String(S.post_time || \'09:00\').match(/^(\\d{1,2}):(\\d{2})/) || [0, \'9\', \'00\']).slice(1).map(Number);\n' +
        'const taken = new Set(rows.filter(r => status(r) !== \'rejected\').map(r => parseWhen(r.publish_at)).filter(Boolean).map(d => d.toFormat(\'yyyy-MM-dd HH:mm\')));\n' +
        'const empty = [];\n' +
        'for (let i = 0; i <= 7; i++) {\n' +
        '  const c = now.startOf(\'day\').plus({ days: i }).set({ hour: hh, minute: mm });\n' +
        '  if (days.includes(c.weekday) && c > now && c <= weekAhead && !taken.has(c.toFormat(\'yyyy-MM-dd HH:mm\'))) empty.push(c.toFormat(\'ccc d LLL, HH:mm\'));\n' +
        '}\n' +
        'const backlog = rows.filter(r => status(r) === \'idea\' && (!parseWhen(r.publish_at) || parseWhen(r.publish_at) > weekAhead)).length;\n' +
        '\n' +
        'const brief = [\n' +
        '  \'BRAND NAME: \' + (S.brand_name || \'\'),\n' +
        '  \'WHAT THEY DO: \' + (S.what_you_do || \'\'),\n' +
        '  \'AUDIENCE: \' + (S.audience || \'\'),\n' +
        '  \'VOICE: \' + (S.voice || \'\'),\n' +
        '  \'FACTS: \' + (S.facts || \'(none)\'),\n' +
        '  \'\',\n' +
        '  \'TOPICS ALREADY IN THE CALENDAR (do not repeat):\',\n' +
        '  rows.map(r => \'- \' + r.topic).join(\'\\n\') || \'(none)\',\n' +
        '  \'\',\n' +
        '  \'LAST WEEK: \' + (last.length ? last.map(x => x.topic).join(\'; \') : \'nothing posted\')\n' +
        '].join(\'\\n\');\n' +
        '\n' +
        'return [{ json: {\n' +
        '  range: weekAgo.toFormat(\'d LLL\') + \' – \' + now.toFormat(\'d LLL\'),\n' +
        '  test_mode: !/^live$/i.test(S.mode || \'test\'),\n' +
        '  last, next, empty, backlog,\n' +
        '  waiting: rows.filter(r => status(r) === \'in_review\').length,\n' +
        '  suggested: rows.filter(r => status(r) === \'suggested\').length,\n' +
        '  problems: rows.filter(r => [\'failed\', \'partial\', \'needs_fix\'].includes(status(r))).map(r => ({ post_id: r.post_id, topic: r.topic, status: status(r), error: String(r.error || \'\').slice(0, 160) })),\n' +
        '  used_ids: rows.map(r => String(r.post_id || \'\')).filter(Boolean),\n' +
        '  now_text: now.toFormat(\'yyyy-MM-dd HH:mm\'),\n' +
        '  approver: state.approver_chat_id || \'\',\n' +
        '  brief\n' +
        '} }];\n'
  } },
  output: [{ range: '30 Sep - 7 Oct', last: [], next: [], empty: [], backlog: 3, waiting: 0, suggested: 0, problems: [], used_ids: [], approver: '123456', brief: 'BRAND NAME: ...' }]
});

const suggest = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Suggest Topics',
    position: [1360, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.5' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.brief }}') }] },
      options: {
        instructions:
        'You suggest social media post topics for one person\'s small business. You get their brand settings, every topic already in their content calendar, and what went out last week.\n' +
        '\n' +
        'Return exactly 3 ideas. Each has:\n' +
        '- topic: one specific line, written the way the owner would put it in their calendar (not a headline full of hype).\n' +
        '- notes: two or three sentences for the writer: the angle, a concrete example or detail to use, and what the reader should take away.\n' +
        '\n' +
        'Rules:\n' +
        '- Only use facts from the FACTS setting and the brief. Never invent clients, results or numbers. Demo projects must be called demos.\n' +
        '- Each idea must be clearly different from every existing topic, and the three should differ from each other in type: for example a practical tip, a demo walkthrough or behind-the-scenes look, and a question or opinion that invites replies.\n' +
        '- Write for the AUDIENCE setting: problems they recognise, in plain words.\n'
        ,
        maxTokens: 3000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'topic_ideas', strict: true, schema:
        '{"type":"object","properties":{"ideas":{"type":"array","items":{"type":"object","properties":{"topic":{"type":"string"},"notes":{"type":"string"}},"required":["topic","notes"],"additionalProperties":false}}},"required":["ideas"],"additionalProperties":false}'
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { ideas: [{ topic: 'a', notes: 'b' }] } }] }] }]
});

const buildReport = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Report', position: [1580, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The weekly message for the owner, and the three suggested topics as new calendar rows.\n' +
        'const g = $(\'Gather Week\').first().json;\n' +
        'const esc = s => String(s ?? \'\').replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\');\n' +
        'const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + \'…\' : String(s));\n' +
        '\n' +
        'let ideas = [];\n' +
        'try {\n' +
        '  const msg = ($json.output || []).find(o => o.type === \'message\') || ($json.output || [])[0] || {};\n' +
        '  const c = (msg.content || []).find(x => x.type === \'output_text\') || (msg.content || [])[0] || {};\n' +
        '  const parsed = typeof c.text === \'string\' ? JSON.parse(c.text) : c.text;\n' +
        '  ideas = (parsed.ideas || []).filter(i => i && i.topic).slice(0, 3);\n' +
        '} catch (e) {\n' +
        '  ideas = [];\n' +
        '}\n' +
        'const used = new Set(g.used_ids);\n' +
        'const suggestions = ideas.map(i => {\n' +
        '  let id;\n' +
        '  do { id = \'P-\' + Math.random().toString(36).slice(2, 7).toUpperCase(); } while (used.has(id));\n' +
        '  used.add(id);\n' +
        '  return { post_id: id, topic: String(i.topic).trim().slice(0, 300), notes: String(i.notes || \'\').trim().slice(0, 600), status: \'suggested\', updated_at: g.now_text };\n' +
        '});\n' +
        '\n' +
        'const L = [\'📊 <b>Weekly report</b> · \' + esc(g.range) + (g.test_mode ? \' · 🧪 test mode\' : \'\')];\n' +
        'L.push(\'\');\n' +
        'L.push(\'<b>Last 7 days</b>: \' + (g.last.length ? g.last.length + \' post\' + (g.last.length > 1 ? \'s\' : \'\') : \'nothing went out\'));\n' +
        'for (const p of g.last) {\n' +
        '  const links = [[\'LinkedIn\', p.linkedin_url], [\'Telegram\', p.telegram_url]]\n' +
        '    .filter(([, u]) => /^https?:/.test(u)).map(([n, u]) => \'<a href="\' + esc(u) + \'">\' + n + \'</a>\').join(\' \');\n' +
        '  L.push(\'• \' + p.day + \' · \' + esc(cut(p.topic, 60)) + (links ? \' · \' + links : \'\') + (p.status === \'test_posted\' ? \' (test)\' : p.status === \'partial\' ? \' (partly)\' : \'\'));\n' +
        '}\n' +
        '\n' +
        'if (g.problems.length) {\n' +
        '  L.push(\'\');\n' +
        '  L.push(\'<b>Needs attention</b>\');\n' +
        '  for (const p of g.problems) L.push(\'• <code>\' + esc(p.post_id) + \'</code> \' + p.status + \': \' + esc(cut(p.topic, 50)) + (p.error ? \' – \' + esc(p.error) : \'\'));\n' +
        '}\n' +
        'if (g.waiting) L.push(\'\\n⏳ \' + g.waiting + \' draft\' + (g.waiting > 1 ? \'s are\' : \' is\') + \' waiting for your approval.\');\n' +
        '\n' +
        'L.push(\'\');\n' +
        'L.push(\'<b>Next 7 days</b>\');\n' +
        'if (g.next.length) for (const p of g.next) L.push(\'• \' + p.when + \' · \' + p.status + \' · \' + esc(cut(p.topic, 60)));\n' +
        'else L.push(\'Nothing scheduled.\');\n' +
        'if (g.empty.length) L.push(\'Empty slots: \' + g.empty.join(\', \') + \'. Add a topic with /idea or /use one below.\');\n' +
        'L.push(\'Backlog: \' + g.backlog + \' idea\' + (g.backlog === 1 ? \'\' : \'s\') + \' waiting for a later slot\' + (g.suggested ? \', \' + g.suggested + \' older suggestion\' + (g.suggested === 1 ? \'\' : \'s\') : \'\') + \'.\');\n' +
        '\n' +
        'if (suggestions.length) {\n' +
        '  L.push(\'\');\n' +
        '  L.push(\'💡 <b>New ideas</b> (in the sheet as <i>suggested</i>)\');\n' +
        '  for (const s of suggestions) L.push(\'• <code>/use \' + s.post_id + \'</code> \' + esc(s.topic));\n' +
        '}\n' +
        '\n' +
        'return [{ json: { report: L.join(\'\\n\').slice(0, 4000), approver: g.approver, suggestions } }];\n'
  } },
  output: [{ report: 'Weekly report', approver: '123456', suggestions: [{ post_id: 'P-ABCDE', topic: 'Idea', notes: 'n', status: 'suggested' }] }]
});

const sendReport = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Report',
    position: [1800, 520],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.approver }}'),
      text: expr('{{ $json.report }}'),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const hasIdeas = ifElse({
  version: 2.2,
  config: { name: 'Any Ideas?', position: [1800, 300], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.suggestions.length > 0 }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } }
});

const suggestionRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Suggestion Rows', position: [2020, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One calendar row per suggested topic.\n' +
        'return $(\'Build Report\').first().json.suggestions.map(s => ({ json: s }));\n'
  } },
  output: [{ post_id: 'P-ABCDE', topic: 'Idea', notes: 'n', status: 'suggested' }]
});

const addSuggestions = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Suggestions',
    position: [2240, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'append', documentId: SHEET_DOC, sheetName: CAL_TAB, columns: { mappingMode: 'autoMapInputData', value: {}, schema: CAL_SCHEMA }, options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' } },
    credentials: SHEETS_CRED
  },
  output: [{ post_id: 'P-ABCDE' }]
});

const note = sticky(
  '## Weekly Report (Monday 08:00)\n' +
  'Sends the owner, in Telegram:\n' +
  '- last 7 days: what went out, with links\n' +
  '- anything failed or waiting for approval\n' +
  '- next 7 days, empty posting slots and the backlog\n' +
  '- three new topic ideas from GPT-5.5 (prompt in `prompts/ideas.md`), added to the sheet as `suggested`; `/use <post_id>` schedules one.\n\n' +
  'LinkedIn and Telegram channel engagement stats need partner API access, so the report lists what went out, not likes.',
  [], { position: [200, 20], width: 760, height: 260, color: 4 }
);

export default workflow('social-autopilot-weekly', 'Social Autopilot 7: Weekly Report')
  .add(everyMonday)
  .to(readSettings)
  .add(sendNow)
  .to(readSettings)
  .to(readCalendar)
  .to(readState)
  .to(gather)
  .to(suggest)
  .to(buildReport)
  .to(hasIdeas.onTrue(suggestionRows.to(addSuggestions)))
  .add(buildReport.to(sendReport))
  .add(note);
