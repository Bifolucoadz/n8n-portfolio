import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const GMAIL_CRED = { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called',
    position: [240, 300],
    parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'record', type: 'object' }] } }
  },
  output: [{ record: { doc_id: 'SK-261001-K7QM', status: 'pending_approval', supplier: 'Frostline Refrigeration Services', supplier_status: 'new', doc_type: 'invoice', invoice_number: 'FR-7731', currency: 'USD', total: 2548.91, flags: [{ level: 'approve', text: 'New supplier' }], lines: [], drive_link: 'https://drive.google.com/file/d/x/view' } }]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [460, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [
        { id: 'c1', name: 'APPROVER_EMAIL', value: 'samuelgurru@gmail.com', type: 'string' },
        { id: 'c2', name: 'TIMEZONE', value: 'America/New_York', type: 'string' },
        { id: 'c3', name: 'SHEET_ID', value: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48', type: 'string' },
        { id: 'c4', name: 'WAIT_DAYS', value: 7, type: 'number' }
      ] }
    }
  },
  output: [{ APPROVER_EMAIL: 'samuelgurru@gmail.com', TIMEZONE: 'America/New_York', SHEET_ID: '1d_w', WAIT_DAYS: 7 }]
});

const buildEmail = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Email',
    position: [680, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// The approval email: what the document is, why it needs a person, and the lines. Everything from the\n' +
        '// document is escaped, so a supplier name or line description can\'t inject HTML into the email.\n' +
        'const r = $(\'When Called\').first().json.record || {};\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const fmt = v => (v === null || v === undefined || v === \'\') ? \'\' : Number(v).toLocaleString(\'en-US\', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n' +
        'const fmtRate = v => (v === null || v === undefined || v === \'\') ? \'\' : Number(v).toLocaleString(\'en-US\', { minimumFractionDigits: 2, maximumFractionDigits: 4 });\n' +
        'const cap = s => s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, \' \') : \'\';\n' +
        'const day = s => { if (!s) return \'\'; const t = DateTime.fromISO(String(s)); return t.isValid ? t.toFormat(\'EEE d LLL yyyy\') : esc(s); };\n' +
        'const review = r.status === \'needs_review\';\n' +
        'const amount = (r.currency || \'USD\') + \' \' + fmt(r.total);\n' +
        'const why = (r.flags || []).filter(f => f.short && f.level === (review ? \'block\' : \'approve\')).map(f => f.short);\n' +
        'const reason = why.slice(0, 2).join(\', \') + (why.length > 2 ? \' +\' + (why.length - 2) + \' more\' : \'\');\n' +
        'const subject = (review ? \'Check before paying: \' : \'Approve: \') + (r.supplier || \'Unknown supplier\') + \', \' + amount + (reason ? \' (\' + reason + \')\' : \'\');\n' +
        '\n' +
        'const colour = { block: [\'#fdecea\', \'#b42318\', \'Check\'], approve: [\'#fff4e0\', \'#b54708\', \'Approve\'], info: [\'#f2f4f7\', \'#475467\', \'Note\'] };\n' +
        'const flagRows = (r.flags || []).map(f => {\n' +
        '  const c = colour[f.level] || colour.info;\n' +
        '  return \'<tr><td style="text-align:left;padding:6px 0;vertical-align:top;width:70px"><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:\' + c[0] + \';color:\' + c[1] + \'">\' + c[2] + \'</span></td>\'\n' +
        '    + \'<td style="text-align:left;padding:6px 0 6px 8px;font-size:14px;line-height:1.45;color:#101828">\' + esc(f.text) + \'</td></tr>\';\n' +
        '}).join(\'\');\n' +
        '\n' +
        'const fact = (k, v) => v ? \'<tr><td style="text-align:left;padding:4px 16px 4px 0;color:#667085;font-size:13px;white-space:nowrap">\' + k + \'</td><td style="text-align:left;padding:4px 0;font-size:14px;color:#101828">\' + v + \'</td></tr>\' : \'\';\n' +
        'const facts = fact(\'Supplier\', esc(r.supplier) + (r.supplier_status === \'new\' ? \' <span style="color:#b54708">(new)</span>\' : \'\'))\n' +
        '  + fact(\'Document\', esc(cap(r.doc_type)) + (r.invoice_number ? \' \' + esc(r.invoice_number) : \'\'))\n' +
        '  + fact(\'Dated\', day(r.invoice_date))\n' +
        '  + fact(\'Due\', day(r.due_date))\n' +
        '  + fact(\'Category\', esc(r.category))\n' +
        '  + fact(\'Received\', [cap(r.source) + (r.sender ? \' from \' + r.sender : \'\'), r.original_filename].filter(Boolean).map(esc).join(\' · \'))\n' +
        '  + fact(\'Reference\', esc(r.doc_id));\n' +
        '\n' +
        'const lines = (r.lines || []).slice(0, 25).map(l =>\n' +
        '  \'<tr><td style="text-align:left;padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:13px">\' + esc(l.description)\n' +
        '  + (l.line_check ? \'<div style="color:#b42318;font-size:12px;margin-top:2px">\' + esc(l.line_check) + \'</div>\' : \'\') + \'</td>\'\n' +
        '  + \'<td style="text-align:left;padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:13px;text-align:right">\' + esc(l.quantity === null ? \'\' : l.quantity) + \'</td>\'\n' +
        '  + \'<td style="text-align:left;padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:13px;text-align:right">\' + fmtRate(l.unit_price) + \'</td>\'\n' +
        '  + \'<td style="text-align:left;padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:13px;text-align:right">\' + fmt(l.amount) + \'</td></tr>\').join(\'\');\n' +
        'const more = (r.lines || []).length > 25 ? \'<p style="font-size:12px;color:#667085">\' + ((r.lines || []).length - 25) + \' more lines in the register.</p>\' : \'\';\n' +
        '\n' +
        'const html = \'<div style="text-align:left;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:600px;color:#101828">\'\n' +
        '  + \'<p style="text-align:left;margin:0 0 4px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:\' + (review ? \'#b42318\' : \'#b54708\') + \';font-weight:700">\' + (review ? \'Needs a check before paying\' : \'Needs your approval\') + \'</p>\'\n' +
        '  + \'<p style="text-align:left;margin:0 0 2px;font-size:22px;font-weight:700">\' + esc(r.supplier || \'Unknown supplier\') + \'</p>\'\n' +
        '  + \'<p style="text-align:left;margin:0 0 18px;font-size:28px;font-weight:700">\' + esc(amount) + \'</p>\'\n' +
        '  + \'<table style="border-collapse:collapse;margin-bottom:18px">\' + flagRows + \'</table>\'\n' +
        '  + \'<table style="border-collapse:collapse;margin-bottom:18px">\' + facts + \'</table>\'\n' +
        '  + (lines ? \'<table style="border-collapse:collapse;width:100%;margin-bottom:8px"><tr>\'\n' +
        '    + \'<th style="text-align:left;padding:6px 8px;font-size:11px;color:#667085;text-transform:uppercase;border-bottom:2px solid #eaecf0">Line</th>\'\n' +
        '    + \'<th style="text-align:right;padding:6px 8px;font-size:11px;color:#667085;text-transform:uppercase;border-bottom:2px solid #eaecf0">Qty</th>\'\n' +
        '    + \'<th style="text-align:right;padding:6px 8px;font-size:11px;color:#667085;text-transform:uppercase;border-bottom:2px solid #eaecf0">Price</th>\'\n' +
        '    + \'<th style="text-align:right;padding:6px 8px;font-size:11px;color:#667085;text-transform:uppercase;border-bottom:2px solid #eaecf0">Amount</th></tr>\'\n' +
        '    + lines + \'</table>\' + more : \'\')\n' +
        '  + \'<p style="text-align:left;margin:16px 0;font-size:14px">\'\n' +
        '  + (r.drive_link ? \'<a href="\' + esc(r.drive_link) + \'" style="color:#175cd3">Open the document</a> · \' : \'\')\n' +
        '  + \'<a href="https://docs.google.com/spreadsheets/d/\' + esc($(\'Config\').first().json.SHEET_ID) + \'/edit" style="color:#175cd3">Open the register</a></p>\'\n' +
        '  + \'<p style="text-align:left;margin:0 0 8px;font-size:13px;color:#475467">\' + (review\n' +
        '    ? \'Check the points above against the document. Approve once it\\\'s right (fix any figures in the register first), or reject it.\'\n' +
        '    : \'Approve to clear it for payment\' + (r.supplier_status === \'new\' ? \' and add \' + esc(r.supplier) + \' to the supplier list\' : \'\') + \', or reject it.\')\n' +
        '  + \'</p></div>\';\n' +
        '\n' +
        'return [{ json: { subject, html, record: r } }];\n'
    }
  },
  output: [{ subject: 'Approve: Frostline Refrigeration Services, USD 2,548.91', html: '<div></div>', record: { doc_id: 'SK-261001-K7QM' } }]
});

