import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const CUSTOMERS_TABLE = { __rl: true, mode: 'id', value: 'QGkic5oor2SFHsoJ', cachedResultName: 'Honeycrumb Customers' };
const SEND_WF = { __rl: true, mode: 'id', value: 'hcbSendWA0000004', cachedResultName: 'Honeycrumb 4: Send WhatsApp' };

const every15 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every 15 Minutes', position: [200, 300], parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } } },
  output: [{}]
});

const readUnpaid = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Unpaid', position: [420, 300], parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, returnAll: true, filters: { conditions: [{ keyName: 'status', condition: 'eq', keyValue: 'awaiting_payment' }] } } },
  output: [{ order_id: 'HC-7K2Q', phone: '2348010000000', status: 'awaiting_payment', reminder_sent: false }]
});

const readCustomers = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Customers', position: [640, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CUSTOMERS_TABLE, returnAll: true } },
  output: [{ phone: '2348010000000', last_inbound_at: '2026-10-28T10:00:00.000+01:00' }]
});

const due = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Due', position: [860, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__DUE__
  } },
  output: [{ action: 'remind', order_id: 'HC-7K2Q', phone: '2348010000000', url: 'https://checkout.paystack.com/abc', button_text: 'Pay ₦57,000', body: 'Your order is still waiting for payment.' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Remind Or Expire?',
    position: [1080, 300],
    parameters: {
      rules: { values: [
        { outputKey: 'remind', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'remind' }], combinator: 'and' } },
        { outputKey: 'expire', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'expire' }], combinator: 'and' } }
      ] },
      options: {}
    }
  }
});

const markReminded = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Reminded',
    position: [1300, 220],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.order_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: { order_id: expr('{{ $json.order_id }}'), reminder_sent: true }, schema: [
        { id: 'order_id', displayName: 'order_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'reminder_sent', displayName: 'reminder_sent', required: false, defaultMatch: false, display: true, type: 'boolean', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ order_id: 'HC-7K2Q', reminder_sent: true }]
});

const reminderMessage = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Reminder Message',
    position: [1520, 220],
    parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
      { id: 't', name: 'to', value: expr("{{ $('Due').item.json.phone }}"), type: 'string' },
      { id: 'k', name: 'kind', value: 'cta', type: 'string' },
      { id: 'b', name: 'body', value: expr("{{ $('Due').item.json.body }}"), type: 'string' },
      { id: 'u', name: 'url', value: expr("{{ $('Due').item.json.url }}"), type: 'string' },
      { id: 'n', name: 'button_text', value: expr("{{ $('Due').item.json.button_text }}"), type: 'string' },
      { id: 'x', name: 'test', value: false, type: 'boolean' }
    ] } }
  },
  output: [{ to: '2348010000000', kind: 'cta', body: 'Still waiting for payment', url: 'https://checkout.paystack.com/abc', button_text: 'Pay ₦57,000', test: false }]
});

const sendReminder = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Reminder', position: [1740, 220], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'each', options: { waitForSubWorkflow: false } } }
});

const markExpired = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Expired',
    position: [1300, 400],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.order_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: { order_id: expr('{{ $json.order_id }}'), status: 'expired', updated_at: expr('{{ $now.toISO() }}') }, schema: [
        { id: 'order_id', displayName: 'order_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ order_id: 'HC-7K2Q', status: 'expired' }]
});

const note = sticky(
  '## Honeycrumb 7: Reminders\nEvery 15 minutes, for orders still waiting for payment: one friendly reminder with the **Pay** button after an hour (only inside WhatsApp\'s 24-hour window), and expiry after 24 hours so stale carts don\'t pile up.',
  [], { position: [160, 80], width: 900, height: 160, color: 5 }
);

export default workflow('honeycrumb-reminders', 'Honeycrumb 7: Reminders')
  .add(every15)
  .to(readUnpaid)
  .to(readCustomers)
  .to(due)
  .to(which
    .onCase(0, markReminded.to(reminderMessage).to(sendReminder))
    .onCase(1, markExpired))
  .add(note);
