import { workflow, node, trigger, sticky, languageModel, memory, tool, embeddings, fromAi, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1_RHqBp7k3rWBY-4plb2oo2mIryQlHIUuNOZ-YhCpVS8' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const SESSION_ID = expr("{{ $('Chat Input').isExecuted ? $('Chat Input').first().json.sessionId : $('Eval Input').first().json.sessionId }}");
const DRY_RUN = expr("{{ !$('Chat Input').isExecuted }}");

const chatTrigger = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.4,
  config: {
    name: 'Website Chat',
    position: [220, 180],
    parameters: {
      public: true,
      mode: 'hostedChat',
      authentication: 'none',
      initialMessages: "Hi, I'm Copperline's assistant. I can answer questions about the shop, check times and book your car in.\nHow can I help?",
      options: {
        responseMode: 'lastNode',
        allowedOrigins: '*',
        title: 'Copperline Auto Repair',
        subtitle: 'Questions, prices and bookings, 24/7. Demo of a fictional shop.',
        inputPlaceholder: 'Ask about prices, hours or booking...',
        showWelcomeScreen: false
      }
    }
  },
  output: [{ sessionId: 'b1f2c3d4', action: 'sendMessage', chatInput: 'What time do you close on Saturday?' }]
});

const evalTrigger = trigger({
  type: 'n8n-nodes-base.evaluationTrigger',
  version: 4.7,
  config: {
    name: 'When Eval Runs',
    position: [220, 1260],
    parameters: {
      source: 'googleSheets',
      authentication: 'oAuth2',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '4', cachedResultName: 'Eval' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, id: 'q01', category: 'knowledge', question: 'What time do you close on Saturday?', expected_answer: 'Saturday hours are 8:00 am to 2:00 pm, so 2:00 pm.', expected_tools: 'search_shop_info', actual_answer: '', actual_tools: '' }]
});

const chatInput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Chat Input',
    position: [440, 180],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'chat-input', name: 'chatInput', value: expr('{{ String($json.chatInput ?? "").trim().slice(0, 1000) }}'), type: 'string' },
          { id: 'session-id', name: 'sessionId', value: expr('{{ $json.sessionId }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ chatInput: 'What time do you close on Saturday?', sessionId: 'b1f2c3d4' }]
});

const evalInput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Eval Input',
    position: [440, 1260],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'chat-input', name: 'chatInput', value: expr('{{ $json.question }}'), type: 'string' },
          { id: 'session-id', name: 'sessionId', value: expr('{{ "eval-" + $json.id + "-" + $execution.id }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ chatInput: 'What time do you close on Saturday?', sessionId: 'eval-q01-500' }]
});

const agentModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'GPT-5.4 mini',
    position: [660, 760],
    parameters: {
      model: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      options: { reasoningEffort: 'low', maxRetries: 2, timeout: 45000 }
    },
    credentials: OPENAI_CRED
  }
});

const chatMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  version: 1.4,
  config: {
    name: 'Chat Memory (Supabase)',
    position: [780, 760],
    parameters: { sessionIdType: 'fromInput', tableName: 'n8n_chat_histories', contextWindowLength: 12 },
    credentials: { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } }
  }
});

const kbEmbeddings = embeddings({
  type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
  version: 1.2,
  config: {
    name: 'OpenAI Embeddings',
    position: [900, 920],
    parameters: { model: 'text-embedding-3-small' },
    credentials: OPENAI_CRED
  }
});

const searchShopInfo = tool({
  type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
  version: 1.3,
  config: {
    name: 'search_shop_info',
    position: [900, 760],
    parameters: {
      mode: 'retrieve-as-tool',
      toolDescription: "Search Copperline Auto Repair's shop information: hours, prices, services, policies, location, payment, warranty, safety advice. Call this before answering any question about the shop.",
      tableName: { __rl: true, mode: 'id', value: 'documents' },
      topK: 6,
      includeDocumentMetadata: false,
      options: { queryName: 'match_documents' }
    },
    subnodes: { embedding: kbEmbeddings },
    credentials: { supabaseApi: { id: 'KdLzNsI1fZqoPyCt', name: 'Supabase account' } }
  }
});

