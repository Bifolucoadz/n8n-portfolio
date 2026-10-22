// @include lib-slots.js
// Turn the model's dates into a search window. Searches one more week past it so that
// "nothing free on Tuesday" can come back with the nearest alternatives in the same turn.
const c = $("Config").first().json;
const a = c.args ?? {};
const now = DateTime.now().setZone(SLOT.TZ);
const today = now.startOf("day");
const last = today.plus({ days: SLOT.DAYS_AHEAD });
const parseDay = s => {
  const d = DateTime.fromISO(String(s ?? "").slice(0, 10), { zone: SLOT.TZ });
  return d.isValid ? d.startOf("day") : null;
};
let from = parseDay(a.date_from) ?? today;
if (from < today) from = today;
let to = parseDay(a.date_to) ?? from;
if (to < from) to = from;
if (to > from.plus({ days: 13 })) to = from.plus({ days: 13 });
const outOfRange = from > last;
if (outOfRange) { from = last; to = last; }
if (to > last) to = last;
const searchEnd = DateTime.min(to.plus({ days: 7 }), last);
const tod = String(a.time_of_day ?? "").toLowerCase();
return [{
  json: {
    tool_call_id: c.tool_call_id,
    type: typeKey(a.appointment_type),
    from: from.toISODate(),
    to: to.toISODate(),
    search_end: searchEnd.toISODate(),
    time_of_day: ["morning", "afternoon"].includes(tod) ? tod : "any",
    out_of_range: outOfRange,
    last_day: last.toISODate(),
    time_min: from.toISO(),
    time_max: searchEnd.endOf("day").toISO(),
  },
}];
