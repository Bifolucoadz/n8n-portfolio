const p = $input.first().json;
if (!p.id) return [{ json: { key: "phone_number_note", value: "Vapi didn't create a number: " + JSON.stringify(p).slice(0, 300) } }];
return [
  { json: { key: "phone_number_id", value: p.id } },
  { json: { key: "phone_number", value: p.number ?? p.sipUri ?? "" } },
];
