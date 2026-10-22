import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'ilfPostgresLocal', name: 'Ironleaf Postgres (local)' } };
const EVAL = { __rl: true, mode: 'id', value: 'Ttb7o3Bj7C1j5SrL', cachedResultName: 'Ironleaf Eval' };
const ANSWER_WF = { __rl: true, mode: 'id', value: 'ilfAnswerQues001', cachedResultName: 'Ironleaf 1: Answer Question' };

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Evaluation', position: [200, 300] },
  output: [{}]
});

const questions = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Questions', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__QUESTIONS__
  } },
  output: [{ qid: 'Q01', question: 'How many active members do we have?', sql: 'SELECT 1', sql_b64: 'U0VMRUNUIDE=', session_id: 'eval-Q01', history: '[]' }]
});

const reference = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Reference',
    position: [640, 300],
    parameters: { operation: 'executeQuery', query: 'SELECT ironleaf.run_readonly(convert_from(decode($1, \'base64\'), \'UTF8\')) AS rows', options: { queryReplacement: expr('{{ $json.sql_b64 }}'), largeNumbersOutput: 'numbers' } },
    credentials: PG_CRED
  },
  output: [{ rows: [{ active_members: 1271 }] }]
});

const items = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Ask Items', position: [860, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// One question per item for the assistant (no chat history).\nreturn $(\'Questions\').all().map(i => ({ json: { question: i.json.question, session_id: i.json.session_id, history: \'[]\' } }));\n' } },
  output: [{ question: 'How many active members do we have?', session_id: 'eval-Q01', history: '[]' }]
});

const ask = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Ask Assistant', position: [1080, 300], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: ANSWER_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const compare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Compare', position: [1300, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__COMPARE__
  } },
  output: [{ qid: 'Q01', pass: true }]
});

const save = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Results', position: [1520, 300], parameters: { resource: 'row', operation: 'insert', dataTableId: EVAL, columns: { mappingMode: 'defineBelow', value: {
__MAP_EVAL__
  }, schema: [
__SCHEMA_EVAL__
  ] } } },
  output: [{ id: 1 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Score', position: [1740, 300], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SUMMARY__
  } },
  output: [{ questions: 19, passed: 18, accuracy_pct: 94.7 }]
});

const note = sticky(
  '## Ironleaf 4: Evaluation (manual)\n19 questions a manager would ask, each with reference SQL written by hand using the same definitions the assistant gets. Each question goes through the real assistant (**Ironleaf 1**), and **Compare** passes it only if every value in the reference result appears in the assistant\'s result (numbers within 0.6% for rounding). Results go to **Ironleaf Eval**, with the SQL the assistant wrote.',
  [], { position: [160, 60], width: 1100, height: 180, color: 6 }
);

export default workflow('ironleaf-evaluation', 'Ironleaf 4: Evaluation')
  .add(run)
  .to(questions)
  .to(reference)
  .to(items)
  .to(ask)
  .to(compare)
  .to(save)
  .to(summary)
  .add(note);
