import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1_RHqBp7k3rWBY-4plb2oo2mIryQlHIUuNOZ-YhCpVS8' };
const BOOKINGS_TAB = { __rl: true, mode: 'id', value: '1', cachedResultName: 'Bookings' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };

const BOOKING_SAMPLE = {
  ok: true, message: '', dry_run: false, booking_ref: 'CA-7Q2KD', service: 'oil_change', service_label: 'Oil change',
  start: '2026-10-03T08:00:00.000-04:00', end: '2026-10-03T08:45:00.000-04:00', label: 'Sat Oct 3, 8:00 am',
  customer_name: 'Jane Doe', first_name: 'Jane', email: 'jane@example.com', phone: '(617) 555-0110',
  vehicle: '2018 Honda Civic', notes: 'Oil light came on', session_id: 'b1f2c3d4',
  send_to: 'oladelesamuel56@gmail.com', subject: '[TEST to jane@example.com] Your Copperline booking: Sat Oct 3, 8:00 am',
  created_at: '2026-10-01T10:40:00.000-04:00'
};

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
          { name: 'start', type: 'string' },
          { name: 'customer_name', type: 'string' },
          { name: 'phone', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'vehicle', type: 'string' },
          { name: 'notes', type: 'string' },
          { name: 'session_id', type: 'string' },
          { name: 'dry_run', type: 'boolean' }
        ]
      }
    }
  },
  output: [{ service: 'oil_change', start: '2026-10-03T08:00:00.000-04:00', customer_name: 'Jane Doe', phone: '(617) 555-0110', email: 'jane@example.com', vehicle: '2018 Honda Civic', notes: 'Oil light came on', session_id: 'b1f2c3d4', dry_run: false }]
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
          { id: 'test-mode', name: 'TEST_MODE', value: true, type: 'boolean' },
          { id: 'test-inbox', name: 'TEST_INBOX', value: 'oladelesamuel56@gmail.com', type: 'string' },
          { id: 'calendar-id', name: 'CALENDAR_ID', value: 'e535dd2bcfe011be160cf20a61416d5b25d758750392d5f3973e473dafe47b34@group.calendar.google.com', type: 'string' },
          { id: 'timezone', name: 'TIMEZONE', value: 'America/New_York', type: 'string' },
          { id: 'shop-phone', name: 'SHOP_PHONE', value: '(617) 555-0142', type: 'string' },
          { id: 'max-bookings', name: 'MAX_BOOKINGS_PER_SESSION', value: 2, type: 'number' }
        ]
      }
    }
  },
  output: [{ service: 'oil_change', start: '2026-10-03T08:00:00.000-04:00', customer_name: 'Jane Doe', phone: '(617) 555-0110', email: 'jane@example.com', vehicle: '2018 Honda Civic', notes: 'Oil light came on', session_id: 'b1f2c3d4', dry_run: false, TEST_MODE: true, TEST_INBOX: 'oladelesamuel56@gmail.com', CALENDAR_ID: 'e535dd2bcfe011be160cf20a61416d5b25d758750392d5f3973e473dafe47b34@group.calendar.google.com', TIMEZONE: 'America/New_York', SHOP_PHONE: '(617) 555-0142', MAX_BOOKINGS_PER_SESSION: 2 }]
});

const readSessionBookings = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Session Bookings',
    position: [680, 300],
    alwaysOutputData: true,
    executeOnce: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      documentId: SHEET_DOC,
      sheetName: BOOKINGS_TAB,
      filtersUI: { values: [{ lookupColumn: 'session_id', lookupValue: expr('{{ $json.session_id }}') }] },
      options: { returnAllMatches: 'returnAllMatches' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, booking_ref: 'CA-1AAAA', session_id: 'b1f2c3d4' }]
});

const recheckTime = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Re-check Time',
    position: [900, 300],
    executeOnce: true,
    parameters: {
      mode: 'once',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'b4jIqNyj0KBxac3L', cachedResultName: 'Support Bot 3: Check Availability' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          service: expr("{{ $('Config').first().json.service }}"),
          date_from: '',
          date_to: '',
          check_start: expr("{{ $('Config').first().json.start }}")
        },
        schema: [
          { id: 'service', displayName: 'service', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'date_from', displayName: 'date_from', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'date_to', displayName: 'date_to', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'check_start', displayName: 'check_start', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
        ]
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ service: 'oil_change', service_label: 'Oil change', duration_minutes: 45, from: '2026-10-03', to: '2026-10-03', available: true, message: 'That time is still free.' }]
});

