import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const CAL_CRED = { googleCalendarOAuth2Api: { id: '5G8pvfh0Kjd75Asw', name: 'Google Calendar account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const CALENDAR = { __rl: true, mode: 'id', value: expr("{{ $('Config').first().json.calendar_id }}") };
const LOG_ROW_WF = { __rl: true, mode: 'id', value: 'pL4bVosX1Dga62wJ', cachedResultName: 'Receptionist 4: Log Row' };
const LOCATION = 'Fernhollow Dental, 4180 Oakridge Parkway, Suite 200, Austin, TX 78745';

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [240, 700], parameters: { inputSource: 'passthrough' } },
  output: [{ tool_call_id: 'call_1', name: 'check_availability', args: { appointment_type: 'cleaning', date_from: '2026-10-28' }, caller_number: '+15125550123', call_id: 'c1', calendar_id: 'cal@group.calendar.google.com', sheet_id: '1abc', staff_chat_id: '123' }]
});

const config = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Config',
    position: [460, 700],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Normalise the tool call coming from Receptionist 1 (one call per execution).\n' +
        'const c = $input.first().json;\n' +
        'let args = c.args ?? {};\n' +
        'if (typeof args === "string") { try { args = JSON.parse(args); } catch (e) { args = {}; } }\n' +
        'return [{ json: { ...c, args, name: String(c.name ?? "").trim() } }];\n'
    }
  },
  output: [{ tool_call_id: 'call_1', name: 'check_availability', args: { appointment_type: 'cleaning', date_from: '2026-10-28' }, caller_number: '+15125550123', call_id: 'c1', calendar_id: 'cal@group.calendar.google.com', sheet_id: '1abc', staff_chat_id: '123' }]
});

const whichTool = switchCase({
  version: 3.2,
  config: {
    name: 'Which Tool?',
    position: [680, 700],
    parameters: {
      rules: {
        values: [
          { outputKey: 'availability', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.name }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'check_availability' }], combinator: 'and' } },
          { outputKey: 'book', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.name }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'book_appointment' }], combinator: 'and' } },
          { outputKey: 'manage', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.name }}'), operator: { type: 'string', operation: 'regex' }, rightValue: '^(find|cancel|reschedule)_appointment$' }], combinator: 'and' } },
          { outputKey: 'message', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.name }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'take_message' }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'other' }
    }
  }
});

// ---- check_availability ----
const workOutWindow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Work Out Window',
    position: [920, 200],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// ---- lib-slots.js (included by build.py): clinic hours, appointment types and slot rules ----\n' +
        'const SLOT = {\n' +
        '  TZ: "America/Chicago",\n' +
        '  TYPES: {\n' +
        '    new_patient: { label: "New patient exam and X-rays", minutes: 60, notice: 120 },\n' +
        '    cleaning: { label: "Cleaning and check-up", minutes: 60, notice: 120 },\n' +
        '    emergency: { label: "Emergency exam", minutes: 30, notice: 60 },\n' +
        '    consultation: { label: "Cosmetic or Invisalign consultation", minutes: 30, notice: 120 },\n' +
        '  },\n' +
        '  // Luxon weekday (1 = Monday) -> open spans. Lunch 12-1 Mon-Thu, Friday until 2 pm.\n' +
        '  HOURS: {\n' +
        '    1: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    2: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    3: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    4: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    5: [["08:00", "14:00"]],\n' +
        '  },\n' +
        '  HOLIDAYS: ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"],\n' +
        '  DAYS_AHEAD: 30,\n' +
        '  STEP: 30,\n' +
        '};\n' +
        '\n' +
        '// The model usually sends the key, but accept everyday words too.\n' +
        'function typeKey(raw) {\n' +
        '  const s = String(raw ?? "").toLowerCase();\n' +
        '  if (SLOT.TYPES[s]) return s;\n' +
        '  if (/emergenc|pain|ache|broken|knock|chip|swell|lost (a )?(filling|crown)/.test(s)) return "emergency";\n' +
        '  if (/new/.test(s)) return "new_patient";\n' +
        '  if (/clean|check|hygien|exam/.test(s)) return "cleaning";\n' +
        '  if (/cosmetic|whiten|invisalign|consult|align|veneer/.test(s)) return "consultation";\n' +
        '  return null;\n' +
        '}\n' +
        '\n' +
        '// Calendar events -> busy intervals in clinic time. All-day events close the whole day.\n' +
        'function busyFrom(events, excludeId) {\n' +
        '  return events\n' +
        '    .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent" && e.id !== excludeId)\n' +
        '    .map(e => e.start.date\n' +
        '      ? { start: DateTime.fromISO(e.start.date, { zone: SLOT.TZ }), end: DateTime.fromISO(e.end.date, { zone: SLOT.TZ }) }\n' +
        '      : { start: DateTime.fromISO(e.start.dateTime).setZone(SLOT.TZ), end: DateTime.fromISO(e.end.dateTime).setZone(SLOT.TZ) });\n' +
        '}\n' +
        '\n' +
        'function isOpen(day) {\n' +
        '  return Boolean(SLOT.HOURS[day.weekday]) && !SLOT.HOLIDAYS.includes(day.toISODate());\n' +
        '}\n' +
        '\n' +
        '// Every start time on `day` that fits inside opening hours, respects the notice period and\n' +
        '// doesn\'t overlap a busy interval. One appointment at a time (single demo calendar).\n' +
        'function freeStarts(day, type, busy, now) {\n' +
        '  const t = SLOT.TYPES[type];\n' +
        '  if (!t || !isOpen(day)) return [];\n' +
        '  const earliest = now.plus({ minutes: t.notice });\n' +
        '  const out = [];\n' +
        '  for (const [a, b] of SLOT.HOURS[day.weekday]) {\n' +
        '    const [ah, am] = a.split(":").map(Number);\n' +
        '    const [bh, bm] = b.split(":").map(Number);\n' +
        '    const open = day.set({ hour: ah, minute: am, second: 0, millisecond: 0 });\n' +
        '    const close = day.set({ hour: bh, minute: bm, second: 0, millisecond: 0 });\n' +
        '    for (let s = open; s.plus({ minutes: t.minutes }) <= close; s = s.plus({ minutes: SLOT.STEP })) {\n' +
        '      if (s < earliest) continue;\n' +
        '      const e = s.plus({ minutes: t.minutes });\n' +
        '      if (busy.some(x => x.start < e && x.end > s)) continue;\n' +
        '      out.push(s);\n' +
        '    }\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        '\n' +
        '// Speech-friendly labels: "Tuesday, October 28 at 9 AM" / "at 2:30 PM".\n' +
        'const sayDay = d => (typeof d === "string" ? DateTime.fromISO(d, { zone: SLOT.TZ }) : d).toFormat("cccc, LLLL d");\n' +
        'const say = d => sayDay(d) + " at " + d.toFormat(d.minute ? "h:mm a" : "h a");\n' +
        'const startValue = d => d.toISO({ suppressMilliseconds: true });\n' +
        'const spell = code => code.split("").map(ch => (ch === "-" ? "dash" : ch)).join(" ");\n' +
        'const digits10 = s => String(s ?? "").replace(/\\D/g, "").slice(-10);\n' +
        '\n' +
        '// Appointment events written by book_appointment carry these description lines.\n' +
        'function parseAppointment(e) {\n' +
        '  const d = String(e.description ?? "");\n' +
        '  const line = k => ((new RegExp("^" + k + ":\\\\s*(.*)$", "m")).exec(d) || [])[1] || "";\n' +
        '  const startIso = e.start?.dateTime ?? e.start?.date;\n' +
        '  return {\n' +
        '    id: e.id,\n' +
        '    code: line("Confirmation").trim().toUpperCase(),\n' +
        '    name: line("Patient").trim(),\n' +
        '    phone: digits10(line("Phone")),\n' +
        '    type: line("Type key").trim(),\n' +
        '    type_label: line("Type").trim() || String(e.summary ?? "").split(":")[0],\n' +
        '    start: startIso ? DateTime.fromISO(startIso).setZone(SLOT.TZ) : null,\n' +
        '    description: d,\n' +
        '  };\n' +
        '}\n' +
        '// ---- end lib-slots.js ----\n' +
        '// Turn the model\'s dates into a search window. Searches one more week past it so that\n' +
        '// "nothing free on Tuesday" can come back with the nearest alternatives in the same turn.\n' +
        'const c = $("Config").first().json;\n' +
        'const a = c.args ?? {};\n' +
        'const now = DateTime.now().setZone(SLOT.TZ);\n' +
        'const today = now.startOf("day");\n' +
        'const last = today.plus({ days: SLOT.DAYS_AHEAD });\n' +
        'const parseDay = s => {\n' +
        '  const d = DateTime.fromISO(String(s ?? "").slice(0, 10), { zone: SLOT.TZ });\n' +
        '  return d.isValid ? d.startOf("day") : null;\n' +
        '};\n' +
        'let from = parseDay(a.date_from) ?? today;\n' +
        'if (from < today) from = today;\n' +
        'let to = parseDay(a.date_to) ?? from;\n' +
        'if (to < from) to = from;\n' +
        'if (to > from.plus({ days: 13 })) to = from.plus({ days: 13 });\n' +
        'const outOfRange = from > last;\n' +
        'if (outOfRange) { from = last; to = last; }\n' +
        'if (to > last) to = last;\n' +
        'const searchEnd = DateTime.min(to.plus({ days: 7 }), last);\n' +
        'const tod = String(a.time_of_day ?? "").toLowerCase();\n' +
        'return [{\n' +
        '  json: {\n' +
        '    tool_call_id: c.tool_call_id,\n' +
        '    type: typeKey(a.appointment_type),\n' +
        '    from: from.toISODate(),\n' +
        '    to: to.toISODate(),\n' +
        '    search_end: searchEnd.toISODate(),\n' +
        '    time_of_day: ["morning", "afternoon"].includes(tod) ? tod : "any",\n' +
        '    out_of_range: outOfRange,\n' +
        '    last_day: last.toISODate(),\n' +
        '    time_min: from.toISO(),\n' +
        '    time_max: searchEnd.endOf("day").toISO(),\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ tool_call_id: 'call_1', type: 'cleaning', from: '2026-10-28', to: '2026-10-28', search_end: '2026-11-04', time_of_day: 'any', out_of_range: false, last_day: '2026-11-20', time_min: '2026-10-28T00:00:00.000-05:00', time_max: '2026-11-04T23:59:59.999-06:00' }]
});

