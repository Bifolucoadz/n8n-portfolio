// Validate a built workflow and import it into the local n8n with a fixed ID:
//   node workflows/deploy.js <built.ts> [more.ts ...]
// IDs, descriptions and settings come from DEPLOY below. Import replaces the workflow's draft;
// publish it afterwards (MCP publish_workflow) if it has a trigger that should run.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const sdk = require('/Users/mac/.npm-global/lib/node_modules/n8n/node_modules/@n8n/workflow-sdk');

const ERROR_WF = 'iTxd64lDk3gI0bKG'; // Social Autopilot 0: Error Alerts (Telegram)
const TZ = 'America/Chicago';
const DEPLOY = {
  '00a-setup.ts': { id: 'rcpFernSetup0a00', description: 'Phone receptionist (project 5): one-off setup. Creates the clinic calendar, the Front Desk sheet and the webhook secret.' },
  '00b-vapi-assistant.ts': { id: 'rcpFernVapi0b000', description: 'Phone receptionist (project 5): creates or updates the Vapi assistant (prompt, voice, tools, webhooks) and its phone number. Re-run after prompt changes.' },
  '01-vapi-tools.ts': { id: 'rcpFernTools0100', description: 'Phone receptionist (project 5): webhook for Vapi tool calls. Checks the secret, runs each call through Receptionist 2 and answers in Vapi\'s results format.' },
  '02-run-tool.ts': { id: 'rcpFernRunTool02', description: 'Phone receptionist (project 5): runs one tool call (availability, booking, find/cancel/reschedule, take message) against Google Calendar.' },
  '03-call-events.ts': { id: 'rcpFernEvents030', description: 'Phone receptionist (project 5): Vapi end-of-call reports to the Calls sheet, with a Telegram alert when follow-up is needed.' },
  '04-log-row.ts': { id: 'pL4bVosX1Dga62wJ', description: 'Phone receptionist (project 5): appends a staff message row to the Front Desk sheet in the background. Called by Receptionist 2.' },
  '05-daily-summary.ts': { id: 'rcpFernDaily0500', description: 'Phone receptionist (project 5): weekday 5:30 pm summary of calls, bookings and messages, plus tomorrow\'s schedule, on Telegram.' },
};

for (const file of process.argv.slice(2)) {
  const base = path.basename(file);
  const meta = DEPLOY[base];
  if (!meta) throw new Error('No deploy entry for ' + base);
  const code = fs.readFileSync(file, 'utf8').replace(/^import .*$/m, '');
  const wf = sdk.parseWorkflowCode(code);
  const json = typeof wf.toJSON === 'function' ? wf.toJSON() : wf;
  const res = sdk.validateWorkflow(json);
  for (const w of res.warnings || []) console.log('warn ', w.code, w.message, w.nodeName || '');
  if ((res.errors || []).length) {
    for (const e of res.errors) console.log('ERROR', e.code, e.message, e.nodeName || '');
    process.exit(1);
  }
  const out = {
    id: meta.id,
    name: json.name,
    description: meta.description,
    nodes: json.nodes,
    connections: json.connections,
    pinData: {},
    active: false,
    settings: { executionOrder: 'v1', availableInMCP: true, timezone: TZ, errorWorkflow: ERROR_WF, callerPolicy: 'workflowsFromSameOwner' },
  };
  const tmp = path.join(os.tmpdir(), meta.id + '.json');
  fs.writeFileSync(tmp, JSON.stringify([out]));
  const log = execFileSync('n8n', ['import:workflow', '--input=' + tmp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  fs.unlinkSync(tmp);
  console.log(base, '→', meta.id, json.nodes.length, 'nodes:', log.trim().split('\n').pop());
}
