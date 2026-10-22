// Checks the model's SQL before it goes anywhere near the database: one SELECT (or WITH ... SELECT),
// no semicolons or comments, no write or admin keywords. The database itself is the real guard
// (read-only role, STABLE function), this just gives a clear error early.
// @include lib-ilf.js
const plan = aiJson($input.first().json);
const base = $('Prompt').first().json;
const out = { attempt: ATTEMPT, plan, ok: false, error: '', sql: '', sql_b64: '' };
if (!plan) out.error = 'The AI did not return a query.';
else if (!plan.can_answer) out.error = '';
else {
  let sql = String(plan.sql || '').trim().replace(/;\s*$/, '');
  const bad = [];
  if (!/^(select|with)\b/i.test(sql)) bad.push('it must start with SELECT or WITH');
  if (/;/.test(sql)) bad.push('only one statement is allowed');
  if (/--|\/\*/.test(sql)) bad.push('no comments');
  const kw = sql.replace(/'(?:[^']|'')*'/g, "''").match(/\b(insert|update|delete|merge|drop|alter|create|grant|revoke|truncate|copy|vacuum|analyze|call|do|set|reset|lock|listen|notify|prepare|execute|comment|refresh|cluster|reindex|pg_sleep|pg_read_file|pg_read_binary_file|pg_terminate_backend|lo_import|dblink|set_config)\b/i);
  if (kw) bad.push('"' + kw[1] + '" is not allowed');
  if (sql.length > 6000) bad.push('the query is too long');
  if (bad.length) out.error = 'Query rejected: ' + bad.join('; ') + '.';
  else Object.assign(out, { ok: true, sql, sql_b64: Buffer.from(sql, 'utf8').toString('base64') });
}
return [{ json: { ...out, can_answer: plan ? !!plan.can_answer : true, started_ms: base.started_ms } }];
