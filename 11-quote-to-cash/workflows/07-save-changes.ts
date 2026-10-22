import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const GMAIL_CRED = { gmailOAuth2: { id: '7rH5EpTCyRAbJqwK', name: 'Gmail account 2' } };
const PDF_WF = { __rl: true, mode: 'id', value: 'mgvDocuments0005', cachedResultName: 'Mossgrove 5: PDF Documents' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 300], parameters: { inputSource: 'passthrough' } },
  output: [{ plan: { mode: 'test', quote_inserts: [], quote_updates: [], events: [], payments: [], schedule: [], emails: [], result: { ok: true } } }]
});

const readMap = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Read Sheet Map',
    position: [420, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/1754F1Rep-Rg9J3x6Dnga0fjTeSR4zfaLOS_zD7Zp1J4?ranges=Quotes!A:A&ranges=Events!A1&ranges=Payments!A1&ranges=Schedule!A1&ranges=Outbox!A1&includeGridData=true&fields=sheets(properties(sheetId,title),data.rowData.values.effectiveValue)', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ sheets: [] }]
});

const build = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Batch', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Turns the plan into ONE Sheets API batchUpdate: new rows are appended to each tab (appendCells) and\n' +
        '// changed quote fields are written cell by cell (updateCells), so the whole plan is saved in a single,\n' +
        '// all-or-nothing request. Values are written as plain text or numbers, never as formulas.\n' +
        'const COLUMNS = {"Settings": ["key", "value", "note"], "Price Book": ["code", "category", "item", "unit", "unit_price", "labour_days", "min_qty", "notes", "active"], "Quotes": ["quote_id", "token", "status", "client_name", "client_email", "client_phone", "site_address", "postcode", "job_title", "summary", "visit_notes", "transcript", "lines_json", "extras_json", "custom_json", "assumptions_json", "questions_json", "flags_json", "subtotal", "vat", "total", "deposit", "labour_days", "version", "estimator", "created_at", "build_ms", "sent_at", "valid_until", "viewed_at", "view_count", "accepted_at", "signed_name", "sign_meta_json", "chosen_extras_json", "accepted_subtotal", "accepted_vat", "accepted_total", "deposit_due", "deposit_paid_at", "job_start", "job_end", "crew", "completed_at", "invoice_id", "balance_due", "balance_paid_at", "review_sent_at", "declined_at", "decline_reason", "reminders_sent", "last_reminder_at", "messages_json", "updated_at"], "Events": ["at", "quote_id", "event", "detail", "actor"], "Payments": ["payment_id", "quote_id", "kind", "amount", "status", "provider", "provider_ref", "created_at", "paid_at"], "Schedule": ["entry_id", "quote_id", "title", "start", "end", "crew", "kind", "notes"], "Outbox": ["at", "to", "subject", "kind", "quote_id", "links", "html"]};\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'const meta = $(\'Read Sheet Map\').first().json;\n' +
        'const sheetId = {}, quoteRow = {};\n' +
        'for (const sh of meta.sheets || []) {\n' +
        '  sheetId[sh.properties.title] = sh.properties.sheetId;\n' +
        '  if (sh.properties.title === \'Quotes\') ((sh.data && sh.data[0] && sh.data[0].rowData) || []).forEach((r, i) => {\n' +
        '    const v = r.values && r.values[0] && r.values[0].effectiveValue;\n' +
        '    if (v && i > 0) quoteRow[String(v.stringValue || v.numberValue)] = i;\n' +
        '  });\n' +
        '}\n' +
        'const cell = v => v === null || v === undefined || v === \'\' ? {} : (typeof v === \'number\' ? { userEnteredValue: { numberValue: v } } : (typeof v === \'boolean\' ? { userEnteredValue: { boolValue: v } } : { userEnteredValue: { stringValue: typeof v === \'object\' ? JSON.stringify(v) : String(v) } }));\n' +
        'const requests = [];\n' +
        'const append = (tab, objs) => {\n' +
        '  if (!objs || !objs.length) return;\n' +
        '  if (sheetId[tab] === undefined) throw new Error(\'The sheet has no \' + tab + \' tab\');\n' +
        '  requests.push({ appendCells: { sheetId: sheetId[tab], rows: objs.map(o => ({ values: COLUMNS[tab].map(c => cell(o[c])) })), fields: \'userEnteredValue\' } });\n' +
        '};\n' +
        'append(\'Quotes\', plan.quote_inserts);\n' +
        'append(\'Events\', plan.events);\n' +
        'append(\'Payments\', plan.payments);\n' +
        'append(\'Schedule\', plan.schedule);\n' +
        'if (plan.mode !== \'live\') append(\'Outbox\', (plan.emails || []).filter(e => e.to).map(e => Object.assign({ at: DateTime.now().setZone(\'Europe/London\').set({ millisecond: 0 }).toISO({ suppressMilliseconds: true }) }, e)));\n' +
        'const missing = [];\n' +
        'for (const u of plan.quote_updates || []) {\n' +
        '  const row = quoteRow[u.quote_id];\n' +
        '  if (row === undefined) { missing.push(u.quote_id); continue; }\n' +
        '  for (const [k, v] of Object.entries(u)) {\n' +
        '    const col = COLUMNS.Quotes.indexOf(k);\n' +
        '    if (k === \'quote_id\' || col < 0) continue;\n' +
        '    requests.push({ updateCells: { start: { sheetId: sheetId.Quotes, rowIndex: row, columnIndex: col }, rows: [{ values: [cell(v)] }], fields: \'userEnteredValue\' } });\n' +
        '  }\n' +
        '}\n' +
        'if (missing.length) throw new Error(\'Quote not found in the sheet: \' + missing.join(\', \'));\n' +
        'return [{ json: { has_writes: requests.length > 0, body: { requests }, count: requests.length } }];\n'
  } },
  output: [{ has_writes: true, body: { requests: [] }, count: 3 }]
});