const askApproval = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Ask for Approval',
    position: [900, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'sendAndWait',
      sendTo: expr("{{ $('Config').first().json.APPROVER_EMAIL }}"),
      subject: expr('{{ $json.subject }}'),
      message: expr('{{ $json.html }}'),
      responseType: 'approval',
      approvalOptions: { values: { approvalType: 'double', approveLabel: 'Approve', buttonApprovalStyle: 'primary', disapproveLabel: 'Reject', buttonDisapprovalStyle: 'secondary' } },
      options: {
        limitWaitTime: { values: { limitType: 'afterTimeInterval', resumeAmount: expr("{{ $('Config').first().json.WAIT_DAYS }}"), resumeUnit: 'days' } },
        appendAttribution: false
      }
    },
    credentials: GMAIL_CRED
  },
  output: [{ data: { approved: true } }]
});

const recordDecision = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Record Decision',
    position: [1120, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Turn the button click into a status. No click within the wait time: leave the row as it is\n' +
        '// (the weekly summary lists it as still waiting).\n' +
        'const cfg = $(\'Config\').first().json;\n' +
        'const r = $(\'Build Email\').first().json.record;\n' +
        'const approved = $json.data ? $json.data.approved : undefined;\n' +
        'if (approved !== true && approved !== false) return [];\n' +
        'return [{\n' +
        '  json: {\n' +
        '    doc_id: r.doc_id,\n' +
        '    status: approved ? \'approved\' : \'rejected\',\n' +
        '    decided_by: cfg.APPROVER_EMAIL,\n' +
        '    decided_at: DateTime.now().setZone(cfg.TIMEZONE).toISO(),\n' +
        '    payment_status: approved ? (r.payment_status || \'unpaid\') : \'do_not_pay\',\n' +
        '    approved,\n' +
        '    record: r\n' +
        '  }\n' +
        '}];\n'
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'approved', decided_by: 'samuelgurru@gmail.com', decided_at: '2026-10-01T18:00:00.000-04:00', payment_status: 'unpaid', approved: true, record: {} }]
});

