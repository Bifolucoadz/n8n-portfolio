import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const CREATE_SHEET_BODY = {"properties": {"title": "Social Autopilot: Content Calendar", "timeZone": "Africa/Lagos"}, "sheets": [{"properties": {"sheetId": 0, "title": "Calendar", "gridProperties": {"frozenRowCount": 1, "frozenColumnCount": 3}}}, {"properties": {"sheetId": 1, "title": "Settings", "gridProperties": {"frozenRowCount": 1}}}]};
const SHEET_VALUES_BODY = {"valueInputOption": "RAW", "data": [{"range": "Calendar!A1", "values": [["post_id", "publish_at", "topic", "notes", "link", "image", "platforms", "status", "linkedin_text", "telegram_text", "image_link", "linkedin_url", "telegram_url", "error", "drafted_at", "approved_at", "posted_at", "feedback", "image_file_id", "preview_message_id", "reminded_at", "attempts", "updated_at"], ["", "", "Why small businesses lose leads in the first five minutes, and how an instant automatic reply fixes it", "Most enquiries go to whoever answers first. An automation can reply within seconds, answer the basic questions and offer a booking time. Keep it practical.", "", "ai", "", "idea", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""], ["", "", "Demo walkthrough: a 24/7 chat assistant for a car repair shop", "Copperline Auto Repair demo: answers from the shop's own documents, books into Google Calendar, weekly report for the owner. What it handles and what it hands to a human.", "", "ai", "", "idea", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""], ["", "", "Demo walkthrough: an AI inbox that reads supplier invoices for a restaurant", "Saltmarsh Kitchen Invoice Desk demo: reads PDFs and phone photos, checks the maths, flags duplicates and changed bank details, asks the owner before paying anything unusual.", "", "ai", "", "idea", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""], ["", "", "Follow-ups are the most boring automation and often the most valuable", "Many sales are lost to no follow-up, not to a no. A simple sequence that stops when the person replies. Contrast manual vs automatic.", "", "none", "", "idea", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""], ["", "", "The first three things I automate for a new client", "1) instant reply to new enquiries, 2) appointment booking and reminders, 3) a weekly summary so the owner sees what happened. Why this order.", "", "ai", "", "idea", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""], ["", "", "Why my AI automations ask a human before they act", "Human-in-the-loop: approvals for big invoices, previews before posts go out. AI drafts, a person decides. Builds trust and catches mistakes.", "", "none", "", "idea", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""], ["", "", "Behind the scenes: this post was drafted by an automation I built", "Social Autopilot: topics go in a Google Sheet, AI drafts a version per platform, I approve from my phone, it posts at the scheduled time.", "", "ai", "", "idea", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""], ["", "", "How to find out which admin tasks are worth automating", "Simple exercise: for one week write down every repetitive task and how long it takes. Anything done daily and taking over 10 minutes is a candidate.", "", "none", "", "idea", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]]}, {"range": "Settings!A1", "values": [["key", "value", "what it does"], ["brand_name", "Samuel Oladele", "Name the posts are written as"], ["what_you_do", "I build AI automations for small businesses: instant replies to new leads, follow-ups, appointment booking, AI support assistants and invoice processing.", "One or two sentences about your offer"], ["audience", "Owners and managers of small service businesses (clinics, repair shops, restaurants, agencies) who lose hours every week to repetitive admin.", "Who the posts are for"], ["voice", "Plain, practical and friendly. First person. Short sentences. Concrete examples over hype. Sounds like a builder explaining what they made, not a marketer.", "How the posts should sound"], ["facts", "I build automations in n8n with OpenAI. Portfolio demos, built for fictional businesses (always describe them as demos, never as clients or real results): 1) Lead Generation Engine: finds local businesses on Google Maps, scores each one with AI, writes a personal opening line, sends a three-email sequence and stops the moment someone replies. 2) Copperline Auto Repair support bot: a website chat assistant for a car repair shop that answers questions from the shop's own documents, books appointments into Google Calendar and sends the owner a weekly report. 3) Saltmarsh Kitchen Invoice Desk: an accounts-payable inbox for a restaurant that reads invoices from email, an upload form or a Drive folder, checks the maths, catches duplicates and changed bank details, files every document and asks the owner to approve big or unusual bills. 4) Social Autopilot (this system): drafts posts from a content calendar, sends each draft to my phone for approval and publishes to LinkedIn and Telegram.", "True things the AI may mention. It must not invent clients, numbers or results"], ["avoid", "Buzzwords (game-changer, unlock, leverage, revolutionise, delve, seamless), em dashes, fake urgency, made-up statistics, more than two emojis.", "Words and habits to stay away from"], ["call_to_action", "If you want something like this for your business, send me a message.", "Closing line idea. The AI adapts it per platform"], ["default_link", "", "Optional link added when a row has none (e.g. your portfolio page)"], ["hashtags", "#automation #AI #smallbusiness #n8n", "Pool of hashtags. LinkedIn uses up to 3, Telegram none"], ["image_style", "Clean modern flat illustration, warm colours, soft light, simple shapes, no text, no logos, no people's faces.", "Style for AI images"], ["default_image", "ai", "Used when a row's image cell is blank: ai or none"], ["default_platforms", "linkedin, telegram", "Used when a row's platforms cell is blank"], ["post_days", "Mon, Wed, Fri", "Days that get an automatic slot"], ["post_time", "09:00", "Time of the automatic slot (24 h)"], ["timezone", "Africa/Lagos", "Time zone for publish_at and post_time"], ["draft_hours_ahead", "48", "How many hours before publish_at the draft is written and sent for approval"], ["require_approval", "yes", "yes = every post waits for your Approve tap. no = drafts are approved automatically"], ["mode", "test", "test = send what would be posted to you in Telegram instead of posting. live = really post"], ["telegram_channel", "", "Your public channel, e.g. @samuel_automates (the bot must be an admin)"], ["linkedin_visibility", "PUBLIC", "PUBLIC or CONNECTIONS"]]}]};
const FORMAT_BODY = {"requests": [{"repeatCell": {"range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 1}, "cell": {"userEnteredFormat": {"textFormat": {"bold": true}, "backgroundColor": {"red": 0.93, "green": 0.95, "blue": 0.97}}}, "fields": "userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor"}}, {"repeatCell": {"range": {"sheetId": 1, "startRowIndex": 0, "endRowIndex": 1}, "cell": {"userEnteredFormat": {"textFormat": {"bold": true}, "backgroundColor": {"red": 0.93, "green": 0.95, "blue": 0.97}}}, "fields": "userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor"}}, {"repeatCell": {"range": {"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 1, "endColumnIndex": 2}, "cell": {"userEnteredFormat": {"numberFormat": {"type": "TEXT"}}}, "fields": "userEnteredFormat.numberFormat"}}, {"repeatCell": {"range": {"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 4}, "cell": {"userEnteredFormat": {"wrapStrategy": "WRAP", "verticalAlignment": "TOP"}}, "fields": "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment"}}, {"repeatCell": {"range": {"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 8, "endColumnIndex": 10}, "cell": {"userEnteredFormat": {"wrapStrategy": "CLIP", "verticalAlignment": "TOP"}}, "fields": "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment"}}, {"setDataValidation": {"range": {"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}, "rule": {"condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": "idea"}, {"userEnteredValue": "drafting"}, {"userEnteredValue": "in_review"}, {"userEnteredValue": "approved"}, {"userEnteredValue": "publishing"}, {"userEnteredValue": "posted"}, {"userEnteredValue": "test_posted"}, {"userEnteredValue": "partial"}, {"userEnteredValue": "failed"}, {"userEnteredValue": "rejected"}, {"userEnteredValue": "needs_fix"}, {"userEnteredValue": "suggested"}]}, "strict": false, "showCustomUi": true}}}, {"setDataValidation": {"range": {"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 5, "endColumnIndex": 6}, "rule": {"condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": "ai"}, {"userEnteredValue": "none"}]}, "strict": false, "showCustomUi": true, "inputMessage": "ai, none, or paste an image URL / Drive link"}}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 1}, "properties": {"pixelSize": 90}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 1, "endIndex": 2}, "properties": {"pixelSize": 130}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 2, "endIndex": 3}, "properties": {"pixelSize": 300}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 3, "endIndex": 4}, "properties": {"pixelSize": 340}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 4, "endIndex": 7}, "properties": {"pixelSize": 140}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 7, "endIndex": 8}, "properties": {"pixelSize": 110}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 8, "endIndex": 10}, "properties": {"pixelSize": 320}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 13, "endIndex": 14}, "properties": {"pixelSize": 260}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 1, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 1}, "properties": {"pixelSize": 170}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 1, "dimension": "COLUMNS", "startIndex": 1, "endIndex": 2}, "properties": {"pixelSize": 520}, "fields": "pixelSize"}}, {"updateDimensionProperties": {"range": {"sheetId": 1, "dimension": "COLUMNS", "startIndex": 2, "endIndex": 3}, "properties": {"pixelSize": 420}, "fields": "pixelSize"}}, {"repeatCell": {"range": {"sheetId": 1, "startRowIndex": 1, "startColumnIndex": 1, "endColumnIndex": 3}, "cell": {"userEnteredFormat": {"wrapStrategy": "WRAP", "verticalAlignment": "TOP"}}, "fields": "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment"}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "idea"}]}, "format": {"backgroundColor": {"red": 0.95, "green": 0.95, "blue": 0.95}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "suggested"}]}, "format": {"backgroundColor": {"red": 0.93, "green": 0.93, "blue": 0.98}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "drafting"}]}, "format": {"backgroundColor": {"red": 0.89, "green": 0.93, "blue": 0.99}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "in_review"}]}, "format": {"backgroundColor": {"red": 1.0, "green": 0.93, "blue": 0.76}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "approved"}]}, "format": {"backgroundColor": {"red": 0.8, "green": 0.9, "blue": 0.99}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "publishing"}]}, "format": {"backgroundColor": {"red": 0.8, "green": 0.9, "blue": 0.99}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "posted"}]}, "format": {"backgroundColor": {"red": 0.78, "green": 0.91, "blue": 0.78}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "test_posted"}]}, "format": {"backgroundColor": {"red": 0.88, "green": 0.95, "blue": 0.86}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "partial"}]}, "format": {"backgroundColor": {"red": 1.0, "green": 0.86, "blue": 0.7}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "failed"}]}, "format": {"backgroundColor": {"red": 0.98, "green": 0.8, "blue": 0.78}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "needs_fix"}]}, "format": {"backgroundColor": {"red": 0.98, "green": 0.8, "blue": 0.78}}}}}}, {"addConditionalFormatRule": {"index": 0, "rule": {"ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": 7, "endColumnIndex": 8}], "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": "rejected"}]}, "format": {"backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9}}}}}}]};
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
