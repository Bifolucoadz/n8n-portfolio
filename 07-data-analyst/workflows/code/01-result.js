// What the query returned, from the second attempt if there was one. On a database error the first
// time, asks for one fix (needs_fix); after that it gives up with the error.
const run = $input.first().json || {};
const chk = $('Check SQL').first().json;
const rows = Array.isArray(run.rows) ? run.rows : (typeof run.rows === 'string' ? JSON.parse(run.rows) : null);
const err = run.error ? String(run.error.message || run.error.description || run.error) : (rows ? '' : 'The query returned nothing usable.');
return [{ json: { ok: !err, rows: rows || [], error: err, needs_fix: !!err && chk.attempt === 1, sql: chk.sql, plan: chk.plan,
  fix_prompt: err ? $('Prompt').first().json.prompt + '\n\nThis SQL failed:\n' + chk.sql + '\n\nDatabase error: ' + err + '\n\nReturn a corrected query.' : '' } }];
