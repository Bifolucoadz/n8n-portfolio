import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Reset the Demo', position: [200, 300] },
  output: [{}]
});

const seed = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Demo Data', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_SEED__
  } },
  output: [{ clear: { ranges: [] }, write: { valueInputOption: 'RAW', data: [] }, summary: {} }]
});

const clear = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Clear All Tabs',
    position: [640, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchClear',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify($('Build Demo Data').first().json.clear) }}"),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ clearedRanges: [] }]
});

const write = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Write All Tabs',
    position: [860, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchUpdate',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify($('Build Demo Data').first().json.write) }}"),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ totalUpdatedRows: 60 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [1080, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "return [{ json: { rows: $('Build Demo Data').first().json.summary, cellsWritten: $input.first().json.totalUpdatedCells } }];" } },
  output: [{ rows: {} }]
});

const note = sticky(
  '## Mossgrove 8: Reset Demo\nPuts the Google Sheet back to the demo state: settings, a 26-item price book, nine sample quotes at every stage (draft, sent, accepted, booked, invoiced, paid, declined, expired) with dates relative to today, their history and payments, both crews\' calendars, and an empty Outbox. Run it before a demo or recording.',
  [], { position: [160, 80], width: 940, height: 150, color: 7 }
);

export default workflow('mossgrove-reset-demo', 'Mossgrove 8: Reset Demo')
  .add(start)
  .to(seed)
  .to(clear)
  .to(write)
  .to(summary)
  .add(note);
