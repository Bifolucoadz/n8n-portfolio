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
__PLAN_WORK__
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
__CAL_SCHEMA__
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
