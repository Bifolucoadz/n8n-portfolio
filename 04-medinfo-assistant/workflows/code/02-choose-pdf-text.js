// Prefer the model's Markdown (tables and headings intact), but only if its numbers match the PDF
// text layer. A scan has no text layer to check against, so it is flagged as unverified OCR.
const layer = $('PDF Text Layer').first().json;
let transcript = '';
if ($('Read PDF as Markdown').isExecuted) {
  const parts = [];
  for (const o of $('Read PDF as Markdown').first().json.output ?? []) {
    for (const c of o.content ?? []) if (typeof c.text === 'string') parts.push(c.text);
  }
  transcript = parts.join('\n').trim().replace(/^```(?:markdown|md)?\s*\n/, '').replace(/\n```\s*$/, '');
  // The model sometimes copies the running footer despite the instructions.
  const footer = /(page\s+\d+\s+of\s+\d+)|(\u00b7\s*version\s+[\d.]+\s*\u00b7\s*effective)/i;
  transcript = transcript.split('\n').filter(l => !footer.test(l)).join('\n');
}
const numbers = s => s.replace(/<!--\s*page\s+\d+\s*-->/gi, ' ').match(/\d+(?:\.\d+)?/g) || [];

if (layer.scanned) {
  if (!transcript) throw new Error('Scanned PDF with no text layer, and the model did not read it (over 25 pages?)');
  return [{ json: { text: transcript, parse_method: 'pdf_ocr', parse_flags: ['ocr_unverified'], pages: layer.pages } }];
}
if (!transcript) {
  return [{ json: { text: layer.layer_text, parse_method: 'pdf_text', parse_flags: [], pages: layer.pages } }];
}
const have = new Set(numbers(layer.layer_text));
const nums = numbers(transcript);
const missing = nums.filter(n => !have.has(n));
const fidelity = nums.length ? 1 - missing.length / nums.length : 0;
const complete = transcript.replace(/\s/g, '').length > layer.layer_chars * 0.8;
const ok = fidelity >= 0.98 && complete;
return [{
  json: {
    text: ok ? transcript : layer.layer_text,
    parse_method: ok ? 'pdf_model' : 'pdf_text',
    parse_flags: ok ? [] : ['transcription_mismatch'],
    pages: layer.pages,
    fidelity: Math.round(fidelity * 1000) / 1000,
    missing_numbers: [...new Set(missing)].slice(0, 20),
  },
}];
