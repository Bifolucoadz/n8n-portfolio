// The hybrid search candidates, labelled for the reranker. Long passages are trimmed to keep it fast.
const q = $('Prepare Query').first().json;
const results = $input.first().json.results ?? [];
const list = results.map(r =>
  `<passage id="${r.id}" doc="${r.doc_code} v${r.version}${r.status === 'superseded' ? ' (superseded)' : ''}" section="${String(r.section ?? '').replace(/"/g, "'")}">\n` +
  `${r.context ?? ''}\n${String(r.text ?? '').slice(0, 1000)}\n</passage>`
).join('\n');
return [{ json: { count: results.length, prompt: `<query>${q.query}</query>\n\n<passages>\n${list}\n</passages>` } }];
