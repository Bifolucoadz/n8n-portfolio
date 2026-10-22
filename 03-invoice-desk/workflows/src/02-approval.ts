import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const GMAIL_CRED = { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called',
    position: [240, 300],
    parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'record', type: 'object' }] } }
  },
  output: [{ record: { doc_id: 'SK-261001-K7QM', status: 'pending_approval', supplier: 'Frostline Refrigeration Services', supplier_status: 'new', doc_type: 'invoice', invoice_number: 'FR-7731', currency: 'USD', total: 2548.91, flags: [{ level: 'approve', text: 'New supplier' }], lines: [], drive_link: 'https://drive.google.com/file/d/x/view' } }]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [460, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [
        { id: 'c1', name: 'APPROVER_EMAIL', value: 'samuelgurru@gmail.com', type: 'string' },
        { id: 'c2', name: 'TIMEZONE', value: 'America/New_York', type: 'string' },
        { id: 'c3', name: 'SHEET_ID', value: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48', type: 'string' },
        { id: 'c4', name: 'WAIT_DAYS', value: 7, type: 'number' }
      ] }
    }
  },
  output: [{ APPROVER_EMAIL: 'samuelgurru@gmail.com', TIMEZONE: 'America/New_York', SHEET_ID: '1d_w', WAIT_DAYS: 7 }]
});

const buildEmail = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Email',
    position: [680, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__BUILD_EMAIL__
    }
  },
  output: [{ subject: 'Approve: Frostline Refrigeration Services, USD 2,548.91', html: '<div></div>', record: { doc_id: 'SK-261001-K7QM' } }]
});

const askApproval = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Ask for Approval',
    position: [900, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'sendAndWait',
      sendTo: expr("{{ $('Config').first().json.APPROVER_EMAIL }}"),
      subject: expr('{{ $json.subject }}'),
      message: expr('{{ $json.html }}'),
      responseType: 'approval',
      approvalOptions: { values: { approvalType: 'double', approveLabel: 'Approve', buttonApprovalStyle: 'primary', disapproveLabel: 'Reject', buttonDisapprovalStyle: 'secondary' } },
      options: {
        limitWaitTime: { values: { limitType: 'afterTimeInterval', resumeAmount: expr("{{ $('Config').first().json.WAIT_DAYS }}"), resumeUnit: 'days' } },
        appendAttribution: false
      }
    },
    credentials: GMAIL_CRED
  },
  output: [{ data: { approved: true } }]
});

const recordDecision = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Record Decision',
    position: [1120, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__RECORD_DECISION__
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'approved', decided_by: 'samuelgurru@gmail.com', decided_at: '2026-10-01T18:00:00.000-04:00', payment_status: 'unpaid', approved: true, record: {} }]
});

const updateRow = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Document Row',
    position: [1340, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'update',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Documents' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          doc_id: expr('{{ $json.doc_id }}'),
          status: expr('{{ $json.status }}'),
          decided_by: expr('{{ $json.decided_by }}'),
          decided_at: expr('{{ $json.decided_at }}'),
          payment_status: expr('{{ $json.payment_status }}')
        },
        matchingColumns: ['doc_id'],
        schema: [
          { id: 'doc_id', displayName: 'doc_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'decided_by', displayName: 'decided_by', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'decided_at', displayName: 'decided_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'payment_status', displayName: 'payment_status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'approved' }]
});

const supplierChange = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Supplier Change',
    position: [1560, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__SUPPLIER_CHANGE__
    }
  },
  output: [{ action: 'add', supplier: 'Frostline Refrigeration Services', aliases: '', email_domain: 'frostline-refrigeration.example', tax_id: '00-0927745', default_category: 'Repairs & maintenance', bank_last4: '5108', status: 'active', added_at: '2026-10-01', added_by: 'approval SK-261001-K7QM' }]
});

const routeChange = switchCase({
  version: 3.2,
  config: {
    name: 'Add or Update?',
    position: [1780, 300],
    parameters: {
      rules: {
        values: [
          { outputKey: 'add', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'add' }], combinator: 'and' } },
          { outputKey: 'update_bank', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'update_bank' }], combinator: 'and' } }
        ]
      },
      options: {}
    }
  }
});

const addSupplier = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add to Supplier List',
    position: [2020, 200],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '2', cachedResultName: 'Suppliers' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          supplier: expr('{{ $json.supplier }}'),
          aliases: expr('{{ $json.aliases }}'),
          email_domain: expr('{{ $json.email_domain }}'),
          tax_id: expr('{{ $json.tax_id }}'),
          default_category: expr('{{ $json.default_category }}'),
          bank_last4: expr('{{ $json.bank_last4 }}'),
          status: expr('{{ $json.status }}'),
          added_at: expr('{{ $json.added_at }}'),
          added_by: expr('{{ $json.added_by }}')
        },
        schema: [
          { id: 'supplier', displayName: 'supplier', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'aliases', displayName: 'aliases', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'email_domain', displayName: 'email_domain', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'tax_id', displayName: 'tax_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'default_category', displayName: 'default_category', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'bank_last4', displayName: 'bank_last4', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'added_at', displayName: 'added_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'added_by', displayName: 'added_by', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true }
    },
    credentials: SHEETS_CRED
  },
  output: [{ supplier: 'Frostline Refrigeration Services' }]
});

const updateBank = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Bank on File',
    position: [2020, 400],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'update',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '2', cachedResultName: 'Suppliers' },
      columns: {
        mappingMode: 'defineBelow',
        value: { supplier: expr('{{ $json.supplier }}'), bank_last4: expr('{{ $json.bank_last4 }}') },
        matchingColumns: ['supplier'],
        schema: [
          { id: 'supplier', displayName: 'supplier', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'bank_last4', displayName: 'bank_last4', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ supplier: 'Bluewick Linen Service', bank_last4: '9047' }]
});

const note = sticky(
  '## Approval\n' +
  'Called by **Process Document** (not awaited) for anything over the limit, from a new supplier, in another currency, or failing a check.\n\n' +
  'The owner gets one email with what the document is, why it needs them, the lines and a link to the file, plus **Approve** / **Reject** buttons. The run waits up to 7 days.\n\n' +
  'The click updates the register. Approving a new supplier adds it to the supplier list; approving a confirmed bank change makes the new account the one on file. No click: the row stays as it is and the weekly summary lists it.',
  [whenCalled, config, buildEmail, askApproval, recordDecision, updateRow, supplierChange, routeChange, addSupplier, updateBank],
  { color: 5 }
);

export default workflow('invoice-desk-approval', 'Invoice Desk 2: Approval')
  .add(whenCalled)
  .to(config)
  .to(buildEmail)
  .to(askApproval)
  .to(recordDecision)
  .to(updateRow)
  .to(supplierChange)
  .to(routeChange.onCase(0, addSupplier).onCase(1, updateBank))
  .add(note);
