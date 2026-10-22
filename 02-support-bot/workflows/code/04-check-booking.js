// Book only if the details are valid, the chat is under its booking limit, and the time is still free.
const cfg = $("Config").first().json;
const check = $("Re-check Time").first().json;
const previous = $("Read Session Bookings").all().map(i => i.json).filter(r => r.booking_ref && r.session_id === cfg.session_id).length;
// Strip links and cap lengths: these fields end up in an email to the address the customer typed.
const clean = (v, max) => String(v ?? "").replace(/https?:\/\/\S+|www\.\S+/gi, "").replace(/\s+/g, " ").trim().slice(0, max);
const name = clean(cfg.customer_name, 60);
const email = clean(cfg.email, 100).toLowerCase();
const phone = clean(cfg.phone, 30);
const vehicle = clean(cfg.vehicle, 60);
const notes = clean(cfg.notes, 500);
const start = DateTime.fromISO(String(cfg.start ?? ""), { zone: cfg.TIMEZONE });

const missing = [];
if (name.length < 2) missing.push("the customer's name");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push("a valid email address");
if (phone.replace(/\D/g, "").length < 10) missing.push("a phone number with at least 10 digits");
if (vehicle.length < 3) missing.push("the vehicle's year, make and model");
if (!start.isValid) missing.push("a start time copied exactly from check_availability");

let message = "";
if (missing.length) {
  message = "Not booked. Still needed: " + missing.join(", ") + ".";
} else if (previous >= cfg.MAX_BOOKINGS_PER_SESSION) {
  message = "Not booked: this chat already has " + previous + " bookings, the most allowed. Ask the customer to call " + cfg.SHOP_PHONE + " for more.";
} else if (check.available !== true) {
  message = "Not booked: that time is no longer free. Call check_availability again and offer other times.";
}

const label = start.isValid ? start.toFormat("ccc LLL d, h:mm a").replace(" AM", " am").replace(" PM", " pm") : "";
const testMode = cfg.TEST_MODE === true || cfg.TEST_MODE === "true";
return [{
  json: {
    ok: !message,
    message,
    dry_run: cfg.dry_run === true || cfg.dry_run === "true",
    booking_ref: "CA-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
    service: check.service ?? "other",
    service_label: check.service_label ?? "Other repair (drop-off)",
    start: start.isValid ? start.toISO() : "",
    end: start.isValid ? start.plus({ minutes: check.duration_minutes ?? 60 }).toISO() : "",
    label,
    customer_name: name,
    first_name: name.split(" ")[0],
    email,
    phone,
    vehicle,
    notes,
    session_id: cfg.session_id,
    send_to: testMode ? cfg.TEST_INBOX : email,
    subject: (testMode ? "[TEST to " + email + "] " : "") + "Your Copperline booking: " + label,
    created_at: DateTime.now().setZone(cfg.TIMEZONE).toISO()
  }
}];
