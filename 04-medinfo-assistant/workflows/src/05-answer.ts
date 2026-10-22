import { workflow, node, trigger, sticky, ifElse, languageModel, tool, fromAi, expr } from '@n8n/workflow-sdk';

const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const PG_CRED = { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } };
const SEARCH_WF = { __rl: true, mode: 'id', value: 'LZSvMY7TYSn9ciul', cachedResultName: 'MedInfo 3: Search Knowledge' };
const TOOLS_WF = { __rl: true, mode: 'id', value: 'o3nP4NFhn63eJrv4', cachedResultName: 'MedInfo 4: Agent Tools' };

const called = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called',
    position: [200, 400],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'message', type: 'string' },
          { name: 'session_id', type: 'string' },
          { name: 'role', type: 'string' },
          { name: 'channel', type: 'string' },
          { name: 'dry_run', type: 'boolean' }
        ]
      }
    }
  },
  output: [{ message: 'What is the Quenvara dose for AF with CrCl 20?', session_id: 'web-abc123', role: 'hcp', channel: 'web', dry_run: false }]
});

const prepareTurn = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Turn',
    position: [420, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__PREPARE_TURN__
    }
  },
  output: [{ turn_id: 't-261007-abc', started_at: 1791343000000, message: 'What is the Quenvara dose for AF with CrCl 20?', session_id: 'web-abc123', memory_key: 'web-abc123:hcp', role: 'hcp', access: ['public'], access_csv: 'public', channel: 'web', dry_run: false, safety_chat_id: '' }]
});

const loadContext = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Load Context',
    position: [640, 400],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 1000,
    parameters: {
      operation: 'executeQuery',
      query: 'select kb_context($1::jsonb) as context;',
      options: { queryReplacement: expr('{{ JSON.stringify({ session_id: $json.session_id, memory_key: $json.memory_key }) }}') }
    },
    credentials: PG_CRED
  },
  output: [{ context: { history: [], open_cases: [], mi_requests: 0 } }]
});

const screenInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Screen Input',
    position: [860, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__SCREEN_INPUT__
    }
  },
  output: [{ prompt: '<role>hcp</role>' }]
});

const screen = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Compliance Screen',
    position: [1080, 400],
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
__PROMPT_COMPLIANCE_SCREEN__
        ,
        maxTokens: 4000,
        store: false,
        promptCacheKey: 'medinfo-screen',
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'compliance_screen', strict: true, verbosity: 'low', schema:
__SCHEMA_COMPLIANCE_SCREEN__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { standalone_question: 'Quenvara dose for nonvalvular AF with CrCl 20 mL/min', request_type: 'medical_question', product: 'quenvara', speaker: 'healthcare_professional', adverse_event: { detected: false }, product_complaint: { detected: false }, off_label: { detected: false, topic: '' }, emergency: false } }] }] }]
});

const route = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Route',
    position: [1300, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__ROUTE__
    }
  },
  output: [{ screen: {}, screen_failed: false, product: 'quenvara', cases: [], case_refs: [], turn_notes: '- Nothing special detected in this message.', emergency_fixed: false, fixed_reply: '' }]
});

const isEmergency = ifElse({
  version: 2.3,
  config: {
    name: 'Emergency?',
    position: [1520, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.emergency_fixed }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const emergencyReply = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Emergency Reply',
    position: [2400, 220],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [{ id: 'a', name: 'output', value: expr('{{ $json.fixed_reply }}'), type: 'string' }] }
    }
  },
  output: [{ output: 'If you or someone else is in danger right now, call 911.' }]
});

const searchFirst = ifElse({
  version: 2.3,
  config: {
    name: 'Question to Search?',
    position: [1740, 520],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.search_first }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const preSearch = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Pre-Search',
    position: [1960, 440],
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'once',
      source: 'database',
      workflowId: SEARCH_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          query: expr('{{ $json.search_query }}'),
          product: expr('{{ $json.search_product }}'),
          include_superseded: false,
          allowed_access: expr("{{ $('Prepare Turn').first().json.access_csv }}"),
          session_id: expr("{{ $('Prepare Turn').first().json.session_id }}")
        },
        schema: [
          { id: 'query', displayName: 'query', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'product', displayName: 'product', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'include_superseded', displayName: 'include_superseded', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'boolean' },
          { id: 'allowed_access', displayName: 'allowed_access', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
        ]
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ query: 'Quenvara dose AF CrCl 22', status: 'ok', reranked: true, candidates: 20, results: [{ id: 'c319', relevance: 3 }], note: '...' }]
});

const agentInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Agent Input',
    position: [2180, 560],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__AGENT_INPUT__
    }
  },
  output: [{ text: 'What dose of Quenvara ...' }]
});

const agentModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'GPT-5.4 mini',
    position: [2280, 800],
    parameters: {
      model: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      options: { reasoningEffort: 'low', maxRetries: 2, timeout: 60000 }
    },
    credentials: OPENAI_CRED
  }
});

const searchTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'search_knowledge',
    position: [2400, 800],
    parameters: {
      description: "Search Larkmoor's approved documents (Prescribing Information, Dear Healthcare Provider letters, and, for staff, SOPs and standard response letters) with hybrid keyword + semantic search and reranking. Returns up to 6 passages, each with a citation id like c123, document number, version, status, section and page. Call it before answering any question about a product, procedure or policy.",
      source: 'database',
      workflowId: SEARCH_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          query: fromAi('query', 'A standalone search query naming the product and the specific topic, e.g. "Quenvara dose in renal impairment creatinine clearance 15 to 29"', 'string'),
          product: fromAi('product', 'quenvara, lumetra, aurivex, or any', 'string'),
          include_superseded: fromAi('include_superseded', 'true only when the user asks about a previous version or what changed; otherwise false', 'boolean'),
          allowed_access: expr("{{ $('Prepare Turn').first().json.access_csv }}"),
          session_id: expr("{{ $('Prepare Turn').first().json.session_id }}")
        },
        schema: [
          { id: 'query', displayName: 'query', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'product', displayName: 'product', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'include_superseded', displayName: 'include_superseded', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'boolean' },
          { id: 'allowed_access', displayName: 'allowed_access', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
        ]
      }
    }
  }
});

