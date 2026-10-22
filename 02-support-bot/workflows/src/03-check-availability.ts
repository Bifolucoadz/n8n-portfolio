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
__WORK_OUT_WINDOW__
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
__FIND_FREE_SLOTS__
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
