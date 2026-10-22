import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1yAp5Z0eIMMvYO9DDx_Gtb_4CCNquU5vxNWaLH-WCzN8' };
const CAL_TAB = { __rl: true, mode: 'id', value: '0', cachedResultName: 'Calendar' };
const SETTINGS_TAB = { __rl: true, mode: 'id', value: '1', cachedResultName: 'Settings' };
const STATE_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const CAL_SCHEMA = [
__CAL_SCHEMA__
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
__GATHER_WEEK__
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
__PROMPT_IDEAS__
        ,
        maxTokens: 3000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'topic_ideas', strict: true, schema:
__SCHEMA_IDEAS__
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
__BUILD_REPORT__
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
__SUGGESTION_ROWS__
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
