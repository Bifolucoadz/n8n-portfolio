// Local SDK check: node workflows/check.js <built file.ts> [--json out.json]
// Parses the workflow code with n8n's own SDK, runs its validator and prints errors/warnings.
const fs = require('fs');
const sdk = require('/Users/mac/.npm-global/lib/node_modules/n8n/node_modules/@n8n/workflow-sdk');
const file = process.argv[2];
const code = fs.readFileSync(file, 'utf8').replace(/^import .*$/m, '');
const wf = sdk.parseWorkflowCode(code);
const json = typeof wf.toJSON === 'function' ? wf.toJSON() : wf;
const res = sdk.validateWorkflow(json);
console.log(file, '→', (json.nodes || []).length, 'nodes,', Object.keys(json.connections || {}).length, 'sources');
for (const e of res.errors || []) console.log('ERROR', e.code, e.message, e.nodeName || '');
for (const w of res.warnings || []) console.log('warn ', w.code, w.message, w.nodeName || '');
const i = process.argv.indexOf('--json');
if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(json, null, 2));
