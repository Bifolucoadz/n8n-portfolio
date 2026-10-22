import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const everyMonday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Mondays 8:00 am',
    position: [240, 220],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 0 8 * * 1' }] } }
  },
  output: [{ timestamp: '2026-10-05T08:00:00.000-04:00' }]
});

const sendNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Summary Now', position: [240, 420] },
  output: [{}]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [480, 320],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [
        { id: 'c1', name: 'BUSINESS', value: 'Saltmarsh Kitchen', type: 'string' },
        { id: 'c2', name: 'OWNER_EMAIL', value: 'samuelgurru@gmail.com', type: 'string' },
        { id: 'c3', name: 'TIMEZONE', value: 'America/New_York', type: 'string' },
        { id: 'c4', name: 'BASE_CURRENCY', value: 'USD', type: 'string' },
        { id: 'c5', name: 'MINUTES_SAVED_PER_DOC', value: 6, type: 'number' },
        { id: 'c6', name: 'SHEET_ID', value: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48', type: 'string' }
      ] }
    }
  },
  output: [{ BUSINESS: 'Saltmarsh Kitchen', OWNER_EMAIL: 'samuelgurru@gmail.com', TIMEZONE: 'America/New_York', BASE_CURRENCY: 'USD', MINUTES_SAVED_PER_DOC: 6, SHEET_ID: '1d_w' }]
});

const readRegister = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Register',
    position: [720, 320],
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: { __rl: true, mode: 'id', value: '1d_wojZZrm89o_jJLU5gu9m7Mge9uKhqZt-dB4FAsU48' }, sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Documents' } },
    credentials: { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } }
  },
  output: [{ row_number: 2, doc_id: 'SK-261001-YL9G', status: 'auto_approved', supplier: 'Harborline Produce Co.', total: 544.55, received_at: '2026-10-01T18:00:12.273-04:00' }]
});

