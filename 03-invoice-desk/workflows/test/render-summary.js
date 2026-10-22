// Renders code/06-build-summary.js from a saved register: node render-summary.js <register.json> <out.html>
const fs = require('fs'), path = require('path');
const { DateTime } = require('/Users/mac/.npm-global/lib/node_modules/n8n/node_modules/luxon');
const code = fs.readFileSync(path.join(__dirname, '../code/06-build-summary.js'), 'utf8');
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const cfg = { TIMEZONE: 'America/New_York', BASE_CURRENCY: 'USD', MINUTES_SAVED_PER_DOC: 6, SHEET_ID: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48', BUSINESS: 'Saltmarsh Kitchen' };
const nodes = { Config: [{ json: cfg }], 'Read Register': rows.map(json => ({ json })) };
const $ = n => ({ first: () => nodes[n][0], all: () => nodes[n] });
const out = new Function('$', 'DateTime', code)($, DateTime)[0].json;
fs.writeFileSync(process.argv[3], '<!doctype html><meta charset=utf-8><body style="margin:24px;background:#fff"><p style="font:13px sans-serif;color:#888">Subject: ' + out.subject + '</p>' + out.html + '</body>');
console.log(out.subject); console.log(JSON.stringify(out.caught));
