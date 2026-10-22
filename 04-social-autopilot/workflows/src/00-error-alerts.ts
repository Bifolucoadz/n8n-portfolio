import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const STATE_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };

const onError = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'When A Workflow Fails', position: [240, 300] },
  output: [{ workflow: { name: 'Social Autopilot 2: Clock' }, execution: { id: '1', url: 'http://localhost:5678/workflow/x/executions/1', lastNodeExecuted: 'Read Calendar', error: { message: 'Timeout' } } }]
});

const readState = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read State', position: [460, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: STATE_TABLE, returnAll: true } },
  output: [{ key: 'approver_chat_id', value: '123456' }]
});

const alert = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Alert Owner',
    position: [680, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ ($('Read State').all().find(i => i.json.key === 'approver_chat_id') || { json: {} }).json.value }}"),
      text: expr("🚨 <b>{{ $('When A Workflow Fails').first().json.workflow.name.replace(/&/g, '&amp;').replace(/</g, '&lt;') }}</b> failed\nNode: {{ ($('When A Workflow Fails').first().json.execution.lastNodeExecuted || 'unknown').replace(/&/g, '&amp;').replace(/</g, '&lt;') }}\nError: {{ String(($('When A Workflow Fails').first().json.execution.error || {}).message || 'no message').slice(0, 500).replace(/&/g, '&amp;').replace(/</g, '&lt;') }}\nTime: {{ $now.setZone('Africa/Lagos').toFormat('yyyy-MM-dd HH:mm') }}\n{{ $('When A Workflow Fails').first().json.execution.url || '' }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## Error alerts\nShared error handler for Social Autopilot 2-8: a failed production run sends the approver a Telegram message with the workflow, node, error and execution link. (The Lead Engine alert emails through the restricted Gmail, so this project uses Telegram.)',
  [], { position: [200, 40], width: 640, height: 200, color: 3 }
);

export default workflow('social-autopilot-errors', 'Social Autopilot 0: Error Alerts')
  .add(onError)
  .to(readState)
  .to(alert)
  .add(note);