const buildSummary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Summary',
    position: [960, 320],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// The owner\'s Monday email, built from the register in code (no AI), so every figure is exact.\n' +
        '// Spend counts approved and auto-approved documents in the base currency; "waiting" lists everything\n' +
        '// still pending, however old.\n' +
        'const cfg = $(\'Config\').first().json;\n' +
        'const tz = cfg.TIMEZONE;\n' +
        'const now = DateTime.now().setZone(tz);\n' +
        'const today = now.startOf(\'day\');\n' +
        'const since = now.minus({ days: 7 });\n' +
        'const base = cfg.BASE_CURRENCY;\n' +
        '\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const fmt = v => Number(v || 0).toLocaleString(\'en-US\', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n' +
        'const money = v => base + \' \' + fmt(v);\n' +
        'const n = v => (v === \'\' || v === null || v === undefined || isNaN(Number(v))) ? 0 : Number(v);\n' +
        'const when = s => { const t = DateTime.fromISO(String(s || \'\'), { zone: tz }); return t.isValid ? t : null; };\n' +
        '\n' +
        'const rows = $(\'Read Register\').all().map(i => i.json).filter(r => r.doc_id);\n' +
        'const week = rows.filter(r => { const t = when(r.received_at); return t && t >= since; });\n' +
        'const approvedStatuses = [\'approved\', \'auto_approved\'];\n' +
        'const spendRows = week.filter(r => approvedStatuses.includes(r.status) && (r.currency || base) === base && r.doc_type !== \'credit_note\');\n' +
        '\n' +
        'const count = (list, key) => Object.entries(list.reduce((m, r) => { const k = r[key] || \'other\'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);\n' +
        'const sumBy = (list, key) => Object.entries(list.reduce((m, r) => { const k = r[key] || \'Other\'; m[k] = (m[k] || 0) + n(r.total); return m; }, {})).sort((a, b) => b[1] - a[1]);\n' +
        '\n' +
        'const spend = spendRows.reduce((a, r) => a + n(r.total), 0);\n' +
        'const byCategory = sumBy(spendRows, \'category\');\n' +
        'const bySupplier = sumBy(spendRows, \'supplier\').slice(0, 5);\n' +
        'const statusCounts = count(week, \'status\');\n' +
        'const channelCounts = count(week, \'source\');\n' +
        '\n' +
        'const waiting = rows.filter(r => [\'pending_approval\', \'needs_review\'].includes(r.status))\n' +
        '  .map(r => ({ ...r, age: Math.max(0, Math.floor(today.diff((when(r.received_at) || today).startOf(\'day\'), \'days\').days)) }))\n' +
        '  .sort((a, b) => b.age - a.age);\n' +
        'const payable = rows.filter(r => approvedStatuses.includes(r.status) && r.payment_status === \'unpaid\' && when(r.due_date));\n' +
        'const dueSoon = payable.filter(r => { const d = when(r.due_date); return d >= today && d <= today.plus({ days: 7 }); }).sort((a, b) => a.due_date.localeCompare(b.due_date));\n' +
        'const overdue = payable.filter(r => when(r.due_date) < today).sort((a, b) => a.due_date.localeCompare(b.due_date));\n' +
        '\n' +
        'const duplicates = week.filter(r => r.status === \'duplicate\');\n' +
        'const duplicateValue = duplicates.reduce((a, r) => a + n(r.total), 0);\n' +
        'const bankChanges = week.filter(r => /bank details have changed|Bank account differs/.test(String(r.flags || \'\')));\n' +
        'const overcharge = week.reduce((a, r) => a + [...String(r.flags || \'\').matchAll(/Overcharged by [A-Z]{3} ([\\d,]+\\.\\d{2})/g)].reduce((b, m) => b + Number(m[1].replace(/,/g, \'\')), 0), 0);\n' +
        'const processed = week.filter(r => ![\'duplicate\', \'unsupported\', \'error\'].includes(r.status)).length;\n' +
        'const minutes = processed * Number(cfg.MINUTES_SAVED_PER_DOC);\n' +
        'const timeSaved = minutes >= 60 ? Math.floor(minutes / 60) + \' h \' + (minutes % 60) + \' min\' : minutes + \' min\';\n' +
        '\n' +
        'const labels = { auto_approved: \'Approved automatically\', approved: \'Approved by you\', pending_approval: \'Waiting for approval\', needs_review: \'Needs a check\', rejected: \'Rejected\', duplicate: \'Duplicates caught\', not_invoice: \'Not invoices\', unsupported: \'Unsupported files\', error: \'Could not be read\' };\n' +
        'const channels = { email: \'Email\', upload: \'Upload form\', drive: \'Drive folder\', test: \'Test\' };\n' +
        '\n' +
        '// Layout helpers: email-safe tables with inline styles.\n' +
        'const h2 = t => \'<h2 style="font-size:15px;margin:28px 0 8px;color:#101828">\' + t + \'</h2>\';\n' +
        'const table = (head, body) => \'<table style="border-collapse:collapse;width:100%">\'\n' +
        '  + (head ? \'<tr>\' + head.map((h, i) => \'<th style="text-align:\' + (i ? \'right\' : \'left\') + \';padding:6px 8px;font-size:11px;color:#667085;text-transform:uppercase;border-bottom:2px solid #eaecf0">\' + h + \'</th>\').join(\'\') + \'</tr>\' : \'\')\n' +
        '  + body.map(cells => \'<tr>\' + cells.map((c, i) => \'<td style="text-align:\' + (i ? \'right\' : \'left\') + \';padding:7px 8px;border-bottom:1px solid #eaecf0;font-size:14px">\' + c + \'</td>\').join(\'\') + \'</tr>\').join(\'\') + \'</table>\';\n' +
        'const none = t => \'<p style="font-size:14px;color:#667085;margin:4px 0">\' + t + \'</p>\';\n' +
        'const link = r => r.drive_link ? \' <a href="\' + esc(r.drive_link) + \'" style="color:#175cd3;font-size:12px">file</a>\' : \'\';\n' +
        'const tile = (label, value, colour) => \'<td style="padding:14px;background:#f9fafb;border-radius:8px;width:25%;vertical-align:top"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#667085">\' + label + \'</div><div style="font-size:22px;font-weight:700;margin-top:4px;color:\' + (colour || \'#101828\') + \'">\' + value + \'</div></td>\';\n' +
        '\n' +
        'const caught = [];\n' +
        'if (overcharge) caught.push(money(overcharge) + \' in overcharged lines\');\n' +
        'if (duplicates.length) caught.push(duplicates.length + \' duplicate\' + (duplicates.length > 1 ? \'s\' : \'\') + \' (\' + money(duplicateValue) + \' that could have been paid twice)\');\n' +
        'if (bankChanges.length) caught.push(bankChanges.length + \' bank-detail change\' + (bankChanges.length > 1 ? \'s\' : \'\') + \' held for a phone check\');\n' +
        '\n' +
        'const html = \'<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;color:#101828">\'\n' +
        '  + \'<p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#667085;font-weight:700">Invoice Desk · weekly summary</p>\'\n' +
        '  + \'<h1 style="margin:4px 0 2px;font-size:24px">\' + esc(cfg.BUSINESS) + \'</h1>\'\n' +
        '  + \'<p style="margin:0 0 18px;color:#667085;font-size:14px">\' + since.toFormat(\'LLL d\') + \' to \' + now.toFormat(\'LLL d, yyyy\') + \'</p>\'\n' +
        '  + \'<table style="border-collapse:separate;border-spacing:8px;width:100%;margin:0 -8px"><tr>\'\n' +
        '  + tile(\'Documents\', week.length) + tile(\'Spend approved\', base + \' \' + Math.round(spend).toLocaleString(\'en-US\')) + tile(\'Waiting on you\', waiting.length, waiting.length ? \'#b54708\' : \'\') + tile(\'Time saved\', timeSaved)\n' +
        '  + \'</tr></table>\'\n' +
        '  + (caught.length ? \'<p style="margin:16px 0 0;padding:12px 14px;background:#ecfdf3;border-radius:8px;font-size:14px;color:#05603a"><b>Caught this week:</b> \' + esc(caught.join(\'; \')) + \'.</p>\' : \'\')\n' +
        '  + h2(\'Waiting on you (\' + waiting.length + \')\')\n' +
        '  + (waiting.length ? table([\'Document\', \'Amount\', \'Waiting\'], waiting.map(r => [\n' +
        '      \'<b>\' + esc(r.supplier || r.original_filename) + \'</b> \' + esc(r.invoice_number) + link(r) + \'<div style="font-size:12px;color:\' + (r.status === \'needs_review\' ? \'#b42318\' : \'#b54708\') + \'">\' + esc(String(r.flags || \'\').split(\'; \')[0]) + \'</div>\',\n' +
        '      esc((r.currency || base) + \' \' + fmt(r.total)), r.age ? r.age + \' day\' + (r.age > 1 ? \'s\' : \'\') : \'today\'])) : none(\'Nothing waiting. Everything has been decided.\'))\n' +
        '  + h2(\'Bills due in the next 7 days\')\n' +
        '  + (dueSoon.length ? table([\'Supplier\', \'Amount\', \'Due\'], dueSoon.map(r => [\'<b>\' + esc(r.supplier) + \'</b> \' + esc(r.invoice_number) + link(r), esc((r.currency || base) + \' \' + fmt(r.total)), esc(when(r.due_date).toFormat(\'EEE LLL d\'))])) : none(\'No approved bills due this week.\'))\n' +
        '  + (overdue.length ? h2(\'Overdue\') + table([\'Supplier\', \'Amount\', \'Was due\'], overdue.map(r => [\'<b>\' + esc(r.supplier) + \'</b> \' + esc(r.invoice_number) + link(r), esc((r.currency || base) + \' \' + fmt(r.total)), \'<span style="color:#b42318">\' + esc(when(r.due_date).toFormat(\'LLL d\')) + \'</span>\'])) : \'\')\n' +
        '  + h2(\'Spend by category\')\n' +
        '  + (byCategory.length ? table(null, byCategory.map(([k, v]) => [esc(k), money(v)])) : none(\'No approved spend this week.\'))\n' +
        '  + h2(\'Top suppliers\')\n' +
        '  + (bySupplier.length ? table(null, bySupplier.map(([k, v]) => [esc(k), money(v)])) : none(\'No approved spend this week.\'))\n' +
        '  + h2(\'What came in\')\n' +
        '  + table(null, statusCounts.map(([k, v]) => [esc(labels[k] || k), String(v)]).concat(channelCounts.length ? [[\'<span style="color:#667085">By channel: \' + channelCounts.map(([k, v]) => esc(channels[k] || k) + \' \' + v).join(\', \') + \'</span>\', \'\']] : []))\n' +
        '  + \'<p style="margin:24px 0 0;font-size:13px"><a href="https://docs.google.com/spreadsheets/d/\' + esc(cfg.SHEET_ID) + \'/edit" style="color:#175cd3">Open the register</a></p>\'\n' +
        '  + \'<p style="margin:8px 0 0;font-size:12px;color:#98a2b3">Mark bills as paid in the payment_status column and they drop off the due lists. Time saved assumes \' + esc(cfg.MINUTES_SAVED_PER_DOC) + \' minutes of manual entry per document.</p>\'\n' +
        '  + \'</div>\';\n' +
        '\n' +
        'const subject = \'Invoice Desk weekly: \' + week.length + \' document\' + (week.length === 1 ? \'\' : \'s\') + \', \' + money(spend) + \' approved\'\n' +
        '  + (waiting.length ? \', \' + waiting.length + \' waiting on you\' : \'\') + (dueSoon.length ? \', \' + dueSoon.length + \' due this week\' : \'\');\n' +
        '\n' +
        'return [{ json: { subject, html, documents: week.length, spend, waiting: waiting.length, due_soon: dueSoon.length, overdue: overdue.length, caught } }];\n'
    }
  },
  output: [{ subject: 'Invoice Desk weekly: 10 documents, USD 4,434.06 approved', html: '<div></div>', documents: 10 }]
});

const emailOwner = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email the Owner',
    position: [1200, 320],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr("{{ $('Config').first().json.OWNER_EMAIL }}"),
      subject: expr('{{ $json.subject }}'),
      emailType: 'html',
      message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'Invoice Desk' }
    },
    credentials: { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } }
  },
  output: [{ id: '19a1', labelIds: ['SENT'] }]
});

const note = sticky(
  '## Weekly Summary\n' +
  'Every Monday at 8:00 am (Portland, Maine time) the owner gets one email built from the register: documents in, spend approved by category and supplier, what is waiting on them, bills due in the next 7 days, overdue bills, and what the checks caught (overcharges, duplicates, bank changes).\n\n' +
  'Built in code with no AI, so every number is exact. Text from documents is escaped before it goes into the HTML.',
  [everyMonday, sendNow, config, readRegister, buildSummary, emailOwner],
  { color: 4 }
);

export default workflow('invoice-desk-weekly-summary', 'Invoice Desk 6: Weekly Summary')
  .add(everyMonday)
  .to(config)
  .add(sendNow)
  .to(config)
  .to(readRegister)
  .to(buildSummary)
  .to(emailOwner)
  .add(note);
