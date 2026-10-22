// @include lib-slots.js
// Same check as booking, ignoring the appointment being moved.
const p = $("Match Appointments").first().json;
const now = DateTime.now().setZone(SLOT.TZ);
const start = DateTime.fromISO(p.start, { zone: SLOT.TZ });
const free = freeStarts(start.startOf("day"), p.type, busyFrom($input.all().map(i => i.json), p.event_id), now);
if (free.some(s => +s === +start)) return [{ json: { ...p, free: true } }];
const others = free.filter(s => +s !== +start).slice(0, 4);
return [{
  json: {
    ...p,
    free: false,
    result: "Not moved: " + say(start) + " is not available" +
      (others.length ? ". Other free times that day: " + others.map(s => say(s) + " [start " + startValue(s) + "]").join("; ") + "." : ". Call check_availability for another day."),
  },
}];
