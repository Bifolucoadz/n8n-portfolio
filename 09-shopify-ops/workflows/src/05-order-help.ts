import { workflow, node, trigger, sticky, ifElse, languageModel, tool, fromAi, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'QbQi6BAEGxZmzGyT', cachedResultName: 'Kettle Settings' };
const MESSAGES = { __rl: true, mode: 'id', value: 'V2SpiVAU4JiGBdNI', cachedResultName: 'Kettle Messages' };
const TOOLS_WF = { __rl: true, mode: 'id', value: 'ktlHelpTools0007', cachedResultName: 'Kettle 7: Help Tools' };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }] };
const TOOL_SCHEMA = [
  { id: 'action', displayName: 'action', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'order_number', displayName: 'order_number', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'summary', displayName: 'summary', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
];

// Page
const pageHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Help Page', position: [200, 200], parameters: { httpMethod: 'GET', path: 'kettle/help', responseMode: 'responseNode', options: {} } },
  output: [{}]
});

const page = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Page', position: [420, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PAGE__
  } },
  output: [{ html: '<html></html>' }]
});

const sendPage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [640, 200], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseHeaders: HTML_HEADERS } } }
});

// Chat
const chatHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Chat Request', position: [200, 520], parameters: { httpMethod: 'POST', path: 'kettle/help/chat', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { session_id: 'web-abc123', message: 'Where is my order?' } }]
});

const readHistory = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read History',
    position: [420, 520],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: MESSAGES, limit: 12, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC', filters: { conditions: [{ keyName: 'session_id', condition: 'eq', keyValue: expr("{{ $('Chat Request').first().json.body.session_id || 'none' }}") }] } }
  },
  output: [{ session_id: 'web-abc123', role: 'user', text: 'Hi' }]
});

const buildInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Input', position: [640, 520], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_INPUT__
  } },
  output: [{ ok: true, session_id: 'web-abc123', message: 'Where is my order?', prompt: 'Today is ...' }]
});

const valid = ifElse({
  version: 2.2,
  config: {
    name: 'Valid?',
    position: [860, 520],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const model = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'GPT-5.4 mini',
    position: [1000, 760],
    parameters: { model: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' }, options: { reasoningEffort: 'low', maxRetries: 2, timeout: 60000 } },
    credentials: OPENAI_CRED
  }
});

const lookupTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'lookup_order',
    position: [1140, 760],
    parameters: {
      description: 'Look up an order. Needs the order number (like #1842) and the email address used for the order. Returns the status, tracking and whether it is late, or found: false.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'lookup',
          order_number: fromAi('order_number', 'The order number, e.g. #1842', 'string'),
          email: fromAi('email', 'The email address the customer ordered with', 'string'),
          summary: ''
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const ticketTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'open_ticket',
    position: [1280, 760],
    parameters: {
      description: 'Open a support ticket so the team chases a late parcel or contacts the customer. Only after lookup_order found the order. Needs the same order number and email, and a one-line summary of what the customer needs.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'ticket',
          order_number: fromAi('order_number', 'The order number, e.g. #1842', 'string'),
          email: fromAi('email', 'The email address the customer ordered with', 'string'),
          summary: fromAi('summary', 'One line: what happened and what the customer wants', 'string')
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
    name: 'Help Agent',
    position: [1080, 520],
    onError: 'continueRegularOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.prompt }}'),
      options: {
        systemMessage:
__PROMPT_HELP_AGENT__
        ,
        maxIterations: 6,
        enableStreaming: false
      }
    },
    subnodes: { model: model, tools: [lookupTool, ticketTool] }
  },
  output: [{ output: 'Thanks! What is the email address you ordered with?' }]
});

const reply = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Reply', position: [1300, 520], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__REPLY__
  } },
  output: [{ reply: 'Thanks!', rows: [] }]
});

const rows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Message Rows', position: [1520, 520], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// Both sides of this turn, one row each.\nreturn $input.first().json.rows.map(r => ({ json: r }));\n' } },
  output: [{ session_id: 'web-abc123', role: 'user', text: 'Hi', order_number: '', at: '2026-10-21T12:00:00.000-07:00' }]
});

const save = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Messages', position: [1740, 520], parameters: { resource: 'row', operation: 'insert', dataTableId: MESSAGES, columns: { mappingMode: 'defineBelow', value: {
__MAP_MESSAGES__
  }, schema: [
__SCHEMA_MESSAGES__
  ] } } },
  output: [{ id: 1 }]
});

const answer = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Reply', position: [1960, 520], executeOnce: true, parameters: { respondWith: 'json', responseBody: expr("{{ { reply: $('Reply').first().json.reply } }}"), options: {} } }
});

const bad = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Bad Request', position: [1080, 300], parameters: { respondWith: 'json', responseBody: '{ "reply": "Please type a message." }', options: { responseCode: 400 } } }
});

const note = sticky(
  '## Kettle 5: Order Help\n`GET /webhook/kettle/help` serves the shop\'s help page with a chat; `POST /webhook/kettle/help/chat` answers it.\nThe **Help Agent** (GPT-5.4 mini) asks for the order number and the email, then uses **lookup_order**: nothing about an order is shared unless both match. It explains the tracking in plain words, and for a late parcel offers **open_ticket**, which emails the team. It never promises refunds. The last 12 messages of the session are its memory (**Kettle Messages**).',
  [], { position: [160, -40], width: 1300, height: 200, color: 5 }
);

export default workflow('kettle-order-help', 'Kettle 5: Order Help')
  .add(pageHook)
  .to(page)
  .to(sendPage)
  .add(chatHook)
  .to(readHistory)
  .to(buildInput)
  .to(valid
    .onTrue(agent.to(reply).to(rows).to(save).to(answer))
    .onFalse(bad))
  .add(note);
