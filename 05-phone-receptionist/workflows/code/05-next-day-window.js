// The next day the clinic is open (tomorrow, or Monday after a Friday), for the schedule preview.
const tz = "America/Chicago";
const open = { 1: true, 2: true, 3: true, 4: true, 5: true };
const holidays = ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"];
const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
let d = DateTime.now().setZone(tz).startOf("day").plus({ days: 1 });
while (!open[d.weekday] || holidays.includes(d.toISODate())) d = d.plus({ days: 1 });
return [{ json: { ...settings, next_day: d.toISODate(), time_min: d.toISO(), time_max: d.endOf("day").toISO() } }];
