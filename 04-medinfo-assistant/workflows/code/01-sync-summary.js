// One line per file: what happened, how it was parsed and any quality flags.
const inputs = $('Action').all(1);
const results = $input.all().map((item, i) => ({ input: inputs[i]?.json ?? {}, out: item.json }));
const deleted = $('Delete From Index').isExecuted ? $('Delete From Index').all().map(i => i.json.result) : [];
const files = results.map(({ input, out }) => ({
  file: input.file_name,
  reason: input.reason,
  status: out.error ? 'failed' : out.status,
  doc_code: out.doc_code,
  chunks: out.chunks ?? out.catalog_rows,
  version_status: out.version_status,
  parse_method: out.parse_method,
  flags: out.parse_flags,
  number_check: out.number_check,
  error: out.error ? String(out.error.message ?? out.error) : undefined,
}));
return [{
  json: {
    indexed: files.filter(f => f.status === 'indexed').length,
    skipped: files.filter(f => f.status === 'skipped').length,
    failed: files.filter(f => f.status === 'failed').length,
    deleted: deleted.length,
    files,
    deleted_documents: deleted,
  },
}];
