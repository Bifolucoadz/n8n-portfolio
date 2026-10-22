// @include lib-shop.js
// The agent's text, plus a Pay button when this turn created a payment link.
const t = $("Build Agent Input").first().json;
let agentOut = "";
try { agentOut = String($("Shop Agent").first()?.json?.output ?? ""); } catch (e) { agentOut = ""; }
let reply = agentOut.trim();
if (!reply) reply = "Sorry, something went wrong on our side. Please send that again in a minute 🙏";
reply = reply.replace(/https:\/\/checkout\.paystack\.com\/\S+/g, "").replace(/\n{3,}/g, "\n\n").trim();
const pay = $input.all().map(i => i.json).find(o => o && o.order_id && o.pay_url && o.status === "awaiting_payment");
const now = DateTime.now().setZone(SHOP.TZ).toISO();
return [{
  json: {
    to: t.phone,
    kind: pay ? "cta" : "text",
    body: reply,
    url: pay ? pay.pay_url : "",
    button_text: pay ? "Pay " + naira(pay.total_ngn) : "",
    test: t.test,
    chats: [
      { phone: t.phone, role: "user", text: (t.voice ? "[voice note] " : "") + t.text, message_id: t.message_id, turn_id: t.turn_id, at: t.now },
      { phone: t.phone, role: "assistant", text: reply + (pay ? "\n[Pay button: " + naira(pay.total_ngn) + "]" : ""), message_id: "", turn_id: t.turn_id, at: now },
    ],
  },
}];