const updateRow = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Document Row',
    position: [1340, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'update',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Documents' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          doc_id: expr('{{ $json.doc_id }}'),
          status: expr('{{ $json.status }}'),
          decided_by: expr('{{ $json.decided_by }}'),
          decided_at: expr('{{ $json.decided_at }}'),
          payment_status: expr('{{ $json.payment_status }}')
        },
        matchingColumns: ['doc_id'],
        schema: [
          { id: 'doc_id', displayName: 'doc_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'decided_by', displayName: 'decided_by', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'decided_at', displayName: 'decided_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'payment_status', displayName: 'payment_status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'approved' }]
});

const supplierChange = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Supplier Change',
    position: [1560, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// After an approval: a new supplier joins the supplier list, and a confirmed bank change becomes the\n' +
        '// account on file, so the next invoice from them goes through on its own.\n' +
        'const d = $(\'Record Decision\').first().json;\n' +
        'const r = d.record;\n' +
        'if (!d.approved || !r.supplier) return [];\n' +
        'const today = DateTime.now().setZone($(\'Config\').first().json.TIMEZONE).toISODate();\n' +
        'if (r.supplier_status === \'new\' && [\'invoice\', \'credit_note\'].includes(r.doc_type)) {\n' +
        '  return [{ json: { action: \'add\', supplier: r.supplier, aliases: \'\', email_domain: r.supplier_email_domain || \'\', tax_id: r.supplier_tax_id || \'\',\n' +
        '    default_category: r.category || \'Other\', bank_last4: r.bank_last4 || \'\', status: \'active\', added_at: today, added_by: \'approval \' + r.doc_id } }];\n' +
        '}\n' +
        'if (r.supplier_status === \'known\' && r.bank_changed && r.bank_last4) {\n' +
        '  return [{ json: { action: \'update_bank\', supplier: r.supplier, bank_last4: r.bank_last4, added_by: \'bank change approved \' + r.doc_id } }];\n' +
        '}\n' +
        'return [];\n'
    }
  },
  output: [{ action: 'add', supplier: 'Frostline Refrigeration Services', aliases: '', email_domain: 'frostline-refrigeration.example', tax_id: '00-0927745', default_category: 'Repairs & maintenance', bank_last4: '5108', status: 'active', added_at: '2026-10-01', added_by: 'approval SK-261001-K7QM' }]
});