const checkAvailability = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'check_availability',
    position: [1020, 760],
    parameters: {
      description: 'Find free drop-off times at Copperline for a service. Use it before offering any appointment time. Returns up to 3 times a day, each with a start value to pass to book_appointment unchanged.',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'b4jIqNyj0KBxac3L', cachedResultName: 'Support Bot 3: Check Availability' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          service: fromAi('service', 'Service key: oil_change, tire_rotation, brakes, diagnostic, state_inspection, ac_service, alignment, battery, fluid_service, pre_purchase or other', 'string'),
          date_from: fromAi('date_from', 'First day to search, yyyy-MM-dd', 'string'),
          date_to: fromAi('date_to', 'Last day to search, yyyy-MM-dd. Same as date_from to search one day.', 'string'),
          check_start: ''
        },
        schema: [
          { id: 'service', displayName: 'service', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'date_from', displayName: 'date_from', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'date_to', displayName: 'date_to', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'check_start', displayName: 'check_start', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
        ]
      }
    }
  }
});

const bookAppointment = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'book_appointment',
    position: [1140, 760],
    parameters: {
      description: 'Book an appointment. Only call it after the customer has confirmed the service, time, name, phone, email and vehicle. Returns success and a booking reference, or success false with a message saying what to do.',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: '2oE6WCVdI69jWl8P', cachedResultName: 'Support Bot 4: Book Appointment' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          service: fromAi('service', 'Service key, the same one used with check_availability', 'string'),
          start: fromAi('start', 'The exact start value returned by check_availability for the chosen time', 'string'),
          customer_name: fromAi('customer_name', "Customer's full name", 'string'),
          phone: fromAi('phone', "Customer's mobile number", 'string'),
          email: fromAi('email', "Customer's email address", 'string'),
          vehicle: fromAi('vehicle', 'Vehicle year, make and model, e.g. 2018 Honda Civic', 'string'),
          notes: fromAi('notes', 'Short note about the problem or request, or an empty string', 'string'),
          session_id: SESSION_ID,
          dry_run: DRY_RUN
        },
        schema: [
          { id: 'service', displayName: 'service', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'start', displayName: 'start', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'customer_name', displayName: 'customer_name', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'vehicle', displayName: 'vehicle', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'dry_run', displayName: 'dry_run', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'boolean' }
        ]
      }
    }
  }
});

const handoffToStaff = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'handoff_to_staff',
    position: [1260, 760],
    parameters: {
      description: "Pass the conversation to the Copperline team, who reply by phone or email within one business day. Needs the customer's name and a phone number or email. Returns a ticket reference, or success false with a message saying what to do.",
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'uZjf1zfpDpHZGRhw', cachedResultName: 'Support Bot 5: Hand Off to Staff' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          customer_name: fromAi('customer_name', "Customer's name", 'string'),
          contact: fromAi('contact', "Customer's phone number or email address", 'string'),
          reason: fromAi('reason', 'One of: asked_for_human, complaint, car_status, warranty_or_billing, change_booking, unanswered, other', 'string'),
          summary: fromAi('summary', 'Two or three sentences for the team: what the customer needs and any details they gave', 'string'),
          urgency: fromAi('urgency', 'high if the customer is stranded, unsafe or very upset, otherwise normal', 'string'),
          session_id: SESSION_ID,
          dry_run: DRY_RUN
        },
        schema: [
          { id: 'customer_name', displayName: 'customer_name', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'contact', displayName: 'contact', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'reason', displayName: 'reason', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'summary', displayName: 'summary', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'urgency', displayName: 'urgency', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'dry_run', displayName: 'dry_run', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'boolean' }
        ]
      }
    }
  }
});

const logUnanswered = tool({
  type: 'n8n-nodes-base.googleSheetsTool',
  version: 4.7,
  config: {
    name: 'log_unanswered_question',
    position: [1380, 760],
    parameters: {
      descriptionType: 'manual',
      toolDescription: 'Record a customer question that search_shop_info could not answer, so the owner can add the answer to the shop info.',
      resource: 'sheet',
      operation: 'append',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '3', cachedResultName: 'Unanswered' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          timestamp: expr("{{ $now.setZone('America/New_York').toISO() }}"),
          session_id: SESSION_ID,
          question: fromAi('question', "The customer's question, in their words", 'string')
        },
        schema: [
          { id: 'timestamp', displayName: 'timestamp', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'question', displayName: 'question', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true }
    },
    credentials: SHEETS_CRED
  }
});

