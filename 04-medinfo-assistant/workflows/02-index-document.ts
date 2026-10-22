import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const PG_CRED = { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } };

const called = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called by Sync',
    position: [200, 500],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'file_id', type: 'string' },
          { name: 'file_name', type: 'string' },
          { name: 'mime_type', type: 'string' },
          { name: 'modified_time', type: 'string' },
          { name: 'url', type: 'string' },
          { name: 'folder', type: 'string' },
          { name: 'access_level', type: 'string' }
        ]
      }
    }
  },
  output: [{ file_id: '1y5G', file_name: 'Quenvara Prescribing Information v5.0.pdf', mime_type: 'application/pdf', modified_time: '2026-10-07T03:03:30.000Z', url: 'https://drive.google.com/file/d/1y5G/view', folder: 'Public', access_level: 'public' }]
});

const fileType = switchCase({
  version: 3.4,
  config: {
    name: 'File Type',
    position: [420, 500],
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          {
            renameOutput: true,
            outputKey: 'Google Doc',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.mime_type }}'), rightValue: 'application/vnd.google-apps.document', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          },
          {
            renameOutput: true,
            outputKey: 'PDF',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.mime_type }}'), rightValue: 'application/pdf', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          },
          {
            renameOutput: true,
            outputKey: 'Catalog Sheet',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.mime_type }}'), rightValue: 'application/vnd.google-apps.spreadsheet', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'Unsupported' }
    }
  }
});

// ---- Google Doc ----
const exportDoc = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Export Doc as Markdown',
    position: [680, 200],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      method: 'GET',
      url: expr('https://www.googleapis.com/drive/v3/files/{{ $json.file_id }}/export?mimeType=text/markdown'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      options: { response: { response: { responseFormat: 'text', outputPropertyName: 'text' } } }
    },
    credentials: DRIVE_CRED
  },
  output: [{ text: '**Document No.:** SOP-PV-001' }]
});

const docText = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Doc Text',
    position: [920, 200],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Google Docs\' Markdown export escapes punctuation (\\- \\. \\( ...). Strip the escapes but keep \\| so\n' +
        '// a pipe inside a table cell doesn\'t become a new column.\n' +
        'const text = String($json.text ?? \'\').replace(/\\\\([\\\\`*_{}\\[\\]()#+\\-.!>~=$&<\'"%:])/g, \'$1\');\n' +
        'return [{ json: { text, parse_method: \'google_doc\', parse_flags: [], pages: null } }];\n'
    }
  },
  output: [{ text: '**Document No.:** SOP-PV-001', parse_method: 'google_doc', parse_flags: [], pages: null }]
});

// ---- PDF ----
const downloadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download PDF',
    position: [680, 460],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      method: 'GET',
      url: expr('https://www.googleapis.com/drive/v3/files/{{ $json.file_id }}?alt=media'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      options: { response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } }
    },
    credentials: DRIVE_CRED
  },
  output: [{}]
});

const extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Extract PDF Text Layer',
    position: [920, 460],
    parameters: {
      operation: 'pdf',
      binaryPropertyName: 'data',
      options: { joinPages: false }
    }
  },
  output: [{ numpages: 5, text: ['Document No.: LRK-PI-QNV'] }]
});

const pdfTextLayer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'PDF Text Layer',
    position: [1160, 460],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// The PDF\'s own text layer, page by page, without running footers. Used to check the model\'s\n' +
        '// reading and as the fallback. A PDF with almost no text layer is a scan.\n' +
        'const out = $input.first().json;\n' +
        'let pages = out.text;\n' +
        'if (!Array.isArray(pages)) pages = String(pages ?? \'\').split(\'\\f\');\n' +
        'const footer = /(page\\s+\\d+\\s+of\\s+\\d+)|(\\u00b7\\s*version\\s+[\\d.]+\\s*\\u00b7\\s*effective)/i;\n' +
        'const clean = pages.map(p => String(p ?? \'\').split(\'\\n\').filter(l => !footer.test(l)).join(\'\\n\').trim());\n' +
        'const chars = clean.reduce((n, p) => n + p.replace(/\\s/g, \'\').length, 0);\n' +
        'const pageCount = Number(out.numpages) || clean.length || 1;\n' +
        'return [{\n' +
        '  json: {\n' +
        '    layer_text: clean.map((p, i) => `<!-- page ${i + 1} -->\\n${p}`).join(\'\\n\\n\'),\n' +
        '    layer_chars: chars,\n' +
        '    pages: pageCount,\n' +
        '    scanned: chars < 80 * pageCount,\n' +
        '    use_model: pageCount <= 25,\n' +
        '  },\n' +
        '  binary: $(\'Download PDF\').first().binary,\n' +
        '}];\n'
    }
  },
  output: [{ layer_text: '<!-- page 1 -->\nDocument No.: LRK-PI-QNV', layer_chars: 9000, pages: 5, scanned: false, use_model: true }]
});

