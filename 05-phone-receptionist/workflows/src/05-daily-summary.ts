import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'qh2lP825xnkmt4z2', cachedResultName: 'Receptionist Settings' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const CAL_CRED = { googleCalendarOAuth2Api: { id: '5G8pvfh0Kjd75Asw', name: 'Google Calendar account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };

const weekdays = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Weekdays 5:30 pm', position: [200, 300], parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 30 17 * * 1-5' }] } } },
  output: [{}]
});

const sendNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'sheet_id', value: '1abc' }]
});

const nextDay = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Next Day Window', position: [640, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__NEXT_DAY_WINDOW__
  } },
  output: [{ sheet_id: '1abc', calendar_id: 'cal', staff_chat_id: '42', next_day: '2026-10-29', time_min: '2026-10-29T00:00:00.000-05:00', time_max: '2026-10-29T23:59:59.999-05:00' }]
});

const readCalls = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Calls',
    position: [860, 400],
    executeOnce: true, alwaysOutputData: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: { __rl: true, mode: 'id', value: expr('{{ $json.sheet_id }}') }, sheetName: { __rl: true, mode: 'id', value: '1', cachedResultName: 'Calls' } },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, started_at: '2026-10-28 10:00', outcome: 'booked', duration_s: '130' }]
});

const readMessages = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Messages',
    position: [1080, 400],
    executeOnce: true, alwaysOutputData: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: { __rl: true, mode: 'id', value: expr("{{ $('Next Day Window').first().json.sheet_id }}") }, sheetName: { __rl: true, mode: 'id', value: '2', cachedResultName: 'Messages' } },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, at: '2026-10-28 11:00', status: 'new' }]
});

const readNextDay = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Read Next Day',
    position: [1300, 400],
    executeOnce: true, alwaysOutputData: true,
    retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
    parameters: {
      resource: 'event', operation: 'getAll',
      calendar: { __rl: true, mode: 'id', value: expr("{{ $('Next Day Window').first().json.calendar_id }}") },
      returnAll: true,
      timeMin: expr("{{ $('Next Day Window').first().json.time_min }}"),
      timeMax: expr("{{ $('Next Day Window').first().json.time_max }}"),
      options: { singleEvents: true, orderBy: 'startTime' }
    },
    credentials: CAL_CRED
  },
  output: [{ id: 'evt1', summary: 'Cleaning and check-up: Jane Doe', start: { dateTime: '2026-10-29T09:00:00-05:00' } }]
});

const buildSummary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Summary', position: [1520, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_SUMMARY__
  } },
  output: [{ chat_id: '42', text: 'Fernhollow Dental: today on the phone line' }]
});

const hasChat = ifElse({
  version: 2.2,
  config: {
    name: 'Chat Set?',
    position: [1740, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.chat_id }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const send = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Summary',
    position: [1960, 340],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    parameters: {
      resource: 'message', operation: 'sendMessage',
      chatId: expr('{{ $json.chat_id }}'),
      text: expr('{{ $json.text }}'),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## Receptionist 5: Daily Summary\nWeekdays at 5:30 pm Austin time (or **Send Now**): calls answered, bookings, moves and cancellations, emergencies referred, messages and who still needs a call back, plus the next open day\'s appointments. Sent to the staff Telegram chat.',
  [], { position: [160, 120], width: 900, height: 160, color: 4 }
);

export default workflow('receptionist-daily-summary', 'Receptionist 5: Daily Summary')
  .add(weekdays)
  .to(readSettings)
  .to(nextDay)
  .to(readCalls)
  .to(readMessages)
  .to(readNextDay)
  .to(buildSummary)
  .to(hasChat.onTrue(send))
  .add(sendNow)
  .to(readSettings)
  .add(note);
