// What the intake workflow gets back: enough to tell whoever sent the document what happened to it.
const d = $('Decide').first().json;
const row = $('Document Row').first().json;
const labels = {
  auto_approved: 'Approved automatically', pending_approval: 'Waiting for approval', needs_review: 'Needs a check',
  duplicate: 'Already logged', not_invoice: 'Not an invoice', unsupported: 'File type not supported', error: 'Could not be read'
};
return [{
  json: {
    doc_id: d.doc_id, status: d.status, status_label: labels[d.status] || d.status, supplier: d.supplier,
    doc_type: d.doc_type, invoice_number: d.invoice_number, invoice_date: d.invoice_date, due_date: d.due_date,
    currency: d.currency, total: d.total, category: d.category, flags: d.flags, drive_link: row.drive_link,
    summary: d.summary, original_filename: d.original_filename, approval_requested: d.needs_person,
    line_count: d.line_count, duplicate_of: d.duplicate_of, ai_error: d.ai_error
  }
}];