const useModel = ifElse({
  version: 2.3,
  config: {
    name: 'Short Enough to Read?',
    position: [1400, 460],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.use_model }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const readPdf = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Read PDF as Markdown',
    position: [1640, 380],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [
        { type: 'file', role: 'user', fileType: 'base64', binaryPropertyName: 'data', fileName: expr("{{ $('When Called by Sync').first().json.file_name }}") },
        { type: 'text', role: 'user', content: 'Transcribe this document into Markdown following the rules.' }
      ] },
      options: {
        instructions:
        'You convert regulated pharmaceutical documents (labels, letters, procedures) into Markdown for a search index. Accuracy matters more than anything else: a wrong number could harm a patient.\n' +
        '\n' +
        'Rules:\n' +
        '- Transcribe everything, in reading order. Never summarize, shorten, reword, correct, translate or skip content.\n' +
        '- Copy every number, unit, symbol, code and date exactly as printed.\n' +
        '- Start each page with a line `<!-- page N -->`, where N is the page number in the file (1, 2, 3...).\n' +
        '- Put each header field that is printed in the document (Document No., Title, Product, Document type, Version, Effective date) on its own line as `Key: value`. Never add a field that is not printed.\n' +
        '- Headings: `#` for the document title, `##` for numbered top-level sections (for example `## 2 DOSAGE AND ADMINISTRATION`) and for unnumbered major headings, `###` for subsections (for example `### 2.3 Dosage in renal impairment`).\n' +
        '- Tables: reproduce as Markdown tables with the header row and every row and cell. If a table continues on the next page, continue it after the page marker with the header row repeated.\n' +
        '- Lists: keep bullets and numbering.\n' +
        '- Leave out running page footers and page numbers ("Page 2 of 5").\n' +
        '- If text is illegible, write [illegible] instead of guessing.\n' +
        '- Output only the Markdown, with no code fences and no comments of your own.\n'
        ,
        maxTokens: 24000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: '<!-- page 1 -->\nDocument No.: LRK-PI-QNV' }] }] }]
});

const choosePdfText = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Choose PDF Text',
    position: [1880, 460],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Prefer the model\'s Markdown (tables and headings intact), but only if its numbers match the PDF\n' +
        '// text layer. A scan has no text layer to check against, so it is flagged as unverified OCR.\n' +
        'const layer = $(\'PDF Text Layer\').first().json;\n' +
        'let transcript = \'\';\n' +
        'if ($(\'Read PDF as Markdown\').isExecuted) {\n' +
        '  const parts = [];\n' +
        '  for (const o of $(\'Read PDF as Markdown\').first().json.output ?? []) {\n' +
        '    for (const c of o.content ?? []) if (typeof c.text === \'string\') parts.push(c.text);\n' +
        '  }\n' +
        '  transcript = parts.join(\'\\n\').trim().replace(/^```(?:markdown|md)?\\s*\\n/, \'\').replace(/\\n```\\s*$/, \'\');\n' +
        '  // The model sometimes copies the running footer despite the instructions.\n' +
        '  const footer = /(page\\s+\\d+\\s+of\\s+\\d+)|(\\u00b7\\s*version\\s+[\\d.]+\\s*\\u00b7\\s*effective)/i;\n' +
        '  transcript = transcript.split(\'\\n\').filter(l => !footer.test(l)).join(\'\\n\');\n' +
        '}\n' +
        'const numbers = s => s.replace(/<!--\\s*page\\s+\\d+\\s*-->/gi, \' \').match(/\\d+(?:\\.\\d+)?/g) || [];\n' +
        '\n' +
        'if (layer.scanned) {\n' +
        '  if (!transcript) throw new Error(\'Scanned PDF with no text layer, and the model did not read it (over 25 pages?)\');\n' +
        '  return [{ json: { text: transcript, parse_method: \'pdf_ocr\', parse_flags: [\'ocr_unverified\'], pages: layer.pages } }];\n' +
        '}\n' +
        'if (!transcript) {\n' +
        '  return [{ json: { text: layer.layer_text, parse_method: \'pdf_text\', parse_flags: [], pages: layer.pages } }];\n' +
        '}\n' +
        'const have = new Set(numbers(layer.layer_text));\n' +
        'const nums = numbers(transcript);\n' +
        'const missing = nums.filter(n => !have.has(n));\n' +
        'const fidelity = nums.length ? 1 - missing.length / nums.length : 0;\n' +
        'const complete = transcript.replace(/\\s/g, \'\').length > layer.layer_chars * 0.8;\n' +
        'const ok = fidelity >= 0.98 && complete;\n' +
        'return [{\n' +
        '  json: {\n' +
        '    text: ok ? transcript : layer.layer_text,\n' +
        '    parse_method: ok ? \'pdf_model\' : \'pdf_text\',\n' +
        '    parse_flags: ok ? [] : [\'transcription_mismatch\'],\n' +
        '    pages: layer.pages,\n' +
        '    fidelity: Math.round(fidelity * 1000) / 1000,\n' +
        '    missing_numbers: [...new Set(missing)].slice(0, 20),\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ text: '<!-- page 1 -->\nDocument No.: LRK-PI-QNV', parse_method: 'pdf_model', parse_flags: [], pages: 5, fidelity: 1, missing_numbers: [] }]
});

