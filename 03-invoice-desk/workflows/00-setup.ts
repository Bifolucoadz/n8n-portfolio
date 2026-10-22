import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const CREATE_SHEET_BODY = {"properties": {"title": "Invoice Desk: Saltmarsh Kitchen", "timeZone": "America/New_York"}, "sheets": [{"properties": {"sheetId": 0, "title": "Documents", "gridProperties": {"frozenRowCount": 1, "frozenColumnCount": 1}}}, {"properties": {"sheetId": 1, "title": "Line Items", "gridProperties": {"frozenRowCount": 1}}}, {"properties": {"sheetId": 2, "title": "Suppliers", "gridProperties": {"frozenRowCount": 1}}}]};
const SHEET_VALUES_BODY = {"valueInputOption": "RAW", "data": [{"range": "Documents!A1", "values": [["doc_id", "received_at", "status", "flags", "supplier", "doc_type", "invoice_number", "invoice_date", "due_date", "currency", "subtotal", "tax", "total", "category", "payment_status", "drive_link", "summary", "source", "sender", "original_filename", "supplier_status", "decided_by", "decided_at", "duplicate_of", "line_count", "confidence", "bank_last4", "file_hash"]]}, {"range": "'Line Items'!A1", "values": [["doc_id", "line_no", "supplier", "invoice_number", "invoice_date", "description", "quantity", "unit_price", "amount", "category", "line_check"]]}, {"range": "Suppliers!A1", "values": [["supplier", "aliases", "email_domain", "tax_id", "default_category", "bank_last4", "status", "added_at", "added_by"], ["Harborline Produce Co.", "Harborline Produce; Harborline", "harborline-produce.example", "00-0482231", "Food & beverage", "3391", "active", "2026-01-15", "setup"], ["Pinecrest Dairy Cooperative", "Pinecrest Dairy; Pinecrest Dairy Co-op", "pinecrestdairy.example", "00-0559817", "Food & beverage", "7720", "active", "2026-01-15", "setup"], ["Gullrock Seafood Co.", "Gullrock Seafood", "gullrockseafood.example", "00-0611402", "Food & beverage", "2264", "active", "2026-02-03", "setup"], ["Bluewick Linen Service", "Bluewick Linen", "bluewicklinen.example", "00-0733950", "Linen & uniforms", "4418", "active", "2026-02-03", "setup"], ["Tidewater Electric Cooperative", "Tidewater Electric; Tidewater Electric Co-op", "tidewater-electric.example", "", "Utilities", "", "active", "2026-01-15", "setup"]]}]};
const FORMAT_BODY = {"requests": [{"repeatCell": {"range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 1}, "cell": {"userEnteredFormat": {"textFormat": {"bold": true}, "backgroundColor": {"red": 0.93, "green": 0.95, "blue": 0.97}}}, "fields": "userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor"}}, {"repeatCell": {"range": {"sheetId": 1, "startRowIndex": 0, "endRowIndex": 1}, "cell": {"userEnteredFormat": {"textFormat": {"bold": true}, "backgroundColor": {"red": 0.93, "green": 0.95, "blue": 0.97}}}, "fields": "userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor"}}, {"repeatCell": {"range": {"sheetId": 2, "startRowIndex": 0, "endRowIndex": 1}, "cell": {"userEnteredFormat": {"textFormat": {"bold": true}, "backgroundColor": {"red": 0.93, "green": 0.95, "blue": 0.97}}}, "fields": "userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor"}}, {"repeatCell": {"range": {"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 10, "endColumnIndex": 13}, "cell": {"userEnteredFormat": {"numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"}}}, "fields": "userEnteredFormat.numberFormat"}}, {"repeatCell": {"range": {"sheetId": 1, "startRowIndex": 1, "startColumnIndex": 6, "endColumnIndex": 9}, "cell": {"userEnteredFormat": {"numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"}}}, "fields": "userEnteredFormat.numberFormat"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 1}, "properties": {"pixelSize": 150}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 1, "endIndex": 2}, "properties": {"pixelSize": 170}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 2, "endIndex": 3}, "properties": {"pixelSize": 130}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 3, "endIndex": 4}, "properties": {"pixelSize": 280}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 4, "endIndex": 5}, "properties": {"pixelSize": 220}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 15, "endIndex": 17}, "properties": {"pixelSize": 260}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 1, "dimension": "COLUMNS", "startIndex": 5, "endIndex": 6}, "properties": {"pixelSize": 320}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 1, "dimension": "COLUMNS", "startIndex": 10, "endIndex": 11}, "properties": {"pixelSize": 280}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 2, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 2}, "properties": {"pixelSize": 240}, "fields": "pixelSize"}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "auto_approved"}]}, "format": {"backgroundColor": {"red": 0.85, "green": 0.94, "blue": 0.85}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "approved"}]}, "format": {"backgroundColor": {"red": 0.78, "green": 0.91, "blue": 0.78}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "pending_approval"}]}, "format": {"backgroundColor": {"red": 1.0, "green": 0.93, "blue": 0.76}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "needs_review"}]}, "format": {"backgroundColor": {"red": 0.98, "green": 0.8, "blue": 0.78}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "rejected"}]}, "format": {"backgroundColor": {"red": 0.92, "green": 0.7, "blue": 0.7}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "duplicate"}]}, "format": {"backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "not_invoice"}]}, "format": {"backgroundColor": {"red": 0.93, "green": 0.93, "blue": 0.96}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "error"}]}, "format": {"backgroundColor": {"red": 0.98, "green": 0.8, "blue": 0.78}}}}}}]};
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };
const GMAIL_CRED = { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Setup Once', position: [240, 400] },
  output: [{}]
});

