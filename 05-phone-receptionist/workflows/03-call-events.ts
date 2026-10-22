import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'qh2lP825xnkmt4z2', cachedResultName: 'Receptionist Settings' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };

const event = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Vapi Event',
    position: [200, 300],
    parameters: { httpMethod: 'POST', path: 'fernhollow/events', responseMode: 'onReceived', options: { responseCode: 200 } }
  },
  output: [{ headers: { 'x-fernhollow-key': 'secret' }, body: { message: { type: 'end-of-call-report', endedReason: 'customer-ended-call', cost: 0.12, startedAt: '2026-10-28T15:00:00.000Z', endedAt: '2026-10-28T15:02:10.000Z', call: { id: 'c1', type: 'inboundPhoneCall', customer: { number: '+15125550123' } }, analysis: { summary: 'Jane booked a cleaning.', structuredData: { outcome: 'booked', follow_up_needed: false } }, artifact: { recordingUrl: 'https://example.com/r.mp3' } } } }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'webhook_secret', value: 'secret' }]
});

const buildRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Call Row', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Vapi end-of-call report -> one Calls row (only with the right secret; other events are ignored).\n' +
        'const req = $("Vapi Event").first().json;\n' +
        'const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        'if (!settings.webhook_secret || (req.headers ?? {})["x-fernhollow-key"] !== settings.webhook_secret) return [];\n' +
        'const m = req.body?.message ?? {};\n' +
        'if (m.type !== "end-of-call-report") return [];\n' +
        '\n' +
        'const call = m.call ?? {};\n' +
        'const analysis = m.analysis ?? call.analysis ?? {};\n' +
        'const sd = analysis.structuredData ?? {};\n' +
        'const art = m.artifact ?? call.artifact ?? {};\n' +
        'const tz = "America/Chicago";\n' +
        'const started = DateTime.fromISO(String(m.startedAt ?? call.startedAt ?? ""));\n' +
        'const ended = DateTime.fromISO(String(m.endedAt ?? call.endedAt ?? ""));\n' +
        'const seconds = started.isValid && ended.isValid ? Math.round(ended.diff(started, "seconds").seconds) : "";\n' +
        'const caller = m.customer?.number ?? call.customer?.number ?? (call.type === "webCall" ? "web call" : "");\n' +
        'const followUp = sd.follow_up_needed === true ? (String(sd.follow_up_reason ?? "").trim() || "yes") : "";\n' +
        'const row = {\n' +
        '  call_id: call.id ?? "",\n' +
        '  started_at: (started.isValid ? started : DateTime.now()).setZone(tz).toFormat("yyyy-MM-dd HH:mm"),\n' +
        '  caller,\n' +
        '  caller_name: String(sd.caller_name ?? ""),\n' +
        '  duration_s: String(seconds),\n' +
        '  outcome: String(sd.outcome ?? ""),\n' +
        '  appointment: [sd.appointment_type, sd.appointment_time].filter(Boolean).join(", "),\n' +
        '  confirmation_code: String(sd.confirmation_code ?? ""),\n' +
        '  summary: String(analysis.summary ?? ""),\n' +
        '  follow_up: followUp,\n' +
        '  recording_url: art.recordingUrl ?? art.recording?.mono?.combinedUrl ?? "",\n' +
        '  ended_reason: String(m.endedReason ?? call.endedReason ?? ""),\n' +
        '  cost_usd: typeof m.cost === "number" ? m.cost.toFixed(3) : "",\n' +
        '};\n' +
        'const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");\n' +
        'const alert = followUp\n' +
        '  ? "📞 <b>Call needs follow-up</b>\\n" + esc(row.caller_name || "Unknown caller") + ", " + esc(caller) + "\\n" + esc(followUp) +\n' +
        '    "\\n\\n" + esc(row.summary).slice(0, 700) + (row.recording_url ? \'\\n<a href="\' + esc(row.recording_url) + \'">Recording</a>\' : "")\n' +
        '  : "";\n' +
        'return [{ json: { sheet_id: settings.sheet_id, staff_chat_id: settings.staff_chat_id, row, alert } }];\n'
  } },
  output: [{ sheet_id: '1abc', staff_chat_id: '42', alert: '', row: { call_id: 'c1', started_at: '2026-10-28 10:00', caller: '+15125550123', outcome: 'booked' } }]
});

const appendCall = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Append Call',
    position: [860, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: { __rl: true, mode: 'id', value: expr('{{ $json.sheet_id }}') },
      sheetName: { __rl: true, mode: 'id', value: '1', cachedResultName: 'Calls' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          call_id: expr('{{ $json.row.call_id }}'),
          started_at: expr('{{ $json.row.started_at }}'),
          caller: expr('{{ $json.row.caller }}'),
          caller_name: expr('{{ $json.row.caller_name }}'),
          duration_s: expr('{{ $json.row.duration_s }}'),
          outcome: expr('{{ $json.row.outcome }}'),
          appointment: expr('{{ $json.row.appointment }}'),
          confirmation_code: expr('{{ $json.row.confirmation_code }}'),
          summary: expr('{{ $json.row.summary }}'),
          follow_up: expr('{{ $json.row.follow_up }}'),
          recording_url: expr('{{ $json.row.recording_url }}'),
          ended_reason: expr('{{ $json.row.ended_reason }}'),
          cost_usd: expr('{{ $json.row.cost_usd }}')
        },
        schema: [
          { id: 'call_id', displayName: 'call_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'started_at', displayName: 'started_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'caller', displayName: 'caller', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'caller_name', displayName: 'caller_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'duration_s', displayName: 'duration_s', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'outcome', displayName: 'outcome', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'appointment', displayName: 'appointment', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'confirmation_code', displayName: 'confirmation_code', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'summary', displayName: 'summary', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'follow_up', displayName: 'follow_up', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'recording_url', displayName: 'recording_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'ended_reason', displayName: 'ended_reason', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'cost_usd', displayName: 'cost_usd', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true }
    },
    credentials: SHEETS_CRED
  },
  output: [{ call_id: 'c1' }]
});

const needsFollowUp = ifElse({
  version: 2.2,
  config: {
    name: 'Needs Follow-up?',
    position: [1080, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          { leftValue: expr("{{ $('Build Call Row').first().json.alert }}"), operator: { type: 'string', operation: 'notEmpty', singleValue: true } },
          { leftValue: expr("{{ $('Build Call Row').first().json.staff_chat_id }}"), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }
        ],
        combinator: 'and'
      }
    }
  }
});

const alertStaff = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Alert Staff',
    position: [1300, 240],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Build Call Row').first().json.staff_chat_id }}"),
      text: expr("{{ $('Build Call Row').first().json.alert }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## Receptionist 3: Call Events\n`POST /webhook/fernhollow/events`, the assistant\'s server URL (only `end-of-call-report` is subscribed). Answers 200 at once, then, if the secret header matches:\n- one row in the **Calls** tab: caller, duration, outcome, appointment and code, Vapi\'s summary, recording link, cost\n- a Telegram alert to staff when the call analysis says someone needs to call back.',
  [], { position: [160, 40], width: 900, height: 200, color: 4 }
);

export default workflow('receptionist-call-events', 'Receptionist 3: Call Events')
  .add(event)
  .to(readSettings)
  .to(buildRow)
  .to(appendCall)
  .to(needsFollowUp.onTrue(alertStaff))
  .add(note);
