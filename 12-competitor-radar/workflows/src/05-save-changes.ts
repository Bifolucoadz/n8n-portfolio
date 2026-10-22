import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const GMAIL_CRED = { gmailOAuth2: { id: '@@GMAIL_CRED_ID@@', name: 'Gmail account 2' } };
const DOC = { __rl: true, mode: 'id', value: '@@SHEET_ID@@', cachedResultName: 'Cobble & Spoke: Competitor Radar' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 760], parameters: { inputSource: 'passthrough' } },
  output: [{ plan: { mode: 'test', appends: {}, updates: {}, emails: [], result: { ok: true } } }]
});

const aChangesRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Changes Rows', position: [440, 80], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__APPEND_CHANGES__
  } },
  output: [{}]
});

const aChangesWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Changes',
    position: [680, 80],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Changes' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
__SCHEMA_CHANGES__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const aPricesRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prices Rows', position: [440, 240], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__APPEND_PRICES__
  } },
  output: [{}]
});

const aPricesWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Prices',
    position: [680, 240],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Prices' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
__SCHEMA_PRICES__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const aRunsRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Runs Rows', position: [440, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__APPEND_RUNS__
  } },
  output: [{}]
});

const aRunsWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Log Run',
    position: [680, 400],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Runs' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
__SCHEMA_RUNS__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const aMatchesRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Matches Rows', position: [440, 560], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__APPEND_MATCHES__
  } },
  output: [{}]
});

const aMatchesWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Matches',
    position: [680, 560],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Matches' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
__SCHEMA_MATCHES__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const aWatchlistRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Watchlist Rows', position: [440, 720], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__APPEND_WATCHLIST__
  } },
  output: [{}]
});

const aWatchlistWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Pages',
    position: [680, 720],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Watchlist' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
__SCHEMA_WATCHLIST__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const uWatchlistRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Watchlist Updates', position: [440, 880], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__UPDATE_WATCHLIST__
  } },
  output: [{ page_id: 'X' }]
});

const uWatchlistWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Pages',
    position: [680, 880],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'update', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Watchlist' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['page_id'], schema: [
__SCHEMA_WATCHLIST__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ page_id: 'X' }]
});

const uChangesRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Changes Updates', position: [440, 1040], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__UPDATE_CHANGES__
  } },
  output: [{ change_id: 'X' }]
});

const uChangesWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Changes',
    position: [680, 1040],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'update', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Changes' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['change_id'], schema: [
__SCHEMA_CHANGES__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ change_id: 'X' }]
});

const emails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Emails', position: [440, 1200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__EMAILS__
  } },
  output: [{ to: 'team@cobblespoke.example', subject: 'Alert', html: '<p>Hi</p>', kind: 'alert', links: '', live: false, at: '2026-10-22T07:05:00+01:00' }]
});

const isLive = ifElse({
  version: 2.2,
  config: {
    name: 'Live Mode?',
    position: [680, 1200],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.live }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const gmail = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send Email',
    position: [920, 1120],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'message', operation: 'send',
      sendTo: expr('{{ $json.to }}'), subject: expr('{{ $json.subject }}'), emailType: 'html', message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'Competitor Radar' }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: 'msg1' }]
});

const outbox = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Write to Outbox',
    position: [920, 1280],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Outbox' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
__SCHEMA_OUTBOX__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result', position: [440, 1400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__RESULT__
  } },
  output: [{ ok: true }]
});

const note = sticky(
  '## Radar 5: Save Changes\nThe other radar workflows decide what to write in code (a **plan**) and hand it here: new changes, price history, the run log, product matches and new pages are added; page states and "seen" flags are updated (only the columns given, as plain text). Alert and digest emails go out with Gmail in live mode or to the **Outbox** tab in test mode. **Result** runs last and is returned to the caller.',
  [], { position: [160, -140], width: 1000, height: 180, color: 7 }
);

export default workflow('radar-save-changes', 'Radar 5: Save Changes')
  .add(whenCalled.to(aChangesRows.to(aChangesWrite)))
  .add(whenCalled.to(aPricesRows.to(aPricesWrite)))
  .add(whenCalled.to(aRunsRows.to(aRunsWrite)))
  .add(whenCalled.to(aMatchesRows.to(aMatchesWrite)))
  .add(whenCalled.to(aWatchlistRows.to(aWatchlistWrite)))
  .add(whenCalled.to(uWatchlistRows.to(uWatchlistWrite)))
  .add(whenCalled.to(uChangesRows.to(uChangesWrite)))
  .add(whenCalled.to(emails.to(isLive.onTrue(gmail).onFalse(outbox))))
  .add(whenCalled.to(result))
  .add(note);
