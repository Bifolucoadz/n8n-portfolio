// Runs one tool call from Claude (or any MCP client). Finance tools only work when called through the
// finance server. Reads are answered here; writes are checked here and handed to the nodes after the
// switch. Every call, allowed or not, goes to the Audit tab.
// @include lib-bms.js
const input = $('When Called').first().json;
const started = Date.now();
const tool = str(input.tool), server = str(input.server) || 'team';
const args = {};
for (const [k, v] of Object.entries(input)) if (!['tool', 'server'].includes(k) && v !== null && v !== undefined && v !== '') args[k] = v;
let out;
if (!TOOLS[tool]) out = { error: 'Unknown tool: ' + tool };
else if (FINANCE_TOOLS.includes(tool) && server !== 'finance') out = { error: 'That tool is only available on the finance server.' };
else {
  try { out = TOOLS[tool](studio(tablesOf($('Load Data').first().json)), args, server); }
  catch (e) { out = { error: 'Something went wrong: ' + e.message }; }
}
const answer = out.error ? { ok: false, error: out.error } : (out.answer || out);
const write = out.error ? null : (out.write || null);
const summary = out.error ? 'Refused: ' + out.error
  : (tool === 'log_time' ? 'Logged ' + answer.hours + ' h for ' + answer.person + ' on ' + answer.project + ' (' + answer.date + ')'
  : tool === 'create_task' ? 'Created ' + answer.task_id + ': ' + answer.title
  : tool === 'update_task' ? 'Updated ' + answer.task_id + ': ' + answer.changes.join('; ')
  : tool === 'draft_invoice' ? (answer.created ? 'Created draft ' + answer.invoice_id : 'Previewed') + ' for ' + answer.client + ' ' + answer.period + ', ' + gbp(answer.net) + ' + VAT'
  : 'Answered');
return [{ json: { answer, write_kind: write ? write.kind : 'none', write, audit: { at: nowIso(), server, tool, args_json: JSON.stringify(args), ok: out.error ? 'no' : 'yes', summary: summary.slice(0, 300), ms: Date.now() - started } } }];
