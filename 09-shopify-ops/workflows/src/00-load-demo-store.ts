import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Load Demo Store', position: [200, 300] },
  output: [{}]
});

const clear0 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Products', position: [420, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'Ep9njyaWF13y9SHL', cachedResultName: 'Kettle Products' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear1 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Orders', position: [640, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'KVudLSbZlietFc9a', cachedResultName: 'Kettle Orders' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Checkouts', position: [860, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'XluYD3lO9tEeAhBS', cachedResultName: 'Kettle Checkouts' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear3 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Reviews', position: [1080, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'D2bbJsHicEHPMugS', cachedResultName: 'Kettle Reviews' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear4 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Messages', position: [1300, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'V2SpiVAU4JiGBdNI', cachedResultName: 'Kettle Messages' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear5 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Outbox', position: [1520, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: '1crkkgyfXiNjy3HZ', cachedResultName: 'Kettle Outbox' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear6 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Reports', position: [1740, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'AyZ17CcwolU182Td', cachedResultName: 'Kettle Reports' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});

const seed = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Demo Store', position: [1960, 300], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SEED__
  } },
  output: [{ table: 'products', sku: 'EG-100' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Which Table?',
    position: [2180, 300],
    parameters: { rules: { values: [
        { outputKey: 'products', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'products' }], combinator: 'and' } },
        { outputKey: 'orders', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'orders' }], combinator: 'and' } },
        { outputKey: 'checkouts', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'checkouts' }], combinator: 'and' } },
        { outputKey: 'reviews', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'reviews' }], combinator: 'and' } }
    ] } }
  }
});

const add0 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Products', position: [2420, 140], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'Ep9njyaWF13y9SHL', cachedResultName: 'Kettle Products' }, columns: { mappingMode: 'defineBelow', value: {
__MAP_PRODUCTS__
  }, schema: [
__SCHEMA_PRODUCTS__
  ] } } },
  output: [{ id: 1 }]
});
const add1 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Orders', position: [2420, 320], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'KVudLSbZlietFc9a', cachedResultName: 'Kettle Orders' }, columns: { mappingMode: 'defineBelow', value: {
__MAP_ORDERS__
  }, schema: [
__SCHEMA_ORDERS__
  ] } } },
  output: [{ id: 1 }]
});
const add2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Checkouts', position: [2420, 500], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'XluYD3lO9tEeAhBS', cachedResultName: 'Kettle Checkouts' }, columns: { mappingMode: 'defineBelow', value: {
__MAP_CHECKOUTS__
  }, schema: [
__SCHEMA_CHECKOUTS__
  ] } } },
  output: [{ id: 1 }]
});
const add3 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Reviews', position: [2420, 680], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'D2bbJsHicEHPMugS', cachedResultName: 'Kettle Reviews' }, columns: { mappingMode: 'defineBelow', value: {
__MAP_REVIEWS__
  }, schema: [
__SCHEMA_REVIEWS__
  ] } } },
  output: [{ id: 1 }]
});

const note = sticky(
  '## Kettle 0: Load Demo Store (manual, destructive)\nClears the demo tables and loads a store dated relative to today: 14 products (three running low), about four weeks of orders with tracking (one stuck in transit, one on its way, one waiting to ship, one delivered), six abandoned checkouts that test each recovery rule, and two weeks of reviews with a jump in shipping complaints. A seeded generator makes the same store every time.',
  [], { position: [160, 40], width: 1200, height: 200, color: 3 }
);

export default workflow('kettle-load-demo-store', 'Kettle 0: Load Demo Store')
  .add(run)
  .to(clear0)
  .to(clear1)
  .to(clear2)
  .to(clear3)
  .to(clear4)
  .to(clear5)
  .to(clear6)
  .to(seed)
  .to(which
    .onCase(0, add0)
    .onCase(1, add1)
    .onCase(2, add2)
    .onCase(3, add3))
  .add(note);
