// The result for the answer writer: question, what was counted, and the rows (first 40).
const r = $input.first().json;
const p = r.plan || {};
const rows = r.rows.slice(0, 40);
return [{ json: { ...r, prompt: 'Question: ' + $('Prompt').first().json.question + '\nWhat the query counts: ' + (p.explanation || '') + '\nAssumptions: ' + ((p.assumptions || []).join('; ') || 'none')
  + '\nRows returned: ' + r.rows.length + (r.rows.length > 40 ? ' (first 40 shown)' : '') + '\n' + JSON.stringify(rows) } }];
