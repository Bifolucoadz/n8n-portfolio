import { workflow, node, trigger, sticky, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const OUTBOX_TABLE = { __rl: true, mode: 'id', value: 'r2de7veluVepOlgg', cachedResultName: 'Honeycrumb Outbox' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 300], parameters: { inputSource: 'passthrough' } },
  output: [{ to: '2348010000000', kind: 'text', body: 'Hello from Honeycrumb!', url: '', button_text: '', message_id: '', test: true }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'whatsapp_phone_number_id', value: '123' }]
});

const buildPayload = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Payload', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_PAYLOAD__
  } },
  output: [{ test: true, url: 'https://graph.facebook.com/v23.0/123/messages', payload: { messaging_product: 'whatsapp', to: '2348010000000', type: 'text', text: { body: 'Hello' } }, outbox: { phone: '2348010000000', kind: 'text', body: 'Hello', url: '', at: '2026-10-28T10:00:00.000+01:00' } }]
});

const isTest = ifElse({
  version: 2.2,
  config: {
    name: 'Test Mode?',
    position: [860, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.test }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const toOutbox = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save To Outbox',
    position: [1080, 220],
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: OUTBOX_TABLE,
      columns: {
        mappingMode: 'defineBelow',
        value: { phone: expr('{{ $json.outbox.phone }}'), kind: expr('{{ $json.outbox.kind }}'), body: expr('{{ $json.outbox.body }}'), url: expr('{{ $json.outbox.url }}'), at: expr('{{ $json.outbox.at }}') },
        schema: [
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'body', displayName: 'body', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'url', displayName: 'url', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
        ]
      }
    }
  },
  output: [{ id: 1, phone: '2348010000000', kind: 'text' }]
});

const send = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Send Message',
    position: [1080, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $json.url }}'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'whatsAppApi',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.payload) }}'),
      options: { timeout: 15000 }
    },
    credentials: { whatsAppApi: newCredential('WhatsApp account') }
  },
  output: [{ messaging_product: 'whatsapp', messages: [{ id: 'wamid.123' }] }]
});

const note = sticky(
  '## Honeycrumb 4: Send WhatsApp\nEvery outgoing message goes through here: `text`, `cta` (a **Pay ₦X** button that opens the Paystack link), `image`, and `read` (blue ticks plus the typing indicator while the agent thinks).\n\nWith `test = true` nothing is sent: the message lands in the **Honeycrumb Outbox** data table, so the whole shop can be tested without Meta.',
  [], { position: [160, 40], width: 900, height: 200, color: 5 }
);

export default workflow('honeycrumb-send-whatsapp', 'Honeycrumb 4: Send WhatsApp')
  .add(whenCalled)
  .to(readSettings)
  .to(buildPayload)
  .to(isTest.onTrue(toOutbox).onFalse(send))
  .add(note);
