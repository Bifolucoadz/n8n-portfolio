import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Reset Demo', position: [200, 300] },
  output: [{}]
});

const clear0 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Deals', position: [420, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: '6fad2EyLoty9oElv', cachedResultName: 'Tidewater Deals' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear1 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Companies', position: [640, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'h1O24r8zgxQeqODi', cachedResultName: 'Tidewater Companies' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Contacts', position: [860, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: '0jlx2ckch1Gj6Qtr', cachedResultName: 'Tidewater Contacts' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear3 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Activity', position: [1080, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'VUrS7HRsgmNpXROv', cachedResultName: 'Tidewater Activity' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear4 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Calls', position: [1300, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: '0hHsTxLEuk6Su6C7', cachedResultName: 'Tidewater Calls' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear5 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Outbox', position: [1520, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'VGQHvXZw7QIaNJgY', cachedResultName: 'Tidewater Outbox' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});

const seed = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Starting CRM', position: [1740, 300], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SEED__
  } },
  output: [{ table: 'deals', deal_id: 'D-1001' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Which Table?',
    position: [1980, 300],
    parameters: { rules: { values: [
        { outputKey: 'companies', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'companies' }], combinator: 'and' } },
        { outputKey: 'contacts', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'contacts' }], combinator: 'and' } },
        { outputKey: 'deals', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'deals' }], combinator: 'and' } },
        { outputKey: 'activity', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'activity' }], combinator: 'and' } }
    ] } }
  }
});

const add0 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Companies', position: [2300, 160], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'h1O24r8zgxQeqODi', cachedResultName: 'Tidewater Companies' }, columns: { mappingMode: 'defineBelow', value: {
__MAP_COMPANIES__
  }, schema: [
__SCHEMA_COMPANIES__
  ] } } },
  output: [{ id: 1 }]
});
const add1 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Contacts', position: [2300, 340], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: '0jlx2ckch1Gj6Qtr', cachedResultName: 'Tidewater Contacts' }, columns: { mappingMode: 'defineBelow', value: {
__MAP_CONTACTS__
  }, schema: [
__SCHEMA_CONTACTS__
  ] } } },
  output: [{ id: 1 }]
});
const add2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Deals', position: [2300, 520], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: '6fad2EyLoty9oElv', cachedResultName: 'Tidewater Deals' }, columns: { mappingMode: 'defineBelow', value: {
__MAP_DEALS__
  }, schema: [
__SCHEMA_DEALS__
  ] } } },
  output: [{ id: 1 }]
});
const add3 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Activity', position: [2300, 700], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'VUrS7HRsgmNpXROv', cachedResultName: 'Tidewater Activity' }, columns: { mappingMode: 'defineBelow', value: {
__MAP_ACTIVITY__
  }, schema: [
__SCHEMA_ACTIVITY__
  ] } } },
  output: [{ id: 1 }]
});

const note = sticky(
  '## Tidewater 6: Reset Demo (manual, destructive)\nPuts the demo CRM back to where it starts: three open deals (Calloway Dental at appointment scheduled, Pemberton Freight at presentation scheduled, Ostara Home Care at contract sent), their companies and contacts and a little earlier activity. Clears processed calls and the outbox.',
  [], { position: [160, 60], width: 1100, height: 180, color: 3 }
);

export default workflow('tidewater-reset-demo', 'Tidewater 6: Reset Demo')
  .add(run)
  .to(clear0)
  .to(clear1)
  .to(clear2)
  .to(clear3)
  .to(clear4)
  .to(clear5)
  .to(seed)
  .to(which
    .onCase(0, add0)
    .onCase(1, add1)
    .onCase(2, add2)
    .onCase(3, add3))
  .add(note);