// ---- Shared: chunk, add context, embed, save ----
const parseAndChunk = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse and Chunk',
    position: [2140, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Header fields, an empty-document guard, then heading-aware chunks: sections never mix, tables\n' +
        '// stay whole (split by rows with the header repeated only when huge), page numbers are tracked.\n' +
        'const file = $(\'When Called by Sync\').first().json;\n' +
        'const src = $input.first().json;\n' +
        'const TARGET = 1200, MAX_TABLE = 2400, PARSER_VERSION = 1;\n' +
        'let text = String(src.text ?? \'\').replace(/\\r\\n?/g, \'\\n\').replace(/\\u00a0/g, \' \');\n' +
        '\n' +
        'if (text.replace(/\\s/g, \'\').length < 300) {\n' +
        '  throw new Error(`"${file.file_name}" has under 300 characters of text. Not indexed; the previous version stays in the index.`);\n' +
        '}\n' +
        '\n' +
        '// 1. Header fields ("Key: value"), wherever they sit near the top (PDF layouts can put two per line).\n' +
        'const head = text.slice(0, 4000).replace(/[*_`#|>\\\\]/g, \' \');\n' +
        'const stop = \'(?=\\\\s{2,}|\\\\s+(?:Document No|Title|Product|Document type|Version|Effective date|Classification|Owner)\\\\b|\\\\n|$)\';\n' +
        'const grab = (label, pattern) => {\n' +
        '  const m = head.match(new RegExp(label + \'\\\\s*:\\\\s*\' + pattern + stop, \'i\'));\n' +
        '  return m ? m[1].trim() : \'\';\n' +
        '};\n' +
        'const meta = {\n' +
        '  doc_code: grab(\'Document No\\\\.?\', \'([A-Z0-9][A-Z0-9-]{2,})\'),\n' +
        '  title: grab(\'Title\', \'(.+?)\'),\n' +
        '  product: grab(\'Product\', \'([A-Za-z]+)\'),\n' +
        '  doc_type: grab(\'Document type\', \'(.+?)\'),\n' +
        '  version: grab(\'Version\', \'([0-9]+(?:\\\\.[0-9]+)*)\'),\n' +
        '  effective_date: grab(\'Effective date\', \'(\\\\d{4}-\\\\d{2}-\\\\d{2})\'),\n' +
        '};\n' +
        '\n' +
        '// 2. A PDF read from its text layer has no Markdown headings: rebuild them from the numbering.\n' +
        'if (src.parse_method === \'pdf_text\') {\n' +
        '  text = text.split(\'\\n\').map(l => {\n' +
        '    const t = l.trim();\n' +
        '    if (/^\\d{1,2}\\s+[A-Z][A-Z ,\\/()&-]{3,}$/.test(t) || /^(BOXED WARNING|REVISION HISTORY)$/.test(t)) return \'## \' + t;\n' +
        '    if (/^\\d{1,2}\\.\\d{1,2}\\s+[A-Z][A-Za-z0-9 ,\\/()&-]{2,90}$/.test(t)) return \'### \' + t;\n' +
        '    return l;\n' +
        '  }).join(\'\\n\');\n' +
        '}\n' +
        '\n' +
        '// 3. Blocks: headings, paragraphs (blank-line separated) and tables, each with its page.\n' +
        'const blocks = [];\n' +
        'let page = String(src.parse_method || \'\').startsWith(\'pdf\') ? 1 : null;\n' +
        'let para = [], table = [];\n' +
        'const flushPara = () => { if (para.length) { blocks.push({ type: \'text\', text: para.join(\'\\n\').trim(), page }); para = []; } };\n' +
        'const flushTable = () => { if (table.length) { blocks.push({ type: \'table\', rows: table.slice(), page }); table = []; } };\n' +
        'for (const raw of text.split(\'\\n\')) {\n' +
        '  const line = raw.replace(/\\s+$/, \'\');\n' +
        '  const pm = line.match(/^<!--\\s*page\\s+(\\d+)\\s*-->$/i);\n' +
        '  if (pm) { flushPara(); flushTable(); page = Number(pm[1]); continue; }\n' +
        '  const hm = line.match(/^(#{1,6})\\s+(.*)$/);\n' +
        '  if (hm) { flushPara(); flushTable(); blocks.push({ type: \'heading\', level: hm[1].length, text: hm[2].replace(/[*_]/g, \'\').trim(), page }); continue; }\n' +
        '  if (/^\\s*\\|.*\\|\\s*$/.test(line)) { flushPara(); table.push(line.trim()); continue; }\n' +
        '  flushTable();\n' +
        '  if (line.trim() === \'\') { flushPara(); continue; }\n' +
        '  para.push(line);\n' +
        '}\n' +
        'flushPara(); flushTable();\n' +
        '\n' +
        '// 4. Chunks within sections.\n' +
        'const path = [], chunks = [];\n' +
        'let cur = null, pendingHeading = \'\';\n' +
        'const sectionName = () => path.filter(h => h.level >= 2).map(h => h.text).join(\' > \') || \'Document information\';\n' +
        'const startChunk = p => {\n' +
        '  cur = { section: sectionName(), page: p, parts: [], size: 0 };\n' +
        '  if (pendingHeading) { cur.parts.push(pendingHeading); cur.size += pendingHeading.length; pendingHeading = \'\'; }\n' +
        '};\n' +
        'const flush = () => {\n' +
        '  if (cur && cur.parts.some(x => !/^#{1,6} /.test(x))) {\n' +
        '    chunks.push({ chunk_index: chunks.length, section: cur.section, page: cur.page, content: cur.parts.join(\'\\n\\n\') });\n' +
        '  }\n' +
        '  cur = null;\n' +
        '};\n' +
        'const add = (t, p) => {\n' +
        '  if (!cur) startChunk(p);\n' +
        '  else if (cur.size > 0 && cur.size + t.length > TARGET) { flush(); startChunk(p); }\n' +
        '  cur.parts.push(t); cur.size += t.length + 2;\n' +
        '};\n' +
        'for (const b of blocks) {\n' +
        '  if (b.type === \'heading\') {\n' +
        '    flush();\n' +
        '    while (path.length && path[path.length - 1].level >= b.level) path.pop();\n' +
        '    path.push({ level: b.level, text: b.text });\n' +
        '    pendingHeading = \'#\'.repeat(b.level) + \' \' + b.text;\n' +
        '    continue;\n' +
        '  }\n' +
        '  if (b.type === \'table\') {\n' +
        '    const whole = b.rows.join(\'\\n\');\n' +
        '    if (whole.length <= MAX_TABLE) {\n' +
        '      if (cur && cur.size > 0 && cur.size + whole.length > TARGET * 1.6) flush();\n' +
        '      if (!cur) startChunk(b.page);\n' +
        '      cur.parts.push(whole); cur.size += whole.length + 2;\n' +
        '    } else {\n' +
        '      const isSep = r => /^\\|\\s*:?-{2,}/.test(r);\n' +
        '      const header = b.rows.slice(0, isSep(b.rows[1] || \'\') ? 2 : 1);\n' +
        '      let piece = [];\n' +
        '      const pushPiece = () => {\n' +
        '        if (!piece.length) return;\n' +
        '        flush(); startChunk(b.page);\n' +
        '        cur.parts.push(header.concat(piece).join(\'\\n\')); cur.size = TARGET;\n' +
        '        piece = [];\n' +
        '      };\n' +
        '      for (const r of b.rows.slice(header.length)) {\n' +
        '        if (header.join(\'\\n\').length + piece.join(\'\\n\').length + r.length > MAX_TABLE) pushPiece();\n' +
        '        piece.push(r);\n' +
        '      }\n' +
        '      pushPiece();\n' +
        '      flush();\n' +
        '    }\n' +
        '    continue;\n' +
        '  }\n' +
        '  if (b.text.length > TARGET * 1.5) {\n' +
        '    const sentences = b.text.match(/[^.!?]+[.!?]+(\\s|$)|[^.!?]+$/g) || [b.text];\n' +
        '    let buf = \'\';\n' +
        '    for (const s of sentences) {\n' +
        '      if (buf && (buf + s).length > TARGET) { add(buf.trim(), b.page); buf = \'\'; }\n' +
        '      buf += s;\n' +
        '    }\n' +
        '    if (buf.trim()) add(buf.trim(), b.page);\n' +
        '  } else add(b.text, b.page);\n' +
        '}\n' +
        'flush();\n' +
        'if (!chunks.length) throw new Error(`No chunks produced for "${file.file_name}"`);\n' +
        '\n' +
        'const h1 = blocks.find(b => b.type === \'heading\' && b.level === 1);\n' +
        'const document = {\n' +
        '  id: file.file_id,\n' +
        '  doc_code: meta.doc_code,\n' +
        '  title: meta.title || (h1 ? h1.text : String(file.file_name).replace(/\\.[a-z0-9]+$/i, \'\')),\n' +
        '  product: meta.product.toLowerCase(),\n' +
        '  doc_type: meta.doc_type,\n' +
        '  version: meta.version,\n' +
        '  effective_date: meta.effective_date,\n' +
        '  access_level: file.access_level,\n' +
        '  folder: file.folder,\n' +
        '  mime_type: file.mime_type,\n' +
        '  url: file.url,\n' +
        '  modified_time: file.modified_time,\n' +
        '  parse_method: src.parse_method,\n' +
        '  parse_flags: src.parse_flags || [],\n' +
        '  parser_version: PARSER_VERSION,\n' +
        '};\n' +
        'return [{\n' +
        '  json: {\n' +
        '    document,\n' +
        '    chunks,\n' +
        '    doc_text: text.slice(0, 60000),\n' +
        '    stats: { chunks: chunks.length, chars: text.length, pages: src.pages ?? null, fidelity: src.fidelity ?? null, missing_numbers: src.missing_numbers ?? [] },\n' +
        '  },\n' +
        '}];\n'
    }
  },
  output: [{ document: { id: '1y5G', doc_code: 'LRK-PI-QNV', title: 'Quenvara (davorixaban) tablets: Prescribing Information' }, chunks: [{ chunk_index: 0, section: '2 DOSAGE AND ADMINISTRATION > 2.3 Dosage in renal impairment', page: 2, content: '| Creatinine clearance |' }], doc_text: '...', stats: { chunks: 36 } }]
});

