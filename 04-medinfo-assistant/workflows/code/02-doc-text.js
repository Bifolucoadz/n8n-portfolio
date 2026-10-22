// Google Docs' Markdown export escapes punctuation (\- \. \( ...). Strip the escapes but keep \| so
// a pipe inside a table cell doesn't become a new column.
const text = String($json.text ?? '').replace(/\\([\\`*_{}\[\]()#+\-.!>~=$&<'"%:])/g, '$1');
return [{ json: { text, parse_method: 'google_doc', parse_flags: [], pages: null } }];