const checkBooking = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Check Booking',
    position: [1120, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Book only if the details are valid, the chat is under its booking limit, and the time is still free.\n' +
        'const cfg = $("Config").first().json;\n' +
        'const check = $("Re-check Time").first().json;\n' +
        'const previous = $("Read Session Bookings").all().map(i => i.json).filter(r => r.booking_ref && r.session_id === cfg.session_id).length;\n' +
        '// Strip links and cap lengths: these fields end up in an email to the address the customer typed.\n' +
        'const clean = (v, max) => String(v ?? "").replace(/https?:\\/\\/\\S+|www\\.\\S+/gi, "").replace(/\\s+/g, " ").trim().slice(0, max);\n' +
        'const name = clean(cfg.customer_name, 60);\n' +
        'const email = clean(cfg.email, 100).toLowerCase();\n' +
        'const phone = clean(cfg.phone, 30);\n' +
        'const vehicle = clean(cfg.vehicle, 60);\n' +
        'const notes = clean(cfg.notes, 500);\n' +
        'const start = DateTime.fromISO(String(cfg.start ?? ""), { zone: cfg.TIMEZONE });\n' +
        '\n' +
        'const missing = [];\n' +
        'if (name.length < 2) missing.push("the customer\'s name");\n' +
        'if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) missing.push("a valid email address");\n' +
        'if (phone.replace(/\\D/g, "").length < 10) missing.push("a phone number with at least 10 digits");\n' +
        'if (vehicle.length < 3) missing.push("the vehicle\'s year, make and model");\n' +
        'if (!start.isValid) missing.push("a start time copied exactly from check_availability");\n' +
        '\n' +
        'let message = "";\n' +
        'if (missing.length) {\n' +
        '  message = "Not booked. Still needed: " + missing.join(", ") + ".";\n' +
        '} else if (previous >= cfg.MAX_BOOKINGS_PER_SESSION) {\n' +
        '  message = "Not booked: this chat already has " + previous + " bookings, the most allowed. Ask the customer to call " + cfg.SHOP_PHONE + " for more.";\n' +
        '} else if (check.available !== true) {\n' +
        '  message = "Not booked: that time is no longer free. Call check_availability again and offer other times.";\n' +
        '}\n' +
        '\n' +
        'const label = start.isValid ? start.toFormat("ccc LLL d, h:mm a").replace(" AM", " am").replace(" PM", " pm") : "";\n' +
        'const testMode = cfg.TEST_MODE === true || cfg.TEST_MODE === "true";\n' +
        'return [{\n' +
        '  json: {\n' +
        '    ok: !message,\n' +
        '    message,\n' +
        '    dry_run: cfg.dry_run === true || cfg.dry_run === "true",\n' +
        '    booking_ref: "CA-" + Math.random().toString(36).slice(2, 7).toUpperCase(),\n' +
        '    service: check.service ?? "other",\n' +
        '    service_label: check.service_label ?? "Other repair (drop-off)",\n' +
        '    start: start.isValid ? start.toISO() : "",\n' +
        '    end: start.isValid ? start.plus({ minutes: check.duration_minutes ?? 60 }).toISO() : "",\n' +
        '    label,\n' +
        '    customer_name: name,\n' +
        '    first_name: name.split(" ")[0],\n' +
        '    email,\n' +
        '    phone,\n' +
        '    vehicle,\n' +
        '    notes,\n' +
        '    session_id: cfg.session_id,\n' +
        '    send_to: testMode ? cfg.TEST_INBOX : email,\n' +
        '    subject: (testMode ? "[TEST to " + email + "] " : "") + "Your Copperline booking: " + label,\n' +
        '    created_at: DateTime.now().setZone(cfg.TIMEZONE).toISO()\n' +
        '  }\n' +
        '}];\n'
    }
  },
  output: [BOOKING_SAMPLE]
});

