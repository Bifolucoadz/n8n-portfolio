import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const PG_CRED = { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } };

const called = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called by Agent',
    position: [200, 300],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'query', type: 'string' },
          { name: 'product', type: 'string' },
          { name: 'include_superseded', type: 'boolean' },
          { name: 'allowed_access', type: 'string' },
          { name: 'session_id', type: 'string' }
        ]
      }
    }
  },
  output: [{ query: 'Quenvara dose in renal impairment CrCl 15 to 29', product: 'quenvara', include_superseded: false, allowed_access: 'public', session_id: 's-1' }]
});

const prepareQuery = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Query',
    position: [420, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__PREPARE_QUERY__
    }
  },
  output: [{ query: 'Quenvara dose in renal impairment CrCl 15 to 29', product: 'quenvara', include_superseded: false, access: ['public'] }]
});

const embedQuery = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Embed Query',
    position: [640, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 1000,
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/embeddings',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ { model: "text-embedding-3-small", input: $json.query } }}'),
      options: { timeout: 20000 }
    },
    credentials: OPENAI_CRED
  },
  output: [{ data: [{ index: 0, embedding: [0.01] }] }]
});

const hybridSearch = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Hybrid Search',
    position: [860, 300],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 1000,
    parameters: {
      operation: 'executeQuery',
      query: 'select kb_search($1::jsonb) as results;',
      options: {
        queryReplacement: expr("{{ JSON.stringify({ query: $('Prepare Query').first().json.query, embedding: $json.data[0].embedding, access: $('Prepare Query').first().json.access, product: $('Prepare Query').first().json.product, include_superseded: $('Prepare Query').first().json.include_superseded, k: 20 }) }}")
      }
    },
    credentials: PG_CRED
  },
  output: [{ results: [{ id: 'c120', doc_code: 'LRK-PI-QNV', title: 'Quenvara (davorixaban) tablets: Prescribing Information', version: '5.0', status: 'current', section: '2 DOSAGE AND ADMINISTRATION > 2.3 Dosage in renal impairment', page: 1, text: '| Creatinine clearance |', vector_rank: 1, keyword_rank: 2, score: 0.03884 }] }]
});

const rerankPrompt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Rerank Prompt',
    position: [1080, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__RERANK_PROMPT__
    }
  },
  output: [{ count: 20, prompt: '<query>...</query>' }]
});

const anyCandidates = ifElse({
  version: 2.3,
  config: {
    name: 'Any Candidates?',
    position: [1300, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.count }}'), rightValue: 0, operator: { type: 'number', operation: 'gt' } }],
        combinator: 'and'
      }
    }
  }
});

const rerank = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Rerank Passages',
    position: [1520, 220],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 1000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_RERANK__
        ,
        maxTokens: 3000,
        store: false,
        promptCacheKey: 'medinfo-rerank',
        reasoning: { reasoningOptions: { effort: expr("{{ 'none' }}"), summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'rerank', strict: true, verbosity: 'low', schema:
__SCHEMA_RERANK__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { scores: [{ id: 'c120', score: 3 }] } }] }] }]
});

const selectPassages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Select Passages',
    position: [1740, 220],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__SELECT_PASSAGES__
    }
  },
  output: [{ query: 'Quenvara dose in renal impairment', status: 'ok', reranked: true, candidates: 20, results: [{ id: 'c120', relevance: 3 }], note: 'Cite passages by their id.' }]
});

const noResults = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'No Results',
    position: [1520, 420],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'q', name: 'query', value: expr("{{ $('Prepare Query').first().json.query }}"), type: 'string' },
          { id: 's', name: 'status', value: 'no_relevant_passages', type: 'string' },
          { id: 'r', name: 'results', value: expr('{{ [] }}'), type: 'array' },
          { id: 'n', name: 'note', value: 'Nothing in the documents this user may see matches this query. Try different words once; if there is still nothing, say it is not in the documents.', type: 'string' }
        ]
      }
    }
  },
  output: [{ query: 'grapefruit', status: 'no_relevant_passages', results: [], note: '...' }]
});

const note = sticky(
  '## MedInfo 3: Search Knowledge (agent tool `search_knowledge`)\n' +
  '1. **Embed** the standalone query the agent wrote.\n' +
  '2. **Hybrid search** in Postgres (`kb_search`): pgvector similarity and full-text keyword ranking, merged with reciprocal rank fusion. Filtered in SQL by the access levels of the user\'s role (set by MedInfo 5, never by the model), the product, and current versions only unless asked.\n' +
  '3. **Rerank** the top 20 with GPT-5.4 mini (0-3), keep the best 6 scored 2+. If the reranker fails, the top 6 from the hybrid search are used.\n\n' +
  'Each passage comes back with a citation ID (`c123`), document number, version, status, section and page.',
  [called, prepareQuery, embedQuery, hybridSearch, rerankPrompt, anyCandidates, rerank, selectPassages, noResults],
  { color: 4 }
);

export default workflow('medinfo-search-knowledge', 'MedInfo 3: Search Knowledge')
  .add(called)
  .to(prepareQuery)
  .to(embedQuery)
  .to(hybridSearch)
  .to(rerankPrompt)
  .to(anyCandidates
    .onTrue(rerank.to(selectPassages))
    .onFalse(noResults))
  .add(note);
