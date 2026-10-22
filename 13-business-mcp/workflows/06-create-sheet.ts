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
        'const COLUMNS = {"Settings": ["key", "value", "note"], "Team": ["person_id", "name", "role", "team", "email", "is_manager", "weekly_hours", "cost_rate", "bill_rate", "active"], "Clients": ["client_id", "name", "sector", "contact", "contact_email", "account_lead", "retainer_hours", "retainer_fee", "status", "since"], "Projects": ["project_id", "client_id", "name", "type", "billing", "status", "lead", "start", "due", "budget_hours", "fee"], "Tasks": ["task_id", "project_id", "title", "assignee", "status", "priority", "due", "created_at", "updated_at"], "Time": ["entry_id", "date", "person", "project_id", "task_id", "hours", "billable", "note", "logged_at", "source", "invoice_id"], "Invoices": ["invoice_id", "client_id", "project_id", "period", "issue_date", "due_date", "amount", "vat", "status", "paid_date", "lines_json"], "Audit": ["at", "server", "tool", "args_json", "ok", "summary", "ms"]};\n' +
        'const colours = { \'Settings\': [0.45, 0.5, 0.55], \'Team\': [0.36, 0.25, 0.63], \'Clients\': [0.12, 0.3, 0.5], \'Projects\': [0.18, 0.49, 0.31], \'Tasks\': [0.72, 0.47, 0.12], \'Time\': [0.82, 0.22, 0.16], \'Invoices\': [0.1, 0.1, 0.1], \'Audit\': [0.6, 0.6, 0.6] };\n' +
        'return [{ json: {\n' +
        '  body: {\n' +
        '    properties: { title: \'Brindle Studio: business data (demo)\', locale: \'en_GB\', timeZone: \'Europe/London\' },\n' +
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
  config: { name: 'Spreadsheet Link', position: [1300, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const c = $('Create Spreadsheet').first().json;\nreturn [{ json: { spreadsheetId: c.spreadsheetId, url: c.spreadsheetUrl, next: 'Put the ID in workflows/config.json (SHEET_ID), rebuild and deploy, then run Brindle 5: Reset Demo.' } }];" } },
  output: [{ spreadsheetId: '1abc', url: 'https://docs.google.com/spreadsheets/d/1abc/edit' }]
});

const note = sticky(
  '## Brindle 6: Create Spreadsheet\nRun once when setting up. Creates the Google Sheet the MCP servers read and write (Settings, Team, Clients, Projects, Tasks, Time, Invoices, Audit) with bold, frozen header rows. A real studio would point the tools at its own sheet, or swap Load Data for its project-management and accounting APIs; the tools stay the same.',
  [], { position: [160, 80], width: 1160, height: 150, color: 7 }
);

export default workflow('brindle-create-sheet', 'Brindle 6: Create Spreadsheet')
  .add(start)
  .to(layout)
  .to(create)
  .to(headers)
  .to(format)
  .to(result)
  .add(note);
