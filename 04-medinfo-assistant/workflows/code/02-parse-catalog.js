// The catalog sheet exported as CSV -> rows for kb_products (quoted fields may hold commas).
const file = $('When Called by Sync').first().json;
const csv = String($json.text ?? '').replace(/^\uFEFF/, '');
const rows = [];
let row = [], field = '', quoted = false;
for (let i = 0; i < csv.length; i++) {
  const ch = csv[i];
  if (quoted) {
    if (ch === '"') { if (csv[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
    else field += ch;
  } else if (ch === '"') quoted = true;
  else if (ch === ',') { row.push(field); field = ''; }
  else if (ch === '\n' || ch === '\r') {
    if (ch === '\r' && csv[i + 1] === '\n') i++;
    row.push(field); rows.push(row); row = []; field = '';
  } else field += ch;
}
if (field !== '' || row.length) { row.push(field); rows.push(row); }
const header = (rows.shift() || []).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
const records = rows
  .filter(r => r.some(v => v.trim() !== ''))
  .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
if (!records.length) throw new Error('The product catalog has no rows. Not synced; the previous catalog stays in place.');
const day = String(file.modified_time || '').slice(0, 10);
const document = {
  id: file.file_id, doc_code: 'LRK-CATALOG', title: file.file_name, version: day, effective_date: day,
  access_level: file.access_level, folder: file.folder, mime_type: file.mime_type, url: file.url,
  modified_time: file.modified_time,
  summary: 'Product catalog: NDC numbers, pack sizes, storage, list prices and supply status.',
};
return [{ json: { payload: JSON.stringify({ document, rows: records }), rows: records.length } }];