const readCalendar = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Read Calendar',
    position: [1140, 200],
    alwaysOutputData: true,
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
    parameters: {
      resource: 'event', operation: 'getAll', calendar: CALENDAR, returnAll: true,
      timeMin: expr('{{ $json.time_min }}'), timeMax: expr('{{ $json.time_max }}'),
      options: { singleEvents: true, orderBy: 'startTime' }
    },
    credentials: CAL_CRED
  },
  output: [{ id: 'evt1', summary: 'Cleaning and check-up: Jane Doe', status: 'confirmed', start: { dateTime: '2026-10-28T09:00:00-05:00' }, end: { dateTime: '2026-10-28T10:00:00-05:00' } }]
});

const findFreeSlots = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Find Free Slots',
    position: [1360, 200],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// ---- lib-slots.js (included by build.py): clinic hours, appointment types and slot rules ----\n' +
        'const SLOT = {\n' +
        '  TZ: "America/Chicago",\n' +
        '  TYPES: {\n' +
        '    new_patient: { label: "New patient exam and X-rays", minutes: 60, notice: 120 },\n' +
        '    cleaning: { label: "Cleaning and check-up", minutes: 60, notice: 120 },\n' +
        '    emergency: { label: "Emergency exam", minutes: 30, notice: 60 },\n' +
        '    consultation: { label: "Cosmetic or Invisalign consultation", minutes: 30, notice: 120 },\n' +
        '  },\n' +
        '  // Luxon weekday (1 = Monday) -> open spans. Lunch 12-1 Mon-Thu, Friday until 2 pm.\n' +
        '  HOURS: {\n' +
        '    1: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    2: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    3: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    4: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    5: [["08:00", "14:00"]],\n' +
        '  },\n' +
        '  HOLIDAYS: ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"],\n' +
        '  DAYS_AHEAD: 30,\n' +
        '  STEP: 30,\n' +
        '};\n' +
        '\n' +
        '// The model usually sends the key, but accept everyday words too.\n' +
        'function typeKey(raw) {\n' +
        '  const s = String(raw ?? "").toLowerCase();\n' +
        '  if (SLOT.TYPES[s]) return s;\n' +
        '  if (/emergenc|pain|ache|broken|knock|chip|swell|lost (a )?(filling|crown)/.test(s)) return "emergency";\n' +
        '  if (/new/.test(s)) return "new_patient";\n' +
        '  if (/clean|check|hygien|exam/.test(s)) return "cleaning";\n' +
        '  if (/cosmetic|whiten|invisalign|consult|align|veneer/.test(s)) return "consultation";\n' +
        '  return null;\n' +
        '}\n' +
        '\n' +
        '// Calendar events -> busy intervals in clinic time. All-day events close the whole day.\n' +
        'function busyFrom(events, excludeId) {\n' +
        '  return events\n' +
        '    .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent" && e.id !== excludeId)\n' +
        '    .map(e => e.start.date\n' +
        '      ? { start: DateTime.fromISO(e.start.date, { zone: SLOT.TZ }), end: DateTime.fromISO(e.end.date, { zone: SLOT.TZ }) }\n' +
        '      : { start: DateTime.fromISO(e.start.dateTime).setZone(SLOT.TZ), end: DateTime.fromISO(e.end.dateTime).setZone(SLOT.TZ) });\n' +
        '}\n' +
        '\n' +
        'function isOpen(day) {\n' +
        '  return Boolean(SLOT.HOURS[day.weekday]) && !SLOT.HOLIDAYS.includes(day.toISODate());\n' +
        '}\n' +
        '\n' +
        '// Every start time on `day` that fits inside opening hours, respects the notice period and\n' +
        '// doesn\'t overlap a busy interval. One appointment at a time (single demo calendar).\n' +
        'function freeStarts(day, type, busy, now) {\n' +
        '  const t = SLOT.TYPES[type];\n' +
        '  if (!t || !isOpen(day)) return [];\n' +
        '  const earliest = now.plus({ minutes: t.notice });\n' +
        '  const out = [];\n' +
        '  for (const [a, b] of SLOT.HOURS[day.weekday]) {\n' +
        '    const [ah, am] = a.split(":").map(Number);\n' +
        '    const [bh, bm] = b.split(":").map(Number);\n' +
        '    const open = day.set({ hour: ah, minute: am, second: 0, millisecond: 0 });\n' +
        '    const close = day.set({ hour: bh, minute: bm, second: 0, millisecond: 0 });\n' +
        '    for (let s = open; s.plus({ minutes: t.minutes }) <= close; s = s.plus({ minutes: SLOT.STEP })) {\n' +
        '      if (s < earliest) continue;\n' +
        '      const e = s.plus({ minutes: t.minutes });\n' +
        '      if (busy.some(x => x.start < e && x.end > s)) continue;\n' +
        '      out.push(s);\n' +
        '    }\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        '\n' +
        '// Speech-friendly labels: "Tuesday, October 28 at 9 AM" / "at 2:30 PM".\n' +
        'const sayDay = d => (typeof d === "string" ? DateTime.fromISO(d, { zone: SLOT.TZ }) : d).toFormat("cccc, LLLL d");\n' +
        'const say = d => sayDay(d) + " at " + d.toFormat(d.minute ? "h:mm a" : "h a");\n' +
        'const startValue = d => d.toISO({ suppressMilliseconds: true });\n' +
        'const spell = code => code.split("").map(ch => (ch === "-" ? "dash" : ch)).join(" ");\n' +
        'const digits10 = s => String(s ?? "").replace(/\\D/g, "").slice(-10);\n' +
        '\n' +
        '// Appointment events written by book_appointment carry these description lines.\n' +
        'function parseAppointment(e) {\n' +
        '  const d = String(e.description ?? "");\n' +
        '  const line = k => ((new RegExp("^" + k + ":\\\\s*(.*)$", "m")).exec(d) || [])[1] || "";\n' +
        '  const startIso = e.start?.dateTime ?? e.start?.date;\n' +
        '  return {\n' +
        '    id: e.id,\n' +
        '    code: line("Confirmation").trim().toUpperCase(),\n' +
        '    name: line("Patient").trim(),\n' +
        '    phone: digits10(line("Phone")),\n' +
        '    type: line("Type key").trim(),\n' +
        '    type_label: line("Type").trim() || String(e.summary ?? "").split(":")[0],\n' +
        '    start: startIso ? DateTime.fromISO(startIso).setZone(SLOT.TZ) : null,\n' +
        '    description: d,\n' +
        '  };\n' +
        '}\n' +
        '// ---- end lib-slots.js ----\n' +
        '// Free start times in the requested window, spread across the day(s); if none, the nearest ones\n' +
        '// in the following week. The result is one line the voice model can turn into speech.\n' +
        'const w = $("Work Out Window").first().json;\n' +
        'const reply = result => [{ json: { tool_call_id: w.tool_call_id, result } }];\n' +
        'if (!w.type) return reply("Unknown appointment type. Ask whether it\'s a new patient exam, a cleaning and check-up, an emergency visit, or a cosmetic or Invisalign consultation.");\n' +
        '\n' +
        'const t = SLOT.TYPES[w.type];\n' +
        'const now = DateTime.now().setZone(SLOT.TZ);\n' +
        'const busy = busyFrom($input.all().map(i => i.json));\n' +
        'const inPart = s => w.time_of_day === "any" || (w.time_of_day === "morning" ? s.hour < 12 : s.hour >= 12);\n' +
        'const days = (a, b) => {\n' +
        '  const out = [];\n' +
        '  for (let d = DateTime.fromISO(a, { zone: SLOT.TZ }); d <= DateTime.fromISO(b, { zone: SLOT.TZ }); d = d.plus({ days: 1 })) out.push(d);\n' +
        '  return out;\n' +
        '};\n' +
        'const collect = list => list.map(d => freeStarts(d, w.type, busy, now).filter(inPart)).filter(g => g.length);\n' +
        'const spread = (arr, n) => (arr.length <= n ? arr : Array.from({ length: n }, (_, i) => arr[Math.round(i * (arr.length - 1) / (n - 1))]));\n' +
        'const pick = groups => (groups.length === 1 ? spread(groups[0], 4) : groups.slice(0, 3).flatMap(g => spread(g, 2)));\n' +
        '\n' +
        'const notes = [];\n' +
        'if (w.out_of_range) notes.push("Appointments can be booked up to " + SLOT.DAYS_AHEAD + " days ahead, so the latest day is " + sayDay(w.last_day) + ".");\n' +
        'const asked = days(w.from, w.to);\n' +
        'const closed = asked.filter(d => !isOpen(d));\n' +
        'if (closed.length === asked.length) notes.push("The clinic is closed " + (asked.length === 1 ? "on " + sayDay(asked[0]) : "on those days") + ".");\n' +
        '\n' +
        'let groups = collect(asked);\n' +
        'if (!groups.length) {\n' +
        '  const span = w.from === w.to ? "on " + sayDay(w.from) : "between " + sayDay(w.from) + " and " + sayDay(w.to);\n' +
        '  if (closed.length !== asked.length) notes.push("Nothing free " + span + (w.time_of_day === "any" ? "" : " in the " + w.time_of_day) + ".");\n' +
        '  const next = DateTime.fromISO(w.to, { zone: SLOT.TZ }).plus({ days: 1 }).toISODate();\n' +
        '  groups = next <= w.search_end ? collect(days(next, w.search_end)) : [];\n' +
        '  if (groups.length) notes.push("Nearest alternatives:");\n' +
        '}\n' +
        'if (!groups.length) return reply(notes.join(" ") + " No free " + t.label + " times in the following week either. Offer to take a message so the front desk can call back.");\n' +
        '\n' +
        'const slots = pick(groups);\n' +
        'return reply(\n' +
        '  notes.join(" ") + (notes.length ? " " : "") +\n' +
        '  "Free times for " + t.label + " (" + t.minutes + " minutes): " +\n' +
        '  slots.map(s => say(s) + " [start " + startValue(s) + "]").join("; ") +\n' +
        '  ". Offer two or three in words. To book, pass the chosen start value exactly."\n' +
        ');\n'
    }
  },
  output: [{ tool_call_id: 'call_1', result: 'Free times for Cleaning and check-up (60 minutes): Wednesday, October 28 at 10 AM [start 2026-10-28T10:00:00-05:00].' }]
});

