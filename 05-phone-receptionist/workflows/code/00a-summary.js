const s = Object.fromEntries($("Read Settings Again").all().map(i => [i.json.key, i.json.value ?? ""]));
return [{
  json: {
    calendar_id: s.calendar_id || "(missing)",
    sheet: s.sheet_id ? "https://docs.google.com/spreadsheets/d/" + s.sheet_id + "/edit" : "(missing)",
    webhook_secret: s.webhook_secret ? "set (" + s.webhook_secret.length + " characters)" : "(missing)",
    staff_chat_id: s.staff_chat_id || "(empty: staff alerts are skipped until it is set)",
    next: "Set public_base_url to the ngrok https address, create the 'Vapi API' credential, then run Receptionist 0b.",
  },
}];
