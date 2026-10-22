import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const everyMonday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Mondays 8:00 am',
    position: [240, 220],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 0 8 * * 1' }] } }
  },
  output: [{ timestamp: '2026-10-05T08:00:00.000-04:00' }]
});

const sendNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Summary Now', position: [240, 420] },
  output: [{}]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [480, 320],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [
        { id: 'c1', name: 'BUSINESS', value: 'Saltmarsh Kitchen', type: 'string' },
        { id: 'c2', name: 'OWNER_EMAIL', value: 'samuelgurru@gmail.com', type: 'string' },
        { id: 'c3', name: 'TIMEZONE', value: 'America/New_York', type: 'string' },
        { id: 'c4', name: 'BASE_CURRENCY', value: 'USD', type: 'string' },
        { id: 'c5', name: 'MINUTES_SAVED_PER_DOC', value: 6, type: 'number' },
        { id: 'c6', name: 'SHEET_ID', value: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48', type: 'string' }
      ] }
    }
  },
  output: [{ BUSINESS: 'Saltmarsh Kitchen', OWNER_EMAIL: 'samuelgurru@gmail.com', TIMEZONE: 'America/New_York', BASE_CURRENCY: 'USD', MINUTES_SAVED_PER_DOC: 6, SHEET_ID: '1d_w' }]
});

const readRegister = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Register',
    position: [720, 320],
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: { __rl: true, mode: 'id', value: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48' }, sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Documents' } },
    credentials: { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } }
  },
  output: [{ row_number: 2, doc_id: 'SK-261001-YL9G', status: 'auto_approved', supplier: 'Harborline Produce Co.', total: 544.55, received_at: '2026-10-01T18:00:12.273-04:00' }]
});

const buildSummary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Summary',
    position: [960, 320],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__BUILD_SUMMARY__
    }
  },
  output: [{ subject: 'Invoice Desk weekly: 10 documents, USD 4,434.06 approved', html: '<div></div>', documents: 10 }]
});

const emailOwner = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email the Owner',
    position: [1200, 320],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr("{{ $('Config').first().json.OWNER_EMAIL }}"),
      subject: expr('{{ $json.subject }}'),
      emailType: 'html',
      message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'Invoice Desk' }
    },
    credentials: { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } }
  },
  output: [{ id: '19a1', labelIds: ['SENT'] }]
});

const note = sticky(
  '## Weekly Summary\n' +
  'Every Monday at 8:00 am (Portland, Maine time) the owner gets one email built from the register: documents in, spend approved by category and supplier, what is waiting on them, bills due in the next 7 days, overdue bills, and what the checks caught (overcharges, duplicates, bank changes).\n\n' +
  'Built in code with no AI, so every number is exact. Text from documents is escaped before it goes into the HTML.',
  [everyMonday, sendNow, config, readRegister, buildSummary, emailOwner],
  { color: 4 }
);

export default workflow('invoice-desk-weekly-summary', 'Invoice Desk 6: Weekly Summary')
  .add(everyMonday)
  .to(config)
  .add(sendNow)
  .to(config)
  .to(readRegister)
  .to(buildSummary)
  .to(emailOwner)
  .add(note);
