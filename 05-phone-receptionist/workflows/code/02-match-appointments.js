// @include lib-slots.js
// find_appointment / cancel_appointment / reschedule_appointment: find the caller's appointment
// by confirmation code (or the last 4 characters of it), else by the phone number it was booked
// with. Decides the next step: reply, delete, or move (after a slot check).
const c = $("Config").first().json;
const a = c.args ?? {};
const now = DateTime.now().setZone(SLOT.TZ);
const reply = result => [{ json: { action: "reply", tool_call_id: c.tool_call_id, result } }];

const appts = $input.all().map(i => i.json)
  .filter(e => e && e.id && e.status !== "cancelled")
  .map(parseAppointment)
  .filter(x => x.code && x.start && x.start > now)
  .sort((x, y) => x.start - y.start);
const wanted = String(a.confirmation_code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const phone = digits10(a.phone) || digits10(c.caller_number);
let hits = [];
if (wanted.length >= 4) hits = appts.filter(x => x.code.replace(/[^A-Z0-9]/g, "").endsWith(wanted.slice(-4)));
if (!hits.length && phone.length === 10) hits = appts.filter(x => x.phone === phone);
const describe = x => x.type_label + " for " + x.name + " on " + say(x.start) + ", confirmation " + x.code;

if (!hits.length) {
  return reply("No upcoming appointment found for " + (wanted ? "that confirmation code" : "") + (wanted && phone ? " or " : "") + (phone ? "that phone number" : "") +
    (!wanted && !phone ? "nothing (ask for the confirmation code or the phone number used to book)" : "") +
    ". Ask them to check the code or the number they booked with, or offer to take a message.");
}
if (c.name === "find_appointment") {
  return reply("Found " + hits.length + " upcoming appointment" + (hits.length > 1 ? "s" : "") + ": " + hits.map(describe).join("; ") + ".");
}
if (hits.length > 1) {
  return reply("That number has " + hits.length + " upcoming appointments: " + hits.map(describe).join("; ") + ". Ask which one, then call again with its confirmation code.");
}
const x = hits[0];
if (c.name === "cancel_appointment") {
  const late = x.start.diff(now, "hours").hours < 24;
  return [{ json: { action: "delete", tool_call_id: c.tool_call_id, event_id: x.id, calendar_id: c.calendar_id, appointment: describe(x), late } }];
}
// reschedule_appointment
const type = typeKey(x.type) || typeKey(x.type_label) || "cleaning";
const t = SLOT.TYPES[type];
const ns = DateTime.fromISO(String(a.new_start ?? ""), { setZone: true });
if (!ns.isValid) return reply("Found " + describe(x) + ". To move it, call check_availability for " + t.label + " and pass the chosen start value as new_start.");
const s = ns.setZone(SLOT.TZ);
return [{
  json: {
    action: "move",
    tool_call_id: c.tool_call_id,
    calendar_id: c.calendar_id,
    event_id: x.id,
    type,
    type_label: t.label,
    code: x.code,
    name: x.name,
    old_start: x.start.toISO(),
    start: s.toISO(),
    end: s.plus({ minutes: t.minutes }).toISO(),
    time_min: s.startOf("day").toISO(),
    time_max: s.endOf("day").toISO(),
    description: x.description + "\nRescheduled by Nora on " + now.toFormat("LLL d, h:mm a") + " (was " + say(x.start) + ").",
  },
}];
