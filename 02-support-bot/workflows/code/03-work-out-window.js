// Turn the requested service and dates into a search window on the bookings calendar.
const cfg = $("Config").first().json;
const tz = cfg.TIMEZONE;
const services = cfg.SERVICES;
const key = String(cfg.service ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
const service = services[key] ? key : "other";
const today = DateTime.now().setZone(tz).startOf("day");
const lastDay = today.plus({ days: cfg.DAYS_AHEAD });
const parseDay = s => {
  const d = DateTime.fromISO(String(s ?? "").slice(0, 10), { zone: tz });
  return d.isValid ? d.startOf("day") : null;
};

// Book Appointment passes check_start to re-check one exact time.
const checkStart = cfg.check_start ? DateTime.fromISO(String(cfg.check_start), { zone: tz }) : null;
const checking = Boolean(checkStart && checkStart.isValid);
let from = checking ? checkStart.startOf("day") : (parseDay(cfg.date_from) ?? today);
if (from < today) from = today;
let to = checking ? from : (parseDay(cfg.date_to) ?? from.plus({ days: 6 }));
if (to < from) to = from;
if (to > from.plus({ days: 7 })) to = from.plus({ days: 7 });
if (to > lastDay) to = lastDay;

return [{
  json: {
    service,
    service_label: services[service].label,
    duration_minutes: services[service].minutes,
    from: from.toISODate(),
    to: to.toISODate(),
    last_bookable_day: lastDay.toISODate(),
    out_of_range: from > lastDay,
    check_start: checking ? checkStart.toISO() : "",
    time_min: from.toISO(),
    time_max: (to < from ? from : to).endOf("day").toISO()
  }
}];