const contextBatches = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Context Batches',
    position: [2380, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// One context call per 30 chunks. Every call starts with the same full document, so OpenAI\'s\n' +
        '// automatic prompt caching makes the second and later batches cheap.\n' +
        'const { document, chunks, doc_text } = $input.first().json;\n' +
        'const BATCH = 30, out = [];\n' +
        'for (let b = 0; b < chunks.length; b += BATCH) {\n' +
        '  const list = chunks.slice(b, b + BATCH)\n' +
        '    .map(c => `<chunk i="${c.chunk_index}" section="${String(c.section).replace(/"/g, "\'")}">\\n${c.content.slice(0, 1800)}\\n</chunk>`)\n' +
        '    .join(\'\\n\');\n' +
        '  out.push({ json: { batch: b / BATCH, prompt: `<document file="${document.title}">\\n${doc_text}\\n</document>\\n\\n<chunks>\\n${list}\\n</chunks>` } });\n' +
        '}\n' +
        'return out;\n'
    }
  },
  output: [{ batch: 0, prompt: '<document>...</document>' }]
});

const writeContext = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Write Chunk Context',
    position: [2620, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
        'You prepare chunks of a pharmaceutical company document for a hybrid (semantic + keyword) search engine used by Medical Information staff and healthcare professionals.\n' +
        '\n' +
        'For every chunk in <chunks>, write one context sentence of at most 35 words that situates the chunk within the whole document, so that the chunk can be found on its own. Name the product (brand and generic name), the document type and the specific topic of the chunk. Resolve references the chunk relies on, such as "this dose", "see 2.3" or "the study". Use words a searcher would use, including common synonyms (for example "kidney" for "renal"). Do not repeat the chunk text and do not add facts that are not in the document.\n' +
        '\n' +
        'Also return the document\'s header fields if the document states them (document number, title, product, document type, version, effective date as YYYY-MM-DD), using an empty string for any that are missing, and a 2 to 3 sentence summary of what the whole document covers.\n' +
        '\n' +
        'Return a context for every chunk index you were given, using the index from the chunk\'s i attribute.\n'
        ,
        maxTokens: 12000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'chunk_context', strict: true, schema:
        '{"type":"object","additionalProperties":false,"required":["doc_code","title","product","doc_type","version","effective_date","summary","contexts"],"properties":{"doc_code":{"type":"string","description":"Document number from the header, or an empty string"},"title":{"type":"string"},"product":{"type":"string","description":"Product brand name, or General for documents that cover all products"},"doc_type":{"type":"string"},"version":{"type":"string"},"effective_date":{"type":"string","description":"YYYY-MM-DD, or an empty string"},"summary":{"type":"string","description":"2 to 3 sentences on what the whole document covers"},"contexts":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["i","context"],"properties":{"i":{"type":"integer"},"context":{"type":"string"}}}}}}'
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { doc_code: 'LRK-PI-QNV', summary: '...', contexts: [{ i: 0, context: '...' }] } }] }] }]
});

