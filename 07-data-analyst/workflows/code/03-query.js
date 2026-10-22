// The fixed weekly query, as a base64 parameter for the read-only function.
const sql =
__SQL_WEEKLY__
;
return [{ json: { sql_b64: Buffer.from(sql, 'utf8').toString('base64') } }];
