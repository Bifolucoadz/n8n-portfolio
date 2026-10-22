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
__DOC_TEXT__
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
__PDF_TEXT_LAYER__
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
__PROMPT_PDF_TO_MARKDOWN__
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
__CHOOSE_PDF_TEXT__
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
__PARSE_AND_CHUNK__
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
__CONTEXT_BATCHES__
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
__PROMPT_CHUNK_CONTEXT__
        ,
        maxTokens: 12000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'chunk_context', strict: true, schema:
__SCHEMA_CHUNK_CONTEXT__
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
__ASSEMBLE_CHUNKS__
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
__BUILD_INDEX_PAYLOAD__
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
__PARSE_CATALOG__
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