const assembleChunks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Assemble Chunks',
    position: [2860, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Merge the context sentences and any header fields the model found, then build embedding inputs.\n' +
        'const parsed = $(\'Parse and Chunk\').first().json;\n' +
        'const document = { ...parsed.document };\n' +
        'const contexts = {};\n' +
        'let found = {};\n' +
        'for (const item of $input.all()) {\n' +
        '  let data = null;\n' +
        '  for (const o of item.json.output ?? []) {\n' +
        '    for (const c of o.content ?? []) {\n' +
        '      if (c.text && typeof c.text === \'object\') data = c.text;\n' +
        '      else if (typeof c.text === \'string\') { try { data = JSON.parse(c.text); } catch (e) { /* ignore */ } }\n' +
        '    }\n' +
        '  }\n' +
        '  if (!data) continue;\n' +
        '  for (const x of data.contexts ?? []) if (x && Number.isInteger(x.i)) contexts[x.i] = String(x.context ?? \'\').trim();\n' +
        '  if (!found.summary && data.summary) found = data;\n' +
        '}\n' +
        'for (const k of [\'doc_code\', \'title\', \'product\', \'doc_type\', \'version\', \'effective_date\']) {\n' +
        '  if (!document[k] && found[k]) document[k] = String(found[k]).trim();\n' +
        '}\n' +
        'document.product = String(document.product || \'general\').toLowerCase().split(/\\s+/)[0] || \'general\';\n' +
        'if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(document.effective_date || \'\')) document.effective_date = String(document.modified_time || \'\').slice(0, 10);\n' +
        'if (!document.doc_code) document.doc_code = \'DRIVE-\' + document.id;\n' +
        'document.summary = String(found.summary || \'\').slice(0, 800);\n' +
        'const missing = parsed.chunks.filter(c => !contexts[c.chunk_index]).length;\n' +
        'if (missing) document.parse_flags = [...(document.parse_flags || []), `context_missing_${missing}`];\n' +
        'const chunks = parsed.chunks.map(c => ({ ...c, context: contexts[c.chunk_index] || `${document.title}, section ${c.section}.` }));\n' +
        'const inputs = chunks.map(c => `${document.title} | ${c.section}\\n${c.context}\\n\\n${c.content}`.slice(0, 7000));\n' +
        'return [{ json: { document, chunks, inputs } }];\n'
    }
  },
  output: [{ document: { id: '1y5G' }, chunks: [{ chunk_index: 0, context: '...' }], inputs: ['Quenvara | 2.3 ...'] }]
});

