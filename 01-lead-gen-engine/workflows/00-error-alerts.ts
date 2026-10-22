import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const errorTrigger = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'When a Lead Engine Workflow Fails', position: [240, 300] },
  output: [{
    execution: {
      id: '231',
      url: 'http://localhost:5678/workflow/abc/executions/231',
      mode: 'trigger',
      lastNodeExecuted: 'Scrape Google Maps (Apify)',
      error: { message: 'Request failed with status code 401', stack: '' }
    },
    workflow: { id: 'abc', name: 'Lead Engine 1: Lead Scraper' }
  }]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [460, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'alert-email', name: 'ALERT_EMAIL', value: 'samuelgurru@gmail.com', type: 'string' }
        ]
      }
    }
  },
  output: [{
    ALERT_EMAIL: 'samuelgurru@gmail.com',
    execution: { id: '231', url: 'http://localhost:5678/workflow/abc/executions/231', lastNodeExecuted: 'Scrape Google Maps (Apify)', error: { message: 'Request failed with status code 401' } },
    workflow: { id: 'abc', name: 'Lead Engine 1: Lead Scraper' }
  }]
});

const sendAlert = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Failure Alert',
    position: [680, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $json.ALERT_EMAIL }}'),
      subject: expr('n8n failure: {{ $json.workflow.name }}'),
      emailType: 'text',
      message: expr(
        'A Lead Engine workflow failed.\n\n' +
        'Workflow: {{ $json.workflow.name }}\n' +
        'Failed node: {{ $json.execution.lastNodeExecuted ?? "unknown" }}\n' +
        'Error: {{ $json.execution.error?.message ?? "no message" }}\n' +
        'Time: {{ $now.toFormat("yyyy-MM-dd HH:mm") }}\n\n' +
        'Open the execution: {{ $json.execution.url ?? "n/a" }}\n'
      ),
      options: { appendAttribution: false }
    },
    credentials: { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } }
  },
  output: [{ id: '18f0a', threadId: '18f0a', labelIds: ['SENT'] }]
});

const note = sticky(
  '## Error alerts\n' +
  'Shared error handler for the three Lead Engine workflows. Each one names this workflow in its settings, so any failed production run sends an email with the workflow, the failing node, the error and a link to the execution.\n\n' +
  'Change `ALERT_EMAIL` in **Config** to send alerts somewhere else.',
  [errorTrigger, config, sendAlert],
  { color: 3 }
);

export default workflow('lead-engine-errors', 'Lead Engine 0: Error Alerts')
  .add(errorTrigger)
  .to(config)
  .to(sendAlert)
  .add(note);
