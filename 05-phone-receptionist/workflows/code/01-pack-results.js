// Vapi wants { results: [{ toolCallId, result }] } with each result a flat, one-line string.
const calls = $("Unpack Calls").all().map(i => i.json).filter(c => c.tool_call_id);
const byId = Object.fromEntries($input.all().map(i => i.json).filter(r => r && r.tool_call_id).map(r => [r.tool_call_id, r]));
const fallback = "The scheduling system didn't respond. Apologize briefly and offer to take a message for the front desk.";
const results = calls.map(c => {
  const r = byId[c.tool_call_id];
  const text = r && typeof r.result === "string" && r.result.trim() ? r.result : fallback;
  return { name: c.name, toolCallId: c.tool_call_id, result: text.replace(/\s*\n\s*/g, " ").trim() };
});
return [{ json: { results } }];
