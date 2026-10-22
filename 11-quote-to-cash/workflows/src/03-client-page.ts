import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'mgvSaveChange007', cachedResultName: 'Mossgrove 7: Save Changes' };
const LOAD_URL = 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=Quotes&valueRenderOption=UNFORMATTED_VALUE';
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };
const IS_OK = { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' };

// Page
const pageHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Quote Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'mossgrove/quote', responseMode: 'responseNode', options: {} } },
  output: [{ query: { t: 'abc' }, headers: { 'user-agent': 'Mozilla/5.0' } }]
});

const loadQuote = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote',
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
  output: [{ code: 200, html: '<html></html>', log: true, plan: {} }]
});

const sendPage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [860, 300], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

const logView = ifElse({
  version: 2.2,
  config: {
    name: 'Count View?',
    position: [1080, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $('Build Page').first().json.log }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const viewPlan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'View Plan', position: [1300, 240], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "return [{ json: { plan: $('Build Page').first().json.plan } }];" } },
  output: [{ plan: {} }]
});

const saveView = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save View', position: [1520, 240], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: false } } }
});

// Actions: accept and sign, ask a question, decline
const actionHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Action Request', position: [200, 700], parameters: { httpMethod: 'POST', path: 'mossgrove/quote-action', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { t: 'abc', action: 'accept', name: 'Grace Whitfield', agree: true, extras: [] }, headers: {} }]
});

const loadAction = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote (Action)',
    position: [420, 700],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const checkAction = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Action', position: [640, 700], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECK_ACTION__
  } },
  output: [{ ok: true, action: 'accept', quote_id: 'Q-1005', name: 'Grace Whitfield', chosen: [], canonical: '{}' }]
});

const allowed = ifElse({ version: 2.2, config: { name: 'Allowed?', position: [860, 700], parameters: { conditions: IS_OK } } });

const fingerprint = node({
  type: 'n8n-nodes-base.crypto',
  version: 1,
  config: { name: 'Fingerprint (SHA-256)', position: [1080, 620], parameters: { action: 'hash', type: 'SHA256', value: expr('{{ $json.canonical }}'), dataPropertyName: 'fingerprint', encoding: 'hex' } },
  output: [{ ok: true, action: 'accept', fingerprint: 'a3f1' }]
});

const planAction = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Action', position: [1300, 620], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN_ACTION__
  } },
  output: [{ plan: {} }]
});

const saveAction = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save Action', position: [1520, 620], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const sendOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Result', position: [1740, 620], parameters: { respondWith: 'json', responseBody: expr("{{ { ok: true, message: $('Plan Action').first().json.plan.result.message } }}"), options: {} } }
});

const refuse = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Refuse', position: [1080, 800], parameters: { respondWith: 'json', responseBody: expr('{{ { ok: false, message: $json.message } }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

const note = sticky(
  '## Mossgrove 3: Client Quote Page\nThe link in the client\'s email. The page shows the quote, lets them tick optional extras (the total updates live), then **accept and sign** with their typed name. What they sign is fingerprinted with SHA-256 and stored with the time, IP and browser, so neither side can change it later. They can also ask a question or decline. Afterwards the same link shows the next step: pay the deposit, the booked start date, the final invoice and the receipt. The first time a client opens a quote, the owner gets an email.',
  [], { position: [160, -40], width: 1380, height: 190, color: 7 }
);

export default workflow('mossgrove-client-page', 'Mossgrove 3: Client Quote Page')
  .add(pageHook)
  .to(loadQuote)
  .to(buildPage)
  .to(sendPage)
  .to(logView.onTrue(viewPlan.to(saveView)))
  .add(actionHook)
  .to(loadAction)
  .to(checkAction)
  .to(allowed
    .onTrue(fingerprint.to(planAction.to(saveAction.to(sendOk))))
    .onFalse(refuse))
  .add(note);
