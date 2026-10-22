const s = Object.fromEntries($("Read Settings Again").all().map(i => [i.json.key, i.json.value ?? ""]));
return [{ json: {
  kitchen_board: s.kitchen_sheet_id ? "https://docs.google.com/spreadsheets/d/" + s.kitchen_sheet_id + "/edit" : "(missing)",
  owner_chat_id: s.owner_chat_id || "(empty: owner alerts are skipped until it is set)",
  payments: s.payments,
  next: "Create the WhatsApp and Paystack credentials, set whatsapp_phone_number_id, then publish Honeycrumb 1 and 5.",
} }];
