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
        '// Which calendar to use: Google Calendar in live mode, the Northgate Calendar table in test mode.\n' +
        '// ---- lib-ngt.js (included by build.py): shared helpers for the Northgate workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const pounds = n => \'£\' + Math.round(Number(n) || 0).toLocaleString(\'en-GB\');\n' +
        'const whenText = iso => DateTime.fromISO(String(iso), { zone: TZ }).toFormat("cccc d LLLL \'at\' h:mm a").replace(\':00 \', \' \');\n' +
        'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
        '\n' +
        '// OpenAI node (Responses API) output: the JSON object from the first output_text part, or null.\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        '\n' +
        '// Plain, left-aligned email body with the agency\'s name at the top.\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#0b6e4f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '\n' +
        'const BAND_LABEL = { shortlist: \'Shortlist\', review: \'Worth a look\', unlikely: \'Unlikely fit\', knockout: \'Knockout\' };\n' +
        '// ---- end lib-ngt.js ----\n' +
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'const i = $(\'When Called\').first().json;\n' +
        'return [{ json: { ...i, route: (s.mode === \'live\' ? \'live_\' : \'test_\') + (i.action === \'book\' ? \'book\' : \'busy\'), calendar_id: s.calendar_id || \'primary\' } }];\n'
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
        '// Busy periods from the test calendar table that overlap the window asked for.\n' +
        'const r = $(\'Route\').first().json;\n' +
        'const from = Date.parse(r.from), to = Date.parse(r.to);\n' +
        'const busy = $input.all().map(i => i.json).filter(e => e.start && e.end && Date.parse(e.end) > from && Date.parse(e.start) < to)\n' +
        '  .map(e => ({ start: e.start, end: e.end, title: e.title }));\n' +
        'return [{ json: { busy } }];\n'
  } },
  output: [{ busy: [] }]
});

const testBook = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Book in Test Calendar', position: [1100, 340], parameters: { resource: 'row', operation: 'insert', dataTableId: CALENDAR, columns: { mappingMode: 'defineBelow', value: {
    start: expr('{{ $json.start }}'), end: expr('{{ $json.end }}'), title: expr('{{ $json.title }}'), kind: 'interview', candidate_id: expr('{{ $json.candidate_id }}')
  }, schema: [
          { id: 'start', displayName: 'start', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'end', displayName: 'end', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'candidate_id', displayName: 'candidate_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
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
        '// Busy periods from Google Calendar (all-day events block the whole day; "free" events are ignored).\n' +
        'const busy = $input.all().map(i => i.json).filter(e => e && e.start && e.transparency !== \'transparent\' && e.status !== \'cancelled\').map(e => ({\n' +
        '  start: e.start.dateTime || (e.start.date + \'T00:00:00\'),\n' +
        '  end: e.end.dateTime || (e.end.date + \'T00:00:00\'),\n' +
        '  title: e.summary || \'Busy\'\n' +
        '}));\n' +
        'return [{ json: { busy } }];\n'
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
        '// The booked event, the same shape in both modes.\n' +
        'const r = $(\'Route\').first().json;\n' +
        'const e = $input.first().json || {};\n' +
        'return [{ json: { booked: true, event_id: String(e.id || \'\'), link: e.htmlLink || \'\', start: r.start, end: r.end } }];\n'
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
