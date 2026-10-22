// WhatsApp Cloud API webhook value -> one item per customer message (statuses are filtered by the trigger).
const out = [];
for (const item of $input.all()) {
  const v = item.json;
  const names = Object.fromEntries((v.contacts ?? []).map(c => [c.wa_id, c.profile?.name ?? ""]));
  for (const m of v.messages ?? []) {
    let text = "", media_id = "", location = null;
    const type = m.type;
    if (type === "text") text = m.text?.body ?? "";
    else if (type === "interactive") text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    else if (type === "button") text = m.button?.text ?? "";
    else if (type === "audio") media_id = m.audio?.id ?? "";
    else if (type === "image") { media_id = m.image?.id ?? ""; text = m.image?.caption ?? ""; }
    else if (type === "location") location = m.location ?? null;
    out.push({ json: {
      phone: m.from, name: names[m.from] ?? "", message_id: m.id,
      type: type === "button" ? "text" : type, text, media_id, location,
      test: false, received_at: m.timestamp,
    } });
  }
}
return out;
