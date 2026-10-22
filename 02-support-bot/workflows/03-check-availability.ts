import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called by Agent',
    position: [240, 300],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'service', type: 'string' },
          { name: 'date_from', type: 'string' },
          { name: 'date_to', type: 'string' },
          { name: 'check_start', type: 'string' }
        ]
      }
    }
  },
  output: [{ service: 'oil_change', date_from: '2026-10-03', date_to: '2026-10-03', check_start: '' }]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [480, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'calendar-id', name: 'CALENDAR_ID', value: 'e535dd2bcfe011be160cf20a61416d5b25d758750392d5f3973e473dafe47b34@group.calendar.google.com', type: 'string' },
          { id: 'timezone', name: 'TIMEZONE', value: 'America/New_York', type: 'string' },
          { id: 'bays', name: 'BAYS', value: 2, type: 'number' },
          { id: 'slot-step', name: 'SLOT_STEP_MIN', value: 30, type: 'number' },
          { id: 'min-notice', name: 'MIN_NOTICE_HOURS', value: 2, type: 'number' },
          { id: 'days-ahead', name: 'DAYS_AHEAD', value: 14, type: 'number' },
          { id: 'booking-hours', name: 'BOOKING_HOURS', value: expr('{{ { "1": ["08:00", "18:00"], "2": ["08:00", "18:00"], "3": ["08:00", "18:00"], "4": ["08:00", "18:00"], "5": ["08:00", "18:00"], "6": ["08:00", "14:00"] } }}'), type: 'object' },
          { id: 'holidays', name: 'HOLIDAYS', value: expr('{{ ["2026-11-26", "2026-12-25", "2027-01-01", "2027-05-31", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-25"] }}'), type: 'array' },
          { id: 'services', name: 'SERVICES', value: expr('{{ { "oil_change": { "label": "Oil change", "minutes": 45 }, "tire_rotation": { "label": "Tire rotation", "minutes": 30 }, "brakes": { "label": "Brake service", "minutes": 120 }, "diagnostic": { "label": "Diagnostic", "minutes": 60 }, "state_inspection": { "label": "Massachusetts state inspection", "minutes": 30 }, "ac_service": { "label": "AC service", "minutes": 90 }, "alignment": { "label": "Wheel alignment", "minutes": 60 }, "battery": { "label": "Battery test or replacement", "minutes": 30 }, "fluid_service": { "label": "Fluid service", "minutes": 60 }, "pre_purchase": { "label": "Pre-purchase inspection", "minutes": 90 }, "other": { "label": "Other repair (drop-off)", "minutes": 60 } } }}'), type: 'object' }
        ]
      }
    }
  },
  output: [{
    service: 'oil_change', date_from: '2026-10-03', date_to: '2026-10-03', check_start: '',
    CALENDAR_ID: 'e535dd2bcfe011be160cf20a61416d5b25d758750392d5f3973e473dafe47b34@group.calendar.google.com',
    TIMEZONE: 'America/New_York', BAYS: 2, SLOT_STEP_MIN: 30, MIN_NOTICE_HOURS: 2, DAYS_AHEAD: 14,
    BOOKING_HOURS: { '1': ['08:00', '18:00'], '6': ['08:00', '14:00'] },
    HOLIDAYS: ['2026-11-26'],
    SERVICES: { oil_change: { label: 'Oil change', minutes: 45 }, other: { label: 'Other repair (drop-off)', minutes: 60 } }
  }]
});

