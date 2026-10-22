import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const FORM_CSS =
  ':root {\n' +
  '  --font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;\n' +
  '  --color-background: #f4f1ea;\n' +
  '  --color-card-bg: #ffffff;\n' +
  '  --color-card-border: #e7e1d6;\n' +
  '  --color-header: #1f2a24;\n' +
  '  --color-label: #344054;\n' +
  '  --color-focus-border: #2f6f5e;\n' +
  '  --color-submit-btn-bg: #2f6f5e;\n' +
  '  --color-submit-btn-text: #ffffff;\n' +
  '  --border-radius-card: 14px;\n' +
  '  --border-radius-input: 10px;\n' +
  '  --font-size-header: 24px;\n' +
  '}\n' +
  '.form-header h1 { letter-spacing: -0.3px; }\n' +
  'button[type="submit"] { font-weight: 600; }\n';

const form = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: {
    name: 'Upload Form',
    position: [240, 300],
    parameters: {
      formTitle: 'Send an invoice or receipt',
      formDescription: '<b>Saltmarsh Kitchen · Invoice Desk</b><br>Drop in supplier invoices, bills or receipts (PDF or a phone photo). Each one is read, checked, filed and logged, and you see the result straight away.<br><small>Demo for a fictional restaurant. Please use the sample documents or your own test files.</small>',
      formFields: { values: [
        { fieldLabel: 'Invoices or receipts', fieldName: 'files', fieldType: 'file', multipleFiles: true, acceptFileTypes: '.pdf,.jpg,.jpeg,.png,.webp', requiredField: true },
        { fieldLabel: 'Your name', fieldName: 'name', fieldType: 'text', placeholder: 'Optional' },
        { fieldLabel: 'Anything we should know?', fieldName: 'note', fieldType: 'textarea', placeholder: 'Optional, e.g. "paid by card" or "PO 1182"' }
      ] },
      responseMode: 'lastNode',
      options: { appendAttribution: false, buttonLabel: 'Send', path: 'saltmarsh-invoices', customCss: FORM_CSS, ignoreBots: true }
    }
  },
  output: [{ name: 'Dana', note: '', submittedAt: '2026-10-01T18:00:00.000-04:00' }]
});

const splitFiles = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Split Files',
    position: [480, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__SPLIT_FILES__
    }
  },
  output: [{ source: 'upload', sender: 'Dana', note: '', received_at: '2026-10-01T18:00:00.000-04:00', original_filename: 'harborline-produce-INV-10482.pdf' }]
});

const processDoc = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Process Document',
    position: [720, 300],
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'each',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'v9Mp2015O3VcFURY', cachedResultName: 'Invoice Desk 1: Process Document' },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'auto_approved', supplier: 'Harborline Produce Co.', total: 544.55, currency: 'USD', flags: [] }]
});

const resultsPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Results Page',
    position: [960, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__RESULTS_PAGE__
    }
  },
  output: [{ html: '<div>Got it</div>', count: 1 }]
});

const showResults = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: {
    name: 'Show Results',
    position: [1200, 300],
    parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') }
  },
  output: [{}]
});

const note = sticky(
  '## Upload Form\n' +
  'A public n8n form for dropping in invoices and receipts (PDF, JPG, PNG, WEBP; several at once).\n\n' +
  'Each file goes through **Process Document** in turn, then the page shows one card per file: what was read, the status, and what happens next.',
  [form, splitFiles, processDoc, resultsPage, showResults],
  { color: 4 }
);

export default workflow('invoice-desk-upload-form', 'Invoice Desk 4: Upload Form')
  .add(form)
  .to(splitFiles)
  .to(processDoc)
  .to(resultsPage)
  .to(showResults)
  .add(note);
