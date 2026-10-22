// Logic tests for Receptionist 1 and 2 Code nodes: node workflows/test/logic.test.js
const assert = require('assert');
const { run, DateTime } = require('./harness');

const TZ = 'America/Chicago';
const now = DateTime.now().setZone(TZ);
// Next Tuesday at least 2 days out, so notice periods never interfere.
let tue = now.startOf('day').plus({ days: 2 });
while (tue.weekday !== 2) tue = tue.plus({ days: 1 });
const iso = d => d.toISO({ suppressMilliseconds: true });
const at = (d, h, m = 0) => d.set({ hour: h, minute: m });
const ev = (id, s, e, extra = {}) => ({ id, status: 'confirmed', start: { dateTime: iso(s) }, end: { dateTime: iso(e) }, ...extra });
const config = (name, args, extra = {}) => ({ Config: [{ tool_call_id: 'tc1', name, args, caller_number: '+15125550123', call_id: 'c1', calendar_id: 'cal', sheet_id: 'sh', staff_chat_id: '42', ...extra }] });

(async () => {
  let n = 0;
  const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

  // Unpack: secret check and argument parsing (string or object).
  const req = (key, body) => ({ 'Vapi Tool Request': [{ headers: { 'x-fernhollow-key': key }, body }], 'Read Settings': [{ key: 'webhook_secret', value: 's3cret' }, { key: 'calendar_id', value: 'cal' }] });
  const body = { message: { type: 'tool-calls', call: { id: 'c1', type: 'inboundPhoneCall', customer: { number: '+15125550123' } }, toolCallList: [{ id: 'a', type: 'function', function: { name: 'check_availability', arguments: '{"appointment_type":"cleaning"}' } }, { id: 'b', type: 'function', function: { name: 'find_appointment', arguments: { phone: '512 555 0123' } } }] } };
  let out = await run('01-unpack-calls.js', req('wrong', body));
  ok(out.length === 1 && out[0].json.authorized === false, 'bad secret is rejected');
  out = await run('01-unpack-calls.js', req('s3cret', body));
  ok(out.length === 2 && out[0].json.args.appointment_type === 'cleaning' && out[1].json.args.phone === '512 555 0123', 'two calls unpacked, args parsed');
  ok(out[0].json.caller_number === '+15125550123' && out[0].json.calendar_id === 'cal', 'caller number and settings attached');

  // Pack: results matched by id, missing ones get the fallback, newlines flattened.
  const packed = await run('01-pack-results.js', { 'Unpack Calls': out }, [{ json: { tool_call_id: 'b', result: 'line one\nline two' } }]);
  ok(packed[0].json.results.length === 2 && /didn't respond/.test(packed[0].json.results[0].result) && packed[0].json.results[1].result === 'line one line two', 'results packed per call');

  // Availability on Tuesday with 9-10 and 13-15 busy.
  const win = await run('02-work-out-window.js', config('check_availability', { appointment_type: 'cleaning', date_from: tue.toISODate() }));
  ok(win[0].json.type === 'cleaning' && win[0].json.from === tue.toISODate() && win[0].json.to === tue.toISODate(), 'window for one day');
  const busy = [ev('e1', at(tue, 9), at(tue, 10)), ev('e2', at(tue, 13), at(tue, 15))];
  let slots = await run('02-find-free-slots.js', { 'Work Out Window': win }, busy.map(json => ({ json })));
  let r = slots[0].json.result;
  ok(/Free times for Cleaning and check-up/.test(r), 'free times returned');
  ok(!/at 9 AM \[/.test(r) && !/at 1 PM \[/.test(r) && !/at 2 PM \[/.test(r) && !/at 12/.test(r), 'busy times and lunch excluded: ' + r);
  ok(!/at 4:30 PM/.test(r), '60-minute cleaning cannot start at 4:30');

  // A Saturday: closed, so the nearest alternatives come back.
  const sat = tue.plus({ days: 4 });
  const winSat = await run('02-work-out-window.js', config('check_availability', { appointment_type: 'emergency', date_from: sat.toISODate() }));
  slots = await run('02-find-free-slots.js', { 'Work Out Window': winSat }, [{ json: {} }]);
  r = slots[0].json.result;
  ok(/closed on Saturday/.test(r) && /Nearest alternatives/.test(r) && /Monday/.test(r), 'closed day falls through to Monday: ' + r);

  // Unknown type.
  const winX = await run('02-work-out-window.js', config('check_availability', { appointment_type: 'tattoo' }));
  slots = await run('02-find-free-slots.js', { 'Work Out Window': winX }, [{ json: {} }]);
  ok(/Unknown appointment type/.test(slots[0].json.result), 'unknown type asks to clarify');

  // Booking: validation, then slot check.
  let prep = await run('02-prepare-booking.js', config('book_appointment', { appointment_type: 'cleaning', start: iso(at(tue, 10)), patient_name: 'Jane' }));
  ok(prep[0].json.ok === false && /first and last name/.test(prep[0].json.result), 'single name rejected');
  prep = await run('02-prepare-booking.js', config('book_appointment', { appointment_type: 'cleaning', start: iso(at(tue, 10)), patient_name: 'Jane Doe' }));
  const p = prep[0].json;
  ok(p.ok && /^FD-[A-Z2-9]{4}$/.test(p.code) && p.phone === '+15125550123' && /Phone: \+15125550123/.test(p.description), 'booking prepared with caller number and code');
  let chk = await run('02-check-booking-slot.js', { 'Prepare Booking': prep }, busy.map(json => ({ json })));
  ok(chk[0].json.free === true, '10 AM is free');
  prep = await run('02-prepare-booking.js', config('book_appointment', { appointment_type: 'cleaning', start: iso(at(tue, 9, 30)), patient_name: 'Jane Doe' }));
  chk = await run('02-check-booking-slot.js', { 'Prepare Booking': prep }, busy.map(json => ({ json })));
  ok(chk[0].json.free === false && /no longer available/.test(chk[0].json.result) && /at 10 AM \[start/.test(chk[0].json.result), '9:30 overlaps, alternatives offered');
  const booked = await run('02-booked-result.js', { 'Check Booking Slot': [{ ...p, free: true }] }, [{ json: { id: 'evtX' } }]);
  ok(/Confirmation code FD-/.test(booked[0].json.result) && /dash/.test(booked[0].json.result), 'booked result spells the code');

  // Find / cancel / reschedule.
  const desc = 'Confirmation: FD-7K2Q\nPatient: Jane Doe\nPhone: +15125550123\nType: Cleaning and check-up\nType key: cleaning';
  const appt = ev('evt123', at(tue, 10), at(tue, 11), { summary: 'Cleaning and check-up: Jane Doe', description: desc });
  const other = ev('evt999', at(tue, 14), at(tue, 15), { description: 'Confirmation: FD-ZZZZ\nPatient: Bob Roe\nPhone: +17375550000\nType: Emergency exam\nType key: emergency' });
  const upcoming = [appt, other].map(json => ({ json }));
  let m = await run('02-match-appointments.js', config('find_appointment', {}), upcoming);
  ok(m[0].json.action === 'reply' && /Jane Doe/.test(m[0].json.result) && !/Bob/.test(m[0].json.result), 'found by caller number only');
  m = await run('02-match-appointments.js', config('find_appointment', { confirmation_code: '7 k 2 q' }, { caller_number: '' }), upcoming);
  ok(/FD-7K2Q/.test(m[0].json.result), 'found by spoken code without FD');
  m = await run('02-match-appointments.js', config('cancel_appointment', { confirmation_code: 'FD-7K2Q' }), upcoming);
  ok(m[0].json.action === 'delete' && m[0].json.event_id === 'evt123', 'cancel goes to delete');
  m = await run('02-match-appointments.js', config('cancel_appointment', { confirmation_code: 'FD-AAAA' }, { caller_number: '+19999999999' }), upcoming);
  ok(m[0].json.action === 'reply' && /No upcoming appointment/.test(m[0].json.result), 'unknown code and number: nothing found');
  m = await run('02-match-appointments.js', config('reschedule_appointment', { confirmation_code: 'FD-7K2Q', new_start: iso(at(tue, 9)) }), upcoming);
  ok(m[0].json.action === 'move' && m[0].json.type === 'cleaning', 'reschedule prepared');
  const mv = await run('02-check-move-slot.js', { 'Match Appointments': m }, [appt].map(json => ({ json })));
  ok(mv[0].json.free === true, 'moving to 9 AM ignores the appointment itself');
  const mv2 = await run('02-check-move-slot.js', { 'Match Appointments': [{ json: { ...m[0].json, start: iso(at(tue, 13, 30)), end: iso(at(tue, 14, 30)) } }] }, [appt, other].map(json => ({ json })));
  ok(mv2[0].json.free === false, 'moving onto another appointment is refused');

  // Messages.
  let msg = await run('02-prepare-message.js', config('take_message', { caller_name: 'Jane Doe', message: 'Question about my bill', urgent: false }));
  ok(msg[0].json.ok && msg[0].json.row.phone === '+15125550123' && /New message/.test(msg[0].json.telegram), 'message prepared with caller number');
  msg = await run('02-prepare-message.js', config('take_message', { caller_name: '', message: 'x' }, { caller_number: '' }));
  ok(!msg[0].json.ok && /name/.test(msg[0].json.missing), 'incomplete message rejected');

  console.log('all ' + n + ' checks passed');
})().catch(e => { console.error(e.message); process.exit(1); });
