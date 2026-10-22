import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const QUESTIONS = { __rl: true, mode: 'id', value: 'aJd2CJkonUN6vRaa', cachedResultName: 'Ironleaf Questions' };
const ANSWER_WF = { __rl: true, mode: 'id', value: 'ilfAnswerQues001', cachedResultName: 'Ironleaf 1: Answer Question' };
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }] };

const pageHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Chat Page', position: [200, 200], parameters: { httpMethod: 'GET', path: 'ironleaf/chat', responseMode: 'responseNode', options: {} } },
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

const askHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Ask Request', position: [200, 520], parameters: { httpMethod: 'POST', path: 'ironleaf/ask', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { session_id: 'web-abc', question: 'Which branch lost the most members last month?' } }]
});

const readHistory = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read History',
    position: [420, 520],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: QUESTIONS, limit: 3, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC', filters: { conditions: [{ keyName: 'session_id', condition: 'eq', keyValue: expr("{{ $('Ask Request').first().json.body.session_id || 'none' }}") }] } }
  },
  output: [{ session_id: 'web-abc', question: 'How many members?', sql: 'SELECT 1' }]
});

const question = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Question', position: [640, 520], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__REQUEST__
  } },
  output: [{ ok: true, question: 'Which branch lost the most members last month?', session_id: 'web-abc', history: '[]' }]
});

const valid = ifElse({
  version: 2.2,
  config: {
    name: 'Valid?',
    position: [860, 520],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const answer = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Answer Question', position: [1080, 420], parameters: { source: 'database', workflowId: ANSWER_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ ok: true, answer: 'Salford Quays lost the most.', rows: [] }]
});

const logRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Log Row', position: [1300, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__LOG_ROW__
  } },
  output: [{ session_id: 'web-abc', question: 'Which branch?', ok: true }]
});

const save = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save to Log', position: [1520, 420], onError: 'continueRegularOutput', parameters: { resource: 'row', operation: 'insert', dataTableId: QUESTIONS, columns: { mappingMode: 'defineBelow', value: {
__MAP_QUESTIONS__
  }, schema: [
__SCHEMA_QUESTIONS__
  ] } } },
  output: [{ id: 1 }]
});

const reply = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Answer', position: [1740, 420], parameters: { respondWith: 'json', responseBody: expr("{{ $('Answer Question').first().json }}"), options: {} } }
});

const bad = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Bad Request', position: [1080, 640], parameters: { respondWith: 'json', responseBody: '{ "ok": false, "answer": "Please type a question.", "rows": [], "columns": [], "ms": 0 }', options: { responseCode: 400 } } }
});

const note = sticky(
  '## Ironleaf 2: Chat API\n`GET /webhook/ironleaf/chat` serves the data assistant page. `POST /webhook/ironleaf/ask` takes a question, adds the last 3 questions of the same chat (so follow-ups like "and last year?" work), gets the answer from **Ironleaf 1** and logs it in **Ironleaf Questions**. The page shows the answer, a chart, the rows and the SQL.',
  [], { position: [160, 0], width: 1100, height: 160, color: 4 }
);

export default workflow('ironleaf-chat-api', 'Ironleaf 2: Chat API')
  .add(pageHook)
  .to(page)
  .to(sendPage)
  .add(askHook)
  .to(readHistory)
  .to(question)
  .to(valid
    .onTrue(answer.to(logRow).to(save).to(reply))
    .onFalse(bad))
  .add(note);
