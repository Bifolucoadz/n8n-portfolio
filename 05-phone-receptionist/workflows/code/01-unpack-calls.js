// One item per tool call in Vapi's request, after checking the shared secret header.
const req = $("Vapi Tool Request").first().json;
const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
const key = (req.headers ?? {})["x-fernhollow-key"] ?? "";
if (!settings.webhook_secret || key !== settings.webhook_secret) return [{ json: { authorized: false } }];

const msg = req.body?.message ?? {};
const call = msg.call ?? {};
const list = Array.isArray(msg.toolCallList) && msg.toolCallList.length
  ? msg.toolCallList
  : (msg.toolWithToolCallList ?? []).map(t => t.toolCall).filter(Boolean);

const items = list.map(c => {
  let args = c.function?.arguments ?? c.arguments ?? {};
  if (typeof args === "string") { try { args = JSON.parse(args); } catch (e) { args = {}; } }
  return {
    json: {
      authorized: true,
      tool_call_id: c.id,
      name: c.function?.name ?? c.name ?? "",
      args,
      caller_number: call.customer?.number ?? msg.customer?.number ?? "",
      call_id: call.id ?? "",
      call_type: call.type ?? "",
      calendar_id: settings.calendar_id,
      sheet_id: settings.sheet_id,
      staff_chat_id: settings.staff_chat_id,
    },
  };
});
return items.length ? items : [{ json: { authorized: true, empty: true } }];
