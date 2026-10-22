// One Line Items row per line. A bill with no itemised lines gets one summary line, so its spend still shows up.
const d = $('Decide').first().json;
if (!['auto_approved', 'pending_approval', 'needs_review'].includes(d.status)) return [];
const v = x => (x === null || x === undefined) ? '' : x;
const lines = d.lines.length ? d.lines : [{
  line_no: 1, description: d.summary || 'Total (no itemised lines)', quantity: null, unit_price: null,
  amount: d.subtotal !== null ? d.subtotal : d.total, line_check: ''
}];
return lines.map(l => ({
  json: {
    doc_id: d.doc_id, line_no: l.line_no, supplier: d.supplier, invoice_number: d.invoice_number,
    invoice_date: d.invoice_date, description: l.description, quantity: v(l.quantity), unit_price: v(l.unit_price),
    amount: v(l.amount), category: d.category, line_check: l.line_check || ''
  }
}));
