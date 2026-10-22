// Diff Drive against the index: new or changed files are indexed, files gone from Drive are deleted.
// Guards: an empty Drive listing, or one that would delete more than half the index, stops the run.
const cfg = $('Config').first().json;
const folders = {
  [cfg.PUBLIC_FOLDER]: ['Public', 'public'],
  [cfg.INTERNAL_FOLDER]: ['Internal', 'internal'],
  [cfg.MEDICAL_FOLDER]: ['Medical', 'medical'],
  [cfg.DATA_FOLDER]: ['Data', 'public'],
};
const files = $('List Drive Files').first().json.files ?? [];
const registry = $('Read Registry').first().json.registry ?? [];
const known = Object.fromEntries(registry.map(r => [r.id, r]));

if (!files.length && registry.length) {
  throw new Error('Google Drive returned no files, but the index has ' + registry.length + '. Refusing to delete the whole index.');
}

const out = [], seen = new Set();
for (const f of files) {
  const parent = (f.parents || []).find(p => folders[p]);
  if (!parent) continue;
  seen.add(f.id);
  const r = known[f.id];
  const moved = r && r.access_level && r.access_level !== folders[parent][1];
  const changed = !r || cfg.FORCE_REINDEX || moved
    || Number(r.parser_version || 0) < cfg.PARSER_VERSION
    || Math.abs(Date.parse(r.modified_time) - Date.parse(f.modifiedTime)) > 1000;
  if (!changed) continue;
  out.push({
    json: {
      action: 'index',
      reason: !r ? 'new' : moved ? 'moved' : 'changed',
      file_id: f.id, file_name: f.name, mime_type: f.mimeType, modified_time: f.modifiedTime,
      url: f.webViewLink, folder: folders[parent][0], access_level: folders[parent][1],
    },
  });
}
const deletes = registry.filter(r => !seen.has(r.id));
if (deletes.length > Math.max(3, registry.length / 2) && !cfg.FORCE_REINDEX) {
  throw new Error(`This sync would delete ${deletes.length} of ${registry.length} indexed documents. Check the Drive folders, or set FORCE_REINDEX to true in Config to allow it.`);
}
for (const r of deletes) out.unshift({ json: { action: 'delete', id: r.id, doc_code: r.doc_code, title: r.title } });
if (!out.length) out.push({ json: { action: 'none', files: files.length, indexed: registry.length } });
return out;
