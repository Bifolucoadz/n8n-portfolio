import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const CLEAR_BODY = {"ranges": ["Documents!A2:AB", "'Line Items'!A2:K", "Suppliers!A2:I"]};
const RESTORE_BODY = {"valueInputOption": "RAW", "data": [{"range": "Suppliers!A2", "values": [["Harborline Produce Co.", "Harborline Produce; Harborline", "harborline-produce.example", "00-0482231", "Food & beverage", "3391", "active", "2026-01-15", "setup"], ["Pinecrest Dairy Cooperative", "Pinecrest Dairy; Pinecrest Dairy Co-op", "pinecrestdairy.example", "00-0559817", "Food & beverage", "7720", "active", "2026-01-15", "setup"], ["Gullrock Seafood Co.", "Gullrock Seafood", "gullrockseafood.example", "00-0611402", "Food & beverage", "2264", "active", "2026-02-03", "setup"], ["Bluewick Linen Service", "Bluewick Linen", "bluewicklinen.example", "00-0733950", "Linen & uniforms", "4418", "active", "2026-02-03", "setup"], ["Tidewater Electric Cooperative", "Tidewater Electric; Tidewater Electric Co-op", "tidewater-electric.example", "", "Utilities", "", "active", "2026-01-15", "setup"]]}]};
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Reset Demo', position: [240, 400] },
  output: [{}]
});

const clearRows = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Clear Register Rows',
    position: [480, 200],
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48/values:batchClear',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: CLEAR_BODY
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1d_w', clearedRanges: [] }]
});

const restoreSuppliers = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Restore Supplier List',
    position: [720, 200],
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48/values:batchUpdate',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: RESTORE_BODY
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1d_w', totalUpdatedRows: 5 }]
});

const listFiled = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Files in Filed, Other and Done',
    position: [480, 520],
    parameters: {
      resource: 'fileFolder',
      operation: 'search',
      searchMethod: 'query',
      queryString: "('1IG8wCIAjJpQrGIE2sRT39Jm9wccJQsmZ' in parents or '1TPg0f11y-ksAxyPBrELf4gKsulBZ4DLB' in parents or '1OwAnTllBb8jOo8p--Gm2LiT01LzSS-Q1' in parents) and mimeType != 'application/vnd.google-apps.folder' and trashed = false",
      returnAll: true,
      filter: { driveId: { __rl: true, mode: 'list', value: 'My Drive' } },
      options: { fields: ['id', 'name'] }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: '1abc', name: '2026-09-28 Harborline Produce Co. - INV-10482 - USD 544.55.pdf' }]
});

const trash = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Move to Trash',
    position: [720, 520],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 3000,
    parameters: {
      resource: 'file',
      operation: 'deleteFile',
      fileId: { __rl: true, mode: 'id', value: expr('{{ $json.id }}') },
      options: { deletePermanently: false }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: '1abc', success: true }]
});

const note = sticky(
  '## Reset Demo (manual, destructive)\n' +
  'Run before recording a demo. Empties the Documents and Line Items tabs, puts the Suppliers tab back to the five starting suppliers, and moves every file in **Filed**, **Other** and **Inbox/Done** to the Drive trash.\n\n' +
  'It does not touch the Demo documents folder, sent emails, or approval requests already waiting (those simply find no row to update).',
  [start, clearRows, restoreSuppliers, listFiled, trash],
  { color: 3 }
);

export default workflow('invoice-desk-reset-demo', 'Invoice Desk 8: Reset Demo')
  .add(start)
  .to(clearRows)
  .to(restoreSuppliers)
  .add(start)
  .to(listFiled)
  .to(trash)
  .add(note);