const workOutWindow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Work Out Window',
    position: [720, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Turn the requested service and dates into a search window on the bookings calendar.\n' +
        'const cfg = $("Config").first().json;\n' +
        'const tz = cfg.TIMEZONE;\n' +
        'const services = cfg.SERVICES;\n' +
        'const key = String(cfg.service ?? "").trim().toLowerCase().replace(/[\\s-]+/g, "_");\n' +
        'const service = services[key] ? key : "other";\n' +
        'const today = DateTime.now().setZone(tz).startOf("day");\n' +
        'const lastDay = today.plus({ days: cfg.DAYS_AHEAD });\n' +
        'const parseDay = s => {\n' +
        '  const d = DateTime.fromISO(String(s ?? "").slice(0, 10), { zone: tz });\n' +
        '  return d.isValid ? d.startOf("day") : null;\n' +
        '};\n' +
        '\n' +
        '// Book Appointment passes check_start to re-check one exact time.\n' +
        'const checkStart = cfg.check_start ? DateTime.fromISO(String(cfg.check_start), { zone: tz }) : null;\n' +
        'const checking = Boolean(checkStart && checkStart.isValid);\n' +
        'let from = checking ? checkStart.startOf("day") : (parseDay(cfg.date_from) ?? today);\n' +
        'if (from < today) from = today;\n' +
        'let to = checking ? from : (parseDay(cfg.date_to) ?? from.plus({ days: 6 }));\n' +
        'if (to < from) to = from;\n' +
        'if (to > from.plus({ days: 7 })) to = from.plus({ days: 7 });\n' +
        'if (to > lastDay) to = lastDay;\n' +
        '\n' +
        'return [{\n' +
        '  json: {\n' +
        '    service,\n' +
        '    service_label: services[service].label,\n' +
        '    duration_minutes: services[service].minutes,\n' +
        '    from: from.toISODate(),\n' +
        '    to: to.toISODate(),\n' +
        '    last_bookable_day: lastDay.toISODate(),\n' +
        '    out_of_range: from > lastDay,\n' +
        '    check_start: checking ? checkStart.toISO() : "",\n' +
        '    time_min: from.toISO(),\n' +
        '    time_max: (to < from ? from : to).endOf("day").toISO()\n' +
        '  }\n' +
        '}];\n'
    }
  },
  output: [{ service: 'oil_change', service_label: 'Oil change', duration_minutes: 45, from: '2026-10-03', to: '2026-10-03', last_bookable_day: '2026-10-15', out_of_range: false, check_start: '', time_min: '2026-10-03T00:00:00.000-04:00', time_max: '2026-10-03T23:59:59.999-04:00' }]
});

const readCalendar = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Read Bookings Calendar',
    position: [960, 300],
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    parameters: {
      resource: 'event',
      operation: 'getAll',
      calendar: { __rl: true, mode: 'id', value: expr("{{ $('Config').item.json.CALENDAR_ID }}") },
      returnAll: true,
      timeMin: expr('{{ $json.time_min }}'),
      timeMax: expr('{{ $json.time_max }}'),
      options: { singleEvents: true, orderBy: 'startTime' }
    },
    credentials: { googleCalendarOAuth2Api: { id: '5G8pvfh0Kjd75Asw', name: 'Google Calendar account' } }
  },
  output: [{ id: 'evt1', summary: 'Oil change: Jane Doe (2018 Honda Civic)', status: 'confirmed', start: { dateTime: '2026-10-03T09:00:00-04:00' }, end: { dateTime: '2026-10-03T09:45:00-04:00' } }]
});

