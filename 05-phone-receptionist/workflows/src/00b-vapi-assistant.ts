import { workflow, node, trigger, sticky, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'qh2lP825xnkmt4z2', cachedResultName: 'Receptionist Settings' };
const VAPI_CRED = { httpHeaderAuth: newCredential('Vapi API') };
const KV_SCHEMA = [
  { id: 'key', displayName: 'key', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
  { id: 'value', displayName: 'value', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
];

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Create Or Update Assistant', position: [200, 300] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'public_base_url', value: 'https://example.ngrok-free.app' }]
});

const build = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Assistant', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_ASSISTANT__
  } },
  output: [{ assistant_id: '', phone_number_id: '', assistant: { name: 'Fernhollow Dental Receptionist' } }]
});

const exists = ifElse({
  version: 2.2,
  config: {
    name: 'Assistant Exists?',
    position: [860, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.assistant_id }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const updateAssistant = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Update Assistant',
    position: [1080, 220],
    parameters: {
      method: 'PATCH',
      url: expr('https://api.vapi.ai/assistant/{{ $json.assistant_id }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.assistant) }}')
    },
    credentials: VAPI_CRED
  },
  output: [{ id: 'asst_123', name: 'Fernhollow Dental Receptionist' }]
});

const createAssistant = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Assistant',
    position: [1080, 400],
    parameters: {
      method: 'POST',
      url: 'https://api.vapi.ai/assistant',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.assistant) }}')
    },
    credentials: VAPI_CRED
  },
  output: [{ id: 'asst_123', name: 'Fernhollow Dental Receptionist' }]
});

const saveAssistant = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Assistant ID',
    position: [1300, 300],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: SETTINGS_TABLE,
      filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'assistant_id' }] },
      columns: { mappingMode: 'defineBelow', value: { key: 'assistant_id', value: expr('{{ $json.id }}') }, schema: KV_SCHEMA }
    }
  },
  output: [{ key: 'assistant_id', value: 'asst_123' }]
});

const needsNumber = ifElse({
  version: 2.2,
  config: {
    name: 'Needs Phone Number?',
    position: [1520, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr("{{ $('Build Assistant').first().json.phone_number_id }}"), operator: { type: 'string', operation: 'empty', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const createNumber = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Free Number',
    position: [1740, 220],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.vapi.ai/phone-number',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify({ provider: 'vapi', name: 'Fernhollow Dental main line', numberDesiredAreaCode: '512', assistantId: $('Save Assistant ID').first().json.value }) }}")
    },
    credentials: VAPI_CRED
  },
  output: [{ id: 'pn_123', number: '+15125550148' }]
});

const phoneRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Phone Rows', position: [1960, 220], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PHONE_ROWS__
  } },
  output: [{ key: 'phone_number_id', value: 'pn_123' }]
});

const savePhone = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Phone Number',
    position: [2180, 220],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: SETTINGS_TABLE,
      filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: expr('{{ $json.key }}') }] },
      columns: { mappingMode: 'defineBelow', value: { key: expr('{{ $json.key }}'), value: expr('{{ $json.value }}') }, schema: KV_SCHEMA }
    }
  },
  output: [{ key: 'phone_number_id', value: 'pn_123' }]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result', position: [2400, 300], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__RESULT__
  } },
  output: [{ assistant_id: 'asst_123' }]
});

const note = sticky(
  '## Receptionist 0b: Vapi Assistant\nBuilds the whole assistant from code and the prompt file: Nora\'s system prompt, GPT-5.4 mini, the Clara voice, Deepgram nova-3, six function tools pointing at **Receptionist 1** (with the secret header), the end-of-call webhook to **Receptionist 3**, and the post-call summary and structured data.\n\nCreates it the first time, then updates it in place, so re-run it after any prompt change. Also claims a free Vapi number (Austin, 512) once.',
  [], { position: [160, 20], width: 1000, height: 220, color: 4 }
);

export default workflow('receptionist-vapi-assistant', 'Receptionist 0b: Vapi Assistant')
  .add(run)
  .to(readSettings)
  .to(build)
  .to(exists
    .onTrue(updateAssistant.to(saveAssistant))
    .onFalse(createAssistant.to(saveAssistant)))
  .add(saveAssistant)
  .to(needsNumber
    .onTrue(createNumber.to(phoneRows).to(savePhone).to(result))
    .onFalse(result))
  .add(note);
