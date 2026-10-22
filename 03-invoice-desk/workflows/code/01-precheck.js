// Before paying for an AI call: is this exact file already in the register, and is it a file we can read?
const doc = $('Check File').first();
const hash = String($('Hash File').first().json.file_hash || '');
const register = $('Read Documents').all().map(i => i.json).filter(r => r.doc_id && r.status !== 'error');

let route = doc.json.kind;
let duplicateOf = '';
if (hash && (route === 'pdf' || route === 'image')) {
  const same = register.find(r => r.file_hash === hash);
  if (same) { route = 'duplicate_file'; duplicateOf = same.doc_id; }
}
const read = route === 'pdf' || route === 'image';

return [{
  json: { ...doc.json, file_hash: hash, route: read ? route : 'skip', skip_reason: read ? '' : route, duplicate_of: duplicateOf },
  binary: doc.binary
}];
