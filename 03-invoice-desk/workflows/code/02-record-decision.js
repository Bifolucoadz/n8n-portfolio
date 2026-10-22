// Turn the button click into a status. No click within the wait time: leave the row as it is
// (the weekly summary lists it as still waiting).
const cfg = $('Config').first().json;
const r = $('Build Email').first().json.record;
const approved = $json.data ? $json.data.approved : undefined;
if (approved !== true && approved !== false) return [];
return [{
  json: {
    doc_id: r.doc_id,
    status: approved ? 'approved' : 'rejected',
    decided_by: cfg.APPROVER_EMAIL,
    decided_at: DateTime.now().setZone(cfg.TIMEZONE).toISO(),
    payment_status: approved ? (r.payment_status || 'unpaid') : 'do_not_pay',
    approved,
    record: r
  }
}];