// ---- book_appointment ----
const prepareBooking = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Booking',
    position: [920, 460],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// ---- lib-slots.js (included by build.py): clinic hours, appointment types and slot rules ----\n' +
        'const SLOT = {\n' +
        '  TZ: "America/Chicago",\n' +
        '  TYPES: {\n' +
        '    new_patient: { label: "New patient exam and X-rays", minutes: 60, notice: 120 },\n' +
        '    cleaning: { label: "Cleaning and check-up", minutes: 60, notice: 120 },\n' +
        '    emergency: { label: "Emergency exam", minutes: 30, notice: 60 },\n' +
        '    consultation: { label: "Cosmetic or Invisalign consultation", minutes: 30, notice: 120 },\n' +
        '  },\n' +
        '  // Luxon weekday (1 = Monday) -> open spans. Lunch 12-1 Mon-Thu, Friday until 2 pm.\n' +
        '  HOURS: {\n' +
        '    1: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    2: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    3: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    4: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    5: [["08:00", "14:00"]],\n' +
        '  },\n' +
        '  HOLIDAYS: ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"],\n' +
        '  DAYS_AHEAD: 30,\n' +
        '  STEP: 30,\n' +
        '};\n' +
        '\n' +
        '// The model usually sends the key, but accept everyday words too.\n' +
        'function typeKey(raw) {\n' +
        '  const s = String(raw ?? "").toLowerCase();\n' +
        '  if (SLOT.TYPES[s]) return s;\n' +
        '  if (/emergenc|pain|ache|broken|knock|chip|swell|lost (a )?(filling|crown)/.test(s)) return "emergency";\n' +
        '  if (/new/.test(s)) return "new_patient";\n' +
        '  if (/clean|check|hygien|exam/.test(s)) return "cleaning";\n' +
        '  if (/cosmetic|whiten|invisalign|consult|align|veneer/.test(s)) return "consultation";\n' +
        '  return null;\n' +
        '}\n' +
        '\n' +
        '// Calendar events -> busy intervals in clinic time. All-day events close the whole day.\n' +
        'function busyFrom(events, excludeId) {\n' +
        '  return events\n' +
        '    .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent" && e.id !== excludeId)\n' +
        '    .map(e => e.start.date\n' +
        '      ? { start: DateTime.fromISO(e.start.date, { zone: SLOT.TZ }), end: DateTime.fromISO(e.end.date, { zone: SLOT.TZ }) }\n' +
        '      : { start: DateTime.fromISO(e.start.dateTime).setZone(SLOT.TZ), end: DateTime.fromISO(e.end.dateTime).setZone(SLOT.TZ) });\n' +
        '}\n' +
        '\n' +
        'function isOpen(day) {\n' +
        '  return Boolean(SLOT.HOURS[day.weekday]) && !SLOT.HOLIDAYS.includes(day.toISODate());\n' +
        '}\n' +
        '\n' +
        '// Every start time on `day` that fits inside opening hours, respects the notice period and\n' +
        '// doesn\'t overlap a busy interval. One appointment at a time (single demo calendar).\n' +
        'function freeStarts(day, type, busy, now) {\n' +
        '  const t = SLOT.TYPES[type];\n' +
        '  if (!t || !isOpen(day)) return [];\n' +
        '  const earliest = now.plus({ minutes: t.notice });\n' +
        '  const out = [];\n' +
        '  for (const [a, b] of SLOT.HOURS[day.weekday]) {\n' +
        '    const [ah, am] = a.split(":").map(Number);\n' +
        '    const [bh, bm] = b.split(":").map(Number);\n' +
        '    const open = day.set({ hour: ah, minute: am, second: 0, millisecond: 0 });\n' +
        '    const close = day.set({ hour: bh, minute: bm, second: 0, millisecond: 0 });\n' +
        '    for (let s = open; s.plus({ minutes: t.minutes }) <= close; s = s.plus({ minutes: SLOT.STEP })) {\n' +
        '      if (s < earliest) continue;\n' +
        '      const e = s.plus({ minutes: t.minutes });\n' +
        '      if (busy.some(x => x.start < e && x.end > s)) continue;\n' +
        '      out.push(s);\n' +
        '    }\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        '\n' +
        '// Speech-friendly labels: "Tuesday, October 28 at 9 AM" / "at 2:30 PM".\n' +
        'const sayDay = d => (typeof d === "string" ? DateTime.fromISO(d, { zone: SLOT.TZ }) : d).toFormat("cccc, LLLL d");\n' +
        'const say = d => sayDay(d) + " at " + d.toFormat(d.minute ? "h:mm a" : "h a");\n' +
        'const startValue = d => d.toISO({ suppressMilliseconds: true });\n' +
        'const spell = code => code.split("").map(ch => (ch === "-" ? "dash" : ch)).join(" ");\n' +
        'const digits10 = s => String(s ?? "").replace(/\\D/g, "").slice(-10);\n' +
        '\n' +
        '// Appointment events written by book_appointment carry these description lines.\n' +
        'function parseAppointment(e) {\n' +
        '  const d = String(e.description ?? "");\n' +
        '  const line = k => ((new RegExp("^" + k + ":\\\\s*(.*)$", "m")).exec(d) || [])[1] || "";\n' +
        '  const startIso = e.start?.dateTime ?? e.start?.date;\n' +
        '  return {\n' +
        '    id: e.id,\n' +
        '    code: line("Confirmation").trim().toUpperCase(),\n' +
        '    name: line("Patient").trim(),\n' +
        '    phone: digits10(line("Phone")),\n' +
        '    type: line("Type key").trim(),\n' +
        '    type_label: line("Type").trim() || String(e.summary ?? "").split(":")[0],\n' +
        '    start: startIso ? DateTime.fromISO(startIso).setZone(SLOT.TZ) : null,\n' +
        '    description: d,\n' +
        '  };\n' +
        '}\n' +
        '// ---- end lib-slots.js ----\n' +
        '// Validate book_appointment\'s arguments and build the event. The slot itself is re-checked next.\n' +
        'const c = $("Config").first().json;\n' +
        'const a = c.args ?? {};\n' +
        'const type = typeKey(a.appointment_type);\n' +
        'const start = DateTime.fromISO(String(a.start ?? ""), { setZone: true });\n' +
        'const name = String(a.patient_name ?? "").replace(/\\s+/g, " ").trim();\n' +
        'const phone = String(a.phone ?? "").trim() || String(c.caller_number ?? "");\n' +
        'const missing = [];\n' +
        'if (!type) missing.push("the appointment type");\n' +
        'if (!start.isValid) missing.push("a start value from check_availability");\n' +
        'if (name.split(" ").length < 2) missing.push("the patient\'s first and last name");\n' +
        'if (digits10(phone).length < 10) missing.push("a phone number with area code");\n' +
        'if (missing.length) {\n' +
        '  return [{ json: { ok: false, tool_call_id: c.tool_call_id, result: "Not booked yet: still need " + missing.join(", ") + ". Ask for it, then call book_appointment again." } }];\n' +
        '}\n' +
        'const t = SLOT.TYPES[type];\n' +
        'const s = start.setZone(SLOT.TZ);\n' +
        'const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";\n' +
        'const code = "FD-" + Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");\n' +
        'const isNew = a.is_new_patient === true || String(a.is_new_patient).toLowerCase() === "true" || type === "new_patient";\n' +
        'return [{\n' +
        '  json: {\n' +
        '    ok: true,\n' +
        '    tool_call_id: c.tool_call_id,\n' +
        '    calendar_id: c.calendar_id,\n' +
        '    type,\n' +
        '    type_label: t.label,\n' +
        '    start: s.toISO(),\n' +
        '    end: s.plus({ minutes: t.minutes }).toISO(),\n' +
        '    time_min: s.startOf("day").toISO(),\n' +
        '    time_max: s.endOf("day").toISO(),\n' +
        '    patient_name: name,\n' +
        '    phone,\n' +
        '    is_new_patient: isNew,\n' +
        '    insurance: String(a.insurance ?? "").trim() || (isNew ? "not given" : "on file"),\n' +
        '    reason: String(a.reason ?? "").trim() || "not given",\n' +
        '    code,\n' +
        '    call_id: c.call_id,\n' +
        '    summary: t.label + ": " + name,\n' +
        '    description: [\n' +
        '      "Confirmation: " + code,\n' +
        '      "Patient: " + name,\n' +
        '      "Phone: " + phone,\n' +
        '      "Type: " + t.label,\n' +
        '      "Type key: " + type,\n' +
        '      "New patient: " + (isNew ? "yes" : "no"),\n' +
        '      "Insurance: " + (String(a.insurance ?? "").trim() || (isNew ? "not given" : "on file")),\n' +
        '      "Reason: " + (String(a.reason ?? "").trim() || "not given"),\n' +
        '      "",\n' +
        '      "Booked by Nora (AI receptionist), call " + (c.call_id || "n/a") + ".",\n' +
        '    ].join("\\n"),\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ ok: true, tool_call_id: 'call_1', type: 'cleaning', type_label: 'Cleaning and check-up', start: '2026-10-28T10:00:00.000-05:00', end: '2026-10-28T11:00:00.000-05:00', time_min: '2026-10-28T00:00:00.000-05:00', time_max: '2026-10-28T23:59:59.999-05:00', patient_name: 'Jane Doe', phone: '+15125550123', is_new_patient: false, code: 'FD-7K2Q', summary: 'Cleaning and check-up: Jane Doe', description: 'Confirmation: FD-7K2Q' }]
});

