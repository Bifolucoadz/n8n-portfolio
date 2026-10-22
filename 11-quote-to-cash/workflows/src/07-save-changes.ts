import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const GMAIL_CRED = { gmailOAuth2: { id: '@@GMAIL_CRED_ID@@', name: 'Gmail account 2' } };
const PDF_WF = { __rl: true, mode: 'id', value: 'mgvDocuments0005', cachedResultName: 'Mossgrove 5: PDF Documents' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 300], parameters: { inputSource: 'passthrough' } },
  output: [{ plan: { mode: 'test', quote_inserts: [], quote_updates: [], events: [], payments: [], schedule: [], emails: [], result: { ok: true } } }]
});

const readMap = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Read Sheet Map',
    position: [420, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@?ranges=Quotes!A:A&ranges=Events!A1&ranges=Payments!A1&ranges=Schedule!A1&ranges=Outbox!A1&includeGridData=true&fields=sheets(properties(sheetId,title),data.rowData.values.effectiveValue)', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ sheets: [] }]
});

const build = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Batch', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_BATCH__
  } },
  output: [{ has_writes: true, body: { requests: [] }, count: 3 }]
});

const anything = ifElse({
  version: 2.2,
  config: {
    name: 'Anything to Write?',
    position: [860, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.has_writes }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const write = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Write to Sheet (one batch)',
    position: [1080, 220],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@:batchUpdate',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc', replies: [] }]
});

const emails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Live Emails', position: [440, 620], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__EMAILS__
  } },
  output: [{ to: 'grace.whitfield@example.com', subject: 'Your quote', html: '<p>Hi</p>', kind: 'quote_sent', attach: 'quote', token: 'abc' }]
});

const hasPdf = ifElse({
  version: 2.2,
  config: {
    name: 'Attach PDF?',
    position: [660, 620],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.attach }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const makePdf = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Make PDF', position: [880, 540], parameters: { source: 'database', workflowId: PDF_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const gmailPdf = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send with PDF',
    position: [1100, 540],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'message', operation: 'send',
      sendTo: expr("{{ $('Live Emails').item.json.to }}"), subject: expr("{{ $('Live Emails').item.json.subject }}"), emailType: 'html', message: expr("{{ $('Live Emails').item.json.html }}"),
      options: { appendAttribution: false, senderName: 'Mossgrove Landscapes', attachmentsUi: { attachmentsBinary: [{ property: 'data' }] } }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: 'msg1' }]
});

const gmail = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send Email',
    position: [880, 700],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'message', operation: 'send',
      sendTo: expr('{{ $json.to }}'), subject: expr('{{ $json.subject }}'), emailType: 'html', message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'Mossgrove Landscapes' }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: 'msg1' }]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result', position: [440, 880], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__RESULT__
  } },
  output: [{ ok: true }]
});

const note = sticky(
  '## Mossgrove 7: Save Changes\nEvery other workflow decides what should happen in code (a **plan**) and hands it here. **Build Batch** turns the plan into one Google Sheets request: new quotes, history, payments, bookings and (in test mode) emails are appended to their tabs, and changed quote fields are written cell by cell. One request means the whole change is saved or none of it is, in about a second; values are written as text or numbers, never formulas. In live mode emails go out with Gmail, with the quote, invoice or receipt PDF attached. **Result** runs last and is what the caller gets back.',
  [], { position: [160, -60], width: 1160, height: 200, color: 7 }
);

export default workflow('mossgrove-save-changes', 'Mossgrove 7: Save Changes')
  .add(whenCalled.to(readMap.to(build.to(anything.onTrue(write)))))
  .add(whenCalled.to(emails.to(hasPdf
    .onTrue(makePdf.to(gmailPdf))
    .onFalse(gmail))))
  .add(whenCalled.to(result))
  .add(note);
