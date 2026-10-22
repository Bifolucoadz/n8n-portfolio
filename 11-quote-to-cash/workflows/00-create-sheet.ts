import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };

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
        '// The tabs, in order, with frozen header rows (from workflows/tables.json).\n' +
        'const COLUMNS = {"Settings": ["key", "value", "note"], "Price Book": ["code", "category", "item", "unit", "unit_price", "labour_days", "min_qty", "notes", "active"], "Quotes": ["quote_id", "token", "status", "client_name", "client_email", "client_phone", "site_address", "postcode", "job_title", "summary", "visit_notes", "transcript", "lines_json", "extras_json", "custom_json", "assumptions_json", "questions_json", "flags_json", "subtotal", "vat", "total", "deposit", "labour_days", "version", "estimator", "created_at", "build_ms", "sent_at", "valid_until", "viewed_at", "view_count", "accepted_at", "signed_name", "sign_meta_json", "chosen_extras_json", "accepted_subtotal", "accepted_vat", "accepted_total", "deposit_due", "deposit_paid_at", "job_start", "job_end", "crew", "completed_at", "invoice_id", "balance_due", "balance_paid_at", "review_sent_at", "declined_at", "decline_reason", "reminders_sent", "last_reminder_at", "messages_json", "updated_at"], "Events": ["at", "quote_id", "event", "detail", "actor"], "Payments": ["payment_id", "quote_id", "kind", "amount", "status", "provider", "provider_ref", "created_at", "paid_at"], "Schedule": ["entry_id", "quote_id", "title", "start", "end", "crew", "kind", "notes"], "Outbox": ["at", "to", "subject", "kind", "quote_id", "links", "html"]};\n' +
        'const colours = { \'Settings\': [0.45, 0.5, 0.48], \'Price Book\': [0.48, 0.71, 0.38], \'Quotes\': [0.12, 0.3, 0.23], \'Events\': [0.6, 0.6, 0.6], \'Payments\': [0.18, 0.4, 0.56], \'Schedule\': [0.72, 0.47, 0.12], \'Outbox\': [0.6, 0.6, 0.6] };\n' +
        'return [{ json: {\n' +
        '  body: {\n' +
        '    properties: { title: \'Mossgrove Landscapes: Quote to Cash (demo)\', locale: \'en_GB\', timeZone: \'Europe/London\' },\n' +
        '    sheets: Object.keys(COLUMNS).map((title, i) => ({ properties: { sheetId: i + 1, title, index: i, gridProperties: { frozenRowCount: 1, columnCount: Math.max(COLUMNS[title].length, 10) }, tabColor: { red: colours[title][0], green: colours[title][1], blue: colours[title][2] } } }))\n' +
        '  },\n' +
        '  headers: { valueInputOption: \'RAW\', data: Object.entries(COLUMNS).map(([t, cols]) => ({ range: "\'" + t + "\'!A1", values: [cols] })) },\n' +
        '  format: { requests: Object.keys(COLUMNS).map((t, i) => ({ repeatCell: { range: { sheetId: i + 1, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.93, green: 0.95, blue: 0.93 } } }, fields: \'userEnteredFormat(textFormat,backgroundColor)\' } })) }\n' +
        '} }];\n'
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
