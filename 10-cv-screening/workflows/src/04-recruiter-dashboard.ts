import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const JOBS = { __rl: true, mode: 'id', value: 'qycslNJXs6wOwRxE', cachedResultName: 'Northgate Jobs' };
const CANDIDATES = { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' };
const EVENTS = { __rl: true, mode: 'id', value: 'v5LAsWSJxw2Uj4Ig', cachedResultName: 'Northgate Events' };
const FILES = { __rl: true, mode: 'id', value: 'nKofBkG4S6UPt1xd', cachedResultName: 'Northgate Files' };
const ACTION_WF = { __rl: true, mode: 'id', value: 'ngtCandAction005', cachedResultName: 'Northgate 5: Candidate Action' };
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };

// Page
const pageHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Dashboard Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'northgate/dashboard', responseMode: 'responseNode', options: {} } },
  output: [{ query: { key: 'k', job: 'NG-101' } }]
});

const pageSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'dashboard_key', value: 'k' }]
});

const pageJobs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Jobs', position: [640, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: JOBS, returnAll: true } },
  output: [{ job_id: 'NG-101', title: 'Customer Success Manager' }]
});

const pageCands = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Candidates', position: [860, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true } },
  output: [{ candidate_id: 'C1021-ABCD', job_id: 'NG-101', score: 82, band: 'shortlist', status: 'new' }]
});

const pageEvents = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Events', position: [1080, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: EVENTS, returnAll: true } },
  output: [{ candidate_id: 'C1021-ABCD', event: 'screened', detail: 'Score 82', at: '2026-10-21T19:00:00.000+01:00' }]
});

const buildPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Page', position: [1300, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_PAGE__
  } },
  output: [{ code: 200, html: '<html></html>' }]
});

const sendPage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [1520, 300], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

// Actions
const actionHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Action Request', position: [200, 640], parameters: { httpMethod: 'POST', path: 'northgate/action', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { key: 'k', candidate_id: 'C1021-ABCD', action: 'invite' } }]
});

const actionSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings (Action)', position: [420, 640], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'dashboard_key', value: 'k' }]
});

const checkKey = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Key', position: [640, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECK_ACTION__
  } },
  output: [{ ok: true, candidate_id: 'C1021-ABCD', action: 'invite', actor: 'Priya Shah' }]
});

const keyOk = ifElse({
  version: 2.2,
  config: {
    name: 'Allowed?',
    position: [860, 640],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const runAction = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Run Action', position: [1080, 560], alwaysOutputData: true, parameters: { source: 'database', workflowId: ACTION_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const readAgain = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read Candidate Again',
    position: [1300, 560],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true, filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr("{{ $('Check Key').first().json.candidate_id }}") }] } }
  },
  output: [{ candidate_id: 'C1021-ABCD', status: 'invited', slots_json: '[]' }]
});

const actionResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Action Response', position: [1520, 560], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ACTION_RESPONSE__
  } },
  output: [{ code: 200, body: { ok: true, message: 'Invite sent.', candidate: {} } }]
});

const sendResult = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Result', position: [1740, 560], parameters: { respondWith: 'json', responseBody: expr('{{ $json.body }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

const refuse = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Refuse', position: [1080, 760], parameters: { respondWith: 'json', responseBody: '{ "ok": false, "message": "Not allowed." }', options: { responseCode: 403 } } }
});

// CV download
const cvHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'CV Request', position: [200, 980], parameters: { httpMethod: 'GET', path: 'northgate/cv', responseMode: 'responseNode', options: {} } },
  output: [{ query: { key: 'k', c: 'C1021-ABCD' } }]
});

const cvSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings (CV)', position: [420, 980], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'dashboard_key', value: 'k' }]
});

const readFile = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read CV File',
    position: [640, 980],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: FILES, limit: 1, filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr("{{ $('CV Request').first().json.query.c }}") }] } }
  },
  output: [{ candidate_id: 'C1021-ABCD', filename: 'cv.pdf', mime: 'application/pdf', base64: 'JVBERi0=' }]
});

const makePdf = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Make PDF', position: [860, 980], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CV_FILE__
  } },
  output: [{ found: true, filename: 'cv.pdf' }]
});

const found = ifElse({
  version: 2.2,
  config: {
    name: 'Found?',
    position: [1080, 980],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.found }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const sendPdf = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send PDF', position: [1300, 900], parameters: { respondWith: 'binary', responseDataSource: 'automatically', options: { responseHeaders: { entries: [{ name: 'Content-Disposition', value: expr('inline; filename="{{ $json.filename }}"') }, { name: 'Cache-Control', value: 'no-store' }] } } } }
});

const notFound = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Not Found', position: [1300, 1080], parameters: { respondWith: 'text', responseBody: 'Not found', options: { responseCode: 404 } } }
});

const note = sticky(
  '## Northgate 4: Recruiter Dashboard\nThree endpoints behind the dashboard key in **Northgate Settings**:\n- `GET /webhook/northgate/dashboard?key=…` serves the page: jobs, candidates ranked by band and score, the evidence for every criterion, flags and history. **Blind review** hides names until someone is invited.\n- `POST /webhook/northgate/action` runs **Invite**, **Hold** or **Reject** through **Northgate 5** and returns the new state.\n- `GET /webhook/northgate/cv?key=…&c=…` returns the stored CV.',
  [], { position: [160, 20], width: 1300, height: 220, color: 5 }
);

export default workflow('northgate-recruiter-dashboard', 'Northgate 4: Recruiter Dashboard')
  .add(pageHook)
  .to(pageSettings)
  .to(pageJobs)
  .to(pageCands)
  .to(pageEvents)
  .to(buildPage)
  .to(sendPage)
  .add(actionHook)
  .to(actionSettings)
  .to(checkKey)
  .to(keyOk
    .onTrue(runAction.to(readAgain).to(actionResponse).to(sendResult))
    .onFalse(refuse))
  .add(cvHook)
  .to(cvSettings)
  .to(readFile)
  .to(makePdf)
  .to(found
    .onTrue(sendPdf)
    .onFalse(notFound))
  .add(note);
