import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'mgvSaveChange007', cachedResultName: 'Mossgrove 7: Save Changes' };
const LOAD_URL = 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=%27Price%20Book%27&ranges=Quotes&ranges=Events&ranges=Payments&ranges=Schedule&valueRenderOption=UNFORMATTED_VALUE';
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };
const IS_OK = { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' };

// Page
const pageHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Dashboard Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'mossgrove/dashboard', responseMode: 'responseNode', options: {} } },
  output: [{ query: { key: 'k', q: 'Q-1005' } }]
});

const loadAll = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load All',
    position: [420, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const buildPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Page', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_PAGE__
  } },
  output: [{ code: 200, html: '<html></html>' }]
});

const sendPage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [860, 300], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

// Owner actions
const actionHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Owner Action', position: [200, 640], parameters: { httpMethod: 'POST', path: 'mossgrove/owner', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { key: 'k', action: 'send', quote_id: 'Q-1009' } }]
});

const loadAction = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load All (Action)',
    position: [420, 640],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const planAction = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Owner Action', position: [640, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN_OWNER_ACTION__
  } },
  output: [{ ok: true, plan: { result: { ok: true, message: 'Sent' } } }]
});

const allowed = ifElse({ version: 2.2, config: { name: 'Allowed?', position: [860, 640], parameters: { conditions: IS_OK } } });

const saveAction = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save Changes', position: [1080, 560], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const loadAfter = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load All (After)',
    position: [1300, 560],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const actionResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Action Result', position: [1520, 560], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ACTION_RESULT__
  } },
  output: [{ ok: true, message: 'Sent', data: {} }]
});

const sendResult = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Result', position: [1740, 560], parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: {} } }
});

const refuse = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Refuse', position: [1080, 760], parameters: { respondWith: 'json', responseBody: expr('{{ { ok: false, message: $json.message } }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

// Test inbox
const inboxHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Inbox Request', position: [200, 1000], parameters: { httpMethod: 'GET', path: 'mossgrove/outbox', responseMode: 'responseNode', options: {} } },
  output: [{ query: { key: 'k' } }]
});

const loadOutbox = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Outbox',
    position: [420, 1000],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=Outbox&valueRenderOption=UNFORMATTED_VALUE', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const buildInbox = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Inbox', position: [640, 1000], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_INBOX__
  } },
  output: [{ code: 200, html: '<html></html>' }]
});

const sendInbox = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Inbox', position: [860, 1000], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

const note = sticky(
  '## Mossgrove 2: Owner Dashboard\nThe owner\'s page (`/webhook/mossgrove/dashboard?key=…`, key in the **Settings** tab): pipeline numbers, every quote with its next step, the AI draft with its checks, an editor (lines are repriced from the price book on save), the client\'s signature and payments, the history, and both crews\' calendars. **Inbox Request** shows the test-mode Outbox as an inbox. Buttons post to **Owner Action**: save, send, withdraw, record a bank transfer (books the job), and "job done" (sends the final invoice). Each action is decided in code and written by **Mossgrove 7: Save Changes**; the page gets fresh data back.',
  [], { position: [160, 0], width: 1380, height: 190, color: 7 }
);

export default workflow('mossgrove-dashboard', 'Mossgrove 2: Owner Dashboard')
  .add(pageHook)
  .to(loadAll)
  .to(buildPage)
  .to(sendPage)
  .add(actionHook)
  .to(loadAction)
  .to(planAction)
  .to(allowed
    .onTrue(saveAction.to(loadAfter.to(actionResult.to(sendResult))))
    .onFalse(refuse))
  .add(inboxHook)
  .to(loadOutbox)
  .to(buildInbox)
  .to(sendInbox)
  .add(note);
