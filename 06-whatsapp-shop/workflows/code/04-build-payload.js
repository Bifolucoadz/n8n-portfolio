// One outgoing WhatsApp message -> Cloud API payload (or an Outbox row in test mode).
// kinds: text, cta (button that opens a link), image, read (blue ticks + typing indicator).
const m = $("When Called").first().json;
const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
const test = m.test === true || String(m.test) === "true";
const to = String(m.to ?? "").replace(/\D/g, "");
const body = String(m.body ?? "").trim();
if (m.kind === "read" && (test || !m.message_id)) return [];
const url = `https://graph.facebook.com/${settings.graph_version || "v23.0"}/${settings.whatsapp_phone_number_id}/messages`;
let payload;
if (m.kind === "read") {
  payload = { messaging_product: "whatsapp", status: "read", message_id: m.message_id, typing_indicator: { type: "text" } };
} else if (m.kind === "cta" && m.url) {
  payload = {
    messaging_product: "whatsapp", recipient_type: "individual", to, type: "interactive",
    interactive: { type: "cta_url", body: { text: body.slice(0, 1024) }, action: { name: "cta_url", parameters: { display_text: String(m.button_text || "Open").slice(0, 20), url: m.url } } },
  };
} else if (m.kind === "image" && m.url) {
  payload = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "image", image: { link: m.url, caption: body.slice(0, 1024) } };
} else {
  payload = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: body.slice(0, 4096) } };
}
return [{
  json: {
    test,
    url,
    payload,
    outbox: { phone: to, kind: m.kind || "text", body, url: m.url || "", at: DateTime.now().setZone("Africa/Lagos").toISO() },
  },
}];
