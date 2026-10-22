import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const HANDLE_WF = { __rl: true, mode: 'id', value: 'hcbHandleMsg0002', cachedResultName: 'Honeycrumb 2: Handle Message' };

const hook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Test Message', position: [200, 300], parameters: { httpMethod: 'POST', path: 'honeycrumb/test-chat', responseMode: 'lastNode', options: {} } },
  output: [{ body: { phone: '2348010000001', name: 'Test Customer', text: 'Hi, do you have red velvet cake?' } }]
});

const makeMessage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Make Message', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__MAKE_MESSAGE__
  } },
  output: [{ phone: '2348010000001', name: 'Test Customer', message_id: 'test-1', type: 'text', text: 'Hi', media_id: '', test: true }]
});

const handle = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Handle Message', position: [640, 300], parameters: { source: 'database', workflowId: HANDLE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Honeycrumb T: Test Chat\nRuns one customer message through **Honeycrumb 2** with `test = true` (replies go to the Outbox table, nothing is sent). Used by the scripted conversation tests; run it manually from the MCP or the editor.',
  [], { position: [160, 80], width: 640, height: 160, color: 7 }
);

export default workflow('honeycrumb-test-chat', 'Honeycrumb T: Test Chat')
  .add(hook)
  .to(makeMessage)
  .to(handle)
  .add(note);
