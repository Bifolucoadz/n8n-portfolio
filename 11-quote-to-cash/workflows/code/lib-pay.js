// ---- lib-pay.js: what a payment link is for, and whether it can be paid now ----
function payable(q, kind) {
  if (!q) return { ok: false, message: 'This payment link is not valid.' };
  if (kind === 'deposit') {
    if (q.status === 'accepted' && !q.deposit_paid_at) return { ok: true, amount: q.deposit_due, label: 'Deposit for quote ' + q.quote_id + ': ' + q.job_title };
    return { ok: false, message: q.deposit_paid_at ? 'Your deposit is already paid. Thank you!' : 'This quote has not been accepted yet.' };
  }
  if (kind === 'balance') {
    if (q.status === 'completed' && !q.balance_paid_at) return { ok: true, amount: q.balance_due, label: 'Invoice ' + q.invoice_id + ': ' + q.job_title };
    return { ok: false, message: q.balance_paid_at ? 'This invoice is already paid. Thank you!' : 'There is no invoice to pay yet.' };
  }
  return { ok: false, message: 'This payment link is not valid.' };
}
// ---- end lib-pay.js ----