const bookingReady = ifElse({
  version: 2.2,
  config: {
    name: 'Booking Ready?',
    position: [1140, 460],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const readBookingDay = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Read Booking Day',
    position: [1360, 400],
    alwaysOutputData: true,
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
    parameters: {
      resource: 'event', operation: 'getAll', calendar: CALENDAR, returnAll: true,
      timeMin: expr('{{ $json.time_min }}'), timeMax: expr('{{ $json.time_max }}'),
      options: { singleEvents: true, orderBy: 'startTime' }
    },
    credentials: CAL_CRED
  },
  output: [{ id: 'evt1', status: 'confirmed', start: { dateTime: '2026-10-28T09:00:00-05:00' }, end: { dateTime: '2026-10-28T10:00:00-05:00' } }]
});

const checkBookingSlot = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Check Booking Slot',
    position: [1580, 400],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// ---- lib-slots.js (included by build.py): clinic hours, appointment types and slot rules ----\n' +
        'const SLOT = {\n' +
        '  TZ: "America/Chicago",\n' +
        '  TYPES: {\n' +
        '    new_patient: { label: "New patient exam and X-rays", minutes: 60, notice: 120 },\n' +
        '    cleaning: { label: "Cleaning and check-up", minutes: 60, notice: 120 },\n' +
        '    emergency: { label: "Emergency exam", minutes: 30, notice: 60 },\n' +
        '    consultation: { label: "Cosmetic or Invisalign consultation", minutes: 30, notice: 120 },\n' +
        '  },\n' +
        '  // Luxon weekday (1 = Monday) -> open spans. Lunch 12-1 Mon-Thu, Friday until 2 pm.\n' +
        '  HOURS: {\n' +
        '    1: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    2: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    3: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    4: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    5: [["08:00", "14:00"]],\n' +
        '  },\n' +
        '  HOLIDAYS: ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"],\n' +
        '  DAYS_AHEAD: 30,\n' +
        '  STEP: 30,\n' +
        '};\n' +
        '\n' +
        '// The model usually sends the key, but accept everyday words too.\n' +
        'function typeKey(raw) {\n' +
        '  const s = String(raw ?? "").toLowerCase();\n' +
        '  if (SLOT.TYPES[s]) return s;\n' +
        '  if (/emergenc|pain|ache|broken|knock|chip|swell|lost (a )?(filling|crown)/.test(s)) return "emergency";\n' +
        '  if (/new/.test(s)) return "new_patient";\n' +
        '  if (/clean|check|hygien|exam/.test(s)) return "cleaning";\n' +
        '  if (/cosmetic|whiten|invisalign|consult|align|veneer/.test(s)) return "consultation";\n' +
        '  return null;\n' +
        '}\n' +
        '\n' +
        '// Calendar events -> busy intervals in clinic time. All-day events close the whole day.\n' +
        'function busyFrom(events, excludeId) {\n' +
        '  return events\n' +
        '    .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent" && e.id !== excludeId)\n' +
        '    .map(e => e.start.date\n' +
        '      ? { start: DateTime.fromISO(e.start.date, { zone: SLOT.TZ }), end: DateTime.fromISO(e.end.date, { zone: SLOT.TZ }) }\n' +
        '      : { start: DateTime.fromISO(e.start.dateTime).setZone(SLOT.TZ), end: DateTime.fromISO(e.end.dateTime).setZone(SLOT.TZ) });\n' +
        '}\n' +
        '\n' +
        'function isOpen(day) {\n' +
        '  return Boolean(SLOT.HOURS[day.weekday]) && !SLOT.HOLIDAYS.includes(day.toISODate());\n' +
        '}\n' +
        '\n' +
        '// Every start time on `day` that fits inside opening hours, respects the notice period and\n' +
        '// doesn\'t overlap a busy interval. One appointment at a time (single demo calendar).\n' +
        'function freeStarts(day, type, busy, now) {\n' +
        '  const t = SLOT.TYPES[type];\n' +
        '  if (!t || !isOpen(day)) return [];\n' +
        '  const earliest = now.plus({ minutes: t.notice });\n' +
        '  const out = [];\n' +
        '  for (const [a, b] of SLOT.HOURS[day.weekday]) {\n' +
        '    const [ah, am] = a.split(":").map(Number);\n' +
        '    const [bh, bm] = b.split(":").map(Number);\n' +
        '    const open = day.set({ hour: ah, minute: am, second: 0, millisecond: 0 });\n' +
        '    const close = day.set({ hour: bh, minute: bm, second: 0, millisecond: 0 });\n' +
        '    for (let s = open; s.plus({ minutes: t.minutes }) <= close; s = s.plus({ minutes: SLOT.STEP })) {\n' +
        '      if (s < earliest) continue;\n' +
        '      const e = s.plus({ minutes: t.minutes });\n' +
        '      if (busy.some(x => x.start < e && x.end > s)) continue;\n' +
        '      out.push(s);\n' +
        '    }\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        '\n' +
        '// Speech-friendly labels: "Tuesday, October 28 at 9 AM" / "at 2:30 PM".\n' +
        'const sayDay = d => (typeof d === "string" ? DateTime.fromISO(d, { zone: SLOT.TZ }) : d).toFormat("cccc, LLLL d");\n' +
        'const say = d => sayDay(d) + " at " + d.toFormat(d.minute ? "h:mm a" : "h a");\n' +
        'const startValue = d => d.toISO({ suppressMilliseconds: true });\n' +
        'const spell = code => code.split("").map(ch => (ch === "-" ? "dash" : ch)).join(" ");\n' +
        'const digits10 = s => String(s ?? "").replace(/\\D/g, "").slice(-10);\n' +
        '\n' +
        '// Appointment events written by book_appointment carry these description lines.\n' +
        'function parseAppointment(e) {\n' +
        '  const d = String(e.description ?? "");\n' +
        '  const line = k => ((new RegExp("^" + k + ":\\\\s*(.*)$", "m")).exec(d) || [])[1] || "";\n' +
        '  const startIso = e.start?.dateTime ?? e.start?.date;\n' +
        '  return {\n' +
        '    id: e.id,\n' +
        '    code: line("Confirmation").trim().toUpperCase(),\n' +
        '    name: line("Patient").trim(),\n' +
        '    phone: digits10(line("Phone")),\n' +
        '    type: line("Type key").trim(),\n' +
        '    type_label: line("Type").trim() || String(e.summary ?? "").split(":")[0],\n' +
        '    start: startIso ? DateTime.fromISO(startIso).setZone(SLOT.TZ) : null,\n' +
        '    description: d,\n' +
        '  };\n' +
        '}\n' +
        '// ---- end lib-slots.js ----\n' +
        '// Is the chosen start still free? If not, offer the other free times that day.\n' +
        'const p = $("Prepare Booking").first().json;\n' +
        'const now = DateTime.now().setZone(SLOT.TZ);\n' +
        'const start = DateTime.fromISO(p.start, { zone: SLOT.TZ });\n' +
        'const free = freeStarts(start.startOf("day"), p.type, busyFrom($input.all().map(i => i.json)), now);\n' +
        'if (free.some(s => +s === +start)) return [{ json: { ...p, free: true } }];\n' +
        'const others = free.slice(0, 4);\n' +
        'return [{\n' +
        '  json: {\n' +
        '    ...p,\n' +
        '    free: false,\n' +
        '    result: "Not booked: " + say(start) + " is no longer available" +\n' +
        '      (others.length ? ". Other free times that day: " + others.map(s => say(s) + " [start " + startValue(s) + "]").join("; ") + ". Offer these." : ". Nothing else is free that day; call check_availability for another day."),\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ ok: true, free: true, tool_call_id: 'call_1', start: '2026-10-28T10:00:00.000-05:00', end: '2026-10-28T11:00:00.000-05:00', summary: 'Cleaning and check-up: Jane Doe', description: 'Confirmation: FD-7K2Q' }]
});

const slotFree = ifElse({
  version: 2.2,
  config: {
    name: 'Slot Free?',
    position: [1800, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.free }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const createEvent = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Create Event',
    position: [2020, 340],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
    parameters: {
      resource: 'event', operation: 'create', calendar: CALENDAR,
      start: expr('{{ $json.start }}'),
      end: expr('{{ $json.end }}'),
      additionalFields: {
        summary: expr('{{ $json.summary }}'),
        description: expr('{{ $json.description }}'),
        location: LOCATION,
        sendUpdates: 'none'
      }
    },
    credentials: CAL_CRED
  },
  output: [{ id: 'evt123', status: 'confirmed' }]
});

const bookedResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Booked Result',
    position: [2240, 340],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// ---- lib-slots.js (included by build.py): clinic hours, appointment types and slot rules ----\n' +
        'const SLOT = {\n' +
        '  TZ: "America/Chicago",\n' +
        '  TYPES: {\n' +
        '    new_patient: { label: "New patient exam and X-rays", minutes: 60, notice: 120 },\n' +
        '    cleaning: { label: "Cleaning and check-up", minutes: 60, notice: 120 },\n' +
        '    emergency: { label: "Emergency exam", minutes: 30, notice: 60 },\n' +
        '    consultation: { label: "Cosmetic or Invisalign consultation", minutes: 30, notice: 120 },\n' +
        '  },\n' +
        '  // Luxon weekday (1 = Monday) -> open spans. Lunch 12-1 Mon-Thu, Friday until 2 pm.\n' +
        '  HOURS: {\n' +
        '    1: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    2: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    3: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    4: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    5: [["08:00", "14:00"]],\n' +
        '  },\n' +
        '  HOLIDAYS: ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"],\n' +
        '  DAYS_AHEAD: 30,\n' +
        '  STEP: 30,\n' +
        '};\n' +
        '\n' +
        '// The model usually sends the key, but accept everyday words too.\n' +
        'function typeKey(raw) {\n' +
        '  const s = String(raw ?? "").toLowerCase();\n' +
        '  if (SLOT.TYPES[s]) return s;\n' +
        '  if (/emergenc|pain|ache|broken|knock|chip|swell|lost (a )?(filling|crown)/.test(s)) return "emergency";\n' +
        '  if (/new/.test(s)) return "new_patient";\n' +
        '  if (/clean|check|hygien|exam/.test(s)) return "cleaning";\n' +
        '  if (/cosmetic|whiten|invisalign|consult|align|veneer/.test(s)) return "consultation";\n' +
        '  return null;\n' +
        '}\n' +
        '\n' +
        '// Calendar events -> busy intervals in clinic time. All-day events close the whole day.\n' +
        'function busyFrom(events, excludeId) {\n' +
        '  return events\n' +
        '    .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent" && e.id !== excludeId)\n' +
        '    .map(e => e.start.date\n' +
        '      ? { start: DateTime.fromISO(e.start.date, { zone: SLOT.TZ }), end: DateTime.fromISO(e.end.date, { zone: SLOT.TZ }) }\n' +
        '      : { start: DateTime.fromISO(e.start.dateTime).setZone(SLOT.TZ), end: DateTime.fromISO(e.end.dateTime).setZone(SLOT.TZ) });\n' +
        '}\n' +
        '\n' +
        'function isOpen(day) {\n' +
        '  return Boolean(SLOT.HOURS[day.weekday]) && !SLOT.HOLIDAYS.includes(day.toISODate());\n' +
        '}\n' +
        '\n' +
        '// Every start time on `day` that fits inside opening hours, respects the notice period and\n' +
        '// doesn\'t overlap a busy interval. One appointment at a time (single demo calendar).\n' +
        'function freeStarts(day, type, busy, now) {\n' +
        '  const t = SLOT.TYPES[type];\n' +
        '  if (!t || !isOpen(day)) return [];\n' +
        '  const earliest = now.plus({ minutes: t.notice });\n' +
        '  const out = [];\n' +
        '  for (const [a, b] of SLOT.HOURS[day.weekday]) {\n' +
        '    const [ah, am] = a.split(":").map(Number);\n' +
        '    const [bh, bm] = b.split(":").map(Number);\n' +
        '    const open = day.set({ hour: ah, minute: am, second: 0, millisecond: 0 });\n' +
        '    const close = day.set({ hour: bh, minute: bm, second: 0, millisecond: 0 });\n' +
        '    for (let s = open; s.plus({ minutes: t.minutes }) <= close; s = s.plus({ minutes: SLOT.STEP })) {\n' +
        '      if (s < earliest) continue;\n' +
        '      const e = s.plus({ minutes: t.minutes });\n' +
        '      if (busy.some(x => x.start < e && x.end > s)) continue;\n' +
        '      out.push(s);\n' +
        '    }\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        '\n' +
        '// Speech-friendly labels: "Tuesday, October 28 at 9 AM" / "at 2:30 PM".\n' +
        'const sayDay = d => (typeof d === "string" ? DateTime.fromISO(d, { zone: SLOT.TZ }) : d).toFormat("cccc, LLLL d");\n' +
        'const say = d => sayDay(d) + " at " + d.toFormat(d.minute ? "h:mm a" : "h a");\n' +
        'const startValue = d => d.toISO({ suppressMilliseconds: true });\n' +
        'const spell = code => code.split("").map(ch => (ch === "-" ? "dash" : ch)).join(" ");\n' +
        'const digits10 = s => String(s ?? "").replace(/\\D/g, "").slice(-10);\n' +
        '\n' +
        '// Appointment events written by book_appointment carry these description lines.\n' +
        'function parseAppointment(e) {\n' +
        '  const d = String(e.description ?? "");\n' +
        '  const line = k => ((new RegExp("^" + k + ":\\\\s*(.*)$", "m")).exec(d) || [])[1] || "";\n' +
        '  const startIso = e.start?.dateTime ?? e.start?.date;\n' +
        '  return {\n' +
        '    id: e.id,\n' +
        '    code: line("Confirmation").trim().toUpperCase(),\n' +
        '    name: line("Patient").trim(),\n' +
        '    phone: digits10(line("Phone")),\n' +
        '    type: line("Type key").trim(),\n' +
        '    type_label: line("Type").trim() || String(e.summary ?? "").split(":")[0],\n' +
        '    start: startIso ? DateTime.fromISO(startIso).setZone(SLOT.TZ) : null,\n' +
        '    description: d,\n' +
        '  };\n' +
        '}\n' +
        '// ---- end lib-slots.js ----\n' +
        'const p = $("Check Booking Slot").first().json;\n' +
        'const when = say(DateTime.fromISO(p.start, { zone: SLOT.TZ }));\n' +
        'return [{\n' +
        '  json: {\n' +
        '    tool_call_id: p.tool_call_id,\n' +
        '    event_id: $input.first().json.id ?? "",\n' +
        '    result: "Booked: " + p.type_label + " for " + p.patient_name + " on " + when + ". Confirmation code " + p.code +\n' +
        '      " (say it as: " + spell(p.code) + ")." +\n' +
        '      (p.is_new_patient ? " First visit: arrive 15 minutes early with photo ID and insurance card; forms will be sent beforehand." : ""),\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ tool_call_id: 'call_1', event_id: 'evt123', result: 'Booked: Cleaning and check-up for Jane Doe on Wednesday, October 28 at 10 AM. Confirmation code FD-7K2Q.' }]
});

const slotTaken = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Slot Taken', position: [2020, 480] }
});

const bookingIncomplete = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Booking Incomplete', position: [1360, 560] }
});

// ---- find / cancel / reschedule ----
const readUpcoming = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Read Upcoming',
    position: [920, 760],
    alwaysOutputData: true,
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
    parameters: {
      resource: 'event', operation: 'getAll', calendar: CALENDAR, returnAll: true,
      timeMin: expr('{{ $now.toISO() }}'), timeMax: expr('{{ $now.plus({ days: 60 }).toISO() }}'),
      options: { singleEvents: true, orderBy: 'startTime' }
    },
    credentials: CAL_CRED
  },
  output: [{ id: 'evt123', status: 'confirmed', summary: 'Cleaning and check-up: Jane Doe', description: 'Confirmation: FD-7K2Q\nPatient: Jane Doe\nPhone: +15125550123\nType: Cleaning and check-up\nType key: cleaning', start: { dateTime: '2026-10-28T10:00:00-05:00' }, end: { dateTime: '2026-10-28T11:00:00-05:00' } }]
});

