import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const RUN_WF = { __rl: true, mode: 'id', value: 'csrRunChecks0001', cachedResultName: 'Radar 1: Run Checks' };
const SAVE_WF = { __rl: true, mode: 'id', value: 'csrSaveChange005', cachedResultName: 'Radar 5: Save Changes' };
const LOAD_URL = 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=Watchlist&ranges=%27Our%20Products%27&ranges=Matches&ranges=Prices&ranges=Changes&ranges=Runs&valueRenderOption=UNFORMATTED_VALUE';
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };
const IS_OK = { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' };

const pageHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Dashboard Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'radar/dashboard', responseMode: 'responseNode', options: {} } },
  output: [{ query: { key: 'k' } }]
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

const actionHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Dashboard Action', position: [200, 640], parameters: { httpMethod: 'POST', path: 'radar/action', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { key: 'k', action: 'seen', change_ids: ['CH-1'] } }]
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
  config: { name: 'Plan Action', position: [640, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN_ACTION__
  } },
  output: [{ ok: true, route: 'save', plan: { result: { ok: true, message: 'Done' } } }]
});

const allowed = ifElse({ version: 2.2, config: { name: 'Allowed?', position: [860, 640], parameters: { conditions: IS_OK } } });

const isRun = ifElse({
  version: 2.2,
  config: {
    name: 'Check Now?',
    position: [1080, 560],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'run' }], combinator: 'and' } }
  }
});

const runChecks = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Run Checks', position: [1300, 480], parameters: { source: 'database', workflowId: RUN_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const save = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save Changes', position: [1300, 640], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const loadAfter = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load All (After)',
    position: [1520, 560],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Action Result', position: [1740, 560], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ACTION_RESULT__
  } },
  output: [{ ok: true, message: 'Done', data: {} }]
});

const sendResult = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Result', position: [1960, 560], parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: {} } }
});

const refuse = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Refuse', position: [1080, 780], parameters: { respondWith: 'json', responseBody: expr('{{ { ok: false, message: $json.message } }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

// Test inbox
const inboxHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Inbox Request', position: [200, 1000], parameters: { httpMethod: 'GET', path: 'radar/outbox', responseMode: 'responseNode', options: {} } },
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
  '## Radar 3: Dashboard\nThe team\'s page (`/webhook/radar/dashboard?key=…`, key in the **Settings** tab): this week\'s numbers, the change feed rated 1 to 5 with why it matters and what to do, a price table of our bikes against each rival\'s closest match, price history charts, and the health of every watched page (and whether it\'s read from structured data or by the AI). **Inbox Request** shows the test-mode Outbox as an inbox. Buttons post to **Dashboard Action**: mark as seen, watch a new page, or check everything now (runs **Radar 1**).',
  [], { position: [160, 0], width: 1380, height: 180, color: 7 }
);

export default workflow('radar-dashboard', 'Radar 3: Dashboard')
  .add(pageHook)
  .to(loadAll)
  .to(buildPage)
  .to(sendPage)
  .add(actionHook)
  .to(loadAction)
  .to(planAction)
  .to(allowed
    .onTrue(isRun
      .onTrue(runChecks.to(loadAfter))
      .onFalse(save.to(loadAfter)))
    .onFalse(refuse))
  .add(loadAfter)
  .to(result)
  .to(sendResult)
  .add(inboxHook)
  .to(loadOutbox)
  .to(buildInbox)
  .to(sendInbox)
  .add(note);
