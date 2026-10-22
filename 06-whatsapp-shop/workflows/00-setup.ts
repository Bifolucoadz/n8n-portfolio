import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const AUTOPILOT_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };

const BOARD_BODY = {
  properties: { title: 'Honeycrumb Kitchen Board', timeZone: 'Africa/Lagos' },
  sheets: [{
    properties: { sheetId: 0, title: 'Orders', gridProperties: { frozenRowCount: 1 } },
    data: [{ startRow: 0, startColumn: 0, rowData: [{ values: [
      { userEnteredValue: { stringValue: 'order_id' } }, { userEnteredValue: { stringValue: 'status' } }, { userEnteredValue: { stringValue: 'deliver_on' } },
      { userEnteredValue: { stringValue: 'window' } }, { userEnteredValue: { stringValue: 'fulfilment' } }, { userEnteredValue: { stringValue: 'area' } },
      { userEnteredValue: { stringValue: 'address' } }, { userEnteredValue: { stringValue: 'customer' } }, { userEnteredValue: { stringValue: 'phone' } },
      { userEnteredValue: { stringValue: 'items' } }, { userEnteredValue: { stringValue: 'total_ngn' } }, { userEnteredValue: { stringValue: 'note' } },
      { userEnteredValue: { stringValue: 'paid_at' } }
    ] }] }]
  }]
};
const FORMAT_BODY = {
  requests: [
    { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, backgroundColor: { red: 0.55, green: 0.33, blue: 0.16 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } },
    { setDataValidation: { range: { sheetId: 0, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 }, rule: { condition: { type: 'ONE_OF_LIST', values: [
      { userEnteredValue: 'paid' }, { userEnteredValue: 'baking' }, { userEnteredValue: 'out_for_delivery' }, { userEnteredValue: 'ready_for_pickup' }, { userEnteredValue: 'delivered' }, { userEnteredValue: 'cancelled' }
    ] }, showCustomUi: true, strict: true } } },
    { addConditionalFormatRule: { index: 0, rule: { ranges: [{ sheetId: 0, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 }], booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'paid' }] }, format: { backgroundColor: { red: 1, green: 0.95, blue: 0.8 } } } } } },
    { addConditionalFormatRule: { index: 1, rule: { ranges: [{ sheetId: 0, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 }], booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'baking' }] }, format: { backgroundColor: { red: 1, green: 0.88, blue: 0.75 } } } } } },
    { addConditionalFormatRule: { index: 2, rule: { ranges: [{ sheetId: 0, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 }], booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'out_for_delivery' }] }, format: { backgroundColor: { red: 0.82, green: 0.9, blue: 1 } } } } } },
    { addConditionalFormatRule: { index: 3, rule: { ranges: [{ sheetId: 0, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 }], booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'delivered' }] }, format: { backgroundColor: { red: 0.82, green: 0.94, blue: 0.84 } } } } } },
    { updateDimensionProperties: { range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 }, properties: { pixelSize: 260 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 9, endIndex: 10 }, properties: { pixelSize: 360 }, fields: 'pixelSize' } }
  ]
};

const runSetup = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Setup', position: [200, 300] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'kitchen_sheet_id', value: '' }]
});

const readAutopilot = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Autopilot State', position: [640, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: AUTOPILOT_TABLE, returnAll: true } },
  output: [{ key: 'approver_chat_id', value: '123456' }]
});

const plan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan', position: [860, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One-off: refuses to run twice so it can\'t create a second kitchen board.\n' +
        'const s = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        'if (s.kitchen_sheet_id) throw new Error("Setup already ran (kitchen_sheet_id is set in Honeycrumb Settings). Clear it first to start over.");\n' +
        'const autopilot = Object.fromEntries($("Read Autopilot State").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        'return [{ json: { owner_chat_id: s.owner_chat_id || autopilot.approver_chat_id || "" } }];\n'
  } },
  output: [{ owner_chat_id: '123456' }]
});

const createBoard = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Kitchen Board',
    position: [1080, 300],
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId,spreadsheetUrl',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: BOARD_BODY
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1abc/edit' }]
});

const formatBoard = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Format Board',
    position: [1300, 300],
    parameters: {
      method: 'POST',
      url: expr('https://sheets.googleapis.com/v4/spreadsheets/{{ $json.spreadsheetId }}:batchUpdate'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: FORMAT_BODY
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc' }]
});

const settingsRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Settings Rows', position: [1520, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'return [\n' +
        '  { json: { key: "kitchen_sheet_id", value: $("Create Kitchen Board").first().json.spreadsheetId } },\n' +
        '  { json: { key: "owner_chat_id", value: $("Plan").first().json.owner_chat_id } },\n' +
        '];\n'
  } },
  output: [{ key: 'kitchen_sheet_id', value: '1abc' }]
});

const saveSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Settings',
    position: [1740, 300],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: SETTINGS_TABLE,
      filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: expr('{{ $json.key }}') }] },
      columns: { mappingMode: 'defineBelow', value: { key: expr('{{ $json.key }}'), value: expr('{{ $json.value }}') }, schema: [
        { id: 'key', displayName: 'key', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'value', displayName: 'value', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ key: 'kitchen_sheet_id', value: '1abc' }]
});

const readAgain = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings Again', position: [1960, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'kitchen_sheet_id', value: '1abc' }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [2180, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'const s = Object.fromEntries($("Read Settings Again").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        'return [{ json: {\n' +
        '  kitchen_board: s.kitchen_sheet_id ? "https://docs.google.com/spreadsheets/d/" + s.kitchen_sheet_id + "/edit" : "(missing)",\n' +
        '  owner_chat_id: s.owner_chat_id || "(empty: owner alerts are skipped until it is set)",\n' +
        '  payments: s.payments,\n' +
        '  next: "Create the WhatsApp and Paystack credentials, set whatsapp_phone_number_id, then publish Honeycrumb 1 and 5.",\n' +
        '} }];\n'
  } },
  output: [{ kitchen_board: 'https://docs.google.com/spreadsheets/d/1abc/edit' }]
});

const note = sticky(
  '## Honeycrumb 0: Setup (run once)\nCreates the **Honeycrumb Kitchen Board** Google Sheet (status dropdown and colours for paid, baking, out for delivery, delivered) and saves its ID in **Honeycrumb Settings**. The owner\'s Telegram chat defaults to Social Autopilot\'s approver chat.\n\nThe menu, delivery zones and settings rows were loaded straight into the data tables when the project was built.',
  [], { position: [160, 40], width: 900, height: 200, color: 5 }
);

export default workflow('honeycrumb-setup', 'Honeycrumb 0: Setup')
  .add(runSetup)
  .to(readSettings)
  .to(readAutopilot)
  .to(plan)
  .to(createBoard)
  .to(formatBoard)
  .to(settingsRows)
  .to(saveSettings)
  .to(readAgain)
  .to(summary)
  .add(note);
