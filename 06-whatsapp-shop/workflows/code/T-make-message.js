const b = $input.first().json.body ?? {};
return [{ json: {
  phone: String(b.phone ?? "2348010000001"),
  name: String(b.name ?? "Test Customer"),
  message_id: "test-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
  type: String(b.type ?? "text"),
  text: String(b.text ?? ""),
  media_id: "",
  location: b.location ?? null,
  test: true,
} }];
