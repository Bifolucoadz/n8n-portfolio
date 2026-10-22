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
        '// One outgoing WhatsApp message -> Cloud API payload (or an Outbox row in test mode).\n' +
        '// kinds: text, cta (button that opens a link), image, read (blue ticks + typing indicator).\n' +
        'const m = $("When Called").first().json;\n' +
        'const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        'const test = m.test === true || String(m.test) === "true";\n' +
        'const to = String(m.to ?? "").replace(/\\D/g, "");\n' +
        'const body = String(m.body ?? "").trim();\n' +
        'if (m.kind === "read" && (test || !m.message_id)) return [];\n' +
        'const url = `https://graph.facebook.com/${settings.graph_version || "v23.0"}/${settings.whatsapp_phone_number_id}/messages`;\n' +
        'let payload;\n' +
        'if (m.kind === "read") {\n' +
        '  payload = { messaging_product: "whatsapp", status: "read", message_id: m.message_id, typing_indicator: { type: "text" } };\n' +
        '} else if (m.kind === "cta" && m.url) {\n' +
        '  payload = {\n' +
        '    messaging_product: "whatsapp", recipient_type: "individual", to, type: "interactive",\n' +
        '    interactive: { type: "cta_url", body: { text: body.slice(0, 1024) }, action: { name: "cta_url", parameters: { display_text: String(m.button_text || "Open").slice(0, 20), url: m.url } } },\n' +
        '  };\n' +
        '} else if (m.kind === "image" && m.url) {\n' +
        '  payload = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "image", image: { link: m.url, caption: body.slice(0, 1024) } };\n' +
        '} else {\n' +
        '  payload = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: body.slice(0, 4096) } };\n' +
        '}\n' +
        'return [{\n' +
        '  json: {\n' +
        '    test,\n' +
        '    url,\n' +
        '    payload,\n' +
        '    outbox: { phone: to, kind: m.kind || "text", body, url: m.url || "", at: DateTime.now().setZone("Africa/Lagos").toISO() },\n' +
        '  },\n' +
        '}];\n'
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
