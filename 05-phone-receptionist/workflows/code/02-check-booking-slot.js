// @include lib-slots.js
// Is the chosen start still free? If not, offer the other free times that day.
const p = $("Prepare Booking").first().json;
const now = DateTime.now().setZone(SLOT.TZ);
const start = DateTime.fromISO(p.start, { zone: SLOT.TZ });
const free = freeStarts(start.startOf("day"), p.type, busyFrom($input.all().map(i => i.json)), now);
if (free.some(s => +s === +start)) return [{ json: { ...p, free: true } }];
const others = free.slice(0, 4);
return [{
  json: {
    ...p,
    free: false,
    result: "Not booked: " + say(start) + " is no longer available" +
      (others.length ? ". Other free times that day: " + others.map(s => say(s) + " [start " + startValue(s) + "]").join("; ") + ". Offer these." : ". Nothing else is free that day; call check_availability for another day."),
  },
}];
