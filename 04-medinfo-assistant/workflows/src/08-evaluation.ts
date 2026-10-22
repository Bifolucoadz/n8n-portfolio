import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const EVAL_TABLE = { __rl: true, mode: 'id', value: 'afak5piZxvU55Lyf', cachedResultName: 'MedInfo Eval' };

const evalTrigger = trigger({
  type: 'n8n-nodes-base.evaluationTrigger',
  version: 4.7,
  config: {
    name: 'When Eval Runs',
    position: [200, 200],
    parameters: { source: 'dataTable', dataTableId: EVAL_TABLE }
  },
  output: [{ qid: 'q01', role: 'hcp', question: 'What is the recommended Quenvara dose for nonvalvular atrial fibrillation?', expected_answer: '5 mg orally twice daily.', expected_route: 'answered', expected_doc: 'LRK-PI-QNV', must_not_cite: '' }]
});

const runAll = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run All Rows', position: [200, 420] },
  output: [{}]
});

const getRows = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get Test Questions',
    position: [420, 420],
    parameters: { resource: 'row', operation: 'get', dataTableId: EVAL_TABLE, returnAll: true }
  },
  output: [{ id: 1, qid: 'q01', role: 'hcp', question: 'What is the recommended Quenvara dose for nonvalvular atrial fibrillation?', expected_answer: '5 mg orally twice daily.', expected_route: 'answered', expected_doc: 'LRK-PI-QNV', must_not_cite: '' }]
});

const evalInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Eval Input',
    position: [660, 300],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode:
__EVAL_INPUT__
    }
  },
  output: [{ qid: 'q01', role: 'hcp', question: 'What is the recommended Quenvara dose for nonvalvular atrial fibrillation?', expected_answer: '5 mg orally twice daily.', expected_route: 'answered', expected_doc: 'LRK-PI-QNV', must_not_cite: '', session_id: 'eval-q01-700' }]
});

const answer = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Answer',
    position: [880, 300],
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'each',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'Rxr2YwhZ721sNvQy', cachedResultName: 'MedInfo 5: Answer' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          message: expr('{{ $json.question }}'),
          session_id: expr('{{ $json.session_id }}'),
          role: expr('{{ $json.role }}'),
          channel: 'eval',
          dry_run: true
        },
        schema: [
          { id: 'message', displayName: 'message', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'role', displayName: 'role', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'channel', displayName: 'channel', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'dry_run', displayName: 'dry_run', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'boolean' }
        ]
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ answer: 'Quenvara 5 mg orally twice daily [1].', sources: [{ n: 1, id: 'c317', doc_code: 'LRK-PI-QNV', version: '5.0', status: 'current', section: '2.1 Recommended dosage' }], route: 'answered', flags: {}, case_refs: [], latency_ms: 7000 }]
});

const passages = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Cited Passages',
    position: [1100, 300],
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      query:
        "select coalesce((select jsonb_agg(jsonb_build_object('id', 'c' || c.id, 'text', c.content)) from kb_chunks c\n" +
        "  where ('c' || c.id) = any (array(select jsonb_array_elements_text($1::jsonb)))), '[]'::jsonb)\n" +
        "  || coalesce((select jsonb_agg(jsonb_build_object('id', 'p' || x.id, 'text', concat_ws(' | ', x.product, x.strength, x.package,\n" +
        "     'NDC ' || x.ndc, 'storage ' || x.storage, 'list price $' || x.list_price, x.supply_status, x.notes))) from kb_products x\n" +
        "  where ('p' || x.id) = any (array(select jsonb_array_elements_text($1::jsonb)))), '[]'::jsonb) as passages;",
      options: { queryReplacement: expr('{{ JSON.stringify(($json.sources ?? []).map(s => s.id)) }}'), queryBatching: 'independently' }
    },
    credentials: { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } }
  },
  output: [{ passages: [{ id: 'c317', text: '| Nonvalvular atrial fibrillation | 5 mg orally twice daily |' }] }]
});

const judgePrompt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Judge Prompt',
    position: [1320, 300],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode:
__JUDGE_PROMPT__
    }
  },
  output: [{ prompt: '<question role="hcp">...</question>' }]
});

const judge = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Judge Answer',
    position: [1540, 300],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_EVAL_JUDGE__
        ,
        maxTokens: 3000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'eval_judge', strict: true, schema:
