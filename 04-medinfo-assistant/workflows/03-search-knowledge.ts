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
        '// Clean the tool inputs. Access levels are set by the Answer workflow, never by the model.\n' +
        'const i = $input.first().json;\n' +
        'const levels = [\'public\', \'internal\', \'medical\'];\n' +
        'const access = String(i.allowed_access || \'public\').split(\',\').map(s => s.trim()).filter(s => levels.includes(s));\n' +
        'const p = String(i.product || \'\').toLowerCase().trim();\n' +
        'const query = String(i.query || \'\').replace(/\\s+/g, \' \').trim().slice(0, 500);\n' +
        'if (!query) throw new Error(\'search_knowledge needs a query: say what to search for.\');\n' +
        'return [{\n' +
        '  json: {\n' +
        '    query,\n' +
        '    product: [\'quenvara\', \'lumetra\', \'aurivex\'].includes(p) ? p : \'any\',\n' +
        '    include_superseded: i.include_superseded === true || String(i.include_superseded).toLowerCase() === \'true\',\n' +
        '    access: access.length ? access : [\'public\'],\n' +
        '  },\n' +
        '}];\n'
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
        '// The hybrid search candidates, labelled for the reranker. Long passages are trimmed to keep it fast.\n' +
        'const q = $(\'Prepare Query\').first().json;\n' +
        'const results = $input.first().json.results ?? [];\n' +
        'const list = results.map(r =>\n' +
        '  `<passage id="${r.id}" doc="${r.doc_code} v${r.version}${r.status === \'superseded\' ? \' (superseded)\' : \'\'}" section="${String(r.section ?? \'\').replace(/"/g, "\'")}">\\n` +\n' +
        '  `${r.context ?? \'\'}\\n${String(r.text ?? \'\').slice(0, 1000)}\\n</passage>`\n' +
        ').join(\'\\n\');\n' +
        'return [{ json: { count: results.length, prompt: `<query>${q.query}</query>\\n\\n<passages>\\n${list}\\n</passages>` } }];\n'
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
        'You are the relevance judge for a pharmaceutical Medical Information search engine. You get a query and up to 20 passages from the company\'s documents. Score every passage for how useful it is for answering the query:\n' +
        '\n' +
        '- 3: directly answers the query, or contains the specific fact, number or instruction asked for.\n' +
        '- 2: contains information needed for a complete answer (a condition, exception, related table row, or the same topic for the same product).\n' +
        '- 1: same general topic but would not help answer this query (for example another product, or another section).\n' +
        '- 0: unrelated.\n' +
        '\n' +
        'Judge relevance only, not whether the passage is correct or current. Pay attention to the product name: a passage about a different product than the one asked about is at most 1. Return a score for every passage id you were given.\n'
        ,
        maxTokens: 3000,
        store: false,
        promptCacheKey: 'medinfo-rerank',
        reasoning: { reasoningOptions: { effort: expr("{{ 'none' }}"), summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'rerank', strict: true, verbosity: 'low', schema:
        '{"type":"object","additionalProperties":false,"required":["scores"],"properties":{"scores":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","score"],"properties":{"id":{"type":"string"},"score":{"type":"integer","enum":[0,1,2,3]}}}}}}'
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
        '// Keep the passages the reranker scored 2 or 3, best 6, most relevant first. If the reranker\n' +
        '// failed, fall back to the top 6 from the hybrid search.\n' +
        'const q = $(\'Prepare Query\').first().json;\n' +
        'const results = $(\'Hybrid Search\').first().json.results ?? [];\n' +
        'const scores = {};\n' +
        'for (const o of $input.first().json.output ?? []) {\n' +
        '  for (const c of o.content ?? []) {\n' +
        '    let d = c.text;\n' +
        '    if (typeof d === \'string\') { try { d = JSON.parse(d); } catch (e) { d = null; } }\n' +
        '    for (const s of d?.scores ?? []) scores[s.id] = Number(s.score);\n' +
        '  }\n' +
        '}\n' +
        'const reranked = Object.keys(scores).length > 0;\n' +
        'const kept = results\n' +
        '  .map((r, i) => ({ r, score: reranked ? (scores[r.id] ?? 0) : (i < 6 ? 2 : 0), rank: i }))\n' +
        '  .filter(x => x.score >= 2)\n' +
        '  .sort((a, b) => b.score - a.score || a.rank - b.rank)\n' +
        '  .slice(0, 6)\n' +
        '  .map(({ r, score }) => ({\n' +
        '    id: r.id, relevance: score, doc_code: r.doc_code, title: r.title, version: r.version,\n' +
        '    effective_date: r.effective_date, status: r.status, access_level: r.access_level,\n' +
        '    section: r.section, page: r.page, url: r.url, parse_flags: r.parse_flags, text: r.text,\n' +
        '  }));\n' +
        'return [{\n' +
        '  json: {\n' +
        '    query: q.query,\n' +
        '    status: kept.length ? \'ok\' : \'no_relevant_passages\',\n' +
        '    reranked,\n' +
        '    candidates: results.length,\n' +
        '    results: kept,\n' +
        '    note: kept.length\n' +
        '      ? \'Cite passages by their id in square brackets, for example [\' + kept[0].id + \'].\'\n' +
        '      : \'Nothing in the documents this user may see answers this query. Try different words once; if there is still nothing, say it is not in the documents.\',\n' +
        '  },\n' +
        '}];\n'
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