const okToBook = ifElse({
  version: 2.3,
  config: {
    name: 'OK to Book?',
    position: [1340, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const isDryRun = ifElse({
  version: 2.3,
  config: {
    name: 'Dry Run?',
    position: [1560, 200],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.dry_run }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const dryRunResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Dry Run Result',
    position: [1780, 60],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'success', name: 'success', value: true, type: 'boolean' },
          { id: 'ref', name: 'booking_ref', value: expr('DRYRUN-{{ $json.booking_ref }}'), type: 'string' },
          { id: 'when', name: 'when', value: expr('{{ $json.label }}'), type: 'string' },
          { id: 'message', name: 'message', value: 'Test run: the details are valid and the time is free. Nothing was booked.', type: 'string' }
        ]
      }
    }
  },
  output: [{ success: true, booking_ref: 'DRYRUN-CA-7Q2KD', when: 'Sat Oct 3, 8:00 am', message: 'Test run: nothing was booked.' }]
});

const createEvent = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Create Calendar Event',
    position: [1780, 260],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    parameters: {
      resource: 'event',
      operation: 'create',
      calendar: { __rl: true, mode: 'id', value: expr("{{ $('Config').item.json.CALENDAR_ID }}") },
      start: expr('{{ $json.start }}'),
      end: expr('{{ $json.end }}'),
      additionalFields: {
        summary: expr('{{ $json.service_label }}: {{ $json.customer_name }} ({{ $json.vehicle }})'),
        description: expr(
          'Booking ref: {{ $json.booking_ref }}\n' +
          'Customer: {{ $json.customer_name }}\n' +
          'Phone: {{ $json.phone }}\n' +
          'Email: {{ $json.email }}\n' +
          'Vehicle: {{ $json.vehicle }}\n' +
          'Notes: {{ $json.notes || "none" }}\n\n' +
          'Booked by the website chat assistant (session {{ $json.session_id }}).'
        ),
        location: '84 Foundry Lane, Allston, MA 02134',
        sendUpdates: 'none'
      }
    },
    credentials: { googleCalendarOAuth2Api: { id: '5G8pvfh0Kjd75Asw', name: 'Google Calendar account' } }
  },
  output: [{ id: 'evt123', htmlLink: 'https://www.google.com/calendar/event?eid=evt123', status: 'confirmed' }]
});

const logBooking = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Log Booking',
    position: [2000, 260],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: SHEET_DOC,
      sheetName: BOOKINGS_TAB,
      columns: {
        mappingMode: 'defineBelow',
        value: {
          booking_ref: expr("{{ $('Check Booking').item.json.booking_ref }}"),
          created_at: expr("{{ $('Check Booking').item.json.created_at }}"),
          appointment_start: expr("{{ $('Check Booking').item.json.start }}"),
          appointment_end: expr("{{ $('Check Booking').item.json.end }}"),
          service: expr("{{ $('Check Booking').item.json.service }}"),
          customer_name: expr("{{ $('Check Booking').item.json.customer_name }}"),
          phone: expr("{{ $('Check Booking').item.json.phone }}"),
          email: expr("{{ $('Check Booking').item.json.email }}"),
          vehicle: expr("{{ $('Check Booking').item.json.vehicle }}"),
          notes: expr("{{ $('Check Booking').item.json.notes }}"),
          calendar_event_id: expr('{{ $json.id }}'),
          session_id: expr("{{ $('Check Booking').item.json.session_id }}"),
          status: 'booked'
        },
        schema: [
          { id: 'booking_ref', displayName: 'booking_ref', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'appointment_start', displayName: 'appointment_start', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'appointment_end', displayName: 'appointment_end', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'service', displayName: 'service', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'customer_name', displayName: 'customer_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'vehicle', displayName: 'vehicle', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'calendar_event_id', displayName: 'calendar_event_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true }
    },
    credentials: SHEETS_CRED
  },
  output: [{ booking_ref: 'CA-7Q2KD', status: 'booked' }]
});

