import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } };

const called = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called',
    position: [200, 300],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'payload', type: 'string' },
          { name: 'safety_chat_id', type: 'string' }
        ]
      }
    }
  },
  output: [{ payload: '{"turn":{"id":"t-1"},"cases":[],"mi_refs":[]}', safety_chat_id: '' }]
});

const record = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save Turn and Cases',
    position: [440, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    parameters: {
      operation: 'executeQuery',
      query: 'select kb_record_turn($1::jsonb) as result;',
      options: { queryReplacement: expr('{{ $json.payload }}') }
    },
    credentials: PG_CRED
  },
  output: [{ result: { turn_id: 't-1', cases: [{ ref: 'AE-261007-AB12', case_type: 'adverse_event', new: true }] } }]
});

const alerts = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Alerts to Send',
    position: [680, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__ALERTS__
    }
  },
  output: [{ chat_id: '123', text: '<b>New: Adverse event AE-261007-AB12</b>' }]
});

const telegram = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Alert Safety Team',
    position: [920, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.chat_id }}'),
      text: expr('{{ $json.text }}'),
      additionalFields: { parse_mode: 'HTML', appendAttribution: false }
    },
    credentials: { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } }
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## MedInfo 7: Record Turn\n' +
  'Called by **MedInfo 5** without waiting, so logging never slows a reply.\n\n' +
  '- `kb_record_turn` writes the audit row (question, answer, role, route, cited document versions, latency) and creates or updates the adverse event and product complaint cases detected this turn, in one transaction.\n' +
  '- New cases, follow-ups and Medical Information requests are alerted on Telegram when `SAFETY_CHAT_ID` is set in MedInfo 5. The case is recorded either way.',
  [called, record, alerts, telegram],
  { color: 4 }
);

export default workflow('medinfo-record-turn', 'MedInfo 7: Record Turn')
  .add(called)
  .to(record)
  .to(alerts)
  .to(telegram)
  .add(note);
