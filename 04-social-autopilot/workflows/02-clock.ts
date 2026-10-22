import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1yAp5Z0eIMMvYO9DDx_Gtb_4CCNquU5vxNWaLH-WCzN8' };
const CAL_TAB = { __rl: true, mode: 'id', value: '0', cachedResultName: 'Calendar' };
const SETTINGS_TAB = { __rl: true, mode: 'id', value: '1', cachedResultName: 'Settings' };
const STATE_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const DRAFT_WF = { __rl: true, mode: 'id', value: 'Pw338SAVybgIkdmI', cachedResultName: 'Social Autopilot 5: Draft Post' };
const PUBLISH_WF = { __rl: true, mode: 'id', value: '3bhvmihQquHwukP6', cachedResultName: 'Social Autopilot 6: Publish Post' };
const STRICT = { caseSensitive: true, leftValue: '', typeValidation: 'strict' };
const EQUALS = { type: 'string', operation: 'equals' };

const everyFive = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every 5 Minutes', position: [240, 400], parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] } } },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Settings',
    position: [460, 400],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: SETTINGS_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, key: 'post_days', value: 'Mon, Wed, Fri' }]
});

const readCalendar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Calendar',
    position: [680, 400],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: CAL_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, post_id: '', topic: 'Why small businesses lose leads', status: 'idea', publish_at: '' }]
});

const readState = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read State', position: [900, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: STATE_TABLE, returnAll: true } },
  output: [{ key: 'approver_chat_id', value: '123456' }]
});

