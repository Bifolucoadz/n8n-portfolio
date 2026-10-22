import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const LOAD_URL = 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=Quotes&ranges=Payments&valueRenderOption=UNFORMATTED_VALUE';
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };

const pdfHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'PDF Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'mossgrove/pdf', responseMode: 'responseNode', options: {} } },
  output: [{ query: { t: 'abc', doc: 'quote' } }]
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

const makePdf = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Make PDF', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__MAKE_PDF__
  } },
  output: [{ ok: true, code: 200, quote_id: 'Q-1005', doc: 'quote', fileName: 'Q-1005.pdf' }]
});

const found = ifElse({
  version: 2.2,
  config: {
    name: 'Found?',
    position: [860, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const sendPdf = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send PDF', position: [1080, 200], parameters: { respondWith: 'binary', responseDataSource: 'set', inputFieldName: 'data', options: { responseHeaders: { entries: [
    { name: 'Content-Type', value: 'application/pdf' },
    { name: 'Content-Disposition', value: expr('inline; filename="{{ $json.fileName }}"') },
    { name: 'Cache-Control', value: 'no-store' },
    { name: 'X-Robots-Tag', value: 'noindex' }
  ] } } } }
});

const notFound = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Not Found Page', position: [1080, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__NOT_FOUND__
  } },
  output: [{ html: '<html></html>' }]
});

const sendNotFound = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Not Found', position: [1300, 400], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: 404, responseHeaders: HTML_HEADERS } } }
});

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 640], parameters: { inputSource: 'passthrough' } },
  output: [{ token: 'abc', attach: 'quote' }]
});

const loadEmail = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote (Email)',
    position: [420, 640],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const makePdfEmail = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Make PDF (Email)', position: [640, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__MAKE_PDF_EMAIL__
  } },
  output: [{ ok: true, fileName: 'Q-1005.pdf' }]
});

const note = sticky(
  '## Mossgrove 5: PDF Documents\nQuotes, invoices and receipts are drawn straight from the quote row by a small PDF writer in the **Make PDF** code node, so there is no template service to pay for and the PDF always matches the sheet. The web link (`/webhook/mossgrove/pdf?t=…&doc=quote|invoice|receipt`) works only with the client\'s secret token. **When Called** makes the same PDF for email attachments in live mode.',
  [], { position: [160, 0], width: 1180, height: 170, color: 7 }
);

export default workflow('mossgrove-documents', 'Mossgrove 5: PDF Documents')
  .add(pdfHook)
  .to(loadQuote)
  .to(makePdf)
  .to(found
    .onTrue(sendPdf)
    .onFalse(notFound.to(sendNotFound)))
  .add(whenCalled)
  .to(loadEmail)
  .to(makePdfEmail)
  .add(note);
