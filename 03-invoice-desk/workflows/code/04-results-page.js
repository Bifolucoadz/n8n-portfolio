// The page the sender sees after uploading: one card per file saying what was read and what happens next.
// Everything read from a document is escaped before it goes into the page.
const results = $('Process Document').all().map(i => i.json);
const sent = $('Split Files').all().map(i => i.json);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = s => { const t = DateTime.fromISO(String(s || '')); return t.isValid ? t.toFormat('LLL d, yyyy') : ''; };

const look = {
  auto_approved: ['#ecfdf3', '#067647', 'Approved', 'Checked and logged. Nothing else to do.'],
  pending_approval: ['#fffaeb', '#b54708', 'Sent for approval', 'Everything adds up. The owner has been asked to approve it.'],
  needs_review: ['#fef3f2', '#b42318', 'Needs a check', 'Something needs a person to look at it. The owner has been emailed.'],
  duplicate: ['#f2f4f7', '#344054', 'Already logged', 'We already have this one, so it was not added again.'],
  not_invoice: ['#f2f4f7', '#344054', 'Not an invoice', 'This does not look like a bill or receipt. It was filed under Other.'],
  unsupported: ['#f2f4f7', '#344054', 'Not supported', 'Please send a PDF or a photo (JPG, PNG or WEBP).'],
  error: ['#fef3f2', '#b42318', 'Could not read', 'The file was saved and the team has been told. Nothing else to do.']
};

const cards = results.map((r, i) => {
  const name = (sent[i] && sent[i].original_filename) || r.original_filename || 'File ' + (i + 1);
  if (r.error || !r.status) {
    const l = look.error;
    return '<div style="border:1px solid #eaecf0;border-radius:12px;padding:16px 18px;margin:0 0 12px;text-align:left">'
      + '<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:' + l[0] + ';color:' + l[1] + '">' + l[2] + '</span>'
      + '<div style="font-size:13px;color:#667085;margin-top:8px">' + esc(name) + '</div>'
      + '<div style="font-size:14px;color:#344054;margin-top:6px">' + l[3] + '</div></div>';
  }
  const l = look[r.status] || look.error;
  const amount = r.total !== null && r.total !== undefined && r.total !== '' ? esc((r.currency || 'USD') + ' ' + fmt(r.total)) : '';
  const notes = (r.flags || []).filter(f => f.level !== 'info' || r.status === 'duplicate').slice(0, 3)
    .map(f => '<li style="margin:2px 0">' + esc(f.text) + '</li>').join('');
  return '<div style="border:1px solid #eaecf0;border-radius:12px;padding:16px 18px;margin:0 0 12px;text-align:left">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">'
    + '<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:' + l[0] + ';color:' + l[1] + '">' + l[2] + '</span>'
    + '<span style="font-size:12px;color:#98a2b3">' + esc(r.doc_id) + '</span></div>'
    + (r.supplier ? '<div style="font-size:17px;font-weight:700;color:#101828;margin-top:10px">' + esc(r.supplier) + '</div>' : '')
    + (amount ? '<div style="font-size:22px;font-weight:700;color:#101828">' + amount + '</div>' : '')
    + '<div style="font-size:13px;color:#667085;margin-top:4px">' + [r.doc_type && r.invoice_number ? esc(r.doc_type.replace(/_/g, ' ') + ' ' + r.invoice_number) : '', r.invoice_date ? 'dated ' + day(r.invoice_date) : '', r.due_date ? 'due ' + day(r.due_date) : '', r.category ? esc(r.category) : ''].filter(Boolean).join(' · ') + '</div>'
    + '<div style="font-size:14px;color:#344054;margin-top:10px">' + l[3] + '</div>'
    + (notes ? '<ul style="margin:8px 0 0;padding-left:18px;font-size:13px;color:' + l[1] + '">' + notes + '</ul>' : '')
    + '<div style="font-size:12px;color:#98a2b3;margin-top:10px">' + esc(name) + '</div></div>';
}).join('');

const n = results.length;
const html = '<div style="max-width:520px;margin:0 auto;padding:36px 16px 24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">'
  + '<div style="text-align:center;margin-bottom:18px"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#667085;font-weight:700">Saltmarsh Kitchen · Invoice Desk</div>'
  + '<h1 style="font-size:24px;margin:6px 0 4px;color:#101828">' + (n === 1 ? 'Got it. Here is what we read.' : 'Got all ' + n + '. Here is what we read.') + '</h1>'
  + '<p style="font-size:14px;color:#667085;margin:0">Every document is filed in Drive and logged in the register.</p></div>'
  + cards
  + '<p style="text-align:center;font-size:13px;margin-top:16px"><a href="?" style="color:#175cd3">Send another</a></p></div>';

return [{ json: { html, count: n } }];