__SCHEMA_EVAL_JUDGE__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { correctness: 5, grounded: 5, reason: 'ok' } }] }] }]
});

const score = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Score',
    position: [1760, 300],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode:
__SCORE__
    }
  },
  output: [{ qid: 'q01', role: 'hcp', question: '...', actual_route: 'answered', actual_answer: '...', actual_sources: 'LRK-PI-QNV', route_ok: 1, retrieval_hit: 1, access_ok: 1, correctness: 5, grounded: 5, judge_reason: 'ok', latency_ms: 7000 }]
});

const isEval = node({
  type: 'n8n-nodes-base.evaluation',
  version: 4.8,
  config: {
    name: 'Evaluation Run?',
    position: [1980, 300],
    parameters: { operation: 'checkIfEvaluating' }
  },
  output: [{ qid: 'q01', route_ok: 1 }]
});

const setOutputs = node({
  type: 'n8n-nodes-base.evaluation',
  version: 4.8,
  config: {
    name: 'Record Outputs',
    position: [2200, 200],
    parameters: {
      operation: 'setOutputs',
      source: 'dataTable',
      dataTableId: EVAL_TABLE,
      outputs: {
        values: [
          { outputName: 'actual_answer', outputValue: expr('{{ $json.actual_answer }}') },
          { outputName: 'actual_route', outputValue: expr('{{ $json.actual_route }}') },
          { outputName: 'actual_sources', outputValue: expr('{{ $json.actual_sources }}') }
        ]
      }
    }
  },
  output: [{ qid: 'q01' }]
});

const setMetrics = node({
  type: 'n8n-nodes-base.evaluation',
  version: 4.8,
  config: {
    name: 'Record Metrics',
    position: [2420, 200],
    parameters: {
      operation: 'setMetrics',
      metric: 'customMetrics',
      metrics: {
        assignments: [
          { id: 'route', name: 'route_ok', value: expr("{{ $('Score').item.json.route_ok }}"), type: 'number' },
          { id: 'hit', name: 'retrieval_hit', value: expr("{{ $('Score').item.json.retrieval_hit }}"), type: 'number' },
          { id: 'access', name: 'access_ok', value: expr("{{ $('Score').item.json.access_ok }}"), type: 'number' },
          { id: 'correct', name: 'correctness', value: expr("{{ $('Score').item.json.correctness }}"), type: 'number' },
          { id: 'grounded', name: 'grounded', value: expr("{{ $('Score').item.json.grounded }}"), type: 'number' }
        ]
      }
    }
  },
  output: [{ route_ok: 1, retrieval_hit: 1, access_ok: 1, correctness: 5, grounded: 5 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Summary',
    position: [2200, 420],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__SUMMARY__
    }
  },
  output: [{ questions: 28, route_ok_pct: 100, retrieval_hit_pct: 100, access_ok_pct: 100, correctness_avg: 4.8, grounded_avg: 4.9, misses: [] }]
});

const note = sticky(
  '## MedInfo 8: Evaluation\n' +
  'Runs the 28 test questions in the **MedInfo Eval** data table through **MedInfo 5** as dry runs (no cases, alerts or MI requests are created).\n\n' +
  'Metrics per question:\n' +
  '- `route_ok`: the expected route (answered, off-label declined or answered, safety captured, emergency, not in documents)\n' +
  '- `retrieval_hit`: the expected document is cited\n' +
  '- `access_ok`: a document this role must not see is not cited\n' +
  '- `correctness` and `grounded` (1-5): GPT-5.4 judges the answer against the expected answer and against the exact passages it cited\n\n' +
  'Run it from the **Evaluations** tab (history and charts), or with **Run All Rows** for a one-off summary.',
  [evalTrigger, runAll, getRows, evalInput, answer, passages, judgePrompt, judge, score, isEval, setOutputs, setMetrics, summary],
  { color: 6 }
);

export default workflow('medinfo-evaluation', 'MedInfo 8: Evaluation')
  .add(evalTrigger)
  .to(evalInput)
  .add(runAll)
  .to(getRows)
  .to(evalInput)
  .to(answer)
  .to(passages)
  .to(judgePrompt)
  .to(judge)
  .to(score)
  .to(isEval)
  .add(isEval.output(0).to(setOutputs).to(setMetrics))
  .add(isEval.output(1).to(summary))
  .add(note);