const anything = ifElse({
  version: 2.2,
  config: {
    name: 'Anything to Write?',
    position: [860, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.has_writes }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const write = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Write to Sheet (one batch)',
    position: [1080, 220],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/1754F1Rep-Rg9J3x6Dnga0fjTeSR4zfaLOS_zD7Zp1J4:batchUpdate',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc', replies: [] }]
});

const emails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Live Emails', position: [440, 620], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Live mode only: one item per email for Gmail (test mode wrote them to the Outbox tab in the batch).\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'if (plan.mode !== \'live\') return [];\n' +
        'return (plan.emails || []).filter(e => e.to).map(e => ({ json: e }));\n'
  } },
  output: [{ to: 'grace.whitfield@example.com', subject: 'Your quote', html: '<p>Hi</p>', kind: 'quote_sent', attach: 'quote', token: 'abc' }]
});

const hasPdf = ifElse({
  version: 2.2,
  config: {
    name: 'Attach PDF?',
    position: [660, 620],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.attach }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const makePdf = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Make PDF', position: [880, 540], parameters: { source: 'database', workflowId: PDF_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const gmailPdf = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send with PDF',
    position: [1100, 540],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'message', operation: 'send',
      sendTo: expr("{{ $('Live Emails').item.json.to }}"), subject: expr("{{ $('Live Emails').item.json.subject }}"), emailType: 'html', message: expr("{{ $('Live Emails').item.json.html }}"),
      options: { appendAttribution: false, senderName: 'Mossgrove Landscapes', attachmentsUi: { attachmentsBinary: [{ property: 'data' }] } }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: 'msg1' }]
});

const gmail = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send Email',
    position: [880, 700],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'message', operation: 'send',
      sendTo: expr('{{ $json.to }}'), subject: expr('{{ $json.subject }}'), emailType: 'html', message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'Mossgrove Landscapes' }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: 'msg1' }]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result', position: [440, 880], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What the caller gets back. Runs last (lowest branch), so it is the sub-workflow\'s output.\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'return [{ json: Object.assign({ ok: true }, plan.result || {}) }];\n'
  } },
  output: [{ ok: true }]
});

const note = sticky(
  '## Mossgrove 7: Save Changes\nEvery other workflow decides what should happen in code (a **plan**) and hands it here. **Build Batch** turns the plan into one Google Sheets request: new quotes, history, payments, bookings and (in test mode) emails are appended to their tabs, and changed quote fields are written cell by cell. One request means the whole change is saved or none of it is, in about a second; values are written as text or numbers, never formulas. In live mode emails go out with Gmail, with the quote, invoice or receipt PDF attached. **Result** runs last and is what the caller gets back.',
  [], { position: [160, -60], width: 1160, height: 200, color: 7 }
);

export default workflow('mossgrove-save-changes', 'Mossgrove 7: Save Changes')
  .add(whenCalled.to(readMap.to(build.to(anything.onTrue(write)))))
  .add(whenCalled.to(emails.to(hasPdf
    .onTrue(makePdf.to(gmailPdf))
    .onFalse(gmail))))
  .add(whenCalled.to(result))
  .add(note);
