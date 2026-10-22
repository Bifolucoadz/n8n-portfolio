// ---- lib-pdf.js (included by build.py): a small PDF writer, so documents need no outside service ----
// A4 pages, Helvetica and Helvetica-Bold (built into every PDF reader), boxes, lines, paths and links.
// Positions are in points from the top-left corner; the writer flips them for PDF.
const PDF_W = 595.28, PDF_H = 841.89;
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
// Characters outside ASCII that WinAnsiEncoding has: [code, width regular, width bold]
const WIN_EXTRA = { '£': [0xA3, 556, 556], '€': [0x80, 556, 556], '–': [0x96, 556, 556], '—': [0x97, 1000, 1000], '•': [0x95, 350, 350], '×': [0xD7, 584, 584], '’': [0x92, 222, 278], '‘': [0x91, 222, 278], '“': [0x93, 333, 500], '”': [0x94, 333, 500], 'é': [0xE9, 556, 556], '²': [0xB2, 333, 333], '°': [0xB0, 400, 400], '·': [0xB7, 278, 278], '…': [0x85, 1000, 1000], ' ': [0x20, 278, 278] };

function pdfChar(ch, bold) {
  const c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return [c, (bold ? HELV_B : HELV)[c - 32]];
  const x = WIN_EXTRA[ch];
  if (x) return [x[0], bold ? x[2] : x[1]];
  return [63, bold ? 611 : 556];
}
function textWidth(s, size, bold) {
  let w = 0;
  for (const ch of String(s)) w += pdfChar(ch, bold)[1];
  return w * size / 1000;
}
function pdfText(s, bold) {
  let out = '';
  for (const ch of String(s)) {
    const t = String.fromCharCode(pdfChar(ch, bold)[0]);
    out += (t === '(' || t === ')' || t === '\\') ? '\\' + t : t;
  }
  return '(' + out + ')';
}
// Word-wrap to a width; keeps the writer's line breaks.
function wrapText(s, size, bold, maxW) {
  const lines = [];
  for (const para of String(s === null || s === undefined ? '' : s).replace(/\t/g, ' ').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + word : word;
      if (!line || textWidth(t, size, bold) <= maxW) line = t;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}
const pdfNum = n => (Math.round(n * 100) / 100).toString();
function rgb(hex) {
  const h = String(hex).replace('#', '');
  return [0, 2, 4].map(i => pdfNum(parseInt(h.slice(i, i + 2), 16) / 255)).join(' ');
}

function newPdf(title) {
  const doc = { title: title || 'Document', pages: [], cur: null };
  doc.addPage = () => { const p = { ops: [], links: [] }; doc.pages.push(p); doc.cur = p; return p; };
  doc.rect = (x, y, w, h, fill) => doc.cur.ops.push(rgb(fill) + ' rg ' + pdfNum(x) + ' ' + pdfNum(PDF_H - y - h) + ' ' + pdfNum(w) + ' ' + pdfNum(h) + ' re f');
  doc.box = (x, y, w, h, stroke, width) => doc.cur.ops.push(rgb(stroke) + ' RG ' + pdfNum(width || 0.75) + ' w ' + pdfNum(x) + ' ' + pdfNum(PDF_H - y - h) + ' ' + pdfNum(w) + ' ' + pdfNum(h) + ' re S');
  doc.line = (x1, y1, x2, y2, color, width) => doc.cur.ops.push(rgb(color) + ' RG ' + pdfNum(width || 0.5) + ' w ' + pdfNum(x1) + ' ' + pdfNum(PDF_H - y1) + ' m ' + pdfNum(x2) + ' ' + pdfNum(PDF_H - y2) + ' l S');
  // y is the text baseline. align: left (x = start), right (x = end), center (x = middle)
  doc.text = (x, y, s, o) => {
    o = o || {};
    const size = o.size || 10, bold = !!o.bold;
    const w = textWidth(s, size, bold);
    const left = o.align === 'right' ? x - w : (o.align === 'center' ? x - w / 2 : x);
    doc.cur.ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + pdfNum(size) + ' Tf ' + rgb(o.color || '#1d2a24') + ' rg ' + pdfNum(left) + ' ' + pdfNum(PDF_H - y) + ' Td ' + pdfText(s, bold) + ' Tj ET');
    return w;
  };
  // A closed shape from moves, lines and curves: [['M',x,y], ['C',x1,y1,x2,y2,x,y], ['L',x,y]]
  doc.shape = (cmds, fill) => {
    const parts = cmds.map(c => c[0] === 'M' ? pdfNum(c[1]) + ' ' + pdfNum(PDF_H - c[2]) + ' m'
      : c[0] === 'L' ? pdfNum(c[1]) + ' ' + pdfNum(PDF_H - c[2]) + ' l'
      : [c[1], PDF_H - c[2], c[3], PDF_H - c[4], c[5], PDF_H - c[6]].map(pdfNum).join(' ') + ' c');
    doc.cur.ops.push(rgb(fill) + ' rg ' + parts.join(' ') + ' h f');
  };
  doc.link = (x, y, w, h, url) => doc.cur.links.push({ rect: [x, PDF_H - y - h, x + w, PDF_H - y].map(pdfNum).join(' '), url: String(url) });
  doc.render = () => {
    const objs = [];
    const add = s => { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add('PAGES');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    for (const p of doc.pages) {
      const stream = p.ops.join('\n');
      const contents = add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
      const annots = p.links.map(l => add('<< /Type /Annot /Subtype /Link /Rect [' + l.rect + '] /Border [0 0 0] /A << /S /URI /URI ' + pdfText(l.url) + ' >> >>'));
      kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PDF_W + ' ' + PDF_H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + contents + ' 0 R' + (annots.length ? ' /Annots [' + annots.map(a => a + ' 0 R').join(' ') + ']' : '') + ' >>'));
    }
    objs[1] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
    const info = add('<< /Title ' + pdfText(doc.title) + ' /Producer (n8n workflow) >>');
    let out = '%PDF-1.4\n%âãÏÓ\n';
    const offsets = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    return Buffer.from(out, 'latin1');
  };
  return doc;
}
// ---- end lib-pdf.js ----
