import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const JOBS = { __rl: true, mode: 'id', value: 'qycslNJXs6wOwRxE', cachedResultName: 'Northgate Jobs' };
const CANDIDATES = { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' };
const EVENTS = { __rl: true, mode: 'id', value: 'v5LAsWSJxw2Uj4Ig', cachedResultName: 'Northgate Events' };
const CAL_WF = { __rl: true, mode: 'id', value: 'ngtCalendar00009', cachedResultName: 'Northgate 9: Calendar' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ngtSendEmail0003', cachedResultName: 'Northgate 3: Send Email' };
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };

const link = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Booking Link', position: [200, 400], parameters: { httpMethod: 'GET', path: 'northgate/book', responseMode: 'responseNode', options: { ignoreBots: true } } },
  output: [{ query: { c: 'C1021-ABCD', t: 'token', s: '0' } }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const readCandidate = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read Candidate',
    position: [640, 400],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true, filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr("{{ $('Booking Link').first().json.query.c || 'none' }}") }] } }
  },
  output: [{ candidate_id: 'C1021-ABCD', status: 'invited', token: 'token', slots_json: '[]' }]
});

const readJobs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Jobs', position: [860, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: JOBS, returnAll: true } },
  output: [{ job_id: 'NG-101', title: 'Customer Success Manager' }]
});

const check = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Link', position: [1080, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECK_LINK__
  } },
  output: [{ route: 'ok', action: 'busy', from: '2026-10-23T10:00:00.000+01:00', to: '2026-10-23T10:45:00.000+01:00' }]
});

const linkOk = ifElse({
  version: 2.2,
  config: {
    name: 'Link OK?',
    position: [1300, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'ok' }], combinator: 'and' } }
  }
});

const busyNow = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Busy at That Time?', position: [1540, 300], parameters: { source: 'database', workflowId: CAL_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const stillFree = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Still Free', position: [1760, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__STILL_FREE__
  } },
  output: [{ free: true, action: 'book', start: '2026-10-23T10:00:00.000+01:00', end: '2026-10-23T10:45:00.000+01:00' }]
});

const isFree = ifElse({
  version: 2.2,
  config: {
    name: 'Free?',
    position: [1980, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.free }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const book = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Book Interview', position: [2200, 200], parameters: { source: 'database', workflowId: CAL_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const booked = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Booked', position: [2420, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BOOKED__
  } },
  output: [{ candidate_id: 'C1021-ABCD', status: 'interview_booked', interview_at: '2026-10-23T10:00:00.000+01:00', page: '<html></html>' }]
});

const update = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Candidate',
    position: [2640, 200],
    parameters: {
      resource: 'row', operation: 'update', dataTableId: CANDIDATES,
      filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr('{{ $json.candidate_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: {
__MAP_STATUS__
      }, schema: [
__SCHEMA_STATUS__
      ] }
    }
  },
  output: [{ id: 3 }]
});

const logEvent = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Log Event', position: [2860, 200], executeOnce: true, parameters: { resource: 'row', operation: 'insert', dataTableId: EVENTS, columns: { mappingMode: 'defineBelow', value: {
    candidate_id: expr("{{ $('Booked').first().json.candidate_id }}"),
    event: expr("{{ $('Booked').first().json.event }}"),
    detail: expr("{{ $('Booked').first().json.detail }}"),
    actor: expr("{{ $('Booked').first().json.actor }}"),
    at: expr("{{ $('Booked').first().json.at }}")
  }, schema: [
__SCHEMA_EVENTS__
  ] } } },
  output: [{ id: 9 }]
});

const emails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Emails', position: [3080, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__EMAILS__
  } },
  output: [{ to: 'amara.okafor@example.com', subject: 'Confirmed', html: '<p>Hi</p>', kind: 'interview_confirmed', candidate_id: 'C1021-ABCD' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Emails', position: [3300, 200], alwaysOutputData: true, onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const confirmation = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Confirmation Page', position: [3520, 200], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CONFIRMATION__
  } },
  output: [{ code: 200, html: '<html></html>' }]
});

const takenPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Taken Page', position: [2200, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TAKEN_PAGE__
  } },
  output: [{ code: 409, html: '<html></html>' }]
});

const messagePage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Message Page', position: [1540, 600], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__MESSAGE_PAGE__
  } },
  output: [{ code: 404, html: '<html></html>' }]
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [3740, 400], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

const note = sticky(
  '## Northgate 6: Book Interview\nThe candidate clicks a time in their invitation (`/webhook/northgate/book?c=…&t=…&s=…`).\n1. **Check Link**: the private token must match, the candidate must still be invited, and the time must be one of those offered and at least 2 hours away.\n2. The time is checked against the calendar again right now (**Northgate 9**), so two candidates can\'t get the same slot.\n3. The interview is booked with both people as guests, the candidate is marked **interview booked**, both get an email and the candidate sees a confirmation page. If the time has gone, they see the other times.',
  [], { position: [160, -20], width: 1400, height: 240, color: 5 }
);

export default workflow('northgate-book-interview', 'Northgate 6: Book Interview')
  .add(link)
  .to(readSettings)
  .to(readCandidate)
  .to(readJobs)
  .to(check)
  .to(linkOk
    .onTrue(busyNow.to(stillFree).to(isFree
      .onTrue(book.to(booked).to(update).to(logEvent).to(emails).to(send).to(confirmation).to(respond))
      .onFalse(takenPage.to(respond))))
    .onFalse(messagePage.to(respond)))
  .add(note);
