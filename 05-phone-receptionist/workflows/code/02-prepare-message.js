// take_message: validate, then build the staff alert and the Messages row.
const c = $("Config").first().json;
const a = c.args ?? {};
const name = String(a.caller_name ?? "").trim();
const phone = String(a.phone ?? "").trim() || String(c.caller_number ?? "");
const message = String(a.message ?? "").trim();
const urgent = a.urgent === true || String(a.urgent).toLowerCase() === "true";
const missing = [];
if (!name) missing.push("their name");
if (phone.replace(/\D/g, "").length < 10) missing.push("a callback number");
if (message.length < 3) missing.push("the message");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const at = DateTime.now().setZone("America/Chicago");
return [{
  json: {
    ok: missing.length === 0,
    tool_call_id: c.tool_call_id,
    sheet_id: c.sheet_id,
    staff_chat_id: c.staff_chat_id,
    missing: missing.join(", "),
    urgent,
    telegram: (urgent ? "🚨 <b>URGENT message</b>" : "📞 <b>New message</b>") + " from the phone line\n" +
      "<b>" + esc(name) + "</b>, " + esc(phone) + "\n" + esc(message) + "\n<i>" + at.toFormat("ccc LLL d, h:mm a") + " (Nora)</i>",
    row: { at: at.toFormat("yyyy-MM-dd HH:mm"), caller_name: name, phone, message, urgent: urgent ? "yes" : "no", status: "new", call_id: c.call_id ?? "" },
  },
}];
