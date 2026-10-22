import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const OPENAI_CRED = { openAiApi: { id: '@@OPENAI_CRED_ID@@', name: 'OpenAI account' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 300], parameters: { inputSource: 'passthrough' } },
  output: [{ run_id: 'RUN-ABC123', as_of: '', ignore_lines: 'DEMO SITE', page: { page_id: 'TS-BIKES', competitor: 'Torque Street', page_type: 'products', url: 'http://localhost:5678/webhook/demo-web/torque-street/bikes', last_hash: '', last_items_json: '[]', last_text: '', fail_count: 0 } }]
});

const fetchPage = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Page',
    position: [420, 300],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET', url: expr('{{ $json.page.url }}'),
      sendHeaders: true, headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (compatible; CobbleRadar/1.0; price monitoring)' }, { name: 'Accept-Language', value: 'en-GB' }] },
      options: { response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } }, timeout: 20000 }
    }
  },
  output: [{ statusCode: 200, headers: {}, body: '<html></html>' }]
});

const readPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Read Page', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__READ_PAGE__
  } },
  output: [{ ok: true, http_status: 200, method: 'json-ld', products: [], lines: [], text: '', hash_input: '' }]
});

const fingerprint = node({
  type: 'n8n-nodes-base.crypto',
  version: 1,
  config: { name: 'Fingerprint', position: [860, 300], parameters: { action: 'hash', type: 'SHA256', value: expr('{{ $json.hash_input }}'), dataPropertyName: 'hash', encoding: 'hex' } },
  output: [{ ok: true, hash: 'ab12' }]
});

const changed = ifElse({
  version: 2.2,
  config: {
    name: 'Changed?',
    position: [1080, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $json.ok && $json.hash !== $('When Called').first().json.page.last_hash }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const needsAi = ifElse({
  version: 2.2,
  config: {
    name: 'Needs AI?',
    position: [1300, 200],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $('Read Page').first().json.method === 'ai' }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const readProducts = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Read Products (AI)',
    position: [1540, 60],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr("Competitor: {{ $('When Called').first().json.page.competitor }}\nPage: {{ $('When Called').first().json.page.url }}\n\nPage text:\n{{ $('Read Page').first().json.text }}") }] },
      options: {
        instructions:
__PROMPT_READ_PRODUCTS__
        ,
        maxTokens: 4000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'products', strict: true, schema:
__JSON_READ_PRODUCTS__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [] }]
});

const compare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Compare', position: [1840, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__COMPARE__
  } },
  output: [{ page_id: 'TS-BIKES', status: 'changed', changes: [], items: [], state: {} }]
});

const noChange = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'No Change or Failed', position: [1300, 440], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__NO_CHANGE__
  } },
  output: [{ page_id: 'TS-BIKES', status: 'unchanged', changes: [], items: [], state: {} }]
});

const note = sticky(
  '## Radar 2: Check Page\nOne competitor page per call. The page is fetched and cleaned; product pages with **JSON-LD** structured data are read in code, others by **GPT-5.4 mini**. A SHA-256 **fingerprint** of the cleaned content means the AI only runs when a page has really changed. **Compare** lists price moves, new and removed products and stock changes (or added and removed lines on home, careers and news pages). If a product page suddenly loses most of its products, it says "check this page" instead of reporting them all as gone; three failed fetches in a row report the page as down.',
  [], { position: [160, -120], width: 1240, height: 190, color: 7 }
);

export default workflow('radar-check-page', 'Radar 2: Check Page')
  .add(whenCalled)
  .to(fetchPage)
  .to(readPage)
  .to(fingerprint)
  .to(changed
    .onTrue(needsAi
      .onTrue(readProducts.to(compare))
      .onFalse(compare))
    .onFalse(noChange))
  .add(note);