const matchAppointments = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Match Appointments',
    position: [1140, 760],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// ---- lib-slots.js (included by build.py): clinic hours, appointment types and slot rules ----\n' +
        'const SLOT = {\n' +
        '  TZ: "America/Chicago",\n' +
        '  TYPES: {\n' +
        '    new_patient: { label: "New patient exam and X-rays", minutes: 60, notice: 120 },\n' +
        '    cleaning: { label: "Cleaning and check-up", minutes: 60, notice: 120 },\n' +
        '    emergency: { label: "Emergency exam", minutes: 30, notice: 60 },\n' +
        '    consultation: { label: "Cosmetic or Invisalign consultation", minutes: 30, notice: 120 },\n' +
        '  },\n' +
        '  // Luxon weekday (1 = Monday) -> open spans. Lunch 12-1 Mon-Thu, Friday until 2 pm.\n' +
        '  HOURS: {\n' +
        '    1: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    2: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    3: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    4: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    5: [["08:00", "14:00"]],\n' +
        '  },\n' +
        '  HOLIDAYS: ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"],\n' +
        '  DAYS_AHEAD: 30,\n' +
        '  STEP: 30,\n' +
        '};\n' +
        '\n' +
        '// The model usually sends the key, but accept everyday words too.\n' +
        'function typeKey(raw) {\n' +
        '  const s = String(raw ?? "").toLowerCase();\n' +
        '  if (SLOT.TYPES[s]) return s;\n' +
        '  if (/emergenc|pain|ache|broken|knock|chip|swell|lost (a )?(filling|crown)/.test(s)) return "emergency";\n' +
        '  if (/new/.test(s)) return "new_patient";\n' +
        '  if (/clean|check|hygien|exam/.test(s)) return "cleaning";\n' +
        '  if (/cosmetic|whiten|invisalign|consult|align|veneer/.test(s)) return "consultation";\n' +
        '  return null;\n' +
        '}\n' +
        '\n' +
        '// Calendar events -> busy intervals in clinic time. All-day events close the whole day.\n' +
        'function busyFrom(events, excludeId) {\n' +
        '  return events\n' +
        '    .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent" && e.id !== excludeId)\n' +
        '    .map(e => e.start.date\n' +
        '      ? { start: DateTime.fromISO(e.start.date, { zone: SLOT.TZ }), end: DateTime.fromISO(e.end.date, { zone: SLOT.TZ }) }\n' +
        '      : { start: DateTime.fromISO(e.start.dateTime).setZone(SLOT.TZ), end: DateTime.fromISO(e.end.dateTime).setZone(SLOT.TZ) });\n' +
        '}\n' +
        '\n' +
        'function isOpen(day) {\n' +
        '  return Boolean(SLOT.HOURS[day.weekday]) && !SLOT.HOLIDAYS.includes(day.toISODate());\n' +
        '}\n' +
        '\n' +
        '// Every start time on `day` that fits inside opening hours, respects the notice period and\n' +
        '// doesn\'t overlap a busy interval. One appointment at a time (single demo calendar).\n' +
        'function freeStarts(day, type, busy, now) {\n' +
        '  const t = SLOT.TYPES[type];\n' +
        '  if (!t || !isOpen(day)) return [];\n' +
        '  const earliest = now.plus({ minutes: t.notice });\n' +
        '  const out = [];\n' +
        '  for (const [a, b] of SLOT.HOURS[day.weekday]) {\n' +
        '    const [ah, am] = a.split(":").map(Number);\n' +
        '    const [bh, bm] = b.split(":").map(Number);\n' +
        '    const open = day.set({ hour: ah, minute: am, second: 0, millisecond: 0 });\n' +
        '    const close = day.set({ hour: bh, minute: bm, second: 0, millisecond: 0 });\n' +
        '    for (let s = open; s.plus({ minutes: t.minutes }) <= close; s = s.plus({ minutes: SLOT.STEP })) {\n' +
        '      if (s < earliest) continue;\n' +
        '      const e = s.plus({ minutes: t.minutes });\n' +
        '      if (busy.some(x => x.start < e && x.end > s)) continue;\n' +
        '      out.push(s);\n' +
        '    }\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        '\n' +
        '// Speech-friendly labels: "Tuesday, October 28 at 9 AM" / "at 2:30 PM".\n' +
        'const sayDay = d => (typeof d === "string" ? DateTime.fromISO(d, { zone: SLOT.TZ }) : d).toFormat("cccc, LLLL d");\n' +
        'const say = d => sayDay(d) + " at " + d.toFormat(d.minute ? "h:mm a" : "h a");\n' +
        'const startValue = d => d.toISO({ suppressMilliseconds: true });\n' +
        'const spell = code => code.split("").map(ch => (ch === "-" ? "dash" : ch)).join(" ");\n' +
        'const digits10 = s => String(s ?? "").replace(/\\D/g, "").slice(-10);\n' +
        '\n' +
        '// Appointment events written by book_appointment carry these description lines.\n' +
        'function parseAppointment(e) {\n' +
        '  const d = String(e.description ?? "");\n' +
        '  const line = k => ((new RegExp("^" + k + ":\\\\s*(.*)$", "m")).exec(d) || [])[1] || "";\n' +
        '  const startIso = e.start?.dateTime ?? e.start?.date;\n' +
        '  return {\n' +
        '    id: e.id,\n' +
        '    code: line("Confirmation").trim().toUpperCase(),\n' +
        '    name: line("Patient").trim(),\n' +
        '    phone: digits10(line("Phone")),\n' +
        '    type: line("Type key").trim(),\n' +
        '    type_label: line("Type").trim() || String(e.summary ?? "").split(":")[0],\n' +
        '    start: startIso ? DateTime.fromISO(startIso).setZone(SLOT.TZ) : null,\n' +
        '    description: d,\n' +
        '  };\n' +
        '}\n' +
        '// ---- end lib-slots.js ----\n' +
        '// find_appointment / cancel_appointment / reschedule_appointment: find the caller\'s appointment\n' +
        '// by confirmation code (or the last 4 characters of it), else by the phone number it was booked\n' +
        '// with. Decides the next step: reply, delete, or move (after a slot check).\n' +
        'const c = $("Config").first().json;\n' +
        'const a = c.args ?? {};\n' +
        'const now = DateTime.now().setZone(SLOT.TZ);\n' +
        'const reply = result => [{ json: { action: "reply", tool_call_id: c.tool_call_id, result } }];\n' +
        '\n' +
        'const appts = $input.all().map(i => i.json)\n' +
        '  .filter(e => e && e.id && e.status !== "cancelled")\n' +
        '  .map(parseAppointment)\n' +
        '  .filter(x => x.code && x.start && x.start > now)\n' +
        '  .sort((x, y) => x.start - y.start);\n' +
        'const wanted = String(a.confirmation_code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");\n' +
        'const phone = digits10(a.phone) || digits10(c.caller_number);\n' +
        'let hits = [];\n' +
        'if (wanted.length >= 4) hits = appts.filter(x => x.code.replace(/[^A-Z0-9]/g, "").endsWith(wanted.slice(-4)));\n' +
        'if (!hits.length && phone.length === 10) hits = appts.filter(x => x.phone === phone);\n' +
        'const describe = x => x.type_label + " for " + x.name + " on " + say(x.start) + ", confirmation " + x.code;\n' +
        '\n' +
        'if (!hits.length) {\n' +
        '  return reply("No upcoming appointment found for " + (wanted ? "that confirmation code" : "") + (wanted && phone ? " or " : "") + (phone ? "that phone number" : "") +\n' +
        '    (!wanted && !phone ? "nothing (ask for the confirmation code or the phone number used to book)" : "") +\n' +
        '    ". Ask them to check the code or the number they booked with, or offer to take a message.");\n' +
        '}\n' +
        'if (c.name === "find_appointment") {\n' +
        '  return reply("Found " + hits.length + " upcoming appointment" + (hits.length > 1 ? "s" : "") + ": " + hits.map(describe).join("; ") + ".");\n' +
        '}\n' +
        'if (hits.length > 1) {\n' +
        '  return reply("That number has " + hits.length + " upcoming appointments: " + hits.map(describe).join("; ") + ". Ask which one, then call again with its confirmation code.");\n' +
        '}\n' +
        'const x = hits[0];\n' +
        'if (c.name === "cancel_appointment") {\n' +
        '  const late = x.start.diff(now, "hours").hours < 24;\n' +
        '  return [{ json: { action: "delete", tool_call_id: c.tool_call_id, event_id: x.id, calendar_id: c.calendar_id, appointment: describe(x), late } }];\n' +
        '}\n' +
        '// reschedule_appointment\n' +
        'const type = typeKey(x.type) || typeKey(x.type_label) || "cleaning";\n' +
        'const t = SLOT.TYPES[type];\n' +
        'const ns = DateTime.fromISO(String(a.new_start ?? ""), { setZone: true });\n' +
        'if (!ns.isValid) return reply("Found " + describe(x) + ". To move it, call check_availability for " + t.label + " and pass the chosen start value as new_start.");\n' +
        'const s = ns.setZone(SLOT.TZ);\n' +
        'return [{\n' +
        '  json: {\n' +
        '    action: "move",\n' +
        '    tool_call_id: c.tool_call_id,\n' +
        '    calendar_id: c.calendar_id,\n' +
        '    event_id: x.id,\n' +
        '    type,\n' +
        '    type_label: t.label,\n' +
        '    code: x.code,\n' +
        '    name: x.name,\n' +
        '    old_start: x.start.toISO(),\n' +
        '    start: s.toISO(),\n' +
        '    end: s.plus({ minutes: t.minutes }).toISO(),\n' +
        '    time_min: s.startOf("day").toISO(),\n' +
        '    time_max: s.endOf("day").toISO(),\n' +
        '    description: x.description + "\\nRescheduled by Nora on " + now.toFormat("LLL d, h:mm a") + " (was " + say(x.start) + ").",\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ action: 'move', tool_call_id: 'call_1', event_id: 'evt123', type: 'cleaning', type_label: 'Cleaning and check-up', code: 'FD-7K2Q', name: 'Jane Doe', old_start: '2026-10-28T10:00:00.000-05:00', start: '2026-10-29T10:00:00.000-05:00', end: '2026-10-29T11:00:00.000-05:00', time_min: '2026-10-29T00:00:00.000-05:00', time_max: '2026-10-29T23:59:59.999-05:00', description: 'Confirmation: FD-7K2Q' }]
});

const nextStep = switchCase({
  version: 3.2,
  config: {
    name: 'Next Step',
    position: [1360, 760],
    parameters: {
      rules: {
        values: [
          { outputKey: 'reply', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'reply' }], combinator: 'and' } },
          { outputKey: 'cancel', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'delete' }], combinator: 'and' } },
          { outputKey: 'move', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'move' }], combinator: 'and' } }
        ]
      },
      options: {}
    }
  }
});

const manageReply = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Manage Reply', position: [1580, 660] }
});

const deleteEvent = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Delete Event',
    position: [1580, 800],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
    parameters: { resource: 'event', operation: 'delete', calendar: CALENDAR, eventId: expr('{{ $json.event_id }}'), options: { sendUpdates: 'none' } },
    credentials: CAL_CRED
  },
  output: [{ success: true }]
});

const cancelledResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Cancelled Result',
    position: [1800, 800],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'const m = $("Match Appointments").first().json;\n' +
        'return [{\n' +
        '  json: {\n' +
        '    tool_call_id: m.tool_call_id,\n' +
        '    result: "Cancelled: " + m.appointment + "." + (m.late ? " It was less than 24 hours away; mention the 24-hour notice policy kindly." : "") + " Offer to book a new time.",\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ tool_call_id: 'call_1', result: 'Cancelled: Cleaning and check-up for Jane Doe on Wednesday, October 28 at 10 AM.' }]
});

const readNewDay = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Read New Day',
    position: [1580, 960],
    alwaysOutputData: true,
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
    parameters: {
      resource: 'event', operation: 'getAll', calendar: CALENDAR, returnAll: true,
      timeMin: expr('{{ $json.time_min }}'), timeMax: expr('{{ $json.time_max }}'),
      options: { singleEvents: true, orderBy: 'startTime' }
    },
    credentials: CAL_CRED
  },
  output: [{ id: 'evt9', status: 'confirmed', start: { dateTime: '2026-10-29T09:00:00-05:00' }, end: { dateTime: '2026-10-29T10:00:00-05:00' } }]
});