const agent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Copperline Assistant',
    position: [760, 540],
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.chatInput }}'),
      options: {
        systemMessage: expr(
__SYSTEM_PROMPT__
        ),
        maxIterations: 8,
        returnIntermediateSteps: true,
        enableStreaming: false
      }
    },
    subnodes: { model: agentModel, memory: chatMemory, tools: [searchShopInfo, checkAvailability, bookAppointment, handoffToStaff, logUnanswered] }
  },
  output: [{ output: 'We close at 2:00 pm on Saturdays.', intermediateSteps: [{ action: { tool: 'search_shop_info' } }] }]
});

const isEvalRun = node({
  type: 'n8n-nodes-base.evaluation',
  version: 4.8,
  config: {
    name: 'Eval Run?',
    position: [1560, 540],
    parameters: { operation: 'checkIfEvaluating' }
  },
  output: [{ output: 'We close at 2:00 pm on Saturdays.', intermediateSteps: [{ action: { tool: 'search_shop_info' } }] }]
});

const replyText = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Reply Text',
    position: [1780, 180],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'reply', name: 'reply', value: expr('{{ $json.output ?? "Sorry, I\'m having trouble right now. Please call us on (617) 555-0142 and we\'ll help you straight away." }}'), type: 'string' },
          { id: 'tools', name: 'tools_used', value: expr('{{ $json.error ? "error: " + ($json.error.message ?? $json.error) : ($json.intermediateSteps ?? []).map(s => s.action?.tool).filter(Boolean).join(", ") }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ reply: 'We close at 2:00 pm on Saturdays.', tools_used: 'search_shop_info' }]
});

const logTurn = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Log Turn (background)',
    position: [2000, 180],
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'once',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: '8QWa34F3qiHQupqo', cachedResultName: 'Support Bot 7: Log Chat Turn' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          session_id: expr("{{ $('Chat Input').first().json.sessionId }}"),
          user_message: expr("{{ $('Chat Input').first().json.chatInput }}"),
          bot_reply: expr('{{ $json.reply }}'),
          tools_used: expr('{{ $json.tools_used }}')
        },
        schema: [
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'user_message', displayName: 'user_message', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'bot_reply', displayName: 'bot_reply', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'tools_used', displayName: 'tools_used', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
        ]
      },
      options: { waitForSubWorkflow: false }
    }
  },
  output: [{ reply: 'We close at 2:00 pm on Saturdays.', tools_used: 'search_shop_info' }]
});

const finalReply = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Final Reply',
    position: [2220, 180],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [{ id: 'output', name: 'output', value: expr("{{ $('Reply Text').item.json.reply }}"), type: 'string' }]
      }
    }
  },
  output: [{ output: 'We close at 2:00 pm on Saturdays.' }]
});

const recordEvalAnswer = node({
  type: 'n8n-nodes-base.evaluation',
  version: 4.8,
  config: {
    name: 'Record Eval Answer',
    position: [1780, 1260],
    parameters: {
      operation: 'setOutputs',
      source: 'googleSheets',
      authentication: 'oAuth2',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '4', cachedResultName: 'Eval' },
      outputs: {
        values: [
          { outputName: 'actual_answer', outputValue: expr('{{ $json.output ?? ("ERROR: " + ($json.error?.message ?? "unknown")) }}') },
          { outputName: 'actual_tools', outputValue: expr('{{ ($json.intermediateSteps ?? []).map(s => s.action?.tool).filter(Boolean).join(", ") }}') }
        ]
      }
    },
    credentials: SHEETS_CRED
  },
  output: [{ output: 'We close at 2:00 pm on Saturdays.' }]
});

const judgeModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'GPT-5.4 (judge)',
    position: [2000, 1420],
    parameters: {
      model: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      options: { reasoningEffort: 'low' }
    },
    credentials: OPENAI_CRED
  }
});

