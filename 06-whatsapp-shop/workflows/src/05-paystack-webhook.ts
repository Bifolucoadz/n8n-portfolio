import { workflow, node, trigger, sticky, ifElse, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const SEND_WF = { __rl: true, mode: 'id', value: 'hcbSendWA0000004', cachedResultName: 'Honeycrumb 4: Send WhatsApp' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const OWNER = "{{ ($('Read Settings').all().find(i => i.json.key === 'owner_chat_id') || { json: {} }).json.value || '' }}";
const BOARD = "{{ ($('Read Settings').all().find(i => i.json.key === 'kitchen_sheet_id') || { json: {} }).json.value }}";

const event = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Paystack Event', position: [200, 400], parameters: { httpMethod: 'POST', path: 'honeycrumb/paystack', responseMode: 'onReceived', options: { responseCode: 200 } } },
  output: [{ body: { event: 'charge.success', data: { reference: 'HC-7K2Q-141500', amount: 5700000, currency: 'NGN', status: 'success' } } }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'owner_chat_id', value: '42' }]
});

const checkEvent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Event', position: [640, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECK_EVENT__
  } },
  output: [{ reference: 'HC-7K2Q-141500' }]
});

const verify = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Verify Payment',
    position: [860, 400],
    onError: 'continueRegularOutput',
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: {
      method: 'GET',
      url: expr('https://api.paystack.co/transaction/verify/{{ encodeURIComponent($json.reference) }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: { timeout: 15000 }
    },
    credentials: { httpHeaderAuth: newCredential('Paystack Test') }
  },
  output: [{ status: true, data: { status: 'success', amount: 5700000, currency: 'NGN', reference: 'HC-7K2Q-141500' } }]
});

const findOrder = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Find Order',
    position: [1080, 400],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, limit: 1, filters: { conditions: [{ keyName: 'paystack_ref', condition: 'eq', keyValue: expr("{{ $('Check Event').first().json.reference }}") }] } }
  },
  output: [{ order_id: 'HC-7K2Q', status: 'awaiting_payment', total_ngn: 57000 }]
});

const decide = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Decide', position: [1300, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__DECIDE__
  } },
  output: [{ action: 'paid', order: { order_id: 'HC-7K2Q', status: 'paid' }, customer_text: 'Payment received', owner_text: 'New paid order', board_row: { order_id: 'HC-7K2Q' } }]
});

const whatNext = switchCase({
  version: 3.2,
  config: {
    name: 'What Next?',
    position: [1520, 400],
    parameters: {
      rules: { values: [
        { outputKey: 'paid', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'paid' }], combinator: 'and' } },
        { outputKey: 'alert', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'alert' }], combinator: 'and' } }
      ] },
      options: {}
    }
  }
});

const markPaid = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Paid',
    position: [1740, 300],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.order.order_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
__ORDER_MAP_ORDER__
        },
        schema: [
__ORDER_SCHEMA__
        ]
      }
    }
  },
  output: [{ order_id: 'HC-7K2Q', status: 'paid' }]
});

const confirmMessage = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Confirmation Message',
    position: [1960, 300],
    parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
      { id: 't', name: 'to', value: expr("{{ $('Decide').first().json.order.phone }}"), type: 'string' },
      { id: 'k', name: 'kind', value: 'text', type: 'string' },
      { id: 'b', name: 'body', value: expr("{{ $('Decide').first().json.customer_text }}"), type: 'string' },
      { id: 'x', name: 'test', value: false, type: 'boolean' }
    ] } }
  },
  output: [{ to: '2348010000000', kind: 'text', body: 'Payment received', test: false }]
});

const sendConfirmation = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Confirmation', position: [2180, 300], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: false } } }
});

const addToBoard = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add To Kitchen Board',
    position: [2400, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sheet', operation: 'append',
      documentId: { __rl: true, mode: 'id', value: expr(BOARD) },
      sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Orders' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          order_id: expr("{{ $('Decide').first().json.board_row.order_id }}"),
          status: expr("{{ $('Decide').first().json.board_row.status }}"),
          deliver_on: expr("{{ $('Decide').first().json.board_row.deliver_on }}"),
          window: expr("{{ $('Decide').first().json.board_row.window }}"),
          fulfilment: expr("{{ $('Decide').first().json.board_row.fulfilment }}"),
          area: expr("{{ $('Decide').first().json.board_row.area }}"),
          address: expr("{{ $('Decide').first().json.board_row.address }}"),
          customer: expr("{{ $('Decide').first().json.board_row.customer }}"),
          phone: expr("{{ $('Decide').first().json.board_row.phone }}"),
          items: expr("{{ $('Decide').first().json.board_row.items }}"),
          total_ngn: expr("{{ $('Decide').first().json.board_row.total_ngn }}"),
          note: expr("{{ $('Decide').first().json.board_row.note }}"),
          paid_at: expr("{{ $('Decide').first().json.board_row.paid_at }}")
        },
        schema: [
          { id: 'order_id', displayName: 'order_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'deliver_on', displayName: 'deliver_on', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'window', displayName: 'window', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'fulfilment', displayName: 'fulfilment', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'area', displayName: 'area', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'address', displayName: 'address', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'customer', displayName: 'customer', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'items', displayName: 'items', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'total_ngn', displayName: 'total_ngn', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'paid_at', displayName: 'paid_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true }
    },
    credentials: SHEETS_CRED
  },
  output: [{ order_id: 'HC-7K2Q' }]
});

const ownerSetPaid = ifElse({
  version: 2.2,
  config: {
    name: 'Owner Chat Set?',
    position: [2620, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr(OWNER), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const alertPaid = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'New Order Alert',
    position: [2840, 240],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: { resource: 'message', operation: 'sendMessage', chatId: expr(OWNER), text: expr("{{ $('Decide').first().json.owner_text }}"), additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true } },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const ownerSetAlert = ifElse({
  version: 2.2,
  config: {
    name: 'Owner Chat Set? (problem)',
    position: [1740, 520],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr(OWNER), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const alertProblem = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Payment Problem Alert',
    position: [1960, 520],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: { resource: 'message', operation: 'sendMessage', chatId: expr(OWNER), text: expr('{{ $json.text }}'), additionalFields: { appendAttribution: false, parse_mode: 'HTML' } },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## Honeycrumb 5: Paystack Webhook\n`POST /webhook/honeycrumb/paystack` (set as the Test Webhook URL in Paystack). The webhook is only a hint: every `charge.success` is re-checked with Paystack\'s **verify** API, and the order is marked paid only if the status is success, the currency is NGN and the amount matches the order total to the kobo. Duplicates are ignored.\n\nPaid: order updated, customer confirmation on WhatsApp, a row on the **kitchen board**, and a Telegram alert to the owner. Anything that doesn\'t match: owner alert, nothing marked paid.',
  [], { position: [160, 80], width: 1000, height: 220, color: 5 }
);

export default workflow('honeycrumb-paystack-webhook', 'Honeycrumb 5: Paystack Webhook')
  .add(event)
  .to(readSettings)
  .to(checkEvent)
  .to(verify)
  .to(findOrder)
  .to(decide)
  .to(whatNext
    .onCase(0, markPaid.to(confirmMessage).to(sendConfirmation).to(addToBoard).to(ownerSetPaid.onTrue(alertPaid)))
    .onCase(1, ownerSetAlert.onTrue(alertProblem)))
  .add(note);
