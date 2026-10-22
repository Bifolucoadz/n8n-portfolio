// Run a Code node script locally: node run-code.js <script> <input.json> [nodeOutputs.json]
// Stubs $input, $json, $(name) with .first()/.all()/.item/.isExecuted from the given JSON.
const fs = require('fs');
const [script, inputFile, nodesFile] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const nodes = nodesFile ? JSON.parse(fs.readFileSync(nodesFile, 'utf8')) : {};
const wrap = items => ({ first: () => items[0], all: () => items, item: items[0], isExecuted: items.length > 0 });
const $input = wrap(input);
const $json = input[0].json;
const $ = name => wrap(nodes[name] || []);
const code = fs.readFileSync(script, 'utf8');
const fn = new Function('$input', '$json', '$', `return (function(){ ${code} })();`);
const out = fn($input, $json, $);
console.log(JSON.stringify(out, null, 1));
