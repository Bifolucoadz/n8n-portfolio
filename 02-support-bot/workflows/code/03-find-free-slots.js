// A start time is free if it is inside booking hours, not a holiday, far enough ahead,
// and fewer than BAYS calendar events overlap the job. An all-day event closes the day.
const cfg = $("Config").first().json;
const w = $("Work Out Window").first().json;
const tz = cfg.TIMEZONE;
const dur = w.duration_minutes;
const fmt = d => d.toFormat("ccc LLL d, h:mm a").replace(" AM", " am").replace(" PM", " pm");

const busy = $input.all()
  .map(i => i.json)
  .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent")
  .map(e => e.start.date
    ? { start: DateTime.fromISO(e.start.date, { zone: tz }), end: DateTime.fromISO(e.end.date, { zone: tz }), allDay: true }
    : { start: DateTime.fromISO(e.start.dateTime).setZone(tz), end: DateTime.fromISO(e.end.dateTime).setZone(tz), allDay: false });

const holidays = new Set(cfg.HOLIDAYS);
const earliest = DateTime.now().setZone(tz).plus({ hours: cfg.MIN_NOTICE_HOURS });
const days = [];
for (let d = DateTime.fromISO(w.from, { zone: tz }); d <= DateTime.fromISO(w.to, { zone: tz }); d = d.plus({ days: 1 })) {
  const hours = cfg.BOOKING_HOURS[String(d.weekday)];
  if (!hours || holidays.has(d.toISODate())) continue;
  const [oh, om] = hours[0].split(":").map(Number);
  const [ch, cm] = hours[1].split(":").map(Number);
  const close = d.set({ hour: ch, minute: cm });
  const free = [];
  for (let s = d.set({ hour: oh, minute: om }); s.plus({ minutes: dur }) <= close; s = s.plus({ minutes: cfg.SLOT_STEP_MIN })) {
    if (s < earliest) continue;
    const e = s.plus({ minutes: dur });
    const overlapping = busy.filter(b => b.start < e && b.end > s);
    if (overlapping.some(b => b.allDay) || overlapping.length >= cfg.BAYS) continue;
    free.push(s);
  }
  if (free.length) days.push(free);
}

const result = { service: w.service, service_label: w.service_label, duration_minutes: dur, from: w.from, to: w.to };

if (w.check_start) {
  const wanted = DateTime.fromISO(w.check_start).toMillis();
  const available = days.flat().some(s => s.toMillis() === wanted);
  return [{ json: { ...result, available, message: available ? "That time is still free." : "That time is no longer free." } }];
}

// One day asked for: up to 6 times spread across it. A range: up to 3 a day for the first 4 open days.
const spread = (arr, n) => arr.length <= n ? arr : Array.from({ length: n }, (_, i) => arr[Math.round(i * (arr.length - 1) / (n - 1))]);
const perDay = w.from === w.to ? 6 : 3;
const slots = days.slice(0, 4).flatMap(arr => spread(arr, perDay)).map(s => ({ start: s.toISO(), label: fmt(s) }));

let message;
if (w.out_of_range) message = "Bookings open up to " + cfg.DAYS_AHEAD + " days ahead, so the latest date is " + w.last_bookable_day + ".";
else if (!slots.length) message = "No free times for " + w.service_label + " between " + w.from + " and " + w.to + ". Offer other dates.";
else message = "Free start times for " + w.service_label + " (about " + dur + " minutes). Offer up to 3. Pass the chosen start value to book_appointment exactly as given.";

return [{ json: { ...result, slots, message } }];