const findFreeSlots = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Find Free Slots',
    position: [1200, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// A start time is free if it is inside booking hours, not a holiday, far enough ahead,\n' +
        '// and fewer than BAYS calendar events overlap the job. An all-day event closes the day.\n' +
        'const cfg = $("Config").first().json;\n' +
        'const w = $("Work Out Window").first().json;\n' +
        'const tz = cfg.TIMEZONE;\n' +
        'const dur = w.duration_minutes;\n' +
        'const fmt = d => d.toFormat("ccc LLL d, h:mm a").replace(" AM", " am").replace(" PM", " pm");\n' +
        '\n' +
        'const busy = $input.all()\n' +
        '  .map(i => i.json)\n' +
        '  .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent")\n' +
        '  .map(e => e.start.date\n' +
        '    ? { start: DateTime.fromISO(e.start.date, { zone: tz }), end: DateTime.fromISO(e.end.date, { zone: tz }), allDay: true }\n' +
        '    : { start: DateTime.fromISO(e.start.dateTime).setZone(tz), end: DateTime.fromISO(e.end.dateTime).setZone(tz), allDay: false });\n' +
        '\n' +
        'const holidays = new Set(cfg.HOLIDAYS);\n' +
        'const earliest = DateTime.now().setZone(tz).plus({ hours: cfg.MIN_NOTICE_HOURS });\n' +
        'const days = [];\n' +
        'for (let d = DateTime.fromISO(w.from, { zone: tz }); d <= DateTime.fromISO(w.to, { zone: tz }); d = d.plus({ days: 1 })) {\n' +
        '  const hours = cfg.BOOKING_HOURS[String(d.weekday)];\n' +
        '  if (!hours || holidays.has(d.toISODate())) continue;\n' +
        '  const [oh, om] = hours[0].split(":").map(Number);\n' +
        '  const [ch, cm] = hours[1].split(":").map(Number);\n' +
        '  const close = d.set({ hour: ch, minute: cm });\n' +
        '  const free = [];\n' +
        '  for (let s = d.set({ hour: oh, minute: om }); s.plus({ minutes: dur }) <= close; s = s.plus({ minutes: cfg.SLOT_STEP_MIN })) {\n' +
        '    if (s < earliest) continue;\n' +
        '    const e = s.plus({ minutes: dur });\n' +
        '    const overlapping = busy.filter(b => b.start < e && b.end > s);\n' +
        '    if (overlapping.some(b => b.allDay) || overlapping.length >= cfg.BAYS) continue;\n' +
        '    free.push(s);\n' +
        '  }\n' +
        '  if (free.length) days.push(free);\n' +
        '}\n' +
        '\n' +
        'const result = { service: w.service, service_label: w.service_label, duration_minutes: dur, from: w.from, to: w.to };\n' +
        '\n' +
        'if (w.check_start) {\n' +
        '  const wanted = DateTime.fromISO(w.check_start).toMillis();\n' +
        '  const available = days.flat().some(s => s.toMillis() === wanted);\n' +
        '  return [{ json: { ...result, available, message: available ? "That time is still free." : "That time is no longer free." } }];\n' +
        '}\n' +
        '\n' +
        '// One day asked for: up to 6 times spread across it. A range: up to 3 a day for the first 4 open days.\n' +
        'const spread = (arr, n) => arr.length <= n ? arr : Array.from({ length: n }, (_, i) => arr[Math.round(i * (arr.length - 1) / (n - 1))]);\n' +
        'const perDay = w.from === w.to ? 6 : 3;\n' +
        'const slots = days.slice(0, 4).flatMap(arr => spread(arr, perDay)).map(s => ({ start: s.toISO(), label: fmt(s) }));\n' +
        '\n' +
        'let message;\n' +
        'if (w.out_of_range) message = "Bookings open up to " + cfg.DAYS_AHEAD + " days ahead, so the latest date is " + w.last_bookable_day + ".";\n' +
        'else if (!slots.length) message = "No free times for " + w.service_label + " between " + w.from + " and " + w.to + ". Offer other dates.";\n' +
        'else message = "Free start times for " + w.service_label + " (about " + dur + " minutes). Offer up to 3. Pass the chosen start value to book_appointment exactly as given.";\n' +
        '\n' +
        'return [{ json: { ...result, slots, message } }];\n'
    }
  },
  output: [{ service: 'oil_change', service_label: 'Oil change', duration_minutes: 45, from: '2026-10-03', to: '2026-10-03', slots: [{ start: '2026-10-03T08:00:00.000-04:00', label: 'Sat Oct 3, 8:00 am' }], message: 'Free start times for Oil change (about 45 minutes).' }]
});

const note = sticky(
  '## Check Availability (agent tool)\n' +
  'Called by the chat agent as `check_availability`, and by **Support Bot 4** to re-check a time just before booking.\n\n' +
  '- Reads the **Copperline Bookings** calendar for the requested days.\n' +
  '- A start time is free when it is inside booking hours, not a holiday, at least `MIN_NOTICE_HOURS` away, and fewer than `BAYS` bookings overlap the job.\n' +
  '- **An all-day event closes that day**, so the owner can block a day straight from Google Calendar.\n' +
  '- Returns up to 3 times a day (6 if one day was asked for), each with the exact `start` value the booking tool needs.\n\n' +
  'Services, durations, hours and holidays live in **Config**.',
  [whenCalled, config, workOutWindow, readCalendar, findFreeSlots],
  { color: 4 }
);

export default workflow('support-bot-check-availability', 'Support Bot 3: Check Availability')
  .add(whenCalled)
  .to(config)
  .to(workOutWindow)
  .to(readCalendar)
  .to(findFreeSlots)
  .add(note);
