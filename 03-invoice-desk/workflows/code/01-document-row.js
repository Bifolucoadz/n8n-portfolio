// The Documents row, with a link to the filed copy in Drive (or to the original, for a duplicate).
const cfg = $('Config').first().json;
const d = $('Decide').first().json;
let link = d.duplicate_drive_link || '';
if ($('Upload to Drive').isExecuted) link = 'https://drive.google.com/file/d/' + $('Upload to Drive').first().json.id + '/view';
const v = x => (x === null || x === undefined) ? '' : x;
const auto = d.status === 'auto_approved';
return [{
  json: {
    doc_id: d.doc_id, received_at: d.received_at, status: d.status, flags: d.flags_text, supplier: d.supplier,
    doc_type: d.doc_type, invoice_number: d.invoice_number, invoice_date: d.invoice_date, due_date: d.due_date,
    currency: d.currency, subtotal: v(d.subtotal), tax: v(d.tax), total: v(d.total), category: d.category,
    payment_status: ['auto_approved', 'pending_approval', 'needs_review'].includes(d.status) ? d.payment_status : '', drive_link: link, summary: d.summary, source: d.source, sender: d.sender,
    original_filename: d.original_filename, supplier_status: d.supplier_status, decided_by: auto ? 'rules' : '',
    decided_at: auto ? DateTime.now().setZone(cfg.TIMEZONE).toISO() : '', duplicate_of: d.duplicate_of,
    line_count: d.line_count, confidence: d.confidence, bank_last4: d.bank_last4, file_hash: d.file_hash
  }
}];
