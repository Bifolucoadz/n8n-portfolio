import { workflow, node, trigger, sticky, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1yAp5Z0eIMMvYO9DDx_Gtb_4CCNquU5vxNWaLH-WCzN8' };
const SETTINGS_TAB = { __rl: true, mode: 'id', value: '1', cachedResultName: 'Settings' };
const STATE_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Check', position: [240, 400] },
  output: [{}]
});

const readState = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read State', position: [460, 400], parameters: { resource: 'row', operation: 'get', dataTableId: STATE_TABLE, returnAll: true } },
  output: [{ key: 'approver_chat_id', value: '123456' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Settings',
    position: [680, 400],
    executeOnce: true,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: SETTINGS_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, key: 'telegram_channel', value: '@demo' }]
});

const telegramChecks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Telegram Checks', position: [900, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TELEGRAM_CHECKS__
  } },
  output: [{ token_set: true, approver: '123456', channel: '@demo', bot: { id: '1', username: 'demo_bot' }, channel_can_post: true }]
});

const credentialBot = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Credential Bot',
    position: [1120, 400],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.approver }}'),
      text: '🔧 Checking Social Autopilot connections…',
      additionalFields: { appendAttribution: false }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true, result: { from: { id: 1, username: 'demo_bot' } } }]
});

const linkedInProfile = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'LinkedIn Profile',
    position: [1340, 400],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: 'https://api.linkedin.com/v2/userinfo',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'linkedInOAuth2Api',
      options: { timeout: 20000 }
    },
    credentials: { linkedInOAuth2Api: newCredential('LinkedIn account') }
  },
  output: [{ sub: 'abc123', name: 'Samuel Oladele' }]
});

const report = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Report', position: [1780, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__REPORT__
  } },
  output: [{ report: 'All good', all_ok: true, linkedin_sub: 'abc123', approver: '123456' }]
});

const hasLinkedIn = ifElse({
  version: 2.2,
  config: { name: 'LinkedIn Connected?', position: [2000, 300], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.linkedin_sub }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } } }
});

const saveLinkedIn = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save LinkedIn Member ID',
    position: [2220, 300],
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: STATE_TABLE,
      filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'linkedin_person_id' }] },
      columns: { mappingMode: 'defineBelow', value: { key: 'linkedin_person_id', value: expr('{{ $json.linkedin_sub }}') }, schema: [
        { id: 'key', displayName: 'key', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'value', displayName: 'value', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ key: 'linkedin_person_id', value: 'abc123' }]
});

const sendReport = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Report',
    position: [2000, 500],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Report').first().json.approver }}"),
      text: expr("{{ $('Report').first().json.report }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## Check Connections (run by hand)\n' +
  'Run after setup and whenever something stops posting. Checks the bot token (and removes any old webhook), the approver, that the n8n Telegram credential is the same bot, the bot\'s admin rights in the channel, and LinkedIn.\n\n' +
  'It also saves your LinkedIn member ID to the data table, which **Publish Post** needs. The result is in the **Report** node and sent to you in Telegram.',
  [], { position: [200, 120], width: 760, height: 220, color: 4 }
);

export default workflow('social-autopilot-check', 'Social Autopilot 8: Check Connections')
  .add(start)
  .to(readState)
  .to(readSettings)
  .to(telegramChecks)
  .to(credentialBot)
  .to(linkedInProfile)
  .to(report)
  .to(hasLinkedIn.onTrue(saveLinkedIn))
  .add(report.to(sendReport))
  .add(note);
