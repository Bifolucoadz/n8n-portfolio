import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };

const nightly = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every Night 9 pm', position: [200, 300], parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 0 21 * * *' }] } } },
  output: [{}]
});

const sendNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'owner_chat_id', value: '42' }]
});

const readOrders = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Orders', position: [640, 400], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, returnAll: true } },
  output: [{ order_id: 'HC-7K2Q', status: 'paid', total_ngn: 57000, paid_at: '2026-10-28T10:00:00.000+01:00' }]
});

const buildSummary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Summary', position: [860, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_SUMMARY__
  } },
  output: [{ chat_id: '42', text: 'Honeycrumb today' }]
});

const chatSet = ifElse({
  version: 2.2,
  config: {
    name: 'Owner Chat Set?',
    position: [1080, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.chat_id }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const send = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Summary',
    position: [1300, 340],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    parameters: { resource: 'message', operation: 'sendMessage', chatId: expr('{{ $json.chat_id }}'), text: expr('{{ $json.text }}'), additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true } },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## Honeycrumb 8: Daily Summary\n9 pm Lagos time (or **Send Now**): paid orders and revenue today, best sellers, orders still waiting for payment, and tomorrow\'s bake and delivery list, on the owner\'s Telegram.',
  [], { position: [160, 120], width: 760, height: 160, color: 5 }
);

export default workflow('honeycrumb-daily-summary', 'Honeycrumb 8: Daily Summary')
  .add(nightly)
  .to(readSettings)
  .to(readOrders)
  .to(buildSummary)
  .to(chatSet.onTrue(send))
  .add(sendNow)
  .to(readSettings)
  .add(note);
