import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'QbQi6BAEGxZmzGyT', cachedResultName: 'Kettle Settings' };
const STORE_WF = { __rl: true, mode: 'id', value: 'ktlStoreApi00001', cachedResultName: 'Kettle 1: Store API' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ktlSendEmail0006', cachedResultName: 'Kettle 6: Send Email' };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const every = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every 30 Minutes', position: [200, 300], parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] } } },
  output: [{}]
});

const runNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [440, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const askCheckouts = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Checkouts Request', position: [660, 400], executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [{ id: 'a', name: 'action', value: 'abandoned_checkouts', type: 'string' }] } } },
  output: [{ action: 'abandoned_checkouts' }]
});

const getCheckouts = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Checkouts', position: [880, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ checkouts: [] }]
});

const askProducts = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Products Request', position: [1100, 400], executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [{ id: 'a', name: 'action', value: 'inventory', type: 'string' }] } } },
  output: [{ action: 'inventory' }]
});

const getProducts = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Products', position: [1320, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ products: [] }]
});

const pick = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Pick Carts', position: [1540, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PICK__
  } },
  output: [{ checkout_id: 'CK-7001', email: 'ava.morgan@example.com', first_name: 'Ava', prompt: 'Customer first name: Ava', skipped: [] }]
});

const any = ifElse({
  version: 2.2,
  config: {
    name: 'Any to Email?',
    position: [1760, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ !$json.none }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const write = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Write Email',
    position: [1980, 300],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_CART_EMAIL__
        ,
        maxTokens: 2000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'cart_email', strict: true, schema:
__JSON_CART_EMAIL__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { subject: 'Your tea is waiting', preheader: '', body: 'Hi Ava,' } }] }] }]
});

const compose = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Compose', position: [2200, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__COMPOSE__
  } },
  output: [{ to: 'ava.morgan@example.com', subject: 'Your tea is waiting', html: '<p>Hi</p>', kind: 'cart_recovery', ref: 'CK-7001', action: 'mark_contacted', checkout_id: 'CK-7001', offer: 'WELCOME10' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Emails', position: [2420, 300], parameters: { source: 'database', workflowId: SEND_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const marks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Contacted', position: [2640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// One "contacted" write per email sent, so nobody is emailed twice.\nreturn $(\'Compose\').all().map(i => ({ json: { action: \'mark_contacted\', checkout_id: i.json.checkout_id, offer: i.json.offer } }));\n' } },
  output: [{ action: 'mark_contacted', checkout_id: 'CK-7001', offer: 'WELCOME10' }]
});

const mark = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Mark Contacted', position: [2860, 300], parameters: { source: 'database', workflowId: STORE_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [3080, 400], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SUMMARY__
  } },
  output: [{ sent: [], skipped: [] }]
});

const note = sticky(
  '## Kettle 2: Abandoned Carts\nEvery 30 minutes. **Pick Carts** (code) chooses who to email: not completed, has consent, not contacted yet, left 1-48 hours ago. It also decides the offer: the welcome code for first-time customers with $60 or more in the cart, a free-shipping nudge when they are within $15 of it, otherwise none.\n**Write Email** (GPT-5.4 mini) writes a short personal note from the shop owner using the shop\'s product notes, and may only mention the offer it was given. **Compose** adds the items, offer box, button and footer. Each checkout is then marked so it is never emailed twice.',
  [], { position: [160, -20], width: 1400, height: 220, color: 5 }
);

export default workflow('kettle-abandoned-carts', 'Kettle 2: Abandoned Carts')
  .add(every)
  .to(readSettings)
  .to(askCheckouts)
  .to(getCheckouts)
  .to(askProducts)
  .to(getProducts)
  .to(pick)
  .to(any
    .onTrue(write.to(compose).to(send).to(marks).to(mark).to(summary))
    .onFalse(summary))
  .add(runNow)
  .to(readSettings)
  .add(note);
