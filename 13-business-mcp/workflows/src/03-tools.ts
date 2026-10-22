import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const AUDIT_WF = { __rl: true, mode: 'id', value: 'bmsAuditLog00004', cachedResultName: 'Brindle 4: Audit Log' };
const DOC = { __rl: true, mode: 'id', value: '@@SHEET_ID@@', cachedResultName: 'Brindle Studio: business data' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 400], parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [ { name: 'tool', type: 'string' }, { name: 'server', type: 'string' }, { name: 'query', type: 'string' }, { name: 'client', type: 'string' }, { name: 'project', type: 'string' }, { name: 'person', type: 'string' }, { name: 'assignee', type: 'string' }, { name: 'task_id', type: 'string' }, { name: 'title', type: 'string' }, { name: 'status', type: 'string' }, { name: 'due', type: 'string' }, { name: 'priority', type: 'string' }, { name: 'hours', type: 'number' }, { name: 'date', type: 'string' }, { name: 'note', type: 'string' }, { name: 'billable', type: 'boolean' }, { name: 'week', type: 'string' }, { name: 'team', type: 'string' }, { name: 'due_within_days', type: 'number' }, { name: 'month', type: 'string' }, { name: 'confirm', type: 'boolean' } ] } } },
  output: [{ tool: 'project_status', server: 'team', project: 'Harbour & Co rebrand' }]
});

const loadData = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Data',
    position: [420, 400],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=Team&ranges=Clients&ranges=Projects&ranges=Tasks&ranges=Time&ranges=Invoices&valueRenderOption=UNFORMATTED_VALUE', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const runTool = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Run Tool', position: [640, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__RUN_TOOL__
  } },
  output: [{ answer: {}, write_kind: 'none', write: null, audit: {} }]
});

const audit = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Log to Audit', position: [860, 400], parameters: { source: 'database', workflowId: AUDIT_WF, mode: 'once', options: { waitForSubWorkflow: false } } }
});

const route = switchCase({
  version: 3.2,
  config: {
    name: 'What to Save?',
    position: [1080, 400],
    parameters: {
      rules: { values: [
        { outputKey: 'time', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Run Tool').first().json.write_kind }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'time' }], combinator: 'and' } },
        { outputKey: 'task_new', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Run Tool').first().json.write_kind }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'task_new' }], combinator: 'and' } },
        { outputKey: 'task_update', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Run Tool').first().json.write_kind }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'task_update' }], combinator: 'and' } },
        { outputKey: 'invoice', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Run Tool').first().json.write_kind }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'invoice' }], combinator: 'and' } }
      ] },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'Nothing' }
    }
  }
});

const timeRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Time Entry', position: [1320, 160], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TIME_ROWS__
  } },
  output: [{}]
});

const addTime = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Time Entry',
    position: [1540, 160],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Time' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
__SCHEMA_TIME__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const taskRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'New Task', position: [1320, 320], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TASK_ROWS__
  } },
  output: [{}]
});

const addTask = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Task',
    position: [1540, 320],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Tasks' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
__SCHEMA_TASKS__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const taskChange = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Task Change', position: [1320, 480], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TASK_CHANGE__
  } },
  output: [{}]
});

const updTask = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Task',
    position: [1540, 480],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      resource: 'sheet', operation: 'update', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Tasks' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['task_id'], schema: [
__SCHEMA_TASKS__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const invRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Draft Invoice', position: [1320, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__INVOICE_ROWS__
  } },
  output: [{}]
});

const addInv = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Invoice',
    position: [1540, 640],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Invoices' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
__SCHEMA_INVOICES__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const billed = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Billed Entries', position: [1760, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BILLED_ENTRIES__
  } },
  output: [{}]
});

const markBilled = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Mark Time Billed',
    position: [1980, 640],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      resource: 'sheet', operation: 'update', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Time' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['entry_id'], schema: [
__SCHEMA_TIME__
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const answer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer', position: [2200, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ANSWER__
  } },
  output: [{}]
});

const note = sticky(
  '## Brindle 3: Tools\nEvery MCP tool call lands here with its name and arguments. **Load Data** reads the whole Google Sheet in one request (Team, Clients, Projects, Tasks, Time, Invoices). **Run Tool** finds the client, project or person (by name or ID, and says when a name is ambiguous), checks access (finance tools only through the finance server), and answers in code from the data, so the numbers are exact. For writes it checks the input first, for example no future dates, at most 12 hours a day, no time on finished projects, and invoices only after a preview. Each call is logged to the **Audit** tab without slowing the answer.',
  [], { position: [160, -120], width: 1240, height: 200, color: 7 }
);

export default workflow('brindle-tools', 'Brindle 3: Tools')
  .add(whenCalled)
  .to(loadData)
  .to(runTool)
  .to(audit)
  .to(route
    .onCase(0, timeRows.to(addTime.to(answer)))
    .onCase(1, taskRows.to(addTask.to(answer)))
    .onCase(2, taskChange.to(updTask.to(answer)))
    .onCase(3, invRows.to(addInv.to(billed.to(markBilled.to(answer)))))
    .onCase(4, answer))
  .add(note);
