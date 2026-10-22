// Refuse after MAX_HANDOFFS_PER_SESSION tickets in one chat, and make sure the team has a way to reach the customer.
const cfg = $("Config").first().json;
const previous = $input.all().map(i => i.json).filter(r => r.ticket_ref && r.session_id === cfg.session_id).length;
const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const contact = clean(cfg.contact, 120);
const hasEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(contact);
const hasPhone = contact.replace(/\D/g, "").length >= 10;
const reasons = ["asked_for_human", "complaint", "car_status", "warranty_or_billing", "change_booking", "unanswered", "other"];
const reason = reasons.includes(cfg.reason) ? cfg.reason : "other";

let problem = "";
if (previous >= cfg.MAX_HANDOFFS_PER_SESSION) {
  problem = "Not passed on: this chat has already been passed to the team " + previous + " times. Ask the customer to call " + cfg.SHOP_PHONE + ".";
} else if (!hasEmail && !hasPhone) {
  problem = "Not passed on yet: ask the customer for a phone number or email address, then call handoff_to_staff again.";
}

const now = DateTime.now().setZone(cfg.TIMEZONE);
return [{
  json: {
    ok: !problem,
    problem,
    dry_run: cfg.dry_run === true || cfg.dry_run === "true",
    ticket_ref: "T-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
    created_at: now.toISO(),
    session_id: cfg.session_id,
    customer_name: clean(cfg.customer_name, 80) || "Unknown",
    contact,
    reason,
    summary: clean(cfg.summary, 1000),
    urgency: cfg.urgency === "high" ? "high" : "normal"
  }
}];