const sendConfirmation = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send Confirmation',
    position: [2220, 260],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr("{{ $('Check Booking').item.json.send_to }}"),
      subject: expr("{{ $('Check Booking').item.json.subject }}"),
      emailType: 'text',
      message: expr(
        "Hi {{ $('Check Booking').item.json.first_name }},\n\n" +
        "You're booked in at Copperline Auto Repair.\n\n" +
        "Reference: {{ $('Check Booking').item.json.booking_ref }}\n" +
        "Service: {{ $('Check Booking').item.json.service_label }}\n" +
        "Drop-off: {{ $('Check Booking').item.json.label }}\n" +
        "Vehicle: {{ $('Check Booking').item.json.vehicle }}\n\n" +
        'Where: 84 Foundry Lane, Allston, MA 02134 (free parking out front)\n' +
        "Please bring your keys{{ $('Check Booking').item.json.service === 'state_inspection' ? ' and your vehicle registration' : '' }}. Most jobs are done the same day, and we'll text you when your car is ready.\n\n" +
        "Need to change or cancel? Reply to this email or call {{ $('Config').item.json.SHOP_PHONE }} at least 4 hours before. There's no cancellation fee.\n\n" +
        'See you soon,\n' +
        'Copperline Auto Repair\n\n' +
        '--\n' +
        'This booking was made through a demo of an AI chat assistant. Copperline Auto Repair is a fictional shop.\n'
      ),
      options: { appendAttribution: false, senderName: 'Copperline Auto Repair' }
    },
    credentials: { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } }
  },
  output: [{ id: '18f0b', threadId: '18f0b', labelIds: ['SENT'] }]
});

const bookingResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Booking Result',
    position: [2440, 260],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'success', name: 'success', value: true, type: 'boolean' },
          { id: 'ref', name: 'booking_ref', value: expr("{{ $('Check Booking').item.json.booking_ref }}"), type: 'string' },
          { id: 'when', name: 'when', value: expr("{{ $('Check Booking').item.json.label }}"), type: 'string' },
          { id: 'service', name: 'service', value: expr("{{ $('Check Booking').item.json.service_label }}"), type: 'string' },
          { id: 'message', name: 'message', value: 'Booked. Give the customer the booking reference and say a confirmation email is on its way.', type: 'string' }
        ]
      }
    }
  },
  output: [{ success: true, booking_ref: 'CA-7Q2KD', when: 'Sat Oct 3, 8:00 am', service: 'Oil change', message: 'Booked.' }]
});

const notBooked = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Not Booked',
    position: [1560, 440],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'success', name: 'success', value: false, type: 'boolean' },
          { id: 'message', name: 'message', value: expr('{{ $json.message }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ success: false, message: 'Not booked: that time is no longer free.' }]
});

const noteOverview = sticky(
  '## Book Appointment (agent tool)\n' +
  'Called by the chat agent as `book_appointment` once the customer has confirmed the details.\n\n' +
  '- Checks the details (email, phone, name, vehicle, a real start time).\n' +
  '- At most `MAX_BOOKINGS_PER_SESSION` bookings per chat.\n' +
  '- **Re-checks the time with Support Bot 3** right before booking, so two customers cannot take the last bay.\n' +
  '- Eval runs pass `dry_run = true`: everything is checked but nothing is booked or sent.',
  [whenCalled, config, readSessionBookings, recheckTime, checkBooking, okToBook, isDryRun, dryRunResult, notBooked],
  { color: 4 }
);

const noteBook = sticky(
  '## Book, log, confirm\n' +
  'Creates the calendar event (no Google invite to the customer), logs the row in **Bookings**, and sends a fixed-template confirmation. The email text is not written by the AI, so the chat cannot be used to send arbitrary emails.\n\n' +
  '`TEST_MODE` in **Config** sends every confirmation to `TEST_INBOX` instead.',
  [createEvent, logBooking, sendConfirmation, bookingResult],
  { color: 5 }
);

export default workflow('support-bot-book-appointment', 'Support Bot 4: Book Appointment')
  .add(whenCalled)
  .to(config)
  .to(readSessionBookings)
  .to(recheckTime)
  .to(checkBooking)
  .to(okToBook
    .onTrue(isDryRun
      .onTrue(dryRunResult)
      .onFalse(createEvent.to(logBooking).to(sendConfirmation).to(bookingResult)))
    .onFalse(notBooked))
  .add(noteOverview)
  .add(noteBook);
