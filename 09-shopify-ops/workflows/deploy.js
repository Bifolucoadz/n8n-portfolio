// Validate built workflows and import them into the local n8n with fixed IDs:
//   node workflows/deploy.js workflows/<built>.ts [more.ts ...]
// IDs, descriptions, disabled nodes and settings come from workflows/deploy.json. Import replaces the
// workflow's draft; publish it afterwards (MCP publish_workflow) if it has a trigger that should run.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const sdk = require('/Users/mac/.npm-global/lib/node_modules/n8n/node_modules/@n8n/workflow-sdk');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'deploy.json'), 'utf8'));

for (const file of process.argv.slice(2)) {
  const base = path.basename(file);
  const meta = cfg.workflows[base];
  if (!meta) throw new Error('No deploy.json entry for ' + base);
  const code = fs.readFileSync(file, 'utf8').replace(/^import .*$/m, '');
  const wf = sdk.parseWorkflowCode(code);
  const json = typeof wf.toJSON === 'function' ? wf.toJSON() : wf;
  const res = sdk.validateWorkflow(json);
  for (const w of res.warnings || []) console.log('warn ', w.code, w.message, w.nodeName || '');
  if ((res.errors || []).length) {
    for (const e of res.errors) console.log('ERROR', e.code, e.message, e.nodeName || '');
    process.exit(1);
  }
  for (const n of json.nodes) if ((meta.disabled || []).includes(n.name)) n.disabled = true;
  const settings = { executionOrder: 'v1', availableInMCP: true, timezone: cfg.timezone, callerPolicy: 'workflowsFromSameOwner', ...(meta.settings || {}) };
  if (cfg.errorWorkflow && meta.errorWorkflow !== false) settings.errorWorkflow = cfg.errorWorkflow;
  const out = {
    id: meta.id,
    name: json.name,
    description: meta.description,
    nodes: json.nodes,
    connections: json.connections,
    pinData: {},
    active: false,
    settings,
  };
  fs.writeFileSync(path.join(__dirname, 'json', base.replace(/\.ts$/, '.local.json')), JSON.stringify(out, null, 2));
  const tmp = path.join(os.tmpdir(), meta.id + '.json');
  fs.writeFileSync(tmp, JSON.stringify([out]));
  const log = execFileSync('n8n', ['import:workflow', '--input=' + tmp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  fs.unlinkSync(tmp);
  console.log(base, '→', meta.id, json.nodes.length, 'nodes:', log.trim().split('\n').pop());
}
