import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

__SETUP_BODIES__
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };

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
    name: 'Create Calendar Sheet',
    position: [480, 400],
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
    name: 'Write Headers, Settings and Topics',
    position: [720, 400],
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
  output: [{ spreadsheetId: '1abc', totalUpdatedRows: 31 }]
});

const formatSheet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Format Sheet',
    position: [960, 400],
    parameters: {
      method: 'POST',
      url: expr("https://sheets.googleapis.com/v4/spreadsheets/{{ $('Create Calendar Sheet').item.json.spreadsheetId }}:batchUpdate"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: FORMAT_BODY
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc' }]
});

const createFolder = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Project Folder',
    position: [1200, 400],
    parameters: {
      method: 'POST',
      url: 'https://www.googleapis.com/drive/v3/files?fields=id,webViewLink',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: { name: 'Social Autopilot', mimeType: 'application/vnd.google-apps.folder' }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'f1', webViewLink: 'https://drive.google.com/drive/folders/f1' }]
});

const createImages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Images Folder',
    position: [1440, 400],
    parameters: {
      method: 'POST',
      url: 'https://www.googleapis.com/drive/v3/files?fields=id,webViewLink',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ { name: "Images", mimeType: "application/vnd.google-apps.folder", parents: [$json.id] } }}')
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'f2', webViewLink: 'https://drive.google.com/drive/folders/f2' }]
});

const moveSheet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Move Sheet Into Folder',
    position: [1680, 400],
    parameters: {
      method: 'PATCH',
      url: expr("https://www.googleapis.com/drive/v3/files/{{ $('Create Calendar Sheet').item.json.spreadsheetId }}?addParents={{ $('Create Project Folder').item.json.id }}&removeParents=root&fields=id,parents"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '{}'
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: '1abc', parents: ['f1'] }]
});

const summary = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'IDs To Copy',
    position: [1920, 400],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [
        { id: 's1', name: 'SHEET_ID', value: expr("{{ $('Create Calendar Sheet').item.json.spreadsheetId }}"), type: 'string' },
        { id: 's2', name: 'SHEET_URL', value: expr("{{ $('Create Calendar Sheet').item.json.spreadsheetUrl }}"), type: 'string' },
        { id: 's3', name: 'FOLDER_ID', value: expr("{{ $('Create Project Folder').item.json.id }}"), type: 'string' },
        { id: 's4', name: 'IMAGES_FOLDER_ID', value: expr("{{ $('Create Images Folder').item.json.id }}"), type: 'string' },
        { id: 's5', name: 'FOLDER_URL', value: expr("{{ $('Create Project Folder').item.json.webViewLink }}"), type: 'string' }
      ] },
      options: {}
    }
  },
  output: [{ SHEET_ID: '1abc', SHEET_URL: 'https://docs.google.com/spreadsheets/d/1abc/edit', FOLDER_ID: 'f1', IMAGES_FOLDER_ID: 'f2' }]
});

const note = sticky(
  '## Setup (run once)\n' +
  'Creates the content calendar sheet (Calendar and Settings tabs, eight starter topics), the Drive folder **Social Autopilot** with an **Images** subfolder, and moves the sheet into it.\n\n' +
  'Running it again makes a second copy. The IDs from the last node are pasted into the other workflows (see `workflows/ids.md`).',
  [], { position: [200, 120], width: 520, height: 220, color: 4 }
);

export default workflow('social-autopilot-setup', 'Social Autopilot 1: Setup')
  .add(start)
  .to(createSheet)
  .to(writeValues)
  .to(formatSheet)
  .to(createFolder)
  .to(createImages)
  .to(moveSheet)
  .to(summary)
  .add(note);
