const t = $("Check Pause").first().json;
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
return [{ json: { chat_id: t.settings.owner_chat_id, text: "💬 <b>" + esc(t.name || "Customer") + "</b> (+" + esc(t.phone) + "), bot paused:\n" + esc(t.text) } }];
