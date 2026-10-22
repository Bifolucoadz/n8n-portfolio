import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const GMAIL_CRED = { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } };

const inbox = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.4,
  config: {
    name: 'Invoices Inbox',
    position: [240, 300],
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      simple: false,
      maxResults: 10,
      filters: { q: 'to:samuelgurru+invoices@gmail.com has:attachment', readStatus: 'both' },
      options: { downloadAttachments: true, dataPropertyAttachmentsPrefixName: 'attachment_' }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: '19a0', subject: 'Invoice INV-10482', date: '2026-10-01T22:00:00.000Z', from: { value: [{ address: 'orders@harborline-produce.example', name: 'Harborline' }] } }]
});

const split = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Split Attachments',
    position: [480, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__SPLIT_ATTACHMENTS__
    }
  },
  output: [{ source: 'email', sender: 'orders@harborline-produce.example', subject: 'Invoice INV-10482', received_at: '2026-10-01T18:00:00.000-04:00', original_filename: 'INV-10482.pdf', message_id: '19a0' }]
});

const processDoc = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Process Document',
    position: [720, 300],
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'each',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'v9Mp2015O3VcFURY', cachedResultName: 'Invoice Desk 1: Process Document' },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'auto_approved' }]
});

const emailsToLabel = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Emails to Label',
    position: [960, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__EMAILS_TO_LABEL__
    }
  },
  output: [{ message_id: '19a0' }]
});

const addLabel = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Label as Processed',
    position: [1200, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: { resource: 'message', operation: 'addLabels', messageId: expr('{{ $json.message_id }}'), labelIds: ['Label_2'] },
    credentials: GMAIL_CRED
  },
  output: [{ id: '19a0', labelIds: ['Label_2'] }]
});

const markRead = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Mark as Read',
    position: [1440, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: { resource: 'message', operation: 'markAsRead', messageId: expr("{{ $('Emails to Label').item.json.message_id }}") },
    credentials: GMAIL_CRED
  },
  output: [{ id: '19a0' }]
});

const note = sticky(
  '## Email Intake\n' +
  'Anything sent to **samuelgurru+invoices@gmail.com** with an attachment, checked every minute.\n\n' +
  'Each PDF or image attachment goes through **Process Document** (oldest email first, so a re-sent invoice is always checked after the original). Signature logos and calendar files are skipped. The email is then labelled *Invoice Desk/Processed* and marked read.',
  [inbox, split, processDoc, emailsToLabel, addLabel, markRead],
  { color: 4 }
);

export default workflow('invoice-desk-email-intake', 'Invoice Desk 3: Email Intake')
  .add(inbox)
  .to(split)
  .to(processDoc)
  .to(emailsToLabel)
  .to(addLabel)
  .to(markRead)
  .add(note);
