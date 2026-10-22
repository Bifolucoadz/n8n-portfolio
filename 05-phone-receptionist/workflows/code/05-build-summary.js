// Today's calls and messages, plus the next open day's appointments, as one Telegram message.
const tz = "America/Chicago";
const w = $("Next Day Window").first().json;
const now = DateTime.now().setZone(tz);
const today = now.toISODate();
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const calls = $("Read Calls").all().map(i => i.json).filter(r => r && String(r.started_at ?? "").startsWith(today));
const messages = $("Read Messages").all().map(i => i.json).filter(r => r && r.at);
const todaysMessages = messages.filter(r => String(r.at).startsWith(today));
const openMessages = messages.filter(r => String(r.status ?? "new").toLowerCase() === "new");
const appts = $("Read Next Day").all().map(i => i.json).filter(e => e && e.id && e.start && e.status !== "cancelled")
  .map(e => ({ start: DateTime.fromISO(e.start.dateTime ?? e.start.date).setZone(tz), title: e.summary ?? "" }))
  .sort((a, b) => a.start - b.start);

const count = o => calls.filter(c => c.outcome === o).length;
const secs = calls.map(c => Number(c.duration_s)).filter(n => n > 0);
const avg = secs.length ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) : 0;
const cost = calls.map(c => Number(c.cost_usd)).filter(n => n > 0).reduce((a, b) => a + b, 0);
const follow = calls.filter(c => c.follow_up);

const lines = [
  "🦷 <b>Fernhollow Dental: today on the phone line</b> (" + now.toFormat("ccc LLL d") + ")",
  "",
  "Calls answered: <b>" + calls.length + "</b>" + (secs.length ? " · average " + Math.floor(avg / 60) + "m " + (avg % 60) + "s" : "") + (cost ? " · cost $" + cost.toFixed(2) : ""),
  "Booked: " + count("booked") + " · moved: " + count("rescheduled") + " · cancelled: " + count("cancelled"),
  "Questions answered: " + count("question_answered") + " · emergencies referred: " + count("emergency_referred"),
  "Messages today: " + todaysMessages.length + " · still open: " + openMessages.length,
];
if (follow.length) {
  lines.push("", "<b>Needs a call back</b>");
  for (const c of follow.slice(0, 8)) lines.push("• " + esc(c.caller_name || c.caller) + ": " + esc(c.follow_up));
}
lines.push("", "<b>" + DateTime.fromISO(w.next_day, { zone: tz }).toFormat("cccc LLL d") + "</b>: " + (appts.length ? appts.length + " appointment" + (appts.length > 1 ? "s" : "") : "nothing booked yet"));
for (const a of appts.slice(0, 15)) lines.push("• " + a.start.toFormat("h:mm a") + "  " + esc(a.title));
return [{ json: { chat_id: w.staff_chat_id, text: lines.join("\n") } }];
