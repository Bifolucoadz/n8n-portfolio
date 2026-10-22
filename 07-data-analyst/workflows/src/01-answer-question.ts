import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'ilfPostgresLocal', name: 'Ironleaf Postgres (local)' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const RUN_SQL = 'SELECT ironleaf.run_readonly(convert_from(decode($1, \'base64\'), \'UTF8\')) AS rows';

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 400], parameters: { inputSource: 'passthrough' } },
  output: [{ question: 'Which branch lost the most members last month?', session_id: 'web-abc', history: '[]' }]
});

const prompt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prompt', position: [420, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PROMPT__
  } },
  output: [{ question: 'Which branch lost the most members last month?', prompt: 'Today is ...', started_ms: 0 }]
});

const writeSql = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Write SQL',
    position: [640, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text', operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_SQL_WRITER__
        ,
        maxTokens: 4000, store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'sql_plan', strict: true, schema:
__JSON_SQL_PLAN__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { can_answer: true, sql: 'SELECT 1' } }] }] }]
});

const checkSql = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check SQL', position: [860, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECK_SQL__
  } },
  output: [{ ok: true, attempt: 1, sql: 'SELECT 1', sql_b64: 'U0VMRUNUIDE=', can_answer: true }]
});

const canRun = ifElse({
  version: 2.2,
  config: {
    name: 'Safe to Run?',
    position: [1080, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const runQuery = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Run Query',
    position: [1300, 300],
    onError: 'continueRegularOutput',
    parameters: { operation: 'executeQuery', query: RUN_SQL, options: { queryReplacement: expr('{{ $json.sql_b64 }}'), largeNumbersOutput: 'numbers' } },
    credentials: PG_CRED
  },
  output: [{ rows: [{ branch: 'Salford Quays', cancellations: 41 }] }]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result', position: [1520, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__RESULT__
  } },
  output: [{ ok: true, rows: [], error: '', needs_fix: false, sql: 'SELECT 1' }]
});

const needsFix = ifElse({
  version: 2.2,
  config: {
    name: 'Needs a Fix?',
    position: [1740, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.needs_fix }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const fixSql = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Fix SQL',
    position: [1960, 140],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text', operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.fix_prompt }}') }] },
      options: {
        instructions:
__PROMPT_SQL_WRITER__
        ,
        maxTokens: 4000, store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'sql_plan', strict: true, schema:
__JSON_SQL_PLAN__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { can_answer: true, sql: 'SELECT 1' } }] }] }]
});

const checkFix = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Fixed SQL', position: [2180, 140], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECK_FIX__
  } },
  output: [{ ok: true, attempt: 2, sql: 'SELECT 1', sql_b64: 'U0VMRUNUIDE=' }]
});

const fixOk = ifElse({
  version: 2.2,
  config: {
    name: 'Fixed Query Safe?',
    position: [2400, 140],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const runFixed = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Run Fixed Query',
    position: [2620, 60],
    onError: 'continueRegularOutput',
    parameters: { operation: 'executeQuery', query: RUN_SQL, options: { queryReplacement: expr('{{ $json.sql_b64 }}'), largeNumbersOutput: 'numbers' } },
    credentials: PG_CRED
  },
  output: [{ rows: [] }]
});

const resultFix = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result (Fixed)', position: [2840, 140], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__RESULT_FIX__
  } },
  output: [{ ok: true, rows: [], error: '', sql: 'SELECT 1' }]
});

const rowsOk = ifElse({
  version: 2.2,
  config: {
    name: 'Got Rows?',
    position: [3060, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const answerInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer Input', position: [3280, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ANSWER_INPUT__
  } },
  output: [{ ok: true, rows: [], prompt: 'Question: ...' }]
});

const writeAnswer = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Write Answer',
    position: [3500, 300],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text', operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_ANSWER_WRITER__
        ,
        maxTokens: 1500, store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'answer', strict: true, schema:
__JSON_ANSWER__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { answer: 'Salford Quays lost the most.', note: '' } }] }] }]
});

const answer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer', position: [3720, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ANSWER__
  } },
  output: [{ ok: true, kind: 'answer', answer: 'Salford Quays lost the most.', sql: 'SELECT 1', columns: [], rows: [], chart: { type: 'bar' } }]
});

const note = sticky(
  '## Ironleaf 1: Answer Question\nOne question in plain English → one answer with the data behind it.\n1. **Write SQL**: GPT-5.4 gets the documented schema and business definitions (active member, churn, revenue…) and returns one query, a chart choice and its assumptions. Questions the data can\'t answer get a clarification instead.\n2. **Check SQL** (code): one SELECT, no semicolons, comments or write keywords.\n3. **Run Query**: inside `ironleaf.run_readonly()`: read-only role, writes refused, 500 rows max, 10 s limit.\n4. If Postgres rejects it, **Fix SQL** gets the error and one more try.\n5. **Write Answer**: GPT-5.4 mini explains the rows in 1-3 sentences, using only numbers from the rows.',
  [], { position: [160, -120], width: 1500, height: 260, color: 5 }
);

export default workflow('ironleaf-answer-question', 'Ironleaf 1: Answer Question')
  .add(whenCalled)
  .to(prompt)
  .to(writeSql)
  .to(checkSql)
  .to(canRun
    .onTrue(runQuery.to(result).to(needsFix
      .onTrue(fixSql.to(checkFix).to(fixOk
        .onTrue(runFixed.to(resultFix))
        .onFalse(resultFix)))
      .onFalse(rowsOk)))
    .onFalse(answer))
  .add(resultFix)
  .to(rowsOk
    .onTrue(answerInput.to(writeAnswer).to(answer))
    .onFalse(answer))
  .add(note);
