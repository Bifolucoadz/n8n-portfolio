// ---- lib-slots.js (included by build.py): clinic hours, appointment types and slot rules ----
const SLOT = {
  TZ: "America/Chicago",
  TYPES: {
    new_patient: { label: "New patient exam and X-rays", minutes: 60, notice: 120 },
    cleaning: { label: "Cleaning and check-up", minutes: 60, notice: 120 },
    emergency: { label: "Emergency exam", minutes: 30, notice: 60 },
    consultation: { label: "Cosmetic or Invisalign consultation", minutes: 30, notice: 120 },
  },
  // Luxon weekday (1 = Monday) -> open spans. Lunch 12-1 Mon-Thu, Friday until 2 pm.
  HOURS: {
    1: [["08:00", "12:00"], ["13:00", "17:00"]],
    2: [["08:00", "12:00"], ["13:00", "17:00"]],
    3: [["08:00", "12:00"], ["13:00", "17:00"]],
    4: [["08:00", "12:00"], ["13:00", "17:00"]],
    5: [["08:00", "14:00"]],
  },
  HOLIDAYS: ["2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"],
  DAYS_AHEAD: 30,
  STEP: 30,
};

// The model usually sends the key, but accept everyday words too.
function typeKey(raw) {
  const s = String(raw ?? "").toLowerCase();
  if (SLOT.TYPES[s]) return s;
  if (/emergenc|pain|ache|broken|knock|chip|swell|lost (a )?(filling|crown)/.test(s)) return "emergency";
  if (/new/.test(s)) return "new_patient";
  if (/clean|check|hygien|exam/.test(s)) return "cleaning";
  if (/cosmetic|whiten|invisalign|consult|align|veneer/.test(s)) return "consultation";
  return null;
}

// Calendar events -> busy intervals in clinic time. All-day events close the whole day.
function busyFrom(events, excludeId) {
  return events
    .filter(e => e && e.start && e.status !== "cancelled" && e.transparency !== "transparent" && e.id !== excludeId)
    .map(e => e.start.date
      ? { start: DateTime.fromISO(e.start.date, { zone: SLOT.TZ }), end: DateTime.fromISO(e.end.date, { zone: SLOT.TZ }) }
      : { start: DateTime.fromISO(e.start.dateTime).setZone(SLOT.TZ), end: DateTime.fromISO(e.end.dateTime).setZone(SLOT.TZ) });
}

function isOpen(day) {
  return Boolean(SLOT.HOURS[day.weekday]) && !SLOT.HOLIDAYS.includes(day.toISODate());
}

// Every start time on `day` that fits inside opening hours, respects the notice period and
// doesn't overlap a busy interval. One appointment at a time (single demo calendar).
function freeStarts(day, type, busy, now) {
  const t = SLOT.TYPES[type];
  if (!t || !isOpen(day)) return [];
  const earliest = now.plus({ minutes: t.notice });
  const out = [];
  for (const [a, b] of SLOT.HOURS[day.weekday]) {
    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);
    const open = day.set({ hour: ah, minute: am, second: 0, millisecond: 0 });
    const close = day.set({ hour: bh, minute: bm, second: 0, millisecond: 0 });
    for (let s = open; s.plus({ minutes: t.minutes }) <= close; s = s.plus({ minutes: SLOT.STEP })) {
      if (s < earliest) continue;
      const e = s.plus({ minutes: t.minutes });
      if (busy.some(x => x.start < e && x.end > s)) continue;
      out.push(s);
    }
  }
  return out;
}

// Speech-friendly labels: "Tuesday, October 28 at 9 AM" / "at 2:30 PM".
const sayDay = d => (typeof d === "string" ? DateTime.fromISO(d, { zone: SLOT.TZ }) : d).toFormat("cccc, LLLL d");
const say = d => sayDay(d) + " at " + d.toFormat(d.minute ? "h:mm a" : "h a");
const startValue = d => d.toISO({ suppressMilliseconds: true });
const spell = code => code.split("").map(ch => (ch === "-" ? "dash" : ch)).join(" ");
const digits10 = s => String(s ?? "").replace(/\D/g, "").slice(-10);

// Appointment events written by book_appointment carry these description lines.
function parseAppointment(e) {
  const d = String(e.description ?? "");
  const line = k => ((new RegExp("^" + k + ":\\s*(.*)$", "m")).exec(d) || [])[1] || "";
  const startIso = e.start?.dateTime ?? e.start?.date;
  return {
    id: e.id,
    code: line("Confirmation").trim().toUpperCase(),
    name: line("Patient").trim(),
    phone: digits10(line("Phone")),
    type: line("Type key").trim(),
    type_label: line("Type").trim() || String(e.summary ?? "").split(":")[0],
    start: startIso ? DateTime.fromISO(startIso).setZone(SLOT.TZ) : null,
    description: d,
  };
}
// ---- end lib-slots.js ----