const embedChunks = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Embed Chunks',
    position: [3100, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/embeddings',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ { model: "text-embedding-3-small", input: $json.inputs } }}'),
      options: { timeout: 120000 }
    },
    credentials: OPENAI_CRED
  },
  output: [{ data: [{ index: 0, embedding: [0.01] }] }]
});

const buildPayload = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Index Payload',
    position: [3340, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Attach each embedding to its chunk. The payload goes to kb_index_document as one JSON parameter.\n' +
        'const prep = $(\'Assemble Chunks\').first().json;\n' +
        'const data = $input.first().json.data ?? [];\n' +
        'if (data.length !== prep.chunks.length) throw new Error(`Got ${data.length} embeddings for ${prep.chunks.length} chunks`);\n' +
        'const byIndex = {};\n' +
        'for (const d of data) byIndex[d.index] = d.embedding;\n' +
        'const chunks = prep.chunks.map((c, i) => ({\n' +
        '  chunk_index: c.chunk_index, section: c.section, page: c.page, content: c.content, context: c.context, embedding: byIndex[i],\n' +
        '}));\n' +
        'return [{ json: { payload: JSON.stringify({ document: prep.document, chunks }) } }];\n'
    }
  },
  output: [{ payload: '{"document":{},"chunks":[]}' }]
});

