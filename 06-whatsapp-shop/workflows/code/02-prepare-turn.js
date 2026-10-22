// Normalise the incoming message, drop duplicates (WhatsApp can redeliver), start a turn.
const m = $("When Called").first().json;
const seen = $input.all().map(i => i.json).some(r => r && r.message_id);
if (seen) return [];
const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
const now = DateTime.now().setZone("Africa/Lagos");
const type = String(m.type ?? "text");
let text = String(m.text ?? "").trim();
if (type === "location" && m.location) {
  const l = m.location;
  text = "[Shared a location pin: " + [l.name, l.address].filter(Boolean).join(", ") + " (" + l.latitude + ", " + l.longitude + ")] " + text;
}
if (type === "image") text = "[Sent a photo" + (text ? " with caption: " + text : "") + ". You can't see photos; ask them to describe what they want.]";
if (!["text", "interactive", "audio", "location", "image"].includes(type)) text = "[Sent a " + type + " message, which this assistant can't read.]";
return [{
  json: {
    phone: String(m.phone ?? "").replace(/\D/g, ""),
    name: String(m.name ?? "").trim(),
    message_id: String(m.message_id ?? ""),
    type,
    media_id: String(m.media_id ?? ""),
    text: text.slice(0, 2000),
    test: m.test === true || String(m.test) === "true",
    turn_id: "t-" + now.toFormat("yyMMddHHmmss") + "-" + Math.random().toString(36).slice(2, 6),
    now: now.toISO(),
    settings,
  },
}];
