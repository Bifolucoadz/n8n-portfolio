// Join each manifest entry to its Drive folder and work out how to upload it.
const folders = {};
for (const f of $('Create Subfolders').all()) folders[f.json.name] = f.json.id;
const base = 'http://127.0.0.1:8765/';
const types = {
  pdf: { target: 'application/pdf', source: 'application/pdf' },
  gdoc: { target: 'application/vnd.google-apps.document', source: 'text/markdown' },
  gsheet: { target: 'application/vnd.google-apps.spreadsheet', source: 'text/csv' },
};
return $input.all().map(item => {
  const m = item.json;
  if (!folders[m.folder]) throw new Error(`No Drive folder for ${m.folder}`);
  if (!types[m.kind]) throw new Error(`Unknown kind ${m.kind} for ${m.file}`);
  return {
    json: {
      ...m,
      folder_id: folders[m.folder],
      url: base + encodeURIComponent(m.file),
      target_mime: types[m.kind].target,
      source_mime: types[m.kind].source,
    },
  };
});
