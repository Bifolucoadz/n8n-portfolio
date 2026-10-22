import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [240, 300], parameters: { inputSource: 'passthrough' } },
  output: [{ sheet_id: '1abc', row: { at: '2026-10-28 10:15', caller_name: 'Jane Doe', phone: '+15125550123', message: 'Please call about my bill', urgent: 'no', status: 'new', call_id: 'call-1' } }]
});

const append = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Append Message',
    position: [460, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: { __rl: true, mode: 'id', value: expr('{{ $json.sheet_id }}') },
      sheetName: { __rl: true, mode: 'id', value: '2', cachedResultName: 'Messages' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          at: expr('{{ $json.row.at }}'),
          caller_name: expr('{{ $json.row.caller_name }}'),
          phone: expr('{{ $json.row.phone }}'),
          message: expr('{{ $json.row.message }}'),
          urgent: expr('{{ $json.row.urgent }}'),
          status: expr('{{ $json.row.status }}'),
          call_id: expr('{{ $json.row.call_id }}')
        },
        schema: [
          { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'caller_name', displayName: 'caller_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'message', displayName: 'message', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'urgent', displayName: 'urgent', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'call_id', displayName: 'call_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true }
    },
    credentials: SHEETS_CRED
  },
  output: [{ at: '2026-10-28 10:15' }]
});

const note = sticky(
  '## Receptionist 4: Log Row\nCalled by **Receptionist 2** without waiting, so a slow Google Sheets append never holds up the caller. Adds one row to the **Messages** tab of the Front Desk sheet.',
  [], { position: [180, 80], width: 520, height: 180, color: 4 }
);

export default workflow('receptionist-log-row', 'Receptionist 4: Log Row')
  .add(whenCalled)
  .to(append)
  .add(note);
