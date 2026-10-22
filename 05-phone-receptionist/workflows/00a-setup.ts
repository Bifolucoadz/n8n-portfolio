import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'qh2lP825xnkmt4z2', cachedResultName: 'Receptionist Settings' };
const AUTOPILOT_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const CAL_CRED = { googleCalendarOAuth2Api: { id: '5G8pvfh0Kjd75Asw', name: 'Google Calendar account' } };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };

const CALENDAR_BODY = {
  summary: 'Fernhollow Dental (demo)',
  description: 'Appointments booked by Nora, the AI phone receptionist (n8n portfolio project 5). Fictional clinic.',
  timeZone: 'America/Chicago'
};
const SHEET_BODY = {
  properties: { title: 'Fernhollow Dental Front Desk', timeZone: 'America/Chicago' },
  sheets: [
    {
      properties: { sheetId: 1, title: 'Calls', gridProperties: { frozenRowCount: 1 } },
      data: [{ startRow: 0, startColumn: 0, rowData: [{ values: [
        { userEnteredValue: { stringValue: 'call_id' } }, { userEnteredValue: { stringValue: 'started_at' } }, { userEnteredValue: { stringValue: 'caller' } },
        { userEnteredValue: { stringValue: 'caller_name' } }, { userEnteredValue: { stringValue: 'duration_s' } }, { userEnteredValue: { stringValue: 'outcome' } },
        { userEnteredValue: { stringValue: 'appointment' } }, { userEnteredValue: { stringValue: 'confirmation_code' } }, { userEnteredValue: { stringValue: 'summary' } },
        { userEnteredValue: { stringValue: 'follow_up' } }, { userEnteredValue: { stringValue: 'recording_url' } }, { userEnteredValue: { stringValue: 'ended_reason' } },
        { userEnteredValue: { stringValue: 'cost_usd' } }
      ] }] }]
    },
    {
      properties: { sheetId: 2, title: 'Messages', gridProperties: { frozenRowCount: 1 } },
      data: [{ startRow: 0, startColumn: 0, rowData: [{ values: [
        { userEnteredValue: { stringValue: 'at' } }, { userEnteredValue: { stringValue: 'caller_name' } }, { userEnteredValue: { stringValue: 'phone' } },
        { userEnteredValue: { stringValue: 'message' } }, { userEnteredValue: { stringValue: 'urgent' } }, { userEnteredValue: { stringValue: 'status' } },
        { userEnteredValue: { stringValue: 'call_id' } }
      ] }] }]
    }
  ]
};
const FORMAT_BODY = {
  requests: [
    { repeatCell: { range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.88, green: 0.94, blue: 0.93 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } },
    { repeatCell: { range: { sheetId: 2, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.88, green: 0.94, blue: 0.93 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } },
    { updateDimensionProperties: { range: { sheetId: 1, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 }, properties: { pixelSize: 420 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: 2, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 380 }, fields: 'pixelSize' } },
    { setDataValidation: { range: { sheetId: 2, startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 6 }, rule: { condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: 'new' }, { userEnteredValue: 'called back' }, { userEnteredValue: 'done' }] }, showCustomUi: true } } }
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
  output: [{ key: 'calendar_id', value: '' }]
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
        '// One-off: refuses to run twice so it can\'t create a second calendar or sheet.\n' +
        'const s = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        'if (s.calendar_id || s.sheet_id) throw new Error("Setup already ran (calendar_id / sheet_id are set in Receptionist Settings). Clear them first to start over.");\n' +
        'const autopilot = Object.fromEntries($("Read Autopilot State").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        '// Staff alerts go to the same Telegram chat as Social Autopilot\'s approver unless set already.\n' +
        'return [{ json: { staff_chat_id: s.staff_chat_id || autopilot.approver_chat_id || "" } }];\n'
  } },
  output: [{ staff_chat_id: '123456' }]
});

