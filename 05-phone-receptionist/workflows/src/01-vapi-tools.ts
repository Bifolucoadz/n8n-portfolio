import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'qh2lP825xnkmt4z2', cachedResultName: 'Receptionist Settings' };
const RUN_TOOL_WF = { __rl: true, mode: 'id', value: 'rcpFernRunTool02', cachedResultName: 'Receptionist 2: Run Tool' };

const toolRequest = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Vapi Tool Request',
    position: [200, 300],
    parameters: { httpMethod: 'POST', path: 'fernhollow/tools', responseMode: 'responseNode', options: {} }
  },
  output: [{ headers: { 'x-fernhollow-key': 'secret' }, body: { message: { type: 'tool-calls', call: { id: 'c1', customer: { number: '+15125550123' } }, toolCallList: [{ id: 'tc1', type: 'function', function: { name: 'check_availability', arguments: { appointment_type: 'cleaning' } } }] } } }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read Settings',
    position: [420, 300],
    executeOnce: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true }
  },
  output: [{ key: 'webhook_secret', value: 'secret' }]
});

const unpack = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Unpack Calls',
    position: [640, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__UNPACK_CALLS__
    }
  },
  output: [{ authorized: true, tool_call_id: 'tc1', name: 'check_availability', args: { appointment_type: 'cleaning' }, caller_number: '+15125550123', call_id: 'c1', calendar_id: 'cal', sheet_id: 'sh', staff_chat_id: '42' }]
});

const authorized = ifElse({
  version: 2.2,
  config: {
    name: 'Authorized?',
    position: [860, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.authorized }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const runTool = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Run Each Tool',
    position: [1080, 220],
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: RUN_TOOL_WF, mode: 'each', options: { waitForSubWorkflow: true } }
  }
});

const pack = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pack Results',
    position: [1300, 220],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PACK_RESULTS__
    }
  },
  output: [{ results: [{ name: 'check_availability', toolCallId: 'tc1', result: 'Free times for Cleaning and check-up (60 minutes): ...' }] }]
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Send Results',
    position: [1520, 220],
    parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: { responseCode: 200 } }
  }
});

const reject = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Reject',
    position: [1080, 400],
    parameters: { respondWith: 'json', responseBody: '{ "error": "unauthorized" }', options: { responseCode: 401 } }
  }
});

const note = sticky(
  '## Receptionist 1: Vapi Tools\n`POST /webhook/fernhollow/tools`, the server URL of every Vapi tool. Vapi sends a `tool-calls` message while the caller waits (Nora says "one moment").\n\n- The `x-fernhollow-key` header must match `webhook_secret` in **Receptionist Settings**; anything else gets a 401.\n- Each call in `toolCallList` runs through **Receptionist 2** (with the caller\'s number from the call).\n- The answer is `{ results: [{ toolCallId, result }] }` with flat one-line strings, as Vapi requires. A failed tool still answers, with "offer to take a message".',
  [], { position: [160, -40], width: 940, height: 240, color: 4 }
);

export default workflow('receptionist-vapi-tools', 'Receptionist 1: Vapi Tools')
  .add(toolRequest)
  .to(readSettings)
  .to(unpack)
  .to(authorized
    .onTrue(runTool.to(pack).to(respond))
    .onFalse(reject))
  .add(note);
