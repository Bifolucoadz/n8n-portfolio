// One item per uploaded file, with who sent it and their note.
const item = $input.first();
const j = item.json;
const name = String(j.name || j['Your name'] || '').trim().slice(0, 100);
const note = String(j.note || j['Anything we should know?'] || '').trim().slice(0, 500);
const now = DateTime.now().setZone('America/New_York').toISO();
return Object.entries(item.binary || {}).map(([key, file]) => ({
  json: { source: 'upload', sender: name, note, received_at: now, original_filename: file.fileName || key },
  binary: { data: file }
}));
