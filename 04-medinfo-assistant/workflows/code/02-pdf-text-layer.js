// The PDF's own text layer, page by page, without running footers. Used to check the model's
// reading and as the fallback. A PDF with almost no text layer is a scan.
const out = $input.first().json;
let pages = out.text;
if (!Array.isArray(pages)) pages = String(pages ?? '').split('\f');
const footer = /(page\s+\d+\s+of\s+\d+)|(\u00b7\s*version\s+[\d.]+\s*\u00b7\s*effective)/i;
const clean = pages.map(p => String(p ?? '').split('\n').filter(l => !footer.test(l)).join('\n').trim());
const chars = clean.reduce((n, p) => n + p.replace(/\s/g, '').length, 0);
const pageCount = Number(out.numpages) || clean.length || 1;
return [{
  json: {
    layer_text: clean.map((p, i) => `<!-- page ${i + 1} -->\n${p}`).join('\n\n'),
    layer_chars: chars,
    pages: pageCount,
    scanned: chars < 80 * pageCount,
    use_model: pageCount <= 25,
  },
  binary: $('Download PDF').first().binary,
}];
