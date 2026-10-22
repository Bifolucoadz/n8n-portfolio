import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'IFuurjqqfST0GLCi', cachedResultName: 'Tidewater Settings' };
const CALLS = { __rl: true, mode: 'id', value: '0hHsTxLEuk6Su6C7', cachedResultName: 'Tidewater Calls' };
const CRM_WF = { __rl: true, mode: 'id', value: 'tdwCrmAdapter003', cachedResultName: 'Tidewater 3: CRM' };
const SEND_WF = { __rl: true, mode: 'id', value: 'tdwSendEmail0005', cachedResultName: 'Tidewater 5: Send Email' };
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };

// The page
const link = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Review Link', position: [200, 300], parameters: { httpMethod: 'GET', path: 'tidewater/review', responseMode: 'responseNode', options: {} } },
  output: [{ query: { call: 'CL-ABCDE', t: 'token' } }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const readCall = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Call', position: [640, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CALLS, returnAll: true, filters: { conditions: [{ keyName: 'call_id', condition: 'eq', keyValue: expr("{{ $('Review Link').first().json.query.call || 'none' }}") }] } } },
  output: [{ call_id: 'CL-ABCDE', token: 'token', deal_id: 'D-1001' }]
});

const check = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Link', position: [860, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECK_LINK__
  } },
  output: [{ ok: true, action: 'get_deal', deal_id: 'D-1001' }]
});

const linkOk = ifElse({
  version: 2.2,
  config: {
    name: 'Link OK?',
    position: [1080, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const getDeal = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Deal', position: [1300, 200], parameters: { source: 'database', workflowId: CRM_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ found: true, deal: {}, contacts: [] }]
});

const buildPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Page', position: [1520, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_PAGE__
  } },
  output: [{ code: 200, html: '<html></html>' }]
});

const notFound = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Not Found', position: [1300, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__NOT_FOUND__
  } },
  output: [{ code: 404, html: '<p>Not found</p>' }]
});

const sendPage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [1740, 300], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

// The decision
const submit = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Review Submit', position: [200, 700], parameters: { httpMethod: 'POST', path: 'tidewater/review', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { call_id: 'CL-ABCDE', token: 'token', action: 'send' } }]
});

const readSettings2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings (Submit)', position: [420, 700], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const readCall2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Call (Submit)', position: [640, 700], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CALLS, returnAll: true, filters: { conditions: [{ keyName: 'call_id', condition: 'eq', keyValue: expr("{{ $('Review Submit').first().json.body.call_id || 'none' }}") }] } } },
  output: [{ call_id: 'CL-ABCDE', token: 'token', status: 'pending_review' }]
});

const plan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan', position: [860, 700], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN__
  } },
  output: [{ ok: true, code: 200, call_id: 'CL-ABCDE', status: 'sent', ops: [], email: null, row: {}, message: 'Sent.' }]
});

const planOk = ifElse({
  version: 2.2,
  config: {
    name: 'Allowed?',
    position: [1080, 700],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const ops = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'CRM Updates', position: [1300, 600], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__OPS__
  } },
  output: [{ action: 'update_deal', deal_id: 'D-1001', fields: { stage: 'qualifiedtobuy' } }]
});

const applyOps = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Update CRM', position: [1520, 600], alwaysOutputData: true, parameters: { source: 'database', workflowId: CRM_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const email = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Follow-up Email', position: [1740, 600], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__EMAIL__
  } },
  output: [{ to: 'renee.alvarez@callowaydental.example', subject: 'Next steps', html: '<p>Hi</p>', kind: 'follow_up', call_id: 'CL-ABCDE' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Email', position: [1960, 600], alwaysOutputData: true, onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const updateRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Reviewed Row', position: [2180, 600], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__UPDATE_ROW__
  } },
  output: [{ call_id: 'CL-ABCDE', status: 'sent' }]
});

const updateCall = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Call',
    position: [2400, 600],
    parameters: {
      resource: 'row', operation: 'update', dataTableId: CALLS,
      filters: { conditions: [{ keyName: 'call_id', condition: 'eq', keyValue: expr('{{ $json.call_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: {
__MAP_CALLREVIEW__
      }, schema: [
__SCHEMA_CALLREVIEW__
      ] }
    }
  },
  output: [{ id: 1 }]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Submit Result', position: [2620, 700], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SUBMIT_RESULT__
  } },
  output: [{ code: 200, body: { ok: true, message: 'Sent.', status: 'sent' } }]
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Result', position: [2840, 700], parameters: { respondWith: 'json', responseBody: expr('{{ $json.body }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

const note = sticky(
  '## Tidewater 4: Review Page\n`GET /webhook/tidewater/review?call=…&t=…` is the rep\'s page for one call: summary, what already went into the CRM, the changes that wait for an OK (with the quote behind each), BANT, objections, risks, the transcript, and the follow-up email to edit.\n`POST` applies the changes the rep ticked, sends the email (Gmail live, Outbox test), logs it on the deal and closes the review. Each link has a private token, and a call can only be reviewed once.',
  [], { position: [160, -20], width: 1400, height: 220, color: 5 }
);

export default workflow('tidewater-review-page', 'Tidewater 4: Review Page')
  .add(link)
  .to(readSettings)
  .to(readCall)
  .to(check)
  .to(linkOk
    .onTrue(getDeal.to(buildPage).to(sendPage))
    .onFalse(notFound.to(sendPage)))
  .add(submit)
  .to(readSettings2)
  .to(readCall2)
  .to(plan)
  .to(planOk
    .onTrue(ops.to(applyOps).to(email).to(send).to(updateRow).to(updateCall).to(result))
    .onFalse(result))
  .add(result)
  .to(respond)
  .add(note);
