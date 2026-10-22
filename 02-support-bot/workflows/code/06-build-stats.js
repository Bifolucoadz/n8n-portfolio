// Last 7 days of chat activity, leaving out automated test runs (sessions starting "eval-" or "check-").
const tz = "America/New_York";
const now = DateTime.now().setZone(tz);
const since = now.minus({ days: 7 });
const isTest = s => /^(eval|check)-/.test(String(s ?? ""));
const recent = (name, field) => $(name).all()
  .map(i => i.json)
  .filter(r => r[field] && DateTime.fromISO(String(r[field])) >= since && !isTest(r.session_id));

const conversations = recent("Read Conversations", "timestamp");
const bookings = recent("Read Bookings", "created_at");
const tickets = recent("Read Tickets", "created_at");
const unanswered = recent("Read Unanswered", "timestamp");

const countBy = (rows, key) => Object.entries(rows.reduce((m, r) => {
  const k = r[key] || "other";
  m[k] = (m[k] || 0) + 1;
  return m;
}, {})).sort((a, b) => b[1] - a[1]);
const questions = [...new Set(unanswered.map(r => String(r.question).trim()).filter(Boolean))].slice(0, 40);

return [{
  json: {
    week_label: since.toFormat("LLL d") + " to " + now.toFormat("LLL d, yyyy"),
    chats: new Set(conversations.map(r => r.session_id)).size,
    messages: conversations.length,
    errors: conversations.filter(r => String(r.tools_used).startsWith("error")).length,
    bookings: bookings.length,
    bookings_by_service: countBy(bookings, "service"),
    handoffs: tickets.length,
    handoffs_by_reason: countBy(tickets, "reason"),
    open_tickets: tickets.filter(r => r.status === "open").length,
    unanswered_count: unanswered.length,
    questions_text: questions.length ? questions.map(q => "- " + q).join("\n") : "(none)"
  }
}];
