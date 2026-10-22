// @include lib-slots.js
// Free start times in the requested window, spread across the day(s); if none, the nearest ones
// in the following week. The result is one line the voice model can turn into speech.
const w = $("Work Out Window").first().json;
const reply = result => [{ json: { tool_call_id: w.tool_call_id, result } }];
if (!w.type) return reply("Unknown appointment type. Ask whether it's a new patient exam, a cleaning and check-up, an emergency visit, or a cosmetic or Invisalign consultation.");

const t = SLOT.TYPES[w.type];
const now = DateTime.now().setZone(SLOT.TZ);
const busy = busyFrom($input.all().map(i => i.json));
const inPart = s => w.time_of_day === "any" || (w.time_of_day === "morning" ? s.hour < 12 : s.hour >= 12);
const days = (a, b) => {
  const out = [];
  for (let d = DateTime.fromISO(a, { zone: SLOT.TZ }); d <= DateTime.fromISO(b, { zone: SLOT.TZ }); d = d.plus({ days: 1 })) out.push(d);
  return out;
};
const collect = list => list.map(d => freeStarts(d, w.type, busy, now).filter(inPart)).filter(g => g.length);
const spread = (arr, n) => (arr.length <= n ? arr : Array.from({ length: n }, (_, i) => arr[Math.round(i * (arr.length - 1) / (n - 1))]));
const pick = groups => (groups.length === 1 ? spread(groups[0], 4) : groups.slice(0, 3).flatMap(g => spread(g, 2)));

const notes = [];
if (w.out_of_range) notes.push("Appointments can be booked up to " + SLOT.DAYS_AHEAD + " days ahead, so the latest day is " + sayDay(w.last_day) + ".");
const asked = days(w.from, w.to);
const closed = asked.filter(d => !isOpen(d));
if (closed.length === asked.length) notes.push("The clinic is closed " + (asked.length === 1 ? "on " + sayDay(asked[0]) : "on those days") + ".");

let groups = collect(asked);
if (!groups.length) {
  const span = w.from === w.to ? "on " + sayDay(w.from) : "between " + sayDay(w.from) + " and " + sayDay(w.to);
  if (closed.length !== asked.length) notes.push("Nothing free " + span + (w.time_of_day === "any" ? "" : " in the " + w.time_of_day) + ".");
  const next = DateTime.fromISO(w.to, { zone: SLOT.TZ }).plus({ days: 1 }).toISODate();
  groups = next <= w.search_end ? collect(days(next, w.search_end)) : [];
  if (groups.length) notes.push("Nearest alternatives:");
}
if (!groups.length) return reply(notes.join(" ") + " No free " + t.label + " times in the following week either. Offer to take a message so the front desk can call back.");

const slots = pick(groups);
return reply(
  notes.join(" ") + (notes.length ? " " : "") +
  "Free times for " + t.label + " (" + t.minutes + " minutes): " +
  slots.map(s => say(s) + " [start " + startValue(s) + "]").join("; ") +
  ". Offer two or three in words. To book, pass the chosen start value exactly."
);
