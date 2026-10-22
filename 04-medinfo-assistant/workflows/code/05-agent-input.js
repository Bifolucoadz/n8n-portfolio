// What the agent gets: the conversation so far, the latest message and, when there was a question,
// the passages already retrieved for it (so it can usually answer without calling a tool first).
const base = $('Screen Input').first().json.agent_input;
let passages = null;
if ($('Pre-Search').isExecuted) {
  const r = $('Pre-Search').first().json;
  if (Array.isArray(r.results)) passages = { query: r.query, status: r.status, results: r.results };
}
const text = passages
  ? `${base}\n\n<retrieved_passages>\n${JSON.stringify(passages)}\n</retrieved_passages>\n` +
    'These passages were retrieved for the latest message. Answer from them if they are enough; call search_knowledge for anything they do not cover.'
  : base;
return [{ json: { text } }];
