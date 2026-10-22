// Drive multipart upload: JSON metadata + the Markdown/CSV body. Drive converts it to a Doc/Sheet.
const plan = $('Plan Uploads').item.json;
const boundary = 'larkmoor-' + Math.random().toString(36).slice(2, 12);
const meta = { name: plan.name, mimeType: plan.target_mime, parents: [plan.folder_id] };
const body =
  `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
  `--${boundary}\r\nContent-Type: ${plan.source_mime}; charset=UTF-8\r\n\r\n${$json.text}\r\n` +
  `--${boundary}--`;
return { json: { name: plan.name, boundary, body } };