const saveIndex = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save to Index',
    position: [3580, 300],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
    parameters: {
      operation: 'executeQuery',
      query: 'select kb_index_document($1::jsonb) as result;',
      options: { queryReplacement: expr('{{ $json.payload }}') }
    },
    credentials: PG_CRED
  },
  output: [{ result: { document_id: '1y5G', doc_code: 'LRK-PI-QNV', chunks: 36, status: 'current' } }]
});

const indexResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Index Result',
    position: [3820, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'status', name: 'status', value: 'indexed', type: 'string' },
          { id: 'file', name: 'file_name', value: expr("{{ $('When Called by Sync').first().json.file_name }}"), type: 'string' },
          { id: 'code', name: 'doc_code', value: expr('{{ $json.result.doc_code }}'), type: 'string' },
          { id: 'chunks', name: 'chunks', value: expr('{{ $json.result.chunks }}'), type: 'number' },
          { id: 'vstatus', name: 'version_status', value: expr('{{ $json.result.status }}'), type: 'string' },
          { id: 'method', name: 'parse_method', value: expr("{{ $('Assemble Chunks').first().json.document.parse_method }}"), type: 'string' },
          { id: 'flags', name: 'parse_flags', value: expr("{{ $('Assemble Chunks').first().json.document.parse_flags }}"), type: 'array' },
          { id: 'fidelity', name: 'number_check', value: expr("{{ $('Parse and Chunk').first().json.stats.fidelity }}"), type: 'number' }
        ]
      }
    }
  },
  output: [{ status: 'indexed', file_name: 'Quenvara Prescribing Information v5.0.pdf', doc_code: 'LRK-PI-QNV', chunks: 36, version_status: 'current', parse_method: 'pdf_model', parse_flags: [], number_check: 1 }]
});

// ---- Catalog sheet ----
const exportSheet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Export Sheet as CSV',
    position: [680, 760],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      method: 'GET',
      url: expr('https://www.googleapis.com/drive/v3/files/{{ $json.file_id }}/export?mimeType=text/csv'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      options: { response: { response: { responseFormat: 'text', outputPropertyName: 'text' } } }
    },
    credentials: DRIVE_CRED
  },
  output: [{ text: 'product,generic_name\nQuenvara,davorixaban' }]
});

const parseCatalog = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Catalog',
    position: [920, 760],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// The catalog sheet exported as CSV -> rows for kb_products (quoted fields may hold commas).\n' +
        'const file = $(\'When Called by Sync\').first().json;\n' +
        'const csv = String($json.text ?? \'\').replace(/^\\uFEFF/, \'\');\n' +
        'const rows = [];\n' +
        'let row = [], field = \'\', quoted = false;\n' +
        'for (let i = 0; i < csv.length; i++) {\n' +
        '  const ch = csv[i];\n' +
        '  if (quoted) {\n' +
        '    if (ch === \'"\') { if (csv[i + 1] === \'"\') { field += \'"\'; i++; } else quoted = false; }\n' +
        '    else field += ch;\n' +
        '  } else if (ch === \'"\') quoted = true;\n' +
        '  else if (ch === \',\') { row.push(field); field = \'\'; }\n' +
        '  else if (ch === \'\\n\' || ch === \'\\r\') {\n' +
        '    if (ch === \'\\r\' && csv[i + 1] === \'\\n\') i++;\n' +
        '    row.push(field); rows.push(row); row = []; field = \'\';\n' +
        '  } else field += ch;\n' +
        '}\n' +
        'if (field !== \'\' || row.length) { row.push(field); rows.push(row); }\n' +
        'const header = (rows.shift() || []).map(h => h.trim().toLowerCase().replace(/\\s+/g, \'_\'));\n' +
        'const records = rows\n' +
        '  .filter(r => r.some(v => v.trim() !== \'\'))\n' +
        '  .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? \'\').trim()])));\n' +
        'if (!records.length) throw new Error(\'The product catalog has no rows. Not synced; the previous catalog stays in place.\');\n' +
        'const day = String(file.modified_time || \'\').slice(0, 10);\n' +
        'const document = {\n' +
        '  id: file.file_id, doc_code: \'LRK-CATALOG\', title: file.file_name, version: day, effective_date: day,\n' +
        '  access_level: file.access_level, folder: file.folder, mime_type: file.mime_type, url: file.url,\n' +
        '  modified_time: file.modified_time,\n' +
        '  summary: \'Product catalog: NDC numbers, pack sizes, storage, list prices and supply status.\',\n' +
        '};\n' +
        'return [{ json: { payload: JSON.stringify({ document, rows: records }), rows: records.length } }];\n'
    }
  },
  output: [{ payload: '{"document":{},"rows":[]}', rows: 10 }]
});

