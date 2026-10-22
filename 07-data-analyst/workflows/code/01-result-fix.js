// The second attempt's result (no more retries).
const run = $input.first().json || {};
const chk = $('Check Fixed SQL').first().json;
const rows = Array.isArray(run.rows) ? run.rows : (typeof run.rows === 'string' ? JSON.parse(run.rows) : null);
const err = !chk.ok ? (chk.error || 'The corrected query was rejected.') : run.error ? String(run.error.message || run.error.description || run.error) : (rows ? '' : 'The query returned nothing usable.');
return [{ json: { ok: !err, rows: rows || [], error: err, needs_fix: false, sql: chk.sql, plan: chk.plan || $('Check SQL').first().json.plan } }];
