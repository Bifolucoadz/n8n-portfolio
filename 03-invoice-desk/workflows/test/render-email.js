// Renders code/02-build-email.js for a saved Decide output: node render-email.js <decide.json> <out.html>
const fs = require('fs'), path = require('path');
const { DateTime } = require('/Users/mac/.npm-global/lib/node_modules/n8n/node_modules/luxon');
const code = fs.readFileSync(path.join(__dirname, '../code/02-build-email.js'), 'utf8');
const rec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
rec.drive_link = 'https://drive.google.com/file/d/example/view';
const nodes = { 'When Called': [{ json: { record: rec } }], Config: [{ json: { SHEET_ID: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48' } }] };
const $ = n => ({ first: () => nodes[n][0] });
const out = new Function('$', 'DateTime', code)($, DateTime)[0].json;
fs.writeFileSync(process.argv[3], '<!doctype html><meta charset=utf-8><body style="margin:24px;background:#fff"><p style="font:13px sans-serif;color:#888">Subject: ' + out.subject + '</p>' + out.html + '</body>');
console.log(out.subject);
