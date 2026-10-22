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
        'const COLUMNS = {"Settings": ["key", "value", "note"], "Watchlist": ["page_id", "competitor", "page_type", "url", "active", "last_checked", "last_status", "last_hash", "last_method", "fail_count", "last_items_json", "last_text", "note"], "Our Products": ["sku", "name", "category", "price", "battery_wh", "range_km", "motor", "url"], "Matches": ["competitor", "competitor_product", "our_sku", "confidence", "matched_by", "matched_at"], "Prices": ["checked_at", "competitor", "product", "price", "was_price", "in_stock", "page_id", "our_sku"], "Changes": ["change_id", "detected_at", "run_id", "competitor", "page_id", "page_type", "kind", "item", "before", "after", "delta_pct", "our_sku", "our_price", "significance", "headline", "why_it_matters", "suggested_action", "alerted", "status"], "Runs": ["run_id", "started_at", "finished_at", "trigger", "pages", "unchanged", "changed", "failed", "changes", "alerts", "ai_calls", "ms"], "Outbox": ["at", "to", "subject", "kind", "links", "html"]};\n' +
        'const colours = { \'Settings\': [0.45, 0.5, 0.55], \'Watchlist\': [0.08, 0.13, 0.24], \'Our Products\': [0.18, 0.49, 0.31], \'Matches\': [0.36, 0.25, 0.63], \'Prices\': [0.89, 0.34, 0.18], \'Changes\': [0.82, 0.22, 0.16], \'Runs\': [0.6, 0.6, 0.6], \'Outbox\': [0.6, 0.6, 0.6] };\n' +
        'return [{ json: {\n' +
        '  body: {\n' +
        '    properties: { title: \'Cobble & Spoke: Competitor Radar (demo)\', locale: \'en_GB\', timeZone: \'Europe/London\' },\n' +
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
  config: { name: 'Spreadsheet Link', position: [1300, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const c = $('Create Spreadsheet').first().json;\nreturn [{ json: { spreadsheetId: c.spreadsheetId, url: c.spreadsheetUrl, next: 'Put the ID in workflows/config.json (SHEET_ID), rebuild and deploy, then run Radar 6: Reset Demo.' } }];" } },
  output: [{ spreadsheetId: '1abc', url: 'https://docs.google.com/spreadsheets/d/1abc/edit' }]
});

const note = sticky(
  '## Radar 7: Create Spreadsheet\nRun once when setting up for a new client. Creates the Google Sheet the radar runs on (Settings, Watchlist, Our Products, Matches, Prices, Changes, Runs, Outbox) with bold, frozen header rows. The team can edit the watchlist, products and settings in the sheet; the workflows write plain text so nothing is treated as a formula.',
  [], { position: [160, 80], width: 1160, height: 150, color: 7 }
);

export default workflow('radar-create-sheet', 'Radar 7: Create Spreadsheet')
  .add(start)
  .to(layout)
  .to(create)
  .to(headers)
  .to(format)
  .to(result)
  .add(note);
