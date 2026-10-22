import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Once', position: [200, 300] },
  output: [{}]
});

const layout = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Sheet Layout', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__LAYOUT__
  } },
  output: [{ body: {}, headers: {}, format: {} }]
});

const create = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Spreadsheet',
    position: [640, 300],
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId,spreadsheetUrl',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1abc/edit' }]
});

const headers = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Write Headers',
    position: [860, 300],
    parameters: {
      method: 'POST',
      url: expr('https://sheets.googleapis.com/v4/spreadsheets/{{ $json.spreadsheetId }}/values:batchUpdate'),
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify($('Sheet Layout').first().json.headers) }}"),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc' }]
});

const format = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Bold Header Rows',
    position: [1080, 300],
    parameters: {
      method: 'POST',
      url: expr("https://sheets.googleapis.com/v4/spreadsheets/{{ $('Create Spreadsheet').first().json.spreadsheetId }}:batchUpdate"),
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify($('Sheet Layout').first().json.format) }}"),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc' }]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Spreadsheet Link', position: [1300, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const c = $('Create Spreadsheet').first().json;\nreturn [{ json: { spreadsheetId: c.spreadsheetId, url: c.spreadsheetUrl, next: 'Put the ID in workflows/config.json (SHEET_ID), rebuild and deploy, then run Mossgrove 8: Reset Demo.' } }];" } },
  output: [{ spreadsheetId: '1abc', url: 'https://docs.google.com/spreadsheets/d/1abc/edit' }]
});

const note = sticky(
  '## Mossgrove 0: Create Spreadsheet\nRun once when setting up for a new client. Creates the Google Sheet the whole system runs on (Settings, Price Book, Quotes, Events, Payments, Schedule, Outbox) with bold, frozen header rows. The owner can read and edit everything in the sheet; the workflows write as plain text, so nothing typed into the forms is treated as a formula.',
  [], { position: [160, 80], width: 1160, height: 150, color: 7 }
);

export default workflow('mossgrove-create-sheet', 'Mossgrove 0: Create Spreadsheet')
  .add(start)
  .to(layout)
  .to(create)
  .to(headers)
  .to(format)
  .to(result)
  .add(note);
