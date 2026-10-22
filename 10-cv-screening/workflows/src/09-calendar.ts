import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const CALENDAR = { __rl: true, mode: 'id', value: 'CF6YJExhwMKsGY9P', cachedResultName: 'Northgate Calendar' };
const GCAL_CRED = { googleCalendarOAuth2Api: { id: '5G8pvfh0Kjd75Asw', name: 'Google Calendar account' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'When Called',
    position: [200, 400],
    parameters: { inputSource: 'passthrough' }
  },
  output: [{ action: 'busy', from: '2026-10-22T00:00:00.000+01:00', to: '2026-11-05T00:00:00.000+00:00' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const route = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Route', position: [640, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ROUTE__
  } },
  output: [{ action: 'busy', route: 'test_busy', calendar_id: 'primary' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Which Calendar?',
    position: [860, 400],
    parameters: {
      rules: { values: [
        { outputKey: 'test busy', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'test_busy' }], combinator: 'and' } },
        { outputKey: 'test book', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'test_book' }], combinator: 'and' } },
        { outputKey: 'live busy', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'live_busy' }], combinator: 'and' } },
        { outputKey: 'live book', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'live_book' }], combinator: 'and' } }
      ] }
    }
  }
});

const testBusyRead = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Test Calendar', position: [1100, 160], alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CALENDAR, returnAll: true } },
  output: [{ start: '2026-10-22T09:30:00.000+01:00', end: '2026-10-22T11:00:00.000+01:00', title: 'Team meeting' }]
});

const testBusy = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Busy (Test)', position: [1320, 160], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUSY_TEST__
  } },
  output: [{ busy: [] }]
});

const testBook = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Book in Test Calendar', position: [1100, 340], parameters: { resource: 'row', operation: 'insert', dataTableId: CALENDAR, columns: { mappingMode: 'defineBelow', value: {
    start: expr('{{ $json.start }}'), end: expr('{{ $json.end }}'), title: expr('{{ $json.title }}'), kind: 'interview', candidate_id: expr('{{ $json.candidate_id }}')
  }, schema: [
__SCHEMA_CALENDAR__
  ] } } },
  output: [{ id: 7 }]
});

const liveBusyRead = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Google Calendar Events',
    position: [1100, 520],
    alwaysOutputData: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: { resource: 'event', operation: 'getAll', calendar: { __rl: true, mode: 'id', value: expr('{{ $json.calendar_id }}') }, returnAll: true, timeMin: expr('{{ $json.from }}'), timeMax: expr('{{ $json.to }}'), options: { singleEvents: true } },
    credentials: GCAL_CRED
  },
  output: [{ id: 'evt1', summary: 'Team meeting', start: { dateTime: '2026-10-22T09:30:00+01:00' }, end: { dateTime: '2026-10-22T11:00:00+01:00' } }]
});

const liveBusy = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Busy (Live)', position: [1320, 520], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUSY_LIVE__
  } },
  output: [{ busy: [] }]
});

const liveBook = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Create Google Event',
    position: [1100, 700],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: {
      resource: 'event', operation: 'create',
      calendar: { __rl: true, mode: 'id', value: expr('{{ $json.calendar_id }}') },
      start: expr('{{ $json.start }}'), end: expr('{{ $json.end }}'),
      additionalFields: { summary: expr('{{ $json.title }}'), description: expr('{{ $json.description }}'), attendees: [expr('{{ $json.attendees }}')], sendUpdates: 'all' }
    },
    credentials: GCAL_CRED
  },
  output: [{ id: 'evt9', htmlLink: 'https://calendar.google.com/event?eid=1' }]
});

const booked = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Booked', position: [1540, 520], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BOOKED__
  } },
  output: [{ booked: true, event_id: 'evt9', link: '' }]
});

const note = sticky(
  '## Northgate 9: Calendar\nOne place for calendar work, so the invite and booking workflows don\'t care which calendar is behind it.\n- **busy**: busy periods between `from` and `to`.\n- **book**: creates the interview with the candidate and interviewer as guests.\nLive mode uses the recruiter\'s Google Calendar; test mode uses the **Northgate Calendar** table.',
  [], { position: [160, -80], width: 1100, height: 200, color: 7 }
);

export default workflow('northgate-calendar', 'Northgate 9: Calendar')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(which
    .onCase(0, testBusyRead.to(testBusy))
    .onCase(1, testBook.to(booked))
    .onCase(2, liveBusyRead.to(liveBusy))
    .onCase(3, liveBook.to(booked)))
  .add(note);
