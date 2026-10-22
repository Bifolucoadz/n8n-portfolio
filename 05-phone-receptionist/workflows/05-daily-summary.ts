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
        '// The next day the clinic is open (tomorrow, or Monday after a Friday), for the schedule preview.\n' +
        'const tz = "America/Chicago";\n' +
        'const open = { 1: true, 2: true, 3: true, 4: true, 5: true };\n' +
        'const holidays = ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"];\n' +
        'const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        'let d = DateTime.now().setZone(tz).startOf("day").plus({ days: 1 });\n' +
        'while (!open[d.weekday] || holidays.includes(d.toISODate())) d = d.plus({ days: 1 });\n' +
        'return [{ json: { ...settings, next_day: d.toISODate(), time_min: d.toISO(), time_max: d.endOf("day").toISO() } }];\n'
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
        '// Today\'s calls and messages, plus the next open day\'s appointments, as one Telegram message.\n' +
        'const tz = "America/Chicago";\n' +
        'const w = $("Next Day Window").first().json;\n' +
        'const now = DateTime.now().setZone(tz);\n' +
        'const today = now.toISODate();\n' +
        'const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");\n' +
        'const calls = $("Read Calls").all().map(i => i.json).filter(r => r && String(r.started_at ?? "").startsWith(today));\n' +
        'const messages = $("Read Messages").all().map(i => i.json).filter(r => r && r.at);\n' +
        'const todaysMessages = messages.filter(r => String(r.at).startsWith(today));\n' +
        'const openMessages = messages.filter(r => String(r.status ?? "new").toLowerCase() === "new");\n' +
        'const appts = $("Read Next Day").all().map(i => i.json).filter(e => e && e.id && e.start && e.status !== "cancelled")\n' +
        '  .map(e => ({ start: DateTime.fromISO(e.start.dateTime ?? e.start.date).setZone(tz), title: e.summary ?? "" }))\n' +
        '  .sort((a, b) => a.start - b.start);\n' +
        '\n' +
        'const count = o => calls.filter(c => c.outcome === o).length;\n' +
        'const secs = calls.map(c => Number(c.duration_s)).filter(n => n > 0);\n' +
        'const avg = secs.length ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) : 0;\n' +
        'const cost = calls.map(c => Number(c.cost_usd)).filter(n => n > 0).reduce((a, b) => a + b, 0);\n' +
        'const follow = calls.filter(c => c.follow_up);\n' +
        '\n' +
        'const lines = [\n' +
        '  "🦷 <b>Fernhollow Dental: today on the phone line</b> (" + now.toFormat("ccc LLL d") + ")",\n' +
        '  "",\n' +
        '  "Calls answered: <b>" + calls.length + "</b>" + (secs.length ? " · average " + Math.floor(avg / 60) + "m " + (avg % 60) + "s" : "") + (cost ? " · cost $" + cost.toFixed(2) : ""),\n' +
        '  "Booked: " + count("booked") + " · moved: " + count("rescheduled") + " · cancelled: " + count("cancelled"),\n' +
        '  "Questions answered: " + count("question_answered") + " · emergencies referred: " + count("emergency_referred"),\n' +
        '  "Messages today: " + todaysMessages.length + " · still open: " + openMessages.length,\n' +
        '];\n' +
        'if (follow.length) {\n' +
        '  lines.push("", "<b>Needs a call back</b>");\n' +
        '  for (const c of follow.slice(0, 8)) lines.push("• " + esc(c.caller_name || c.caller) + ": " + esc(c.follow_up));\n' +
        '}\n' +
        'lines.push("", "<b>" + DateTime.fromISO(w.next_day, { zone: tz }).toFormat("cccc LLL d") + "</b>: " + (appts.length ? appts.length + " appointment" + (appts.length > 1 ? "s" : "") : "nothing booked yet"));\n' +
        'for (const a of appts.slice(0, 15)) lines.push("• " + a.start.toFormat("h:mm a") + "  " + esc(a.title));\n' +
        'return [{ json: { chat_id: w.staff_chat_id, text: lines.join("\\n") } }];\n'
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