const replaceCatalog = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Replace Product Catalog',
    position: [1160, 760],
    parameters: {
      operation: 'executeQuery',
      query: 'select kb_replace_products($1::jsonb) as result;',
      options: { queryReplacement: expr('{{ $json.payload }}') }
    },
    credentials: PG_CRED
  },
  output: [{ result: { document_id: '12Uw', rows: 10 } }]
});

const catalogResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Catalog Result',
    position: [1400, 760],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'status', name: 'status', value: 'indexed', type: 'string' },
          { id: 'file', name: 'file_name', value: expr("{{ $('When Called by Sync').first().json.file_name }}"), type: 'string' },
          { id: 'code', name: 'doc_code', value: 'LRK-CATALOG', type: 'string' },
          { id: 'rows', name: 'catalog_rows', value: expr('{{ $json.result.rows }}'), type: 'number' }
        ]
      }
    }
  },
  output: [{ status: 'indexed', file_name: 'Larkmoor Product Catalog', doc_code: 'LRK-CATALOG', catalog_rows: 10 }]
});

// ---- Anything else ----
const unsupported = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Unsupported File',
    position: [680, 1000],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'status', name: 'status', value: 'skipped', type: 'string' },
          { id: 'file', name: 'file_name', value: expr('{{ $json.file_name }}'), type: 'string' },
          { id: 'reason', name: 'reason', value: expr('Unsupported file type {{ $json.mime_type }}. Supported: Google Docs, PDFs and the catalog Google Sheet.'), type: 'string' }
        ]
      }
    }
  },
  output: [{ status: 'skipped', file_name: 'notes.docx', reason: 'Unsupported file type' }]
});

const noteOverview = sticky(
  '## MedInfo 2: Index Document\n' +
  'Called by **MedInfo 1: Sync Knowledge** once per new or changed Drive file.\n\n' +
  '- **Google Doc**: exported as Markdown.\n' +
  '- **PDF**: the model reads the PDF into Markdown (tables and headings kept). Every number it writes must also be in the PDF text layer (98%+), otherwise the text layer is used and the file is flagged `transcription_mismatch`. A scan has no text layer, so it is flagged `ocr_unverified`.\n' +
  '- **Catalog sheet**: exported as CSV and replaces `kb_products`.',
  [called, fileType, exportDoc, docText, downloadPdf, extractPdf, pdfTextLayer, useModel, readPdf, choosePdfText],
  { color: 4 }
);

const noteIndex = sticky(
  '## Chunk, add context, embed, save\n' +
  '- Header fields (document number, version, effective date, product) are parsed; under 300 characters is an error, never an empty index.\n' +
  '- Chunks follow the headings and never mix sections; tables stay whole.\n' +
  '- **Contextual retrieval**: GPT-5.4 mini writes one sentence per chunk placing it in the whole document.\n' +
  '- One batched embeddings call, then `kb_index_document` swaps the chunks and marks older versions with the same document number as superseded, all in one transaction.',
  [parseAndChunk, contextBatches, writeContext, assembleChunks, embedChunks, buildPayload, saveIndex, indexResult],
  { color: 5 }
);

export default workflow('medinfo-index-document', 'MedInfo 2: Index Document')
  .add(called)
  .to(fileType
    .onCase(0, exportDoc.to(docText).to(parseAndChunk))
    .onCase(1, downloadPdf.to(extractPdf).to(pdfTextLayer).to(useModel
      .onTrue(readPdf.to(choosePdfText))
      .onFalse(choosePdfText)))
    .onCase(2, exportSheet.to(parseCatalog).to(replaceCatalog).to(catalogResult))
    .onCase(3, unsupported))
  .add(choosePdfText)
  .to(parseAndChunk)
  .to(contextBatches)
  .to(writeContext)
  .to(assembleChunks)
  .to(embedChunks)
  .to(buildPayload)
  .to(saveIndex)
  .to(indexResult)
  .add(noteOverview)
  .add(noteIndex);
