import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const DOC = { __rl: true, mode: 'id', value: '13IFBgri_0mBqjU5JZSvFjfmk4jVpqzGulaEWBLjJQks', cachedResultName: 'Brindle Studio: business data' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 300], parameters: { inputSource: 'passthrough' } },
  output: [{ audit: { at: '2026-10-22T10:00:00+01:00', server: 'team', tool: 'log_time', args_json: '{}', ok: 'yes', summary: 'Logged', ms: 40 } }]
});

const row = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Audit Row', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One row per tool call: when, which server, which tool, the arguments, whether it worked, and how long it took.\n' +
        'return $input.all().map(i => ({ json: i.json.audit }));\n'
  } },
  output: [{ at: '2026-10-22T10:00:00+01:00', tool: 'log_time' }]
});

const add = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add to Audit',
    position: [640, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Audit' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'server', displayName: 'server', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'tool', displayName: 'tool', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'args_json', displayName: 'args_json', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'ok', displayName: 'ok', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'summary', displayName: 'summary', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'ms', displayName: 'ms', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const note = sticky(
  '## Brindle 4: Audit Log\nRuns in the background after every tool call: when, which server (team or finance), which tool, the arguments, whether it worked or was refused, and how long it took. The owner can see in the **Audit** tab exactly what the AI asked for and changed.',
  [], { position: [160, 80], width: 660, height: 160, color: 7 }
);

export default workflow('brindle-audit-log', 'Brindle 4: Audit Log')
  .add(whenCalled)
  .to(row)
  .to(add)
  .add(note);