const createCalendar = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Calendar',
    position: [1080, 300],
    parameters: {
      method: 'POST',
      url: 'https://www.googleapis.com/calendar/v3/calendars',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleCalendarOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: CALENDAR_BODY
    },
    credentials: CAL_CRED
  },
  output: [{ id: 'abc@group.calendar.google.com', summary: 'Fernhollow Dental (demo)' }]
});

const createSheet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Sheet',
    position: [1300, 300],
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId,spreadsheetUrl',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: SHEET_BODY
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1abc/edit' }]
});

const formatSheet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Format Sheet',
    position: [1520, 300],
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

const generateSecret = node({
  type: 'n8n-nodes-base.crypto',
  version: 2,
  config: { name: 'Generate Secret', position: [1740, 300], parameters: { action: 'generate', encodingType: 'hex', stringLength: 40 } },
  output: [{ data: 'f00d' }]
});

const settingsRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Settings Rows', position: [1960, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'return [\n' +
        '  { json: { key: "calendar_id", value: $("Create Calendar").first().json.id } },\n' +
        '  { json: { key: "sheet_id", value: $("Create Sheet").first().json.spreadsheetId } },\n' +
        '  { json: { key: "webhook_secret", value: $("Generate Secret").first().json.data } },\n' +
        '  { json: { key: "staff_chat_id", value: $("Plan").first().json.staff_chat_id } },\n' +
        '];\n'
  } },
  output: [{ key: 'calendar_id', value: 'abc@group.calendar.google.com' }]
});

const saveSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Settings',
    position: [2180, 300],
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: SETTINGS_TABLE,
      filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: expr('{{ $json.key }}') }] },
      columns: { mappingMode: 'defineBelow', value: { key: expr('{{ $json.key }}'), value: expr('{{ $json.value }}') }, schema: [
        { id: 'key', displayName: 'key', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'value', displayName: 'value', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ key: 'calendar_id', value: 'abc@group.calendar.google.com' }]
});

const readAgain = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings Again', position: [2400, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'calendar_id', value: 'abc@group.calendar.google.com' }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [2620, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'const s = Object.fromEntries($("Read Settings Again").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        'return [{\n' +
        '  json: {\n' +
        '    calendar_id: s.calendar_id || "(missing)",\n' +
        '    sheet: s.sheet_id ? "https://docs.google.com/spreadsheets/d/" + s.sheet_id + "/edit" : "(missing)",\n' +
        '    webhook_secret: s.webhook_secret ? "set (" + s.webhook_secret.length + " characters)" : "(missing)",\n' +
        '    staff_chat_id: s.staff_chat_id || "(empty: staff alerts are skipped until it is set)",\n' +
        '    next: "Set public_base_url to the ngrok https address, create the \'Vapi API\' credential, then run Receptionist 0b.",\n' +
        '  },\n' +
        '}];\n'
  } },
  output: [{ calendar_id: 'abc@group.calendar.google.com', sheet: 'https://docs.google.com/spreadsheets/d/1abc/edit' }]
});

const note = sticky(
  '## Receptionist 0a: Setup (run once)\nCreates the **Fernhollow Dental (demo)** Google Calendar, the **Fernhollow Dental Front Desk** sheet (Calls and Messages tabs), and a random 40-character webhook secret, and saves them in the **Receptionist Settings** data table. Staff alerts default to Social Autopilot\'s Telegram approver chat.\n\nRefuses to run again once a calendar or sheet is saved. Next: put the ngrok address in `public_base_url` and run **0b** to create the Vapi assistant.',
  [], { position: [160, 40], width: 1000, height: 200, color: 4 }
);

export default workflow('receptionist-setup', 'Receptionist 0a: Setup')
  .add(runSetup)
  .to(readSettings)
  .to(readAutopilot)
  .to(plan)
  .to(createCalendar)
  .to(createSheet)
  .to(formatSheet)
  .to(generateSecret)
  .to(settingsRows)
  .to(saveSettings)
  .to(readAgain)
  .to(summary)
  .add(note);