const TOOL_SCHEMA = [
  { id: 'action', displayName: 'action', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'chunk_id', displayName: 'chunk_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'term', displayName: 'term', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'requester_name', displayName: 'requester_name', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'contact', displayName: 'contact', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'question', displayName: 'question', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'product', displayName: 'product', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'allowed_access', displayName: 'allowed_access', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'channel', displayName: 'channel', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'role', displayName: 'role', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'dry_run', displayName: 'dry_run', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'boolean' }
];

const readSectionTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'read_section',
    position: [2520, 800],
    parameters: {
      description: 'Read the whole document section that a search passage comes from, for example the rest of a long table. Give the citation id of a passage you already have.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'read_section',
          chunk_id: fromAi('chunk_id', 'Citation id of a passage from search_knowledge, e.g. c123', 'string'),
          term: '', requester_name: '', contact: '', question: '', product: '',
          allowed_access: expr("{{ $('Prepare Turn').first().json.access_csv }}"),
          session_id: expr("{{ $('Prepare Turn').first().json.session_id }}"),
          channel: expr("{{ $('Prepare Turn').first().json.channel }}"),
          role: expr("{{ $('Prepare Turn').first().json.role }}"),
          dry_run: expr("{{ $('Prepare Turn').first().json.dry_run }}")
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const lookupTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'lookup_product',
    position: [2640, 800],
    parameters: {
      description: 'Look up the Larkmoor product catalog: NDC numbers, strengths, pack sizes, storage, list prices (USD) and supply status (available, limited, backordered). Search by product name, strength or NDC. Rows have citation ids like p3.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'lookup_product',
          chunk_id: '',
          term: fromAi('term', 'Product name, strength or NDC, e.g. "Aurivex 250", "99107-425-10" or "Lumetra"', 'string'),
          requester_name: '', contact: '', question: '', product: '',
          allowed_access: expr("{{ $('Prepare Turn').first().json.access_csv }}"),
          session_id: expr("{{ $('Prepare Turn').first().json.session_id }}"),
          channel: expr("{{ $('Prepare Turn').first().json.channel }}"),
          role: expr("{{ $('Prepare Turn').first().json.role }}"),
          dry_run: expr("{{ $('Prepare Turn').first().json.dry_run }}")
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const requestTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'request_medical_information',
    position: [2760, 800],
    parameters: {
      description: "Submit a Medical Information request so Larkmoor's Medical Information team answers a healthcare professional directly within 2 business days, for off-label questions or questions the documents don't answer. Only call it after the person agrees and you have the healthcare professional's name, an email or phone number, and their exact question. Returns a reference like MIR-261007-AB12.",
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'request_mi',
          chunk_id: '', term: '',
          requester_name: fromAi('requester_name', "The healthcare professional's full name", 'string'),
          contact: fromAi('contact', "The healthcare professional's email address or phone number", 'string'),
          question: fromAi('question', 'The exact question, in their words', 'string'),
          product: fromAi('product', 'quenvara, lumetra, aurivex, or empty', 'string'),
          allowed_access: expr("{{ $('Prepare Turn').first().json.access_csv }}"),
          session_id: expr("{{ $('Prepare Turn').first().json.session_id }}"),
          channel: expr("{{ $('Prepare Turn').first().json.channel }}"),
          role: expr("{{ $('Prepare Turn').first().json.role }}"),
          dry_run: expr("{{ $('Prepare Turn').first().json.dry_run }}")
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const agent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'MedInfo Agent',
    position: [2400, 560],
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.text }}'),
      options: {
        systemMessage: expr(
__PROMPT_AGENT_SYSTEM__
        ),
        maxIterations: 6,
        returnIntermediateSteps: true,
        enableStreaming: false
      }
    },
    subnodes: { model: agentModel, tools: [searchTool, readSectionTool, lookupTool, requestTool] }
  },
  output: [{ output: 'For nonvalvular atrial fibrillation with CrCl 15 to 29 mL/min, the dose is 2.5 mg twice daily [c319].', intermediateSteps: [] }]
});

const finalize = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Finalize',
    position: [2900, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__FINALIZE__
    }
  },
  output: [{ answer: 'For nonvalvular atrial fibrillation with CrCl 15 to 29 mL/min, the dose is 2.5 mg twice daily [1].', sources: [], route: 'answered', flags: {}, case_refs: [], turn_id: 't-1', session_id: 'web-abc123', role: 'hcp', latency_ms: 9000, tools: ['search_knowledge'], record: '{}' }]
});

const safetyCase = ifElse({
  version: 2.3,
  config: {
    name: 'Safety Case?',
    position: [3100, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr("{{ $('Route').first().json.cases.length }}"), rightValue: 0, operator: { type: 'number', operation: 'gt' } }],
        combinator: 'and'
      }
    }
  }
});

const recordTurn = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Record Turn (background)',
    position: [3340, 520],
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r0jIVlPUDyiZdPde', cachedResultName: 'MedInfo 7: Record Turn' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          payload: expr("{{ $('Finalize').first().json.record }}"),
          safety_chat_id: expr("{{ $('Prepare Turn').first().json.safety_chat_id }}")
        },
        schema: [
          { id: 'payload', displayName: 'payload', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'safety_chat_id', displayName: 'safety_chat_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
        ]
      },
      options: { waitForSubWorkflow: false }
    }
  },
  output: [{}]
});

const recordWait = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Record Turn (wait for case)',
    position: [3340, 280],
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'r0jIVlPUDyiZdPde', cachedResultName: 'MedInfo 7: Record Turn' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          payload: expr("{{ $('Finalize').first().json.record }}"),
          safety_chat_id: expr("{{ $('Prepare Turn').first().json.safety_chat_id }}")
        },
        schema: [
          { id: 'payload', displayName: 'payload', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'safety_chat_id', displayName: 'safety_chat_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
        ]
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{}]
});

