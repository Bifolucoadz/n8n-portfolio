import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'ilfPostgresLocal', name: 'Ironleaf Postgres (local)' } };
const SETTINGS = { __rl: true, mode: 'id', value: 'eLHuDVWvuDw7XkhB', cachedResultName: 'Ironleaf Settings' };
const REPORTS = { __rl: true, mode: 'id', value: 'B5yiB01JQHOCKTZ2', cachedResultName: 'Ironleaf Reports' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ilfSendEmail0005', cachedResultName: 'Ironleaf 5: Send Email' };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const monday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Mondays 7:00', position: [200, 300], parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 7, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const runNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [440, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'anomaly_z', value: '2' }]
});

const query = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Weekly Query', position: [660, 400], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__QUERY__
  } },
  output: [{ sql_b64: 'U0VMRUNUIDE=' }]
});

const run = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Last 9 Weeks',
    position: [880, 400],
    parameters: { operation: 'executeQuery', query: 'SELECT ironleaf.run_readonly(convert_from(decode($1, \'base64\'), \'UTF8\')) AS rows', options: { queryReplacement: expr('{{ $json.sql_b64 }}'), largeNumbersOutput: 'numbers' } },
    credentials: PG_CRED
  },
  output: [{ rows: [{ branch: 'Stockport', week: '2026-10-12', check_ins: 203 }] }]
});

const flags = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Flag Changes', position: [1100, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__FLAGS__
  } },
  output: [{ week: '2026-10-12', flags: [], prompt: 'Last week: ...' }]
});

const write = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Write Summary',
    position: [1320, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text', operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_ANOMALY_WRITER__
        ,
        maxTokens: 2500, store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'anomalies', strict: true, schema:
__JSON_ANOMALIES__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { headline: 'Stockport check-ins fell 45%.', items: [] } }] }] }]
});

const report = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Report', position: [1540, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__REPORT__
  } },
  output: [{ email: {}, report: {} }]
});

const save = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Report', position: [1760, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: REPORTS, columns: { mappingMode: 'defineBelow', value: {
    kind: expr('{{ $json.report.kind }}'), period: expr('{{ $json.report.period }}'), summary: expr('{{ $json.report.summary }}'), data_json: expr('{{ $json.report.data_json }}'), created_at: expr('{{ $json.report.created_at }}')
  }, schema: [
__SCHEMA_REPORTS__
  ] } } },
  output: [{ id: 1 }]
});

const emailItem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Email Item', position: [1980, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// The report email for Send Email.\nreturn [{ json: $(\'Report\').first().json.email }];\n' } },
  output: [{ to: 'rachel.moss@ironleaf.example', subject: 'Week of ...', html: '<p>Report</p>', kind: 'weekly_anomalies', ref: '' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Email the Owner', position: [2200, 400], parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Ironleaf 3: Weekly Anomalies\nEvery Monday at 7:00. A fixed query (through the same read-only function) gets check-ins, new members, cancellations, failed payments and revenue per branch for the last 9 full weeks. **Flag Changes** (code) compares last week with the 8 weeks before and flags anything at least 2 standard deviations and 15% away from normal. GPT-5.4 writes the headline and what to check, using only those numbers. The report is saved and emailed to the owner.',
  [], { position: [160, 60], width: 1300, height: 200, color: 5 }
);

export default workflow('ironleaf-weekly-anomalies', 'Ironleaf 3: Weekly Anomalies')
  .add(monday)
  .to(readSettings)
  .to(query)
  .to(run)
  .to(flags)
  .to(write)
  .to(report)
  .to(save)
  .to(emailItem)
  .to(send)
  .add(runNow)
  .to(readSettings)
  .add(note);
