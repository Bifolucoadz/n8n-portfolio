// Runs a Code-node script locally with stubbed $(), $json, $input and Luxon, for logic tests.
const fs = require('fs');
const path = require('path');
const { DateTime } = require('/Users/mac/.npm-global/lib/node_modules/n8n/node_modules/luxon');

async function run(codeFile, nodes, input = [{ json: {} }]) {
  const dir = path.join(__dirname, '..', 'code');
  const src = fs.readFileSync(path.join(dir, codeFile), 'utf8')
    .replace(/^\/\/ @include (\S+)$/m, (_, f) => fs.readFileSync(path.join(dir, f), 'utf8'));
  const $ = name => {
    if (!(name in nodes)) throw new Error('no stub for node ' + name);
    const items = nodes[name].map(j => (j && j.json ? j : { json: j }));
    return { all: () => items, first: () => items[0], item: items[0] };
  };
  const $input = { all: () => input, first: () => input[0] };
  const fn = new (Object.getPrototypeOf(async function () {}).constructor)('$', '$json', '$input', 'DateTime', 'helpers', src);
  return fn.call({ helpers: {} }, $, (input[0] || { json: {} }).json, $input, DateTime);
}
module.exports = { run, DateTime };
