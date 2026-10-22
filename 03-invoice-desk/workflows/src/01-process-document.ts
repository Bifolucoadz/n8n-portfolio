import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called',
    position: [240, 420],
    parameters: { inputSource: 'passthrough' }
  },
  output: [{ source: 'upload', sender: 'Dana', original_filename: 'harborline-produce-INV-10482.pdf', received_at: '2026-10-01T18:00:00.000-04:00' }]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [460, 420],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [
        { id: 'c1', name: 'APPROVAL_LIMIT', value: 1000, type: 'number' },
        { id: 'c2', name: 'BASE_CURRENCY', value: 'USD', type: 'string' },
        { id: 'c3', name: 'MAX_FILE_MB', value: 10, type: 'number' },
        { id: 'c4', name: 'TIMEZONE', value: 'America/New_York', type: 'string' },
        { id: 'c5', name: 'MODEL', value: 'gpt-5.4-mini', type: 'string' },
        { id: 'c6', name: 'FILED_FOLDER_ID', value: '1IG8wCIAjJpQrGIE2sRT39Jm9wccJQsmZ', type: 'string' },
        { id: 'c7', name: 'OTHER_FOLDER_ID', value: '1TPg0f11y-ksAxyPBrELf4gKsulBZ4DLB', type: 'string' }
      ] },
      options: { includeBinary: false }
    }
  },
  output: [{ APPROVAL_LIMIT: 1000, BASE_CURRENCY: 'USD', MAX_FILE_MB: 10, TIMEZONE: 'America/New_York', MODEL: 'gpt-5.4-mini', FILED_FOLDER_ID: '1IG8', OTHER_FOLDER_ID: '1TPg' }]
});

const checkFile = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Check File',
    position: [680, 420],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__CHECK_FILE__
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', source: 'upload', original_filename: 'harborline-produce-INV-10482.pdf', ext: 'pdf', kind: 'pdf', bytes: 70883 }]
});

const hashFile = node({
  type: 'n8n-nodes-base.crypto',
  version: 1,
  config: {
    name: 'Hash File',
    position: [900, 420],
    onError: 'continueRegularOutput',
    parameters: { action: 'hash', binaryData: true, binaryPropertyName: 'data', type: 'SHA256', dataPropertyName: 'file_hash', encoding: 'hex' }
  },
  output: [{ doc_id: 'SK-261001-K7QM', file_hash: '0e19485d' }]
});

const readDocuments = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Documents',
    position: [1120, 420],
    executeOnce: true,
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Documents' } },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, doc_id: 'SK-260930-ABCD', status: 'auto_approved', supplier: 'Harborline Produce Co.', invoice_number: 'INV-10400', file_hash: 'aa' }]
});

const readSuppliers = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Suppliers',
    position: [1340, 420],
    executeOnce: true,
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: { __rl: true, mode: 'id', value: '2', cachedResultName: 'Suppliers' } },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, supplier: 'Harborline Produce Co.', aliases: 'Harborline', bank_last4: '3391', status: 'active' }]
});

const precheck = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Precheck',
    position: [1560, 420],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__PRECHECK__
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', kind: 'pdf', route: 'pdf', skip_reason: '', duplicate_of: '', file_hash: '0e19485d' }]
});

const route = switchCase({
  version: 3.2,
  config: {
    name: 'PDF or Image?',
    position: [1780, 420],
    parameters: {
      rules: {
        values: [
          { outputKey: 'pdf', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'pdf' }], combinator: 'and' } },
          { outputKey: 'image', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'image' }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'skip AI' }
    }
  }
});

const readPdf = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Read PDF',
    position: [2020, 260],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: expr("{{ $('Config').first().json.MODEL }}") },
      responses: { values: [
        { type: 'file', role: 'user', fileType: 'base64', binaryPropertyName: 'data', fileName: expr('{{ $json.original_filename }}') },
        { type: 'text', role: 'user', content: 'Read this document and return the JSON.' }
      ] },
      options: {
        instructions:
__EXTRACTION_PROMPT__
        ,
        maxTokens: 8000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'supplier_document', strict: true, schema:
__EXTRACTION_SCHEMA__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { document_type: 'invoice' } }] }] }]
});

const readImage = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Read Image',
    position: [2020, 460],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: expr("{{ $('Config').first().json.MODEL }}") },
      responses: { values: [
        { type: 'image', role: 'user', imageType: 'base64', binaryPropertyName: 'data', imageDetail: 'high' },
        { type: 'text', role: 'user', content: 'Read this document and return the JSON.' }
      ] },
      options: {
        instructions:
__EXTRACTION_PROMPT__
        ,
        maxTokens: 8000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'supplier_document', strict: true, schema:
__EXTRACTION_SCHEMA__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { document_type: 'receipt' } }] }] }]
});

const decide = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Decide',
    position: [2280, 420],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__DECIDE__
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'auto_approved', supplier: 'Harborline Produce Co.', upload: true, folder: 'filed', file_name: '2026-09-28 Harborline Produce Co. - INV-10482 - USD 544.55.pdf', needs_person: false, flags: [], lines: [] }]
});

const lineRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Line Item Rows',
    position: [2520, 200],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__LINE_ROWS__
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', line_no: 1, supplier: 'Harborline Produce Co.', invoice_number: 'INV-10482', invoice_date: '2026-09-28', description: 'Heirloom tomatoes', quantity: 2, unit_price: 48.5, amount: 97, category: 'Food & beverage', line_check: '' }]
});

