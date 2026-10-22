// Header fields, an empty-document guard, then heading-aware chunks: sections never mix, tables
// stay whole (split by rows with the header repeated only when huge), page numbers are tracked.
const file = $('When Called by Sync').first().json;
const src = $input.first().json;
const TARGET = 1200, MAX_TABLE = 2400, PARSER_VERSION = 1;
let text = String(src.text ?? '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');

if (text.replace(/\s/g, '').length < 300) {
  throw new Error(`"${file.file_name}" has under 300 characters of text. Not indexed; the previous version stays in the index.`);
}

// 1. Header fields ("Key: value"), wherever they sit near the top (PDF layouts can put two per line).
const head = text.slice(0, 4000).replace(/[*_`#|>\\]/g, ' ');
const stop = '(?=\\s{2,}|\\s+(?:Document No|Title|Product|Document type|Version|Effective date|Classification|Owner)\\b|\\n|$)';
const grab = (label, pattern) => {
  const m = head.match(new RegExp(label + '\\s*:\\s*' + pattern + stop, 'i'));
  return m ? m[1].trim() : '';
};
const meta = {
  doc_code: grab('Document No\\.?', '([A-Z0-9][A-Z0-9-]{2,})'),
  title: grab('Title', '(.+?)'),
  product: grab('Product', '([A-Za-z]+)'),
  doc_type: grab('Document type', '(.+?)'),
  version: grab('Version', '([0-9]+(?:\\.[0-9]+)*)'),
  effective_date: grab('Effective date', '(\\d{4}-\\d{2}-\\d{2})'),
};

// 2. A PDF read from its text layer has no Markdown headings: rebuild them from the numbering.
if (src.parse_method === 'pdf_text') {
  text = text.split('\n').map(l => {
    const t = l.trim();
    if (/^\d{1,2}\s+[A-Z][A-Z ,\/()&-]{3,}$/.test(t) || /^(BOXED WARNING|REVISION HISTORY)$/.test(t)) return '## ' + t;
    if (/^\d{1,2}\.\d{1,2}\s+[A-Z][A-Za-z0-9 ,\/()&-]{2,90}$/.test(t)) return '### ' + t;
    return l;
  }).join('\n');
}

// 3. Blocks: headings, paragraphs (blank-line separated) and tables, each with its page.
const blocks = [];
let page = String(src.parse_method || '').startsWith('pdf') ? 1 : null;
let para = [], table = [];
const flushPara = () => { if (para.length) { blocks.push({ type: 'text', text: para.join('\n').trim(), page }); para = []; } };
const flushTable = () => { if (table.length) { blocks.push({ type: 'table', rows: table.slice(), page }); table = []; } };
for (const raw of text.split('\n')) {
  const line = raw.replace(/\s+$/, '');
  const pm = line.match(/^<!--\s*page\s+(\d+)\s*-->$/i);
  if (pm) { flushPara(); flushTable(); page = Number(pm[1]); continue; }
  const hm = line.match(/^(#{1,6})\s+(.*)$/);
  if (hm) { flushPara(); flushTable(); blocks.push({ type: 'heading', level: hm[1].length, text: hm[2].replace(/[*_]/g, '').trim(), page }); continue; }
  if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); table.push(line.trim()); continue; }
  flushTable();
  if (line.trim() === '') { flushPara(); continue; }
  para.push(line);
}
flushPara(); flushTable();

// 4. Chunks within sections.
const path = [], chunks = [];
let cur = null, pendingHeading = '';
const sectionName = () => path.filter(h => h.level >= 2).map(h => h.text).join(' > ') || 'Document information';
const startChunk = p => {
  cur = { section: sectionName(), page: p, parts: [], size: 0 };
  if (pendingHeading) { cur.parts.push(pendingHeading); cur.size += pendingHeading.length; pendingHeading = ''; }
};
const flush = () => {
  if (cur && cur.parts.some(x => !/^#{1,6} /.test(x))) {
    chunks.push({ chunk_index: chunks.length, section: cur.section, page: cur.page, content: cur.parts.join('\n\n') });
  }
  cur = null;
};
const add = (t, p) => {
  if (!cur) startChunk(p);
  else if (cur.size > 0 && cur.size + t.length > TARGET) { flush(); startChunk(p); }
  cur.parts.push(t); cur.size += t.length + 2;
};
for (const b of blocks) {
  if (b.type === 'heading') {
    flush();
    while (path.length && path[path.length - 1].level >= b.level) path.pop();
    path.push({ level: b.level, text: b.text });
    pendingHeading = '#'.repeat(b.level) + ' ' + b.text;
    continue;
  }
  if (b.type === 'table') {
    const whole = b.rows.join('\n');
    if (whole.length <= MAX_TABLE) {
      if (cur && cur.size > 0 && cur.size + whole.length > TARGET * 1.6) flush();
      if (!cur) startChunk(b.page);
      cur.parts.push(whole); cur.size += whole.length + 2;
    } else {
      const isSep = r => /^\|\s*:?-{2,}/.test(r);
      const header = b.rows.slice(0, isSep(b.rows[1] || '') ? 2 : 1);
      let piece = [];
      const pushPiece = () => {
        if (!piece.length) return;
        flush(); startChunk(b.page);
        cur.parts.push(header.concat(piece).join('\n')); cur.size = TARGET;
        piece = [];
      };
      for (const r of b.rows.slice(header.length)) {
        if (header.join('\n').length + piece.join('\n').length + r.length > MAX_TABLE) pushPiece();
        piece.push(r);
      }
      pushPiece();
      flush();
    }
    continue;
  }
  if (b.text.length > TARGET * 1.5) {
    const sentences = b.text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [b.text];
    let buf = '';
    for (const s of sentences) {
      if (buf && (buf + s).length > TARGET) { add(buf.trim(), b.page); buf = ''; }
      buf += s;
    }
    if (buf.trim()) add(buf.trim(), b.page);
  } else add(b.text, b.page);
}
flush();
if (!chunks.length) throw new Error(`No chunks produced for "${file.file_name}"`);

const h1 = blocks.find(b => b.type === 'heading' && b.level === 1);
const document = {
  id: file.file_id,
  doc_code: meta.doc_code,
  title: meta.title || (h1 ? h1.text : String(file.file_name).replace(/\.[a-z0-9]+$/i, '')),
  product: meta.product.toLowerCase(),
  doc_type: meta.doc_type,
  version: meta.version,
  effective_date: meta.effective_date,
  access_level: file.access_level,
  folder: file.folder,
  mime_type: file.mime_type,
  url: file.url,
  modified_time: file.modified_time,
  parse_method: src.parse_method,
  parse_flags: src.parse_flags || [],
  parser_version: PARSER_VERSION,
};
return [{
  json: {
    document,
    chunks,
    doc_text: text.slice(0, 60000),
    stats: { chunks: chunks.length, chars: text.length, pages: src.pages ?? null, fidelity: src.fidelity ?? null, missing_numbers: src.missing_numbers ?? [] },
  },
}];
