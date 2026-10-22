const s = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
const saved = $("Save Assistant ID").first().json;
return [{
  json: {
    assistant_id: saved.value,
    dashboard: "https://dashboard.vapi.ai/assistants/" + saved.value,
    tools_url: String(s.public_base_url).replace(/\/+$/, "") + "/webhook/fernhollow/tools",
    note: "Talk to it from the Vapi dashboard (Talk to Assistant) or call the phone number in Receptionist Settings.",
  },
}];