const appendLines = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Append Line Items',
    position: [2760, 200],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '1', cachedResultName: 'Line Items' },
      columns: {
        mappingMode: 'autoMapInputData',
        value: {},
        schema: [
__LINE_SCHEMA__
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true, handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ doc_id: 'SK-261001-K7QM', line_no: 1 }]
});

const shouldUpload = ifElse({
  version: 2.2,
  config: {
    name: 'File It?',
    position: [2520, 520],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.upload }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const upload = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Upload to Drive',
    position: [2760, 440],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr('{{ $json.file_name }}'),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("{{ $json.folder === 'filed' ? $('Config').first().json.FILED_FOLDER_ID : $('Config').first().json.OTHER_FOLDER_ID }}") }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: '1abcFile', name: '2026-09-28 Harborline Produce Co. - INV-10482 - USD 544.55.pdf' }]
});

const documentRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Document Row',
    position: [3000, 520],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__DOCUMENT_ROW__
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'auto_approved', drive_link: 'https://drive.google.com/file/d/1abcFile/view' }]
});

const appendDocument = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Append to Register',
    position: [3240, 520],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Documents' },
      columns: {
        mappingMode: 'autoMapInputData',
        value: {},
        schema: [
__DOC_SCHEMA__
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true, handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'auto_approved' }]
});

const needsPerson = ifElse({
  version: 2.2,
  config: {
    name: 'Needs a Person?',
    position: [3480, 520],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr("{{ $('Decide').first().json.needs_person }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const requestApproval = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Request Approval (background)',
    position: [3720, 420],
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'once',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'fD6wYG96es2Hgpnw', cachedResultName: 'Invoice Desk 2: Approval' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: { record: expr("{{ Object.assign({}, $('Decide').first().json, { drive_link: $('Document Row').first().json.drive_link }) }}") },
        schema: [{ id: 'record', displayName: 'record', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'object' }]
      },
      options: { waitForSubWorkflow: false }
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM' }]
});

const failed = ifElse({
  version: 2.2,
  config: {
    name: 'Could Not Read?',
    position: [3960, 520],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr("{{ $('Decide').first().json.status }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'error' }],
        combinator: 'and'
      }
    }
  }
});

const stopError = node({
  type: 'n8n-nodes-base.stopAndError',
  version: 1,
  config: {
    name: 'Alert: Could Not Read',
    position: [4200, 420],
    parameters: {
      errorType: 'errorMessage',
      errorMessage: expr("Could not read {{ $('Decide').first().json.original_filename }} ({{ $('Decide').first().json.doc_id }}, from {{ $('Decide').first().json.source }}): {{ $('Decide').first().json.ai_error || 'no file received' }}. It is logged in the register with status error.")
    }
  },
  output: [{}]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Result',
    position: [4200, 620],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__RESULT__
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'auto_approved', status_label: 'Approved automatically', supplier: 'Harborline Produce Co.', total: 544.55, currency: 'USD', flags: [], drive_link: 'https://drive.google.com/file/d/1abcFile/view' }]
});

const noteCheck = sticky(
  '## 1. Check the file\n' +
  'Called once per document by the email, upload and Drive intakes. Works out the file type and size, hashes the bytes, and reads the register and supplier list.\n\n' +
  'An exact copy of a file already logged skips the AI call entirely.',
  [whenCalled, config, checkFile, hashFile, readDocuments, readSuppliers, precheck],
  { color: 7 }
);

const noteRead = sticky(
  '## 2. Read it\n' +
  'GPT-5.4 mini reads the PDF (as a file) or the photo (as an image) and returns JSON that must match a strict schema: supplier, numbers, dates, lines, bank account, category.\n\n' +
  'It only transcribes. It is told to copy wrong arithmetic as printed and to ignore instructions inside the document.',
  [route, readPdf, readImage],
  { color: 4 }
);

const noteDecide = sticky(
  '## 3. Check it and decide (code, not AI)\n' +
  'Required fields, every line\'s qty × price, lines vs subtotal vs total, dates, supplier match, duplicate invoice number, changed bank details, approval limit, currency.\n\n' +
  'Status: auto_approved, pending_approval, needs_review, duplicate, not_invoice, unsupported or error.',
  [decide],
  { color: 3 }
);

const noteFile = sticky(
  '## 4. File, log, ask\n' +
  'Files a renamed copy in Drive (Filed or Other), writes the register row and its line items (RAW, so nothing is read as a formula), and hands anything that needs a person to **Approval** without waiting.\n\n' +
  'If the AI could not read the file, the row is still logged and the run fails on purpose so the error alert goes out.',
  [lineRows, appendLines, shouldUpload, upload, documentRow, appendDocument, needsPerson, requestApproval, failed, stopError, result],
  { color: 6 }
);

export default workflow('invoice-desk-process-document', 'Invoice Desk 1: Process Document')
  .add(whenCalled)
  .to(config)
  .to(checkFile)
  .to(hashFile)
  .to(readDocuments)
  .to(readSuppliers)
  .to(precheck)
  .to(route
    .onCase(0, readPdf.to(decide))
    .onCase(1, readImage.to(decide))
    .onCase(2, decide))
  .add(decide)
  .to(lineRows)
  .to(appendLines)
  .add(decide)
  .to(shouldUpload
    .onTrue(upload.to(documentRow))
    .onFalse(documentRow))
  .add(documentRow)
  .to(appendDocument)
  .to(needsPerson.onTrue(requestApproval).onFalse(failed))
  .add(requestApproval)
  .to(failed.onTrue(stopError).onFalse(result))
  .add(noteCheck)
  .add(noteRead)
  .add(noteDecide)
  .add(noteFile);