const routeChange = switchCase({
  version: 3.2,
  config: {
    name: 'Add or Update?',
    position: [1780, 300],
    parameters: {
      rules: {
        values: [
          { outputKey: 'add', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'add' }], combinator: 'and' } },
          { outputKey: 'update_bank', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'update_bank' }], combinator: 'and' } }
        ]
      },
      options: {}
    }
  }
});

const addSupplier = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add to Supplier List',
    position: [2020, 200],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '2', cachedResultName: 'Suppliers' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          supplier: expr('{{ $json.supplier }}'),
          aliases: expr('{{ $json.aliases }}'),
          email_domain: expr('{{ $json.email_domain }}'),
          tax_id: expr('{{ $json.tax_id }}'),
          default_category: expr('{{ $json.default_category }}'),
          bank_last4: expr('{{ $json.bank_last4 }}'),
          status: expr('{{ $json.status }}'),
          added_at: expr('{{ $json.added_at }}'),
          added_by: expr('{{ $json.added_by }}')
        },
        schema: [
          { id: 'supplier', displayName: 'supplier', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'aliases', displayName: 'aliases', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'email_domain', displayName: 'email_domain', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'tax_id', displayName: 'tax_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'default_category', displayName: 'default_category', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'bank_last4', displayName: 'bank_last4', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'added_at', displayName: 'added_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'added_by', displayName: 'added_by', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true }
    },
    credentials: SHEETS_CRED
  },
  output: [{ supplier: 'Frostline Refrigeration Services' }]
});

const updateBank = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Bank on File',
    position: [2020, 400],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'update',
      documentId: SHEET_DOC,
      sheetName: { __rl: true, mode: 'id', value: '2', cachedResultName: 'Suppliers' },
      columns: {
        mappingMode: 'defineBelow',
        value: { supplier: expr('{{ $json.supplier }}'), bank_last4: expr('{{ $json.bank_last4 }}') },
        matchingColumns: ['supplier'],
        schema: [
          { id: 'supplier', displayName: 'supplier', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'bank_last4', displayName: 'bank_last4', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ supplier: 'Bluewick Linen Service', bank_last4: '9047' }]
});

const note = sticky(
  '## Approval\n' +
  'Called by **Process Document** (not awaited) for anything over the limit, from a new supplier, in another currency, or failing a check.\n\n' +
  'The owner gets one email with what the document is, why it needs them, the lines and a link to the file, plus **Approve** / **Reject** buttons. The run waits up to 7 days.\n\n' +
  'The click updates the register. Approving a new supplier adds it to the supplier list; approving a confirmed bank change makes the new account the one on file. No click: the row stays as it is and the weekly summary lists it.',
  [whenCalled, config, buildEmail, askApproval, recordDecision, updateRow, supplierChange, routeChange, addSupplier, updateBank],
  { color: 5 }
);

export default workflow('invoice-desk-approval', 'Invoice Desk 2: Approval')
  .add(whenCalled)
  .to(config)
  .to(buildEmail)
  .to(askApproval)
  .to(recordDecision)
  .to(updateRow)
  .to(supplierChange)
  .to(routeChange.onCase(0, addSupplier).onCase(1, updateBank))
  .add(note);
