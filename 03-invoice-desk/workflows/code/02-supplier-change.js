// After an approval: a new supplier joins the supplier list, and a confirmed bank change becomes the
// account on file, so the next invoice from them goes through on its own.
const d = $('Record Decision').first().json;
const r = d.record;
if (!d.approved || !r.supplier) return [];
const today = DateTime.now().setZone($('Config').first().json.TIMEZONE).toISODate();
if (r.supplier_status === 'new' && ['invoice', 'credit_note'].includes(r.doc_type)) {
  return [{ json: { action: 'add', supplier: r.supplier, aliases: '', email_domain: r.supplier_email_domain || '', tax_id: r.supplier_tax_id || '',
    default_category: r.category || 'Other', bank_last4: r.bank_last4 || '', status: 'active', added_at: today, added_by: 'approval ' + r.doc_id } }];
}
if (r.supplier_status === 'known' && r.bank_changed && r.bank_last4) {
  return [{ json: { action: 'update_bank', supplier: r.supplier, bank_last4: r.bank_last4, added_by: 'bank change approved ' + r.doc_id } }];
}
return [];