const answerOut = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Answer',
    position: [3580, 400],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'a', name: 'answer', value: expr("{{ $('Finalize').first().json.answer }}"), type: 'string' },
          { id: 's', name: 'sources', value: expr("{{ $('Finalize').first().json.sources }}"), type: 'array' },
          { id: 'r', name: 'route', value: expr("{{ $('Finalize').first().json.route }}"), type: 'string' },
          { id: 'f', name: 'flags', value: expr("{{ $('Finalize').first().json.flags }}"), type: 'object' },
          { id: 'c', name: 'case_refs', value: expr("{{ $('Finalize').first().json.case_refs }}"), type: 'array' },
          { id: 't', name: 'turn_id', value: expr("{{ $('Finalize').first().json.turn_id }}"), type: 'string' },
          { id: 'sid', name: 'session_id', value: expr("{{ $('Finalize').first().json.session_id }}"), type: 'string' },
          { id: 'role', name: 'role', value: expr("{{ $('Finalize').first().json.role }}"), type: 'string' },
          { id: 'tools', name: 'tools', value: expr("{{ $('Finalize').first().json.tools }}"), type: 'array' },
          { id: 'l', name: 'latency_ms', value: expr("{{ $('Finalize').first().json.latency_ms }}"), type: 'number' }
        ]
      }
    }
  },
  output: [{ answer: '...', sources: [], route: 'answered', flags: {}, case_refs: [], turn_id: 't-1', session_id: 'web-abc123', role: 'hcp', tools: [], latency_ms: 9000 }]
});

const noteScreen = sticky(
  '## 1. Compliance screen (every message)\n' +
  'GPT-5.4 mini with a strict JSON schema reads the message and the last turns, and flags **adverse events** (with the four minimum criteria), **product complaints**, **off-label** requests and **emergencies**. **Route** then decides in code: case references are created (`AE-`/`PC-`, reused for follow-ups in the same chat), and turn-specific instructions are written for the agent. A patient emergency on the public site gets a fixed reply without the agent.',
  [called, prepareTurn, loadContext, screenInput, screen, route, isEmergency, emergencyReply],
  { color: 4 }
);

const noteAgent = sticky(
  '## 2. Retrieve, then the agent\n' +
  '**Pre-Search** runs MedInfo 3 with the screen\'s standalone question before the agent starts, so most answers take one model call. GPT-5.4 mini. The last 8 messages of this session and role come from Load Context (no memory node: one database call instead of three). Tools: `search_knowledge` (MedInfo 3), and `read_section`, `lookup_product`, `request_medical_information` (MedInfo 4). The access levels, session, role and dry-run flag are set by expression, never by the model. It must cite every fact with passage IDs.',
  [searchFirst, preSearch, agentInput, agent, agentModel, searchTool, readSectionTool, lookupTool, requestTool],
  { color: 5 }
);

const noteFinal = sticky(
  '## 3. Finalize and record\n' +
  'Citations are checked against what was actually retrieved this turn (made-up IDs are removed) and renumbered [1], [2]... with a source list (document number, version, section, page, link, superseded). The route is labelled. **MedInfo 7** records the audit row: in the background for ordinary turns, and before replying when an adverse event or complaint case was opened, so the reference given to the user is already saved.',
  [finalize, safetyCase, recordWait, recordTurn, answerOut],
  { color: 6 }
);

export default workflow('medinfo-answer', 'MedInfo 5: Answer')
  .add(called)
  .to(prepareTurn)
  .to(loadContext)
  .to(screenInput)
  .to(screen)
  .to(route)
  .to(isEmergency
    .onTrue(emergencyReply.to(finalize))
    .onFalse(searchFirst
      .onTrue(preSearch.to(agentInput))
      .onFalse(agentInput)))
  .add(agentInput)
  .to(agent)
  .to(finalize)
  .add(agent.onError(finalize))
  .add(finalize)
  .to(safetyCase
    .onTrue(recordWait.to(answerOut))
    .onFalse(recordTurn.to(answerOut)))
  .add(noteScreen)
  .add(noteAgent)
  .add(noteFinal);