const createSheet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Register Sheet',
    position: [500, 160],
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId,spreadsheetUrl',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: CREATE_SHEET_BODY
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1abc/edit' }]
});

const writeValues = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Write Headers and Suppliers',
    position: [740, 160],
    parameters: {
      method: 'POST',
      url: expr('https://sheets.googleapis.com/v4/spreadsheets/{{ $json.spreadsheetId }}/values:batchUpdate'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: SHEET_VALUES_BODY
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc', totalUpdatedRows: 8 }]
});

const formatSheet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Format Sheet',
    position: [980, 160],
    parameters: {
      method: 'POST',
      url: expr("https://sheets.googleapis.com/v4/spreadsheets/{{ $('Create Register Sheet').first().json.spreadsheetId }}:batchUpdate"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: FORMAT_BODY
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc', replies: [] }]
});

const rootFolder = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Create Root Folder',
    position: [500, 400],
    parameters: {
      resource: 'folder',
      operation: 'create',
      name: 'Invoice Desk (Saltmarsh Kitchen)',
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'list', value: 'root', cachedResultName: '/ (Root folder)' }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'folder1', name: 'Invoice Desk (Saltmarsh Kitchen)' }]
});

const inboxFolder = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Create Inbox Folder',
    position: [740, 400],
    parameters: {
      resource: 'folder',
      operation: 'create',
      name: 'Inbox',
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("{{ $('Create Root Folder').first().json.id }}") }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'folder1', name: 'Inbox' }]
});

const doneFolder = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Create Done Folder',
    position: [980, 400],
    parameters: {
      resource: 'folder',
      operation: 'create',
      name: 'Done',
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("{{ $('Create Inbox Folder').first().json.id }}") }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'folder1', name: 'Done' }]
});

const filedFolder = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Create Filed Folder',
    position: [1220, 400],
    parameters: {
      resource: 'folder',
      operation: 'create',
      name: 'Filed',
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("{{ $('Create Root Folder').first().json.id }}") }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'folder1', name: 'Filed' }]
});

const otherFolder = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Create Other Folder',
    position: [1460, 400],
    parameters: {
      resource: 'folder',
      operation: 'create',
      name: 'Other',
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("{{ $('Create Root Folder').first().json.id }}") }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'folder1', name: 'Other' }]
});

const samplesFolder = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Create Demo Folder',
    position: [1700, 400],
    parameters: {
      resource: 'folder',
      operation: 'create',
      name: 'Demo documents',
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("{{ $('Create Root Folder').first().json.id }}") }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'folder1', name: 'Demo documents' }]
});

const moveSheet = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Move Sheet Into Folder',
    position: [1940, 400],
    parameters: {
      resource: 'file',
      operation: 'move',
      fileId: { __rl: true, mode: 'id', value: expr("{{ $('Create Register Sheet').first().json.spreadsheetId }}") },
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("{{ $('Create Root Folder').first().json.id }}") }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: '1abc', name: 'Invoice Desk: Saltmarsh Kitchen' }]
});

const sampleList = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'List Demo Documents',
    position: [2180, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        'const files = [\n' +
        '  "harborline-produce-INV-10482.pdf", "pinecrest-dairy-2291.pdf", "frostline-refrigeration-FR-7731.pdf",\n' +
        '  "gullrock-seafood-55120.pdf", "bluewick-linen-8840.pdf", "ledgestone-hardware-receipt.jpg",\n' +
        '  "tidewater-electric-bill-scan.pdf", "saltmarsh-fall-menu.pdf", "harborline-produce-INV-10482-copy.pdf"\n' +
        '];\n' +
        'return files.map(file => ({ json: { file } }));\n'
    }
  },
  output: [{ file: 'harborline-produce-INV-10482.pdf' }]
});

const downloadSample = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download Demo Document',
    position: [2420, 400],
    parameters: {
      method: 'GET',
      url: expr('http://127.0.0.1:8765/{{ $json.file }}'),
      options: { response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } }
    }
  },
  output: [{}]
});

const uploadSample = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Upload to Demo Folder',
    position: [2660, 400],
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr("{{ $('List Demo Documents').item.json.file }}"),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("{{ $('Create Demo Folder').first().json.id }}") }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'file1', name: 'harborline-produce-INV-10482.pdf' }]
});

const parentLabel = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Create Gmail Label',
    position: [500, 640],
    parameters: { resource: 'label', operation: 'create', name: 'Invoice Desk', options: {} },
    credentials: GMAIL_CRED
  },
  output: [{ id: 'Label_1', name: 'Invoice Desk' }]
});

const processedLabel = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Create Processed Label',
    position: [740, 640],
    parameters: { resource: 'label', operation: 'create', name: 'Invoice Desk/Processed', options: {} },
    credentials: GMAIL_CRED
  },
  output: [{ id: 'Label_2', name: 'Invoice Desk/Processed' }]
});

export default workflow('invoice-desk-setup', 'Invoice Desk 0: Setup (run once)')
  .add(start)
  .to(createSheet)
  .to(writeValues)
  .to(formatSheet)
  .add(start)
  .to(rootFolder)
  .to(inboxFolder)
  .to(doneFolder)
  .to(filedFolder)
  .to(otherFolder)
  .to(samplesFolder)
  .to(moveSheet)
  .to(sampleList)
  .to(downloadSample)
  .to(uploadSample)
  .add(start)
  .to(parentLabel)
  .to(processedLabel);
