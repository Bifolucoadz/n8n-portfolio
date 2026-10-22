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
__CAL_SCHEMA__
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
__DECIDE__
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
__IDEA_ROW__
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
__ROW_UPDATE__
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
