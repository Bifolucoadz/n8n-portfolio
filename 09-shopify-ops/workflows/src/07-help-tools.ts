import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'QbQi6BAEGxZmzGyT', cachedResultName: 'Kettle Settings' };
const STORE_WF = { __rl: true, mode: 'id', value: 'ktlStoreApi00001', cachedResultName: 'Kettle 1: Store API' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ktlSendEmail0006', cachedResultName: 'Kettle 6: Send Email' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called',
    position: [200, 400],
    parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [
      { name: 'action', type: 'string' }, { name: 'order_number', type: 'string' }, { name: 'email', type: 'string' }, { name: 'summary', type: 'string' }
    ] } }
  },
  output: [{ action: 'lookup', order_number: '#1838', email: 'marcus.lee@example.com', summary: '' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'stale_tracking_days', value: '4' }]
});

const route = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Lookup Request', position: [640, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ROUTE__
  } },
  output: [{ action: 'find_order', order_number: '#1838', email: 'marcus.lee@example.com', tool: 'lookup' }]
});

const find = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Find Order', position: [860, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ found: true, order: {} }]
});

const isTicket = ifElse({
  version: 2.2,
  config: {
    name: 'Open a Ticket?',
    position: [1080, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('When Called').first().json.action }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'ticket' }], combinator: 'and' } }
  }
});

const status = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Order Status', position: [1300, 520], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__STATUS__
  } },
  output: [{ found: true, order_number: '#1838', status: 'Shipped', late: true }]
});

const ticket = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Ticket', position: [1300, 280], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TICKET__
  } },
  output: [{ to: 'help@kettleandfern.example', subject: 'Ticket KF-ABCDE', html: '<p>Ticket</p>', kind: 'support_ticket', ref: 'KF-ABCDE', answer: { ok: true, ticket_id: 'KF-ABCDE' } }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Email the Team', position: [1520, 280], alwaysOutputData: true, onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const ticketAnswer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Ticket Answer', position: [1740, 280], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// What the agent hears back.\nreturn [{ json: $(\'Ticket\').first().json.answer }];\n' } },
  output: [{ ok: true, ticket_id: 'KF-ABCDE', message: 'Ticket opened.' }]
});

const note = sticky(
  '## Kettle 7: Help Tools\nThe help chat\'s two tools. Both look the order up first through **Kettle 1** (order number and email must both match).\n- **lookup**: a plain-English status worked out in code. "Late" means the delivery estimate has passed or tracking hasn\'t moved for 4 days.\n- **ticket**: emails the team a ticket with the order, tracking and the customer\'s words, and returns the ticket number.',
  [], { position: [160, 80], width: 1100, height: 180, color: 7 }
);

export default workflow('kettle-help-tools', 'Kettle 7: Help Tools')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(find)
  .to(isTicket
    .onTrue(ticket.to(send).to(ticketAnswer))
    .onFalse(status))
  .add(note);
