// @include lib-slots.js
// Validate book_appointment's arguments and build the event. The slot itself is re-checked next.
const c = $("Config").first().json;
const a = c.args ?? {};
const type = typeKey(a.appointment_type);
const start = DateTime.fromISO(String(a.start ?? ""), { setZone: true });
const name = String(a.patient_name ?? "").replace(/\s+/g, " ").trim();
const phone = String(a.phone ?? "").trim() || String(c.caller_number ?? "");
const missing = [];
if (!type) missing.push("the appointment type");
if (!start.isValid) missing.push("a start value from check_availability");
if (name.split(" ").length < 2) missing.push("the patient's first and last name");
if (digits10(phone).length < 10) missing.push("a phone number with area code");
if (missing.length) {
  return [{ json: { ok: false, tool_call_id: c.tool_call_id, result: "Not booked yet: still need " + missing.join(", ") + ". Ask for it, then call book_appointment again." } }];
}
const t = SLOT.TYPES[type];
const s = start.setZone(SLOT.TZ);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = "FD-" + Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
const isNew = a.is_new_patient === true || String(a.is_new_patient).toLowerCase() === "true" || type === "new_patient";
return [{
  json: {
    ok: true,
    tool_call_id: c.tool_call_id,
    calendar_id: c.calendar_id,
    type,
    type_label: t.label,
    start: s.toISO(),
    end: s.plus({ minutes: t.minutes }).toISO(),
    time_min: s.startOf("day").toISO(),
    time_max: s.endOf("day").toISO(),
    patient_name: name,
    phone,
    is_new_patient: isNew,
    insurance: String(a.insurance ?? "").trim() || (isNew ? "not given" : "on file"),
    reason: String(a.reason ?? "").trim() || "not given",
    code,
    call_id: c.call_id,
    summary: t.label + ": " + name,
    description: [
      "Confirmation: " + code,
      "Patient: " + name,
      "Phone: " + phone,
      "Type: " + t.label,
      "Type key: " + type,
      "New patient: " + (isNew ? "yes" : "no"),
      "Insurance: " + (String(a.insurance ?? "").trim() || (isNew ? "not given" : "on file")),
      "Reason: " + (String(a.reason ?? "").trim() || "not given"),
      "",
      "Booked by Nora (AI receptionist), call " + (c.call_id || "n/a") + ".",
    ].join("\n"),
  },
}];
