// Merge the context sentences and any header fields the model found, then build embedding inputs.
const parsed = $('Parse and Chunk').first().json;
const document = { ...parsed.document };
const contexts = {};
let found = {};
for (const item of $input.all()) {
  let data = null;
  for (const o of item.json.output ?? []) {
    for (const c of o.content ?? []) {
      if (c.text && typeof c.text === 'object') data = c.text;
      else if (typeof c.text === 'string') { try { data = JSON.parse(c.text); } catch (e) { /* ignore */ } }
    }
  }
  if (!data) continue;
  for (const x of data.contexts ?? []) if (x && Number.isInteger(x.i)) contexts[x.i] = String(x.context ?? '').trim();
  if (!found.summary && data.summary) found = data;
}
for (const k of ['doc_code', 'title', 'product', 'doc_type', 'version', 'effective_date']) {
  if (!document[k] && found[k]) document[k] = String(found[k]).trim();
}
document.product = String(document.product || 'general').toLowerCase().split(/\s+/)[0] || 'general';
if (!/^\d{4}-\d{2}-\d{2}$/.test(document.effective_date || '')) document.effective_date = String(document.modified_time || '').slice(0, 10);
if (!document.doc_code) document.doc_code = 'DRIVE-' + document.id;
document.summary = String(found.summary || '').slice(0, 800);
const missing = parsed.chunks.filter(c => !contexts[c.chunk_index]).length;
if (missing) document.parse_flags = [...(document.parse_flags || []), `context_missing_${missing}`];
const chunks = parsed.chunks.map(c => ({ ...c, context: contexts[c.chunk_index] || `${document.title}, section ${c.section}.` }));
const inputs = chunks.map(c => `${document.title} | ${c.section}\n${c.context}\n\n${c.content}`.slice(0, 7000));
return [{ json: { document, chunks, inputs } }];