const planWork = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Work', position: [1120, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One pass over the calendar: give rows an ID and a slot, start drafts and publishing that are due,\n' +
        '// remind the owner about drafts still waiting at post time, and un-stick rows that stopped half-way.\n' +
        'const S = Object.fromEntries($(\'Read Settings\').all().map(i => [String(i.json.key || \'\').trim(), String(i.json.value ?? \'\').trim()]));\n' +
        'const state = Object.fromEntries($(\'Read State\').all().map(i => [String(i.json.key), String(i.json.value ?? \'\')]));\n' +
        'const rows = $(\'Read Calendar\').all().map(i => i.json);\n' +
        'const tz = S.timezone || \'Africa/Lagos\';\n' +
        'const now = DateTime.now().setZone(tz);\n' +
        'const nowText = now.toFormat(\'yyyy-MM-dd HH:mm\');\n' +
        'const leadHours = Number(S.draft_hours_ahead) > 0 ? Number(S.draft_hours_ahead) : 48;\n' +
        'const approver = state.approver_chat_id || \'\';\n' +
        'const MAX_DRAFTS = 3;\n' +
        'const MAX_PUBLISH = 2;\n' +
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
        'const key = d => d.toFormat(\'yyyy-MM-dd HH:mm\');\n' +
        '\n' +
        '// Posting slots from Settings: post_days (Mon, Wed, Fri) at post_time (09:00).\n' +
        'const dayNum = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };\n' +
        'let days = String(S.post_days || \'Mon, Wed, Fri\').toLowerCase().split(/[\\s,;]+/).map(d => dayNum[d.slice(0, 3)]).filter(Boolean);\n' +
        'if (!days.length) days = [1, 3, 5];\n' +
        'const [hh, mm] = (String(S.post_time || \'09:00\').match(/^(\\d{1,2}):(\\d{2})/) || [0, \'9\', \'00\']).slice(1).map(Number);\n' +
        '\n' +
        'const taken = new Set();\n' +
        'for (const r of rows) {\n' +
        '  const w = parseWhen(r.publish_at);\n' +
        '  if (w && String(r.status || \'\').trim() !== \'rejected\') taken.add(key(w));\n' +
        '}\n' +
        'function nextSlot() {\n' +
        '  const start = now.startOf(\'day\');\n' +
        '  for (let i = 0; i < 180; i++) {\n' +
        '    const c = start.plus({ days: i }).set({ hour: hh, minute: mm });\n' +
        '    if (days.includes(c.weekday) && c > now.plus({ hours: 1 }) && !taken.has(key(c))) { taken.add(key(c)); return c; }\n' +
        '  }\n' +
        '  return null;\n' +
        '}\n' +
        '\n' +
        'const usedIds = new Set(rows.map(r => String(r.post_id || \'\').trim()).filter(Boolean));\n' +
        'function newId() {\n' +
        '  let id;\n' +
        '  do { id = \'P-\' + Math.random().toString(36).slice(2, 7).toUpperCase(); } while (usedIds.has(id));\n' +
        '  usedIds.add(id);\n' +
        '  return id;\n' +
        '}\n' +
        '\n' +
        'const work = [];\n' +
        'const updates = [];\n' +
        'let drafts = 0;\n' +
        'let publishes = 0;\n' +
        'for (const r of rows) {\n' +
        '  if (!String(r.topic || \'\').trim()) continue;\n' +
        '  const u = { row_number: r.row_number };\n' +
        '  let id = String(r.post_id || \'\').trim();\n' +
        '  if (!id) { id = newId(); u.post_id = id; }\n' +
        '  let st = String(r.status || \'\').trim().toLowerCase();\n' +
        '  if (!st) { st = \'idea\'; u.status = \'idea\'; }\n' +
        '  let when = parseWhen(r.publish_at);\n' +
        '  const badDate = String(r.publish_at ?? \'\').trim() !== \'\' && !when;\n' +
        '  const touched = parseWhen(r.updated_at);\n' +
        '  const ageMin = touched ? now.diff(touched, \'minutes\').minutes : 9999;\n' +
        '\n' +
        '  if (st === \'idea\') {\n' +
        '    if (badDate) {\n' +
        '      Object.assign(u, { status: \'needs_fix\', error: \'publish_at must look like 2026-10-12 09:00 (24-hour, \' + tz + \'). Fix it, then set status back to idea.\', updated_at: nowText });\n' +
        '    } else {\n' +
        '      if (!when) { when = nextSlot(); if (when) u.publish_at = key(when); }\n' +
        '      if (when && when.diff(now, \'hours\').hours <= leadHours && drafts < MAX_DRAFTS) {\n' +
        '        Object.assign(u, { status: \'drafting\', error: \'\', updated_at: nowText });\n' +
        '        work.push({ json: { kind: \'draft\', post_id: id } });\n' +
        '        drafts++;\n' +
        '      }\n' +
        '    }\n' +
        '  } else if (st === \'drafting\' && ageMin > 20) {\n' +
        '    const attempts = (Number(r.attempts) || 0) + 1;\n' +
        '    Object.assign(u, { attempts: String(attempts), updated_at: nowText });\n' +
        '    if (attempts >= 3) Object.assign(u, { status: \'needs_fix\', error: \'Drafting stopped 3 times without finishing. Check the Social Autopilot 5 executions in n8n.\' });\n' +
        '    else Object.assign(u, { status: \'idea\', error: \'Drafting stopped half-way; trying again.\' });\n' +
        '  } else if (st === \'approved\' && (!when || when <= now) && publishes < MAX_PUBLISH) {\n' +
        '    Object.assign(u, { status: \'publishing\', updated_at: nowText });\n' +
        '    if (!when) u.publish_at = nowText;\n' +
        '    work.push({ json: { kind: \'publish\', post_id: id } });\n' +
        '    publishes++;\n' +
        '  } else if (st === \'publishing\' && ageMin > 30) {\n' +
        '    Object.assign(u, { status: \'failed\', updated_at: nowText, error: \'Publishing stopped half-way. Platforms that already have a link were posted; set status to approved to post the rest.\' });\n' +
        '    if (approver) work.push({ json: { kind: \'remind\', chat: approver, reply_to: 0, text: \'⚠️ Publishing <code>\' + id + \'</code> stopped half-way. Check the links in the sheet, then set its status to approved to post the rest.\' } });\n' +
        '  } else if (st === \'in_review\' && when && when <= now && !String(r.reminded_at || \'\').trim() && approver) {\n' +
        '    u.reminded_at = nowText;\n' +
        '    work.push({ json: { kind: \'remind\', chat: approver, reply_to: Number(r.preview_message_id) || 0, text: \'⏰ <code>\' + id + \'</code> was due \' + when.toFormat(\'ccc d LLL, HH:mm\') + \' and is still waiting for you. Approve it and it goes out within 5 minutes.\' } });\n' +
        '  }\n' +
        '  if (Object.keys(u).length > 1) updates.push({ json: { kind: \'update\', ...u } });\n' +
        '}\n' +
        '// Row updates first, so the sub-workflows started after them see the new status.\n' +
        'return [...updates, ...work];\n'
  } },
  output: [{ kind: 'update', row_number: 2, post_id: 'P-ABCDE', publish_at: '2026-10-09 09:00', status: 'drafting' }]
});

