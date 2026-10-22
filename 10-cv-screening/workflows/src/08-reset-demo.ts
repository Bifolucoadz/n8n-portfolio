import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Reset Demo', position: [200, 300] },
  output: [{}]
});

const clear0 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Candidates', position: [420, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear1 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear CV Files', position: [640, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'nKofBkG4S6UPt1xd', cachedResultName: 'Northgate Files' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Outbox', position: [860, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'ygMH59WjeBt0Og19', cachedResultName: 'Northgate Outbox' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear3 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Events', position: [1080, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'v5LAsWSJxw2Uj4Ig', cachedResultName: 'Northgate Events' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear4 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Calendar', position: [1300, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'CF6YJExhwMKsGY9P', cachedResultName: 'Northgate Calendar' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});

const busy = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Busy Times', position: [1520, 300], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUSY_TIMES__
  } },
  output: [{ start: '2026-10-22T09:30:00.000+01:00', end: '2026-10-22T11:00:00.000+01:00', title: 'Team meeting', kind: 'busy', candidate_id: '' }]
});

const addBusy = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Busy Times', position: [1740, 300], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'CF6YJExhwMKsGY9P', cachedResultName: 'Northgate Calendar' }, columns: { mappingMode: 'defineBelow', value: {
__MAP_CALENDAR__
  }, schema: [
__SCHEMA_CALENDAR__
  ] } } },
  output: [{ id: 1 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [1960, 300], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SUMMARY__
  } },
  output: [{ busy_slots_added: 15 }]
});

const note = sticky(
  '## Northgate 8: Reset Demo (manual, destructive)\nEmpties the candidates, CV files, outbox, events and calendar tables, then adds example busy times for the interviewer over the next three weeks. Jobs and settings are kept.',
  [], { position: [160, 80], width: 900, height: 160, color: 3 }
);

export default workflow('northgate-reset-demo', 'Northgate 8: Reset Demo')
  .add(run)
  .to(clear0)
  .to(clear1)
  .to(clear2)
  .to(clear3)
  .to(clear4)
  .to(busy)
  .to(addBusy)
  .to(summary)
  .add(note);
