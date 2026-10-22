import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'eLHuDVWvuDw7XkhB', cachedResultName: 'Ironleaf Settings' };
const OUTBOX = { __rl: true, mode: 'id', value: 'jeTJyVYufE4q3cuM', cachedResultName: 'Ironleaf Outbox' };
const GMAIL_CRED = { gmailOAuth2: { id: '7rH5EpTCyRAbJqwK', name: 'Gmail account 2' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'When Called',
    position: [200, 300],
    parameters: { inputSource: 'passthrough' }
  },
  output: [{ to: 'rachel.moss@ironleaf.example', subject: 'Hello', html: '<p>Hi</p>', kind: 'acknowledgement', ref: '2026-10-12' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const route = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Route', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ROUTE__
  } },
  output: [{ to: 'rachel.moss@ironleaf.example', subject: 'Hello', html: '<p>Hi</p>', kind: 'acknowledgement', ref: '2026-10-12', live: false, sender: 'Ironleaf Fitness', reply_to: '', at: '2026-10-21T19:00:00.000+01:00' }]
});

const isLive = ifElse({
  version: 2.2,
  config: {
    name: 'Live Mode?',
    position: [860, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.live }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const gmail = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send with Gmail',
    position: [1100, 200],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'message', operation: 'send',
      sendTo: expr('{{ $json.to }}'), subject: expr('{{ $json.subject }}'), emailType: 'html', message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: expr('{{ $json.sender }}'), replyTo: expr('{{ $json.reply_to }}') }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: 'msg1' }]
});

const outbox = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Write to Outbox', position: [1100, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: OUTBOX, columns: { mappingMode: 'defineBelow', value: {
    to: expr('{{ $json.to }}'), subject: expr('{{ $json.subject }}'), body: expr('{{ $json.html }}'),
    kind: expr("{{ $json.kind }}"), ref: expr('{{ $json.ref }}'), at: expr('{{ $json.at }}')
  }, schema: [
__SCHEMA_OUTBOX__
  ] } } },
  output: [{ id: 1 }]
});

const note = sticky(
  '## Ironleaf 5: Send Email\nEvery email (the Monday report) goes through here. With `mode = live` in **Ironleaf Settings** it sends with Gmail; in test mode it writes to the **Ironleaf Outbox** table instead, so nothing is emailed while testing.',
  [], { position: [160, 40], width: 900, height: 160, color: 7 }
);

export default workflow('ironleaf-send-email', 'Ironleaf 5: Send Email')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(isLive
    .onTrue(gmail)
    .onFalse(outbox))
  .add(note);