const route = switchCase({
  version: 3.2,
  config: {
    name: 'Route Work',
    position: [1340, 400],
    parameters: { rules: { values: [
      { outputKey: 'update', conditions: { options: STRICT, conditions: [{ leftValue: expr('{{ $json.kind }}'), operator: EQUALS, rightValue: 'update' }], combinator: 'and' } },
      { outputKey: 'draft', conditions: { options: STRICT, conditions: [{ leftValue: expr('{{ $json.kind }}'), operator: EQUALS, rightValue: 'draft' }], combinator: 'and' } },
      { outputKey: 'publish', conditions: { options: STRICT, conditions: [{ leftValue: expr('{{ $json.kind }}'), operator: EQUALS, rightValue: 'publish' }], combinator: 'and' } },
      { outputKey: 'remind', conditions: { options: STRICT, conditions: [{ leftValue: expr('{{ $json.kind }}'), operator: EQUALS, rightValue: 'remind' }], combinator: 'and' } }
    ] }, options: {} }
  }
});

const saveUpdates = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Save Row Changes',
    position: [1580, 220],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'update',
      documentId: SHEET_DOC,
      sheetName: CAL_TAB,
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['row_number'], schema: [
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
          , { id: 'row_number', displayName: 'row_number', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true, readOnly: true, removed: false }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2 }]
});

const startDraft = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Start Draft',
    position: [1580, 380],
    parameters: {
      mode: 'each',
      source: 'database',
      workflowId: DRAFT_WF,
      workflowInputs: { mappingMode: 'defineBelow', value: { post_id: expr('{{ $json.post_id }}'), feedback: '' }, schema: [
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
    position: [1580, 540],
    parameters: {
      mode: 'each',
      source: 'database',
      workflowId: PUBLISH_WF,
      workflowInputs: { mappingMode: 'defineBelow', value: { post_id: expr('{{ $json.post_id }}') }, schema: [
        { id: 'post_id', displayName: 'post_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { waitForSubWorkflow: false }
    }
  },
  output: [{}]
});

const remind = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Reminder',
    position: [1580, 700],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.chat }}'),
      text: expr('{{ $json.text }}'),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', reply_to_message_id: expr('{{ $json.reply_to || 0 }}') }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## Clock (every 5 minutes)\n' +
  'Reads the calendar once and decides what is due:\n\n' +
  '- new rows get a `post_id`, and rows without `publish_at` get the next free slot from `post_days` + `post_time`\n' +
  '- `idea` rows within `draft_hours_ahead` (48 h) of their slot → `drafting` + **Draft Post** (max 3 per run)\n' +
  '- `approved` rows whose time has come → `publishing` + **Publish Post** (max 2 per run)\n' +
  '- `in_review` rows past their time → one reminder in Telegram\n' +
  '- rows stuck in `drafting` (20 min) or `publishing` (30 min) are reset or marked failed\n\n' +
  'Row changes are saved first (output 0 runs before the others). Successful runs are not saved.',
  [], { position: [200, -120], width: 760, height: 320, color: 4 }
);

export default workflow('social-autopilot-clock', 'Social Autopilot 2: Clock')
  .add(everyFive)
  .to(readSettings)
  .to(readCalendar)
  .to(readState)
  .to(planWork)
  .to(route
    .onCase(0, saveUpdates)
    .onCase(1, startDraft)
    .onCase(2, startPublish)
    .onCase(3, remind))
  .add(note);
