import { workflow, node, trigger, sticky, splitInBatches, nextBatch, expr } from '@n8n/workflow-sdk';

const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Demo Documents', position: [240, 300] },
  output: [{}]
});

const listDemo = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'List Demo Folder',
    position: [480, 300],
    parameters: {
      resource: 'fileFolder',
      operation: 'search',
      searchMethod: 'name',
      queryString: '',
      returnAll: true,
      filter: {
        driveId: { __rl: true, mode: 'list', value: 'My Drive' },
        folderId: { __rl: true, mode: 'id', value: '1OvRhUVBESpPgvQG2PIplxZqaXgZkMPUg', cachedResultName: 'Demo documents' },
        whatToSearch: 'files'
      },
      options: { fields: ['id', 'name', 'mimeType'] }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: '1w3Z', name: 'harborline-produce-INV-10482.pdf', mimeType: 'application/pdf' }]
});

const plan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Plan Emails',
    position: [720, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__DEMO_EMAILS__
    }
  },
  output: [{ order: 1, file_id: '1w3Z', file: 'harborline-produce-INV-10482.pdf', from: 'Harborline Produce Co.', subject: 'Invoice INV-10482 from Harborline Produce Co.', body: 'Hi' }]
});

const loop = splitInBatches({ version: 3, config: { name: 'One at a Time', position: [960, 300], parameters: { batchSize: 1, options: {} } } });

const download = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Download Document',
    position: [1200, 400],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'file',
      operation: 'download',
      fileId: { __rl: true, mode: 'id', value: expr('{{ $json.file_id }}') },
      options: { binaryPropertyName: 'data', fileName: expr('{{ $json.file }}') }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: '1w3Z', name: 'harborline-produce-INV-10482.pdf' }]
});

const send = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email to Invoices Inbox',
    position: [1440, 400],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: 'samuelgurru+invoices@gmail.com',
      subject: expr("{{ $('One at a Time').item.json.subject }}"),
      emailType: 'text',
      message: expr("{{ $('One at a Time').item.json.body }}"),
      options: {
        appendAttribution: false,
        senderName: expr("{{ $('One at a Time').item.json.from }} (demo)"),
        attachmentsUi: { attachmentsBinary: [{ property: 'data' }] }
      }
    },
    credentials: { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } }
  },
  output: [{ id: '19a2', labelIds: ['SENT'] }]
});

const pause = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Pause 3 s', position: [1680, 400], parameters: { resume: 'timeInterval', amount: 3, unit: 'seconds' } },
  output: [{}]
});

const done = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'All Sent',
    position: [1200, 180],
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [
        { id: 'd1', name: 'sent', value: expr("{{ $('Plan Emails').all().length }}"), type: 'number' },
        { id: 'd2', name: 'next', value: 'Email Intake picks them up within a minute. Watch the register fill up.', type: 'string' }
      ] }
    }
  },
  output: [{ sent: 9 }]
});

const note = sticky(
  '## Send Demo Documents\n' +
  'For demos and recordings: emails the nine sample documents in the **Demo documents** Drive folder to the invoices inbox, one email each, written as if from the supplier, 3 seconds apart.\n\n' +
  '**Email Intake** picks them up within a minute: two approve automatically, one goes for approval, two need a check (an overcharged line and a bank change), a phone photo of a receipt and a scanned bill are read, a menu is set aside and a re-sent invoice is caught as a duplicate.',
  [start, listDemo, plan, loop, download, send, pause, done],
  { color: 7 }
);

export default workflow('invoice-desk-send-demo', 'Invoice Desk 7: Send Demo Documents')
  .add(start)
  .to(listDemo)
  .to(plan)
  .to(loop
    .onDone(done)
    .onEachBatch(download.to(send).to(pause).to(nextBatch(loop))))
  .add(note);
