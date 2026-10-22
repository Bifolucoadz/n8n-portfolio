// Pause the bot in this chat for 2 hours and tell the owner, with the last few messages.
const c = $("Config").first().json;
const now = DateTime.now().setZone("Africa/Lagos");
const chats = $input.all().map(i => i.json).filter(m => m.text).reverse().slice(-6);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = "🙋 <b>Customer wants a person</b>\n" + esc(c.customer_name || "Customer") + ", +" + esc(c.phone) +
  "\nReason: " + esc(c.reason || "not given") + "\n\n" +
  chats.map(m => (m.role === "user" ? "👤 " : "🤖 ") + esc(String(m.text).slice(0, 300))).join("\n") +
  "\n\n<i>The bot stays quiet in this chat until " + now.plus({ hours: 2 }).toFormat("h:mm a") + ". Reply from the WhatsApp Business inbox.</i>";
return [{ json: { phone: c.phone, name: c.customer_name, handoff_until: now.plus({ hours: 2 }).toISO(), chat_id: c.settings.owner_chat_id, telegram: text } }];