const checkMoveSlot = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Check Move Slot',
    position: [1800, 960],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// ---- lib-slots.js (included by build.py): clinic hours, appointment types and slot rules ----\n' +
        'const SLOT = {\n' +
        '  TZ: "America/Chicago",\n' +
        '  TYPES: {\n' +
        '    new_patient: { label: "New patient exam and X-rays", minutes: 60, notice: 120 },\n' +
        '    cleaning: { label: "Cleaning and check-up", minutes: 60, notice: 120 },\n' +
        '    emergency: { label: "Emergency exam", minutes: 30, notice: 60 },\n' +
        '    consultation: { label: "Cosmetic or Invisalign consultation", minutes: 30, notice: 120 },\n' +
        '  },\n' +
        '  // Luxon weekday (1 = Monday) -> open spans. Lunch 12-1 Mon-Thu, Friday until 2 pm.\n' +
        '  HOURS: {\n' +
        '    1: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    2: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    3: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    4: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    5: [["08:00", "14:00"]],\n' +
        '  },\n' +
        '  HOLIDAYS: ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"],\n' +
        '  DAYS_AHEAD: 30,\n' +
        '  STEP: 30,\n' +
        '};\n' +
        '\n' +
        '// The model usually sends the key, but accept everyday words too.\n' +
        'function typeKey(raw) {\n' +
        '  const s = String(raw ?? "").toLowerCase();\n' +
        '  if (SLOT.TYPES[s]) return s;\n' +
        '  if (/emergenc|pain|ache|broken|knock|chip|swell|lost (a )?(filling|crown)/.test(s)) return "emergency";\n' +
        '  if (/new/.test(s)) return "new_patient";\n' +
        '  if (/clean|check|hygien|exam/.test(s)) return "cleaning";\n' +
        '  if (/cosmetic|whiten|invisalign|consult|align|veneer/.test(s)) return "consultation";\n' +
        '  return null;\n' +
        '}\n' +
        '\n' +
        '// Calendar events -> busy intervals in clinic time. All-day events close the whole day.\n' +
        'function busyFrom(events, excludeId) {\n' +
        '  return events\n' +
        '    .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent" && e.id !== excludeId)\n' +
        '    .map(e => e.start.date\n' +
        '      ? { start: DateTime.fromISO(e.start.date, { zone: SLOT.TZ }), end: DateTime.fromISO(e.end.date, { zone: SLOT.TZ }) }\n' +
        '      : { start: DateTime.fromISO(e.start.dateTime).setZone(SLOT.TZ), end: DateTime.fromISO(e.end.dateTime).setZone(SLOT.TZ) });\n' +
        '}\n' +
        '\n' +
        'function isOpen(day) {\n' +
        '  return Boolean(SLOT.HOURS[day.weekday]) && !SLOT.HOLIDAYS.includes(day.toISODate());\n' +
        '}\n' +
        '\n' +
        '// Every start time on `day` that fits inside opening hours, respects the notice period and\n' +
        '// doesn\'t overlap a busy interval. One appointment at a time (single demo calendar).\n' +
        'function freeStarts(day, type, busy, now) {\n' +
        '  const t = SLOT.TYPES[type];\n' +
        '  if (!t || !isOpen(day)) return [];\n' +
        '  const earliest = now.plus({ minutes: t.notice });\n' +
        '  const out = [];\n' +
        '  for (const [a, b] of SLOT.HOURS[day.weekday]) {\n' +
        '    const [ah, am] = a.split(":").map(Number);\n' +
        '    const [bh, bm] = b.split(":").map(Number);\n' +
        '    const open = day.set({ hour: ah, minute: am, second: 0, millisecond: 0 });\n' +
        '    const close = day.set({ hour: bh, minute: bm, second: 0, millisecond: 0 });\n' +
        '    for (let s = open; s.plus({ minutes: t.minutes }) <= close; s = s.plus({ minutes: SLOT.STEP })) {\n' +
        '      if (s < earliest) continue;\n' +
        '      const e = s.plus({ minutes: t.minutes });\n' +
        '      if (busy.some(x => x.start < e && x.end > s)) continue;\n' +
        '      out.push(s);\n' +
        '    }\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        '\n' +
        '// Speech-friendly labels: "Tuesday, October 28 at 9 AM" / "at 2:30 PM".\n' +
        'const sayDay = d => (typeof d === "string" ? DateTime.fromISO(d, { zone: SLOT.TZ }) : d).toFormat("cccc, LLLL d");\n' +
        'const say = d => sayDay(d) + " at " + d.toFormat(d.minute ? "h:mm a" : "h a");\n' +
        'const startValue = d => d.toISO({ suppressMilliseconds: true });\n' +
        'const spell = code => code.split("").map(ch => (ch === "-" ? "dash" : ch)).join(" ");\n' +
        'const digits10 = s => String(s ?? "").replace(/\\D/g, "").slice(-10);\n' +
        '\n' +
        '// Appointment events written by book_appointment carry these description lines.\n' +
        'function parseAppointment(e) {\n' +
        '  const d = String(e.description ?? "");\n' +
        '  const line = k => ((new RegExp("^" + k + ":\\\\s*(.*)$", "m")).exec(d) || [])[1] || "";\n' +
        '  const startIso = e.start?.dateTime ?? e.start?.date;\n' +
        '  return {\n' +
        '    id: e.id,\n' +
        '    code: line("Confirmation").trim().toUpperCase(),\n' +
        '    name: line("Patient").trim(),\n' +
        '    phone: digits10(line("Phone")),\n' +
        '    type: line("Type key").trim(),\n' +
        '    type_label: line("Type").trim() || String(e.summary ?? "").split(":")[0],\n' +
        '    start: startIso ? DateTime.fromISO(startIso).setZone(SLOT.TZ) : null,\n' +
        '    description: d,\n' +
        '  };\n' +
        '}\n' +
        '// ---- end lib-slots.js ----\n' +
        '// Same check as booking, ignoring the appointment being moved.\n' +
        'const p = $("Match Appointments").first().json;\n' +
        'const now = DateTime.now().setZone(SLOT.TZ);\n' +
        'const start = DateTime.fromISO(p.start, { zone: SLOT.TZ });\n' +
        'const free = freeStarts(start.startOf("day"), p.type, busyFrom($input.all().map(i => i.json), p.event_id), now);\n' +
        'if (free.some(s => +s === +start)) return [{ json: { ...p, free: true } }];\n' +
        'const others = free.filter(s => +s !== +start).slice(0, 4);\n' +
        'return [{\n' +
        '  json: {\n' +
        '    ...p,\n' +
        '    free: false,\n' +
        '    result: "Not moved: " + say(start) + " is not available" +\n' +
        '      (others.length ? ". Other free times that day: " + others.map(s => say(s) + " [start " + startValue(s) + "]").join("; ") + "." : ". Call check_availability for another day."),\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ free: true, tool_call_id: 'call_1', event_id: 'evt123', start: '2026-10-29T10:00:00.000-05:00', end: '2026-10-29T11:00:00.000-05:00', description: 'Confirmation: FD-7K2Q' }]
});

const moveFree = ifElse({
  version: 2.2,
  config: {
    name: 'Move Free?',
    position: [2020, 960],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.free }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const updateEvent = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Update Event',
    position: [2240, 900],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
    parameters: {
      resource: 'event', operation: 'update', calendar: CALENDAR,
      eventId: expr('{{ $json.event_id }}'),
      updateFields: { start: expr('{{ $json.start }}'), end: expr('{{ $json.end }}'), description: expr('{{ $json.description }}'), sendUpdates: 'none' }
    },
    credentials: CAL_CRED
  },
  output: [{ id: 'evt123', status: 'confirmed' }]
});

const movedResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Moved Result',
    position: [2460, 900],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// ---- lib-slots.js (included by build.py): clinic hours, appointment types and slot rules ----\n' +
        'const SLOT = {\n' +
        '  TZ: "America/Chicago",\n' +
        '  TYPES: {\n' +
        '    new_patient: { label: "New patient exam and X-rays", minutes: 60, notice: 120 },\n' +
        '    cleaning: { label: "Cleaning and check-up", minutes: 60, notice: 120 },\n' +
        '    emergency: { label: "Emergency exam", minutes: 30, notice: 60 },\n' +
        '    consultation: { label: "Cosmetic or Invisalign consultation", minutes: 30, notice: 120 },\n' +
        '  },\n' +
        '  // Luxon weekday (1 = Monday) -> open spans. Lunch 12-1 Mon-Thu, Friday until 2 pm.\n' +
        '  HOURS: {\n' +
        '    1: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    2: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    3: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    4: [["08:00", "12:00"], ["13:00", "17:00"]],\n' +
        '    5: [["08:00", "14:00"]],\n' +
        '  },\n' +
        '  HOLIDAYS: ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"],\n' +
        '  DAYS_AHEAD: 30,\n' +
        '  STEP: 30,\n' +
        '};\n' +
        '\n' +
        '// The model usually sends the key, but accept everyday words too.\n' +
        'function typeKey(raw) {\n' +
        '  const s = String(raw ?? "").toLowerCase();\n' +
        '  if (SLOT.TYPES[s]) return s;\n' +
        '  if (/emergenc|pain|ache|broken|knock|chip|swell|lost (a )?(filling|crown)/.test(s)) return "emergency";\n' +
        '  if (/new/.test(s)) return "new_patient";\n' +
        '  if (/clean|check|hygien|exam/.test(s)) return "cleaning";\n' +
        '  if (/cosmetic|whiten|invisalign|consult|align|veneer/.test(s)) return "consultation";\n' +
        '  return null;\n' +
        '}\n' +
        '\n' +
        '// Calendar events -> busy intervals in clinic time. All-day events close the whole day.\n' +
        'function busyFrom(events, excludeId) {\n' +
        '  return events\n' +
        '    .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent" && e.id !== excludeId)\n' +
        '    .map(e => e.start.date\n' +
        '      ? { start: DateTime.fromISO(e.start.date, { zone: SLOT.TZ }), end: DateTime.fromISO(e.end.date, { zone: SLOT.TZ }) }\n' +
        '      : { start: DateTime.fromISO(e.start.dateTime).setZone(SLOT.TZ), end: DateTime.fromISO(e.end.dateTime).setZone(SLOT.TZ) });\n' +
        '}\n' +
        '\n' +
        'function isOpen(day) {\n' +
        '  return Boolean(SLOT.HOURS[day.weekday]) && !SLOT.HOLIDAYS.includes(day.toISODate());\n' +
        '}\n' +
        '\n' +
        '// Every start time on `day` that fits inside opening hours, respects the notice period and\n' +
        '// doesn\'t overlap a busy interval. One appointment at a time (single demo calendar).\n' +
        'function freeStarts(day, type, busy, now) {\n' +
        '  const t = SLOT.TYPES[type];\n' +
        '  if (!t || !isOpen(day)) return [];\n' +
        '  const earliest = now.plus({ minutes: t.notice });\n' +
        '  const out = [];\n' +
        '  for (const [a, b] of SLOT.HOURS[day.weekday]) {\n' +
        '    const [ah, am] = a.split(":").map(Number);\n' +
        '    const [bh, bm] = b.split(":").map(Number);\n' +
        '    const open = day.set({ hour: ah, minute: am, second: 0, millisecond: 0 });\n' +
        '    const close = day.set({ hour: bh, minute: bm, second: 0, millisecond: 0 });\n' +
        '    for (let s = open; s.plus({ minutes: t.minutes }) <= close; s = s.plus({ minutes: SLOT.STEP })) {\n' +
        '      if (s < earliest) continue;\n' +
        '      const e = s.plus({ minutes: t.minutes });\n' +
        '      if (busy.some(x => x.start < e && x.end > s)) continue;\n' +
        '      out.push(s);\n' +
        '    }\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        '\n' +
        '// Speech-friendly labels: "Tuesday, October 28 at 9 AM" / "at 2:30 PM".\n' +
        'const sayDay = d => (typeof d === "string" ? DateTime.fromISO(d, { zone: SLOT.TZ }) : d).toFormat("cccc, LLLL d");\n' +
        'const say = d => sayDay(d) + " at " + d.toFormat(d.minute ? "h:mm a" : "h a");\n' +
        'const startValue = d => d.toISO({ suppressMilliseconds: true });\n' +
        'const spell = code => code.split("").map(ch => (ch === "-" ? "dash" : ch)).join(" ");\n' +
        'const digits10 = s => String(s ?? "").replace(/\\D/g, "").slice(-10);\n' +
        '\n' +
        '// Appointment events written by book_appointment carry these description lines.\n' +
        'function parseAppointment(e) {\n' +
        '  const d = String(e.description ?? "");\n' +
        '  const line = k => ((new RegExp("^" + k + ":\\\\s*(.*)$", "m")).exec(d) || [])[1] || "";\n' +
        '  const startIso = e.start?.dateTime ?? e.start?.date;\n' +
        '  return {\n' +
        '    id: e.id,\n' +
        '    code: line("Confirmation").trim().toUpperCase(),\n' +
        '    name: line("Patient").trim(),\n' +
        '    phone: digits10(line("Phone")),\n' +
        '    type: line("Type key").trim(),\n' +
        '    type_label: line("Type").trim() || String(e.summary ?? "").split(":")[0],\n' +
        '    start: startIso ? DateTime.fromISO(startIso).setZone(SLOT.TZ) : null,\n' +
        '    description: d,\n' +
        '  };\n' +
        '}\n' +
        '// ---- end lib-slots.js ----\n' +
        'const p = $("Check Move Slot").first().json;\n' +
        'return [{\n' +
        '  json: {\n' +
        '    tool_call_id: p.tool_call_id,\n' +
        '    result: "Moved: " + p.type_label + " for " + p.name + " is now on " + say(DateTime.fromISO(p.start, { zone: SLOT.TZ })) +\n' +
        '      " (was " + say(DateTime.fromISO(p.old_start, { zone: SLOT.TZ })) + "). Same confirmation code " + p.code + ".",\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ tool_call_id: 'call_1', result: 'Moved: Cleaning and check-up for Jane Doe is now on Thursday, October 29 at 10 AM.' }]
});

const moveTaken = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Move Taken', position: [2240, 1040] }
});

// ---- take_message ----
const prepareMessage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Message',
    position: [920, 1260],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// take_message: validate, then build the staff alert and the Messages row.\n' +
        'const c = $("Config").first().json;\n' +
        'const a = c.args ?? {};\n' +
        'const name = String(a.caller_name ?? "").trim();\n' +
        'const phone = String(a.phone ?? "").trim() || String(c.caller_number ?? "");\n' +
        'const message = String(a.message ?? "").trim();\n' +
        'const urgent = a.urgent === true || String(a.urgent).toLowerCase() === "true";\n' +
        'const missing = [];\n' +
        'if (!name) missing.push("their name");\n' +
        'if (phone.replace(/\\D/g, "").length < 10) missing.push("a callback number");\n' +
        'if (message.length < 3) missing.push("the message");\n' +
        'const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");\n' +
        'const at = DateTime.now().setZone("America/Chicago");\n' +
        'return [{\n' +
        '  json: {\n' +
        '    ok: missing.length === 0,\n' +
        '    tool_call_id: c.tool_call_id,\n' +
        '    sheet_id: c.sheet_id,\n' +
        '    staff_chat_id: c.staff_chat_id,\n' +
        '    missing: missing.join(", "),\n' +
        '    urgent,\n' +
        '    telegram: (urgent ? "🚨 <b>URGENT message</b>" : "📞 <b>New message</b>") + " from the phone line\\n" +\n' +
        '      "<b>" + esc(name) + "</b>, " + esc(phone) + "\\n" + esc(message) + "\\n<i>" + at.toFormat("ccc LLL d, h:mm a") + " (Nora)</i>",\n' +
        '    row: { at: at.toFormat("yyyy-MM-dd HH:mm"), caller_name: name, phone, message, urgent: urgent ? "yes" : "no", status: "new", call_id: c.call_id ?? "" },\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ ok: true, tool_call_id: 'call_1', sheet_id: '1abc', staff_chat_id: '123', urgent: false, telegram: 'New message', row: { at: '2026-10-28 10:15', caller_name: 'Jane Doe' } }]
});

const messageComplete = ifElse({
  version: 2.2,
  config: {
    name: 'Message Complete?',
    position: [1140, 1260],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const logMessage = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Log Message (background)',
    position: [1360, 1200],
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: LOG_ROW_WF, mode: 'once', options: { waitForSubWorkflow: false } }
  }
});

const alertStaff = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Alert Staff',
    position: [1580, 1200],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Prepare Message').first().json.staff_chat_id }}"),
      text: expr("{{ $('Prepare Message').first().json.telegram }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const messageResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Message Result',
    position: [1800, 1260],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'const m = $("Prepare Message").first().json;\n' +
        'return [{\n' +
        '  json: {\n' +
        '    tool_call_id: m.tool_call_id,\n' +
        '    result: m.ok\n' +
        '      ? "Message passed to the front desk" + (m.urgent ? " as urgent: they call back within two hours during opening hours." : ": they call back within one business day.")\n' +
        '      : "Message not sent yet: still need " + m.missing + ". Ask for it, then call take_message again.",\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ tool_call_id: 'call_1', result: 'Message passed to the front desk.' }]
});

const unknownTool = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Unknown Tool',
    position: [920, 1460],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'const c = $("Config").first().json;\n' +
        'return [{ json: { tool_call_id: c.tool_call_id, result: "That action isn\'t available. Offer to take a message for the front desk." } }];\n'
    }
  },
  output: [{ tool_call_id: 'call_1', result: "That action isn't available." }]
});

const notes = sticky(
  '## Receptionist 2: Run Tool\nRuns one Vapi tool call for **Receptionist 1** and always ends in `{ tool_call_id, result }`, where `result` is one line the voice model turns into speech.\n\nAll scheduling rules are code (`lib-slots.js`): opening hours, lunch, holidays, notice periods, 30-minute steps, 30 days ahead. Bookings and moves re-read the day and re-check the exact slot before writing, so two callers can\'t get the same time. Appointments are found by confirmation code or by the phone number they were booked with; nobody else\'s details are given out.',
  [], { position: [180, -80], width: 1000, height: 220, color: 4 }
);

export default workflow('receptionist-run-tool', 'Receptionist 2: Run Tool')
  .add(whenCalled)
  .to(config)
  .to(whichTool
    .onCase(0, workOutWindow.to(readCalendar).to(findFreeSlots))
    .onCase(1, prepareBooking.to(bookingReady
      .onTrue(readBookingDay.to(checkBookingSlot).to(slotFree
        .onTrue(createEvent.to(bookedResult))
        .onFalse(slotTaken)))
      .onFalse(bookingIncomplete)))
    .onCase(2, readUpcoming.to(matchAppointments).to(nextStep
      .onCase(0, manageReply)
      .onCase(1, deleteEvent.to(cancelledResult))
      .onCase(2, readNewDay.to(checkMoveSlot).to(moveFree
        .onTrue(updateEvent.to(movedResult))
        .onFalse(moveTaken)))))
    .onCase(3, prepareMessage.to(messageComplete
      .onTrue(logMessage.to(alertStaff).to(messageResult))
      .onFalse(messageResult)))
    .onCase(4, unknownTool))
  .add(notes);
