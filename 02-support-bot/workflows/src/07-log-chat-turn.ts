import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called by Chat Agent',
    position: [240, 300],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'session_id', type: 'string' },
          { name: 'user_message', type: 'string' },
          { name: 'bot_reply', type: 'string' },
          { name: 'tools_used', type: 'string' }
        ]
      }
    }
  },
  output: [{ session_id: 'b1f2c3d4', user_message: 'What time do you close on Saturday?', bot_reply: 'We close at 2:00 pm on Saturdays.', tools_used: 'search_shop_info' }]
});

const logTurn = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Append to Conversations',
    position: [480, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: { __rl: true, mode: 'id', value: '1_RHqBp7k3rWBY-4plb2oo2mIryQlHIUuNOZ-YhCpVS8' },
      sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Conversations' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          timestamp: expr("{{ $now.setZone('America/New_York').toISO() }}"),
          session_id: expr('{{ $json.session_id }}'),
          user_message: expr('{{ $json.user_message }}'),
          bot_reply: expr('{{ $json.bot_reply }}'),
          tools_used: expr('{{ $json.tools_used }}')
        },
        schema: [
          { id: 'timestamp', displayName: 'timestamp', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'user_message', displayName: 'user_message', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'bot_reply', displayName: 'bot_reply', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'tools_used', displayName: 'tools_used', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true }
    },
    credentials: { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } }
  },
  output: [{ timestamp: '2026-10-01T10:45:00.000-04:00', session_id: 'b1f2c3d4' }]
});

const note = sticky(
  '## Log Chat Turn (background)\n' +
  'Support Bot 2 calls this without waiting for it, so a slow Google Sheets write never delays the reply the customer sees. Each chat turn becomes one row in the **Conversations** tab, which feeds the weekly report.',
  [whenCalled, logTurn],
  { color: 4 }
);

export default workflow('support-bot-log-chat-turn', 'Support Bot 7: Log Chat Turn')
  .add(whenCalled)
  .to(logTurn)
  .add(note);
