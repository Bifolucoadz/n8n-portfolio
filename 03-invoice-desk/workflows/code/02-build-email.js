// The approval email: what the document is, why it needs a person, and the lines. Everything from the
// document is escaped, so a supplier name or line description can't inject HTML into the email.
const r = $('When Called').first().json.record || {};
const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = v => (v === null || v === undefined || v === '') ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtRate = v => (v === null || v === undefined || v === '') ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const cap = s => s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, ' ') : '';
const day = s => { if (!s) return ''; const t = DateTime.fromISO(String(s)); return t.isValid ? t.toFormat('EEE d LLL yyyy') : esc(s); };
const review = r.status === 'needs_review';
const amount = (r.currency || 'USD') + ' ' + fmt(r.total);
const why = (r.flags || []).filter(f => f.short && f.level === (review ? 'block' : 'approve')).map(f => f.short);
const reason = why.slice(0, 2).join(', ') + (why.length > 2 ? ' +' + (why.length - 2) + ' more' : '');
const subject = (review ? 'Check before paying: ' : 'Approve: ') + (r.supplier || 'Unknown supplier') + ', ' + amount + (reason ? ' (' + reason + ')' : '');

const colour = { block: ['#fdecea', '#b42318', 'Check'], approve: ['#fff4e0', '#b54708', 'Approve'], info: ['#f2f4f7', '#475467', 'Note'] };
const flagRows = (r.flags || []).map(f => {
  const c = colour[f.level] || colour.info;
  return '<tr><td style="text-align:left;padding:6px 0;vertical-align:top;width:70px"><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:' + c[0] + ';color:' + c[1] + '">' + c[2] + '</span></td>'
    + '<td style="text-align:left;padding:6px 0 6px 8px;font-size:14px;line-height:1.45;color:#101828">' + esc(f.text) + '</td></tr>';
}).join('');

const fact = (k, v) => v ? '<tr><td style="text-align:left;padding:4px 16px 4px 0;color:#667085;font-size:13px;white-space:nowrap">' + k + '</td><td style="text-align:left;padding:4px 0;font-size:14px;color:#101828">' + v + '</td></tr>' : '';
const facts = fact('Supplier', esc(r.supplier) + (r.supplier_status === 'new' ? ' <span style="color:#b54708">(new)</span>' : ''))
  + fact('Document', esc(cap(r.doc_type)) + (r.invoice_number ? ' ' + esc(r.invoice_number) : ''))
  + fact('Dated', day(r.invoice_date))
  + fact('Due', day(r.due_date))
  + fact('Category', esc(r.category))
  + fact('Received', [cap(r.source) + (r.sender ? ' from ' + r.sender : ''), r.original_filename].filter(Boolean).map(esc).join(' · '))
  + fact('Reference', esc(r.doc_id));

const lines = (r.lines || []).slice(0, 25).map(l =>
  '<tr><td style="text-align:left;padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:13px">' + esc(l.description)
  + (l.line_check ? '<div style="color:#b42318;font-size:12px;margin-top:2px">' + esc(l.line_check) + '</div>' : '') + '</td>'
  + '<td style="text-align:left;padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:13px;text-align:right">' + esc(l.quantity === null ? '' : l.quantity) + '</td>'
  + '<td style="text-align:left;padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:13px;text-align:right">' + fmtRate(l.unit_price) + '</td>'
  + '<td style="text-align:left;padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:13px;text-align:right">' + fmt(l.amount) + '</td></tr>').join('');
const more = (r.lines || []).length > 25 ? '<p style="font-size:12px;color:#667085">' + ((r.lines || []).length - 25) + ' more lines in the register.</p>' : '';

const html = '<div style="text-align:left;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:600px;color:#101828">'
  + '<p style="text-align:left;margin:0 0 4px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:' + (review ? '#b42318' : '#b54708') + ';font-weight:700">' + (review ? 'Needs a check before paying' : 'Needs your approval') + '</p>'
  + '<p style="text-align:left;margin:0 0 2px;font-size:22px;font-weight:700">' + esc(r.supplier || 'Unknown supplier') + '</p>'
  + '<p style="text-align:left;margin:0 0 18px;font-size:28px;font-weight:700">' + esc(amount) + '</p>'
  + '<table style="border-collapse:collapse;margin-bottom:18px">' + flagRows + '</table>'
  + '<table style="border-collapse:collapse;margin-bottom:18px">' + facts + '</table>'
  + (lines ? '<table style="border-collapse:collapse;width:100%;margin-bottom:8px"><tr>'
    + '<th style="text-align:left;padding:6px 8px;font-size:11px;color:#667085;text-transform:uppercase;border-bottom:2px solid #eaecf0">Line</th>'
    + '<th style="text-align:right;padding:6px 8px;font-size:11px;color:#667085;text-transform:uppercase;border-bottom:2px solid #eaecf0">Qty</th>'
    + '<th style="text-align:right;padding:6px 8px;font-size:11px;color:#667085;text-transform:uppercase;border-bottom:2px solid #eaecf0">Price</th>'
    + '<th style="text-align:right;padding:6px 8px;font-size:11px;color:#667085;text-transform:uppercase;border-bottom:2px solid #eaecf0">Amount</th></tr>'
    + lines + '</table>' + more : '')
  + '<p style="text-align:left;margin:16px 0;font-size:14px">'
  + (r.drive_link ? '<a href="' + esc(r.drive_link) + '" style="color:#175cd3">Open the document</a> · ' : '')
  + '<a href="https://docs.google.com/spreadsheets/d/' + esc($('Config').first().json.SHEET_ID) + '/edit" style="color:#175cd3">Open the register</a></p>'
  + '<p style="text-align:left;margin:0 0 8px;font-size:13px;color:#475467">' + (review
    ? 'Check the points above against the document. Approve once it\'s right (fix any figures in the register first), or reject it.'
    : 'Approve to clear it for payment' + (r.supplier_status === 'new' ? ' and add ' + esc(r.supplier) + ' to the supplier list' : '') + ', or reject it.')
  + '</p></div>';

return [{ json: { subject, html, record: r } }];
