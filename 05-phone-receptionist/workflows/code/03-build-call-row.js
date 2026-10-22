// Vapi end-of-call report -> one Calls row (only with the right secret; other events are ignored).
const req = $("Vapi Event").first().json;
const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
if (!settings.webhook_secret || (req.headers ?? {})["x-fernhollow-key"] !== settings.webhook_secret) return [];
const m = req.body?.message ?? {};
if (m.type !== "end-of-call-report") return [];

const call = m.call ?? {};
const analysis = m.analysis ?? call.analysis ?? {};
const sd = analysis.structuredData ?? {};
const art = m.artifact ?? call.artifact ?? {};
const tz = "America/Chicago";
const started = DateTime.fromISO(String(m.startedAt ?? call.startedAt ?? ""));
const ended = DateTime.fromISO(String(m.endedAt ?? call.endedAt ?? ""));
const seconds = started.isValid && ended.isValid ? Math.round(ended.diff(started, "seconds").seconds) : "";
const caller = m.customer?.number ?? call.customer?.number ?? (call.type === "webCall" ? "web call" : "");
const followUp = sd.follow_up_needed === true ? (String(sd.follow_up_reason ?? "").trim() || "yes") : "";
const row = {
  call_id: call.id ?? "",
  started_at: (started.isValid ? started : DateTime.now()).setZone(tz).toFormat("yyyy-MM-dd HH:mm"),
  caller,
  caller_name: String(sd.caller_name ?? ""),
  duration_s: String(seconds),
  outcome: String(sd.outcome ?? ""),
  appointment: [sd.appointment_type, sd.appointment_time].filter(Boolean).join(", "),
  confirmation_code: String(sd.confirmation_code ?? ""),
  summary: String(analysis.summary ?? ""),
  follow_up: followUp,
  recording_url: art.recordingUrl ?? art.recording?.mono?.combinedUrl ?? "",
  ended_reason: String(m.endedReason ?? call.endedReason ?? ""),
  cost_usd: typeof m.cost === "number" ? m.cost.toFixed(3) : "",
};
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const alert = followUp
  ? "📞 <b>Call needs follow-up</b>\n" + esc(row.caller_name || "Unknown caller") + ", " + esc(caller) + "\n" + esc(followUp) +
    "\n\n" + esc(row.summary).slice(0, 700) + (row.recording_url ? '\n<a href="' + esc(row.recording_url) + '">Recording</a>' : "")
  : "";
return [{ json: { sheet_id: settings.sheet_id, staff_chat_id: settings.staff_chat_id, row, alert } }];
