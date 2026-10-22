// The owner's Monday email, built from the register in code (no AI), so every figure is exact.
// Spend counts approved and auto-approved documents in the base currency; "waiting" lists everything
// still pending, however old.
const cfg = $('Config').first().json;
const tz = cfg.TIMEZONE;
const now = DateTime.now().setZone(tz);
const today = now.startOf('day');
const since = now.minus({ days: 7 });
const base = cfg.BASE_CURRENCY;

const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = v => base + ' ' + fmt(v);
const n = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? 0 : Number(v);
const when = s => { const t = DateTime.fromISO(String(s || ''), { zone: tz }); return t.isValid ? t : null; };

const rows = $('Read Register').all().map(i => i.json).filter(r => r.doc_id);
const week = rows.filter(r => { const t = when(r.received_at); return t && t >= since; });
const approvedStatuses = ['approved', 'auto_approved'];
const spendRows = week.filter(r => approvedStatuses.includes(r.status) && (r.currency || base) === base && r.doc_type !== 'credit_note');

const count = (list, key) => Object.entries(list.reduce((m, r) => { const k = r[key] || 'other'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
const sumBy = (list, key) => Object.entries(list.reduce((m, r) => { const k = r[key] || 'Other'; m[k] = (m[k] || 0) + n(r.total); return m; }, {})).sort((a, b) => b[1] - a[1]);

const spend = spendRows.reduce((a, r) => a + n(r.total), 0);
const byCategory = sumBy(spendRows, 'category');
const bySupplier = sumBy(spendRows, 'supplier').slice(0, 5);
const statusCounts = count(week, 'status');
const channelCounts = count(week, 'source');

const waiting = rows.filter(r => ['pending_approval', 'needs_review'].includes(r.status))
  .map(r => ({ ...r, age: Math.max(0, Math.floor(today.diff((when(r.received_at) || today).startOf('day'), 'days').days)) }))
  .sort((a, b) => b.age - a.age);
const payable = rows.filter(r => approvedStatuses.includes(r.status) && r.payment_status === 'unpaid' && when(r.due_date));
const dueSoon = payable.filter(r => { const d = when(r.due_date); return d >= today && d <= today.plus({ days: 7 }); }).sort((a, b) => a.due_date.localeCompare(b.due_date));
const overdue = payable.filter(r => when(r.due_date) < today).sort((a, b) => a.due_date.localeCompare(b.due_date));

const duplicates = week.filter(r => r.status === 'duplicate');
const duplicateValue = duplicates.reduce((a, r) => a + n(r.total), 0);
const bankChanges = week.filter(r => /bank details have changed|Bank account differs/.test(String(r.flags || '')));
const overcharge = week.reduce((a, r) => a + [...String(r.flags || '').matchAll(/Overcharged by [A-Z]{3} ([\d,]+\.\d{2})/g)].reduce((b, m) => b + Number(m[1].replace(/,/g, '')), 0), 0);
const processed = week.filter(r => !['duplicate', 'unsupported', 'error'].includes(r.status)).length;
const minutes = processed * Number(cfg.MINUTES_SAVED_PER_DOC);
const timeSaved = minutes >= 60 ? Math.floor(minutes / 60) + ' h ' + (minutes % 60) + ' min' : minutes + ' min';

const labels = { auto_approved: 'Approved automatically', approved: 'Approved by you', pending_approval: 'Waiting for approval', needs_review: 'Needs a check', rejected: 'Rejected', duplicate: 'Duplicates caught', not_invoice: 'Not invoices', unsupported: 'Unsupported files', error: 'Could not be read' };
const channels = { email: 'Email', upload: 'Upload form', drive: 'Drive folder', test: 'Test' };

// Layout helpers: email-safe tables with inline styles.
const h2 = t => '<h2 style="font-size:15px;margin:28px 0 8px;color:#101828">' + t + '</h2>';
const table = (head, body) => '<table style="border-collapse:collapse;width:100%">'
  + (head ? '<tr>' + head.map((h, i) => '<th style="text-align:' + (i ? 'right' : 'left') + ';padding:6px 8px;font-size:11px;color:#667085;text-transform:uppercase;border-bottom:2px solid #eaecf0">' + h + '</th>').join('') + '</tr>' : '')
  + body.map(cells => '<tr>' + cells.map((c, i) => '<td style="text-align:' + (i ? 'right' : 'left') + ';padding:7px 8px;border-bottom:1px solid #eaecf0;font-size:14px">' + c + '</td>').join('') + '</tr>').join('') + '</table>';
const none = t => '<p style="font-size:14px;color:#667085;margin:4px 0">' + t + '</p>';
const link = r => r.drive_link ? ' <a href="' + esc(r.drive_link) + '" style="color:#175cd3;font-size:12px">file</a>' : '';
const tile = (label, value, colour) => '<td style="padding:14px;background:#f9fafb;border-radius:8px;width:25%;vertical-align:top"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#667085">' + label + '</div><div style="font-size:22px;font-weight:700;margin-top:4px;color:' + (colour || '#101828') + '">' + value + '</div></td>';

const caught = [];
if (overcharge) caught.push(money(overcharge) + ' in overcharged lines');
if (duplicates.length) caught.push(duplicates.length + ' duplicate' + (duplicates.length > 1 ? 's' : '') + ' (' + money(duplicateValue) + ' that could have been paid twice)');
if (bankChanges.length) caught.push(bankChanges.length + ' bank-detail change' + (bankChanges.length > 1 ? 's' : '') + ' held for a phone check');

const html = '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;color:#101828">'
  + '<p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#667085;font-weight:700">Invoice Desk · weekly summary</p>'
  + '<h1 style="margin:4px 0 2px;font-size:24px">' + esc(cfg.BUSINESS) + '</h1>'
  + '<p style="margin:0 0 18px;color:#667085;font-size:14px">' + since.toFormat('LLL d') + ' to ' + now.toFormat('LLL d, yyyy') + '</p>'
  + '<table style="border-collapse:separate;border-spacing:8px;width:100%;margin:0 -8px"><tr>'
  + tile('Documents', week.length) + tile('Spend approved', base + ' ' + Math.round(spend).toLocaleString('en-US')) + tile('Waiting on you', waiting.length, waiting.length ? '#b54708' : '') + tile('Time saved', timeSaved)
  + '</tr></table>'
  + (caught.length ? '<p style="margin:16px 0 0;padding:12px 14px;background:#ecfdf3;border-radius:8px;font-size:14px;color:#05603a"><b>Caught this week:</b> ' + esc(caught.join('; ')) + '.</p>' : '')
  + h2('Waiting on you (' + waiting.length + ')')
  + (waiting.length ? table(['Document', 'Amount', 'Waiting'], waiting.map(r => [
      '<b>' + esc(r.supplier || r.original_filename) + '</b> ' + esc(r.invoice_number) + link(r) + '<div style="font-size:12px;color:' + (r.status === 'needs_review' ? '#b42318' : '#b54708') + '">' + esc(String(r.flags || '').split('; ')[0]) + '</div>',
      esc((r.currency || base) + ' ' + fmt(r.total)), r.age ? r.age + ' day' + (r.age > 1 ? 's' : '') : 'today'])) : none('Nothing waiting. Everything has been decided.'))
  + h2('Bills due in the next 7 days')
  + (dueSoon.length ? table(['Supplier', 'Amount', 'Due'], dueSoon.map(r => ['<b>' + esc(r.supplier) + '</b> ' + esc(r.invoice_number) + link(r), esc((r.currency || base) + ' ' + fmt(r.total)), esc(when(r.due_date).toFormat('EEE LLL d'))])) : none('No approved bills due this week.'))
  + (overdue.length ? h2('Overdue') + table(['Supplier', 'Amount', 'Was due'], overdue.map(r => ['<b>' + esc(r.supplier) + '</b> ' + esc(r.invoice_number) + link(r), esc((r.currency || base) + ' ' + fmt(r.total)), '<span style="color:#b42318">' + esc(when(r.due_date).toFormat('LLL d')) + '</span>'])) : '')
  + h2('Spend by category')
  + (byCategory.length ? table(null, byCategory.map(([k, v]) => [esc(k), money(v)])) : none('No approved spend this week.'))
  + h2('Top suppliers')
  + (bySupplier.length ? table(null, bySupplier.map(([k, v]) => [esc(k), money(v)])) : none('No approved spend this week.'))
  + h2('What came in')
  + table(null, statusCounts.map(([k, v]) => [esc(labels[k] || k), String(v)]).concat(channelCounts.length ? [['<span style="color:#667085">By channel: ' + channelCounts.map(([k, v]) => esc(channels[k] || k) + ' ' + v).join(', ') + '</span>', '']] : []))
  + '<p style="margin:24px 0 0;font-size:13px"><a href="https://docs.google.com/spreadsheets/d/' + esc(cfg.SHEET_ID) + '/edit" style="color:#175cd3">Open the register</a></p>'
  + '<p style="margin:8px 0 0;font-size:12px;color:#98a2b3">Mark bills as paid in the payment_status column and they drop off the due lists. Time saved assumes ' + esc(cfg.MINUTES_SAVED_PER_DOC) + ' minutes of manual entry per document.</p>'
  + '</div>';

const subject = 'Invoice Desk weekly: ' + week.length + ' document' + (week.length === 1 ? '' : 's') + ', ' + money(spend) + ' approved'
  + (waiting.length ? ', ' + waiting.length + ' waiting on you' : '') + (dueSoon.length ? ', ' + dueSoon.length + ' due this week' : '');

return [{ json: { subject, html, documents: week.length, spend, waiting: waiting.length, due_soon: dueSoon.length, overdue: overdue.length, caught } }];
