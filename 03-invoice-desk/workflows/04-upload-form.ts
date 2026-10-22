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
        '// One item per uploaded file, with who sent it and their note.\n' +
        'const item = $input.first();\n' +
        'const j = item.json;\n' +
        'const name = String(j.name || j[\'Your name\'] || \'\').trim().slice(0, 100);\n' +
        'const note = String(j.note || j[\'Anything we should know?\'] || \'\').trim().slice(0, 500);\n' +
        'const now = DateTime.now().setZone(\'America/New_York\').toISO();\n' +
        'return Object.entries(item.binary || {}).map(([key, file]) => ({\n' +
        '  json: { source: \'upload\', sender: name, note, received_at: now, original_filename: file.fileName || key },\n' +
        '  binary: { data: file }\n' +
        '}));\n'
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
        '// The page the sender sees after uploading: one card per file saying what was read and what happens next.\n' +
        '// Everything read from a document is escaped before it goes into the page.\n' +
        'const results = $(\'Process Document\').all().map(i => i.json);\n' +
        'const sent = $(\'Split Files\').all().map(i => i.json);\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const fmt = v => Number(v || 0).toLocaleString(\'en-US\', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n' +
        'const day = s => { const t = DateTime.fromISO(String(s || \'\')); return t.isValid ? t.toFormat(\'LLL d, yyyy\') : \'\'; };\n' +
        '\n' +
        'const look = {\n' +
        '  auto_approved: [\'#ecfdf3\', \'#067647\', \'Approved\', \'Checked and logged. Nothing else to do.\'],\n' +
        '  pending_approval: [\'#fffaeb\', \'#b54708\', \'Sent for approval\', \'Everything adds up. The owner has been asked to approve it.\'],\n' +
        '  needs_review: [\'#fef3f2\', \'#b42318\', \'Needs a check\', \'Something needs a person to look at it. The owner has been emailed.\'],\n' +
        '  duplicate: [\'#f2f4f7\', \'#344054\', \'Already logged\', \'We already have this one, so it was not added again.\'],\n' +
        '  not_invoice: [\'#f2f4f7\', \'#344054\', \'Not an invoice\', \'This does not look like a bill or receipt. It was filed under Other.\'],\n' +
        '  unsupported: [\'#f2f4f7\', \'#344054\', \'Not supported\', \'Please send a PDF or a photo (JPG, PNG or WEBP).\'],\n' +
        '  error: [\'#fef3f2\', \'#b42318\', \'Could not read\', \'The file was saved and the team has been told. Nothing else to do.\']\n' +
        '};\n' +
        '\n' +
        'const cards = results.map((r, i) => {\n' +
        '  const name = (sent[i] && sent[i].original_filename) || r.original_filename || \'File \' + (i + 1);\n' +
        '  if (r.error || !r.status) {\n' +
        '    const l = look.error;\n' +
        '    return \'<div style="border:1px solid #eaecf0;border-radius:12px;padding:16px 18px;margin:0 0 12px;text-align:left">\'\n' +
        '      + \'<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:\' + l[0] + \';color:\' + l[1] + \'">\' + l[2] + \'</span>\'\n' +
        '      + \'<div style="font-size:13px;color:#667085;margin-top:8px">\' + esc(name) + \'</div>\'\n' +
        '      + \'<div style="font-size:14px;color:#344054;margin-top:6px">\' + l[3] + \'</div></div>\';\n' +
        '  }\n' +
        '  const l = look[r.status] || look.error;\n' +
        '  const amount = r.total !== null && r.total !== undefined && r.total !== \'\' ? esc((r.currency || \'USD\') + \' \' + fmt(r.total)) : \'\';\n' +
        '  const notes = (r.flags || []).filter(f => f.level !== \'info\' || r.status === \'duplicate\').slice(0, 3)\n' +
        '    .map(f => \'<li style="margin:2px 0">\' + esc(f.text) + \'</li>\').join(\'\');\n' +
        '  return \'<div style="border:1px solid #eaecf0;border-radius:12px;padding:16px 18px;margin:0 0 12px;text-align:left">\'\n' +
        '    + \'<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">\'\n' +
        '    + \'<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:\' + l[0] + \';color:\' + l[1] + \'">\' + l[2] + \'</span>\'\n' +
        '    + \'<span style="font-size:12px;color:#98a2b3">\' + esc(r.doc_id) + \'</span></div>\'\n' +
        '    + (r.supplier ? \'<div style="font-size:17px;font-weight:700;color:#101828;margin-top:10px">\' + esc(r.supplier) + \'</div>\' : \'\')\n' +
        '    + (amount ? \'<div style="font-size:22px;font-weight:700;color:#101828">\' + amount + \'</div>\' : \'\')\n' +
        '    + \'<div style="font-size:13px;color:#667085;margin-top:4px">\' + [r.doc_type && r.invoice_number ? esc(r.doc_type.replace(/_/g, \' \') + \' \' + r.invoice_number) : \'\', r.invoice_date ? \'dated \' + day(r.invoice_date) : \'\', r.due_date ? \'due \' + day(r.due_date) : \'\', r.category ? esc(r.category) : \'\'].filter(Boolean).join(\' · \') + \'</div>\'\n' +
        '    + \'<div style="font-size:14px;color:#344054;margin-top:10px">\' + l[3] + \'</div>\'\n' +
        '    + (notes ? \'<ul style="margin:8px 0 0;padding-left:18px;font-size:13px;color:\' + l[1] + \'">\' + notes + \'</ul>\' : \'\')\n' +
        '    + \'<div style="font-size:12px;color:#98a2b3;margin-top:10px">\' + esc(name) + \'</div></div>\';\n' +
        '}).join(\'\');\n' +
        '\n' +
        'const n = results.length;\n' +
        'const html = \'<div style="max-width:520px;margin:0 auto;padding:36px 16px 24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">\'\n' +
        '  + \'<div style="text-align:center;margin-bottom:18px"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#667085;font-weight:700">Saltmarsh Kitchen · Invoice Desk</div>\'\n' +
        '  + \'<h1 style="font-size:24px;margin:6px 0 4px;color:#101828">\' + (n === 1 ? \'Got it. Here is what we read.\' : \'Got all \' + n + \'. Here is what we read.\') + \'</h1>\'\n' +
        '  + \'<p style="font-size:14px;color:#667085;margin:0">Every document is filed in Drive and logged in the register.</p></div>\'\n' +
        '  + cards\n' +
        '  + \'<p style="text-align:center;font-size:13px;margin-top:16px"><a href="?" style="color:#175cd3">Send another</a></p></div>\';\n' +
        '\n' +
        'return [{ json: { html, count: n } }];\n'
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