const scoreCorrectness = node({
  type: 'n8n-nodes-base.evaluation',
  version: 4.8,
  config: {
    name: 'Score Correctness',
    position: [2000, 1260],
    parameters: {
      operation: 'setMetrics',
      metric: 'correctness',
      expectedAnswer: expr("{{ $('When Eval Runs').item.json.expected_answer }}"),
      actualAnswer: expr("{{ $('Copperline Assistant').item.json.output ?? '' }}"),
      prompt: 'You are grading a customer support chat bot for an auto repair shop. The expected answer describes what a correct reply must contain or do. Score the actual reply from 1 to 5: 5 = contains all the required facts and behaviour with nothing wrong or invented, 3 = mostly right but misses something required, 1 = wrong, invented, unsafe or ignores the expected behaviour. Extra helpful detail that does not contradict the expected answer is fine.',
      options: { metricName: 'Correctness' }
    },
    subnodes: { model: judgeModel }
  },
  output: [{ Correctness: 5 }]
});

const scoreTools = node({
  type: 'n8n-nodes-base.evaluation',
  version: 4.8,
  config: {
    name: 'Score Tool Use',
    position: [2220, 1260],
    parameters: {
      operation: 'setMetrics',
      metric: 'customMetrics',
      metrics: {
        assignments: [
          {
            id: 'tools-ok',
            name: 'tools_ok',
            value: expr("{{ (() => { const used = ($('Copperline Assistant').item.json.intermediateSteps ?? []).map(s => s.action?.tool); const expected = String($('When Eval Runs').item.json.expected_tools ?? '').split(',').map(t => t.trim()).filter(Boolean); return expected.every(t => used.includes(t)) ? 1 : 0; })() }}"),
            type: 'number'
          }
        ]
      }
    }
  },
  output: [{ tools_ok: 1 }]
});

const noteChat = sticky(
  '## Copperline website chat\n' +
  'The **Website Chat** trigger serves the hosted chat page and the widget on the demo site. Messages are trimmed to 1,000 characters before the **Copperline Assistant** sees them.\n\n' +
  'The turn is handed to **Support Bot 7** to log in the background (no waiting on Google Sheets), then **Final Reply** goes straight back to the chat. If the agent fails, the customer gets a polite fallback with the shop phone number, and the error is recorded in the log.',
  [chatTrigger, chatInput, replyText, logTurn, finalReply],
  { color: 4 }
);

const noteAgent = sticky(
  '## Agent and tools\n' +
  'GPT-5.4 mini with 12 messages of chat memory in Supabase. It answers only from `search_shop_info` (the shop info Google Doc, indexed by Support Bot 1).\n\n' +
  '- `check_availability` / `book_appointment`: Support Bot 3 and 4\n' +
  '- `handoff_to_staff`: Support Bot 5\n' +
  '- `log_unanswered_question`: adds a row to **Unanswered** for the weekly report\n\n' +
  '`session_id` and `dry_run` are filled in by expression, never by the model.',
  [agent, agentModel, chatMemory, searchShopInfo, kbEmbeddings, checkAvailability, bookAppointment, handoffToStaff, logUnanswered],
  { color: 5 }
);

const noteEval = sticky(
  '## Evaluation\n' +
  'Runs the 33 test questions in the **Eval** tab through the same agent with `dry_run = true` (nothing is booked or sent). Writes each answer back to the sheet, has GPT-5.4 grade it 1 to 5 against the expected answer, and checks the expected tools were called.\n\n' +
  'Run it from the **Evaluations** tab of this workflow.',
  [evalTrigger, evalInput, isEvalRun, recordEvalAnswer, scoreCorrectness, judgeModel, scoreTools],
  { color: 6 }
);

export default workflow('support-bot-chat-agent', 'Support Bot 2: Chat Agent')
  .add(chatTrigger)
  .to(chatInput)
  .to(agent)
  .add(evalTrigger)
  .to(evalInput)
  .to(agent)
  .add(agent)
  .to(isEvalRun)
  .add(agent.onError(isEvalRun))
  .add(isEvalRun.output(0).to(recordEvalAnswer).to(scoreCorrectness).to(scoreTools))
  .add(isEvalRun.output(1).to(replyText).to(logTurn).to(finalReply))
  .add(noteChat)
  .add(noteAgent)
  .add(noteEval);
