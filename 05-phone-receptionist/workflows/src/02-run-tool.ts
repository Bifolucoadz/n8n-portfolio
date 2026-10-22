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
__CONFIG__
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
__WORK_OUT_WINDOW__
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
__FIND_FREE_SLOTS__
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
__PREPARE_BOOKING__
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
__CHECK_BOOKING_SLOT__
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
__BOOKED_RESULT__
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
__MATCH_APPOINTMENTS__
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
__CANCELLED_RESULT__
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
__CHECK_MOVE_SLOT__
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
__MOVED_RESULT__
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
__PREPARE_MESSAGE__
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
__MESSAGE_RESULT__
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
__UNKNOWN_TOOL__
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
