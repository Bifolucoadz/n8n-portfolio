import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'QbQi6BAEGxZmzGyT', cachedResultName: 'Kettle Settings' };
const REPORTS = { __rl: true, mode: 'id', value: 'AyZ17CcwolU182Td', cachedResultName: 'Kettle Reports' };
const STORE_WF = { __rl: true, mode: 'id', value: 'ktlStoreApi00001', cachedResultName: 'Kettle 1: Store API' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ktlSendEmail0006', cachedResultName: 'Kettle 6: Send Email' };

const daily = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every Morning 7:00', position: [200, 300], parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 7, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const runNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [440, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'safety_days', value: '7' }]
});

const askInventory = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Inventory Request', position: [660, 400], executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [{ id: 'a', name: 'action', value: 'inventory', type: 'string' }] } } },
  output: [{ action: 'inventory' }]
});

const getInventory = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Inventory', position: [880, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ products: [] }]
});

const askOrders = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Orders Request', position: [1100, 400], executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
    { id: 'a', name: 'action', value: 'orders_since', type: 'string' }, { id: 'd', name: 'days', value: 28, type: 'number' }
  ] } } },
  output: [{ action: 'orders_since', days: 28 }]
});

const getOrders = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Orders', position: [1320, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ orders: [] }]
});

const compute = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Stock Check', position: [1540, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__COMPUTE__
  } },
  output: [{ any: true, email: {}, report: {} }]
});

const saveReport = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Report', position: [1760, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: REPORTS, columns: { mappingMode: 'defineBelow', value: {
    kind: expr('{{ $json.report.kind }}'), period: expr('{{ $json.report.period }}'), summary: expr('{{ $json.report.summary }}'), data_json: expr('{{ $json.report.data_json }}'), created_at: expr('{{ $json.report.created_at }}')
  }, schema: [
__SCHEMA_REPORTS__
  ] } } },
  output: [{ id: 1 }]
});

const anyLow = ifElse({
  version: 2.2,
  config: {
    name: 'Anything Low?',
    position: [1980, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $('Stock Check').first().json.any }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const emailItem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Email Item', position: [2200, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// The alert email for Send Email.\nreturn [{ json: $(\'Stock Check\').first().json.email }];\n' } },
  output: [{ to: 'hannah@kettleandfern.example', subject: 'Low stock', html: '<p>Low</p>', kind: 'low_stock', ref: '' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Email the Owner', position: [2420, 300], parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Kettle 4: Low Stock\nEvery morning at 7:00, in code (no AI). For every product: units sold per day over 28 days, days of stock left, the day it runs out and the last day to order. It flags anything that will run out before a delivery could arrive (supplier lead time plus a safety buffer) and suggests a reorder quantity: enough for the lead time plus 30 days, never below the supplier\'s minimum. The check is saved in **Kettle Reports**; the owner gets an email only when something is low.',
  [], { position: [160, 40], width: 1300, height: 200, color: 5 }
);

export default workflow('kettle-low-stock', 'Kettle 4: Low Stock')
  .add(daily)
  .to(readSettings)
  .to(askInventory)
  .to(getInventory)
  .to(askOrders)
  .to(getOrders)
  .to(compute)
  .to(saveReport)
  .to(anyLow.onTrue(emailItem.to(send)))
  .add(runNow)
  .to(readSettings)
  .add(note);
