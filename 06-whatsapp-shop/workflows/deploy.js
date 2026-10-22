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
const TZ = 'Africa/Lagos';
// Nodes kept disabled until their credential exists (WhatsApp account, Paystack Test).
const DISABLED = {
  '02-handle-message.ts': ['Get Media URL', 'Download Voice Note'],
  '03-shop-tools.ts': ['Paystack Initialize'],
  '04-send-whatsapp.ts': ['Send Message'],
  '05-paystack-webhook.ts': ['Verify Payment'],
};
const DEPLOY = {
  '00-setup.ts': { id: 'hcbShopSetup0000', description: 'WhatsApp shop (project 6): one-off setup. Creates the Honeycrumb kitchen board Google Sheet and saves its ID.' },
  '01-whatsapp-in.ts': { id: 'hcbWhatsAppIn001', description: 'WhatsApp shop (project 6): WhatsApp Trigger for customer messages. Normalises text, buttons, voice notes and location pins and hands each to Honeycrumb 2.' },
  '02-handle-message.ts': { id: 'hcbHandleMsg0002', description: 'WhatsApp shop (project 6): one customer message. Dedupe, hand-off check, voice transcription, GPT-5.4 mini agent with shop tools, reply with a Pay button when a link was created.' },
  '03-shop-tools.ts': { id: 'hcbShopTools0003', description: 'WhatsApp shop (project 6): agent tools. Menu search, cart, delivery quotes, checkout with Paystack, order status, hand-off to a person.' },
  '04-send-whatsapp.ts': { id: 'hcbSendWA0000004', description: 'WhatsApp shop (project 6): sends text, Pay buttons, images and read receipts through the WhatsApp Cloud API, or to the Outbox table in test mode.' },
  '05-paystack-webhook.ts': { id: 'hcbPaystack00005', description: 'WhatsApp shop (project 6): Paystack webhook. Verifies each payment with the Paystack API, marks the order paid, confirms on WhatsApp, adds it to the kitchen board and alerts the owner.' },
  '06-kitchen-board.ts': { id: 'hcbKitchen000006', description: 'WhatsApp shop (project 6): watches the kitchen board sheet; a status change messages the customer on WhatsApp.' },
  '07-reminders.ts': { id: 'hcbReminders0007', description: 'WhatsApp shop (project 6): every 15 minutes, one payment reminder after an hour and expiry after 24 hours for unpaid orders.' },
  'T-test-chat.ts': { id: 'hcbTestChat0000T', description: 'WhatsApp shop (project 6): test harness. Runs one message through Honeycrumb 2 in test mode.' },
  '08-daily-summary.ts': { id: 'hcbDailySum00008', description: 'WhatsApp shop (project 6): 9 pm Lagos summary of orders, revenue, best sellers and tomorrow\'s deliveries on Telegram.' },
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
  for (const n of json.nodes) if ((DISABLED[base] || []).includes(n.name)) n.disabled = true;
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
