import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const CUSTOMERS_TABLE = { __rl: true, mode: 'id', value: 'QGkic5oor2SFHsoJ', cachedResultName: 'Honeycrumb Customers' };
const SEND_WF = { __rl: true, mode: 'id', value: 'hcbSendWA0000004', cachedResultName: 'Honeycrumb 4: Send WhatsApp' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const BOARD = "{{ ($('Read Settings').all().find(i => i.json.key === 'kitchen_sheet_id') || { json: {} }).json.value || '' }}";

const everyMinute = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every Minute', position: [200, 300], parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } } },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'kitchen_sheet_id', value: '1abc' }]
});

const boardSet = ifElse({
  version: 2.2,
  config: {
    name: 'Board Set Up?',
    position: [640, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr(BOARD), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const readBoard = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Board',
    position: [860, 240],
    executeOnce: true,
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: { __rl: true, mode: 'id', value: expr(BOARD) }, sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Orders' } },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, order_id: 'HC-7K2Q', status: 'baking' }]
});

const readOrders = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Orders', position: [1080, 240], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, returnAll: true } },
  output: [{ order_id: 'HC-7K2Q', phone: '2348010000000', status: 'paid' }]
});

const readCustomers = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Customers', position: [1300, 240], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CUSTOMERS_TABLE, returnAll: true } },
  output: [{ phone: '2348010000000', last_inbound_at: '2026-10-28T10:00:00.000+01:00' }]
});

const statusChange = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Status Change', position: [1520, 240], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__STATUS_CHANGE__
  } },
  output: [{ order_id: 'HC-7K2Q', phone: '2348010000000', status: 'baking', in_window: true, text: 'Your order HC-7K2Q is in the oven now!', updated_at: '2026-10-28T10:00:00.000+01:00' }]
});

const saveStatus = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Status',
    position: [1740, 240],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.order_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { order_id: expr('{{ $json.order_id }}'), status: expr('{{ $json.status }}'), updated_at: expr('{{ $json.updated_at }}') },
        schema: [
          { id: 'order_id', displayName: 'order_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
        ]
      }
    }
  },
  output: [{ order_id: 'HC-7K2Q', status: 'baking' }]
});

const inWindow = ifElse({
  version: 2.2,
  config: {
    name: 'Within 24 Hours?',
    position: [1960, 240],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $('Status Change').item.json.in_window }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const updateMessage = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Update Message',
    position: [2180, 180],
    parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
      { id: 't', name: 'to', value: expr("{{ $('Status Change').item.json.phone }}"), type: 'string' },
      { id: 'k', name: 'kind', value: 'text', type: 'string' },
      { id: 'b', name: 'body', value: expr("{{ $('Status Change').item.json.text }}"), type: 'string' },
      { id: 'x', name: 'test', value: false, type: 'boolean' }
    ] } }
  },
  output: [{ to: '2348010000000', kind: 'text', body: 'Your order is in the oven now!', test: false }]
});

const sendUpdate = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Update', position: [2400, 180], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'each', options: { waitForSubWorkflow: false } } }
});

const note = sticky(
  '## Honeycrumb 6: Kitchen Board\nThe owner runs the day from the **Honeycrumb Kitchen Board** sheet: paid orders arrive there, and staff change the `status` dropdown (baking, out_for_delivery, ready_for_pickup, delivered, cancelled).\n\nEvery minute this compares the board with the orders table; each change is saved and the customer gets a WhatsApp update. WhatsApp only allows free-form messages within 24 hours of the customer\'s last message, so older chats are updated silently (production would use an approved template).',
  [], { position: [160, -20], width: 1000, height: 220, color: 5 }
);

export default workflow('honeycrumb-kitchen-board', 'Honeycrumb 6: Kitchen Board')
  .add(everyMinute)
  .to(readSettings)
  .to(boardSet.onTrue(readBoard.to(readOrders).to(readCustomers).to(statusChange).to(saveStatus).to(inWindow.onTrue(updateMessage.to(sendUpdate)))))
  .add(note);
