// Chat memory rows are LangChain messages: { type: "human" | "ai", data: { content } }.
const ticket = $("Check Request").first().json;
const lines = $input.all()
  .map(i => i.json.message)
  .filter(Boolean)
  .map(m => {
    const msg = typeof m === "string" ? JSON.parse(m) : m;
    const text = String(msg.data?.content ?? msg.content ?? "").trim();
    return text ? (msg.type === "human" ? "Customer: " : "Assistant: ") + text : null;
  })
  .filter(Boolean);
return [{ json: { ...ticket, transcript: lines.length ? lines.join("\n\n") : "(No earlier messages saved for this chat.)" } }];
