// ---- lib-pdf-request.js: find the quote for a token and make the requested PDF (quote, invoice, receipt) ----
async function pdfFor(helpers, T, token, doc) {
  const s = settingsOf(T.Settings);
  const row = (T.Quotes || []).find(r => token && String(r.token) === String(token));
  const q = quoteOf(row);
  doc = ['quote', 'invoice', 'receipt'].includes(doc) ? doc : 'quote';
  if (!q) return { json: { ok: false, code: 404, message: 'This link is not valid.' } };
  if (doc === 'invoice' && !q.completed_at) return { json: { ok: false, code: 404, message: 'There is no invoice for this job yet.' } };
  if (doc === 'receipt' && !q.balance_paid_at) return { json: { ok: false, code: 404, message: 'This job has not been paid in full yet.' } };
  const payments = (T.Payments || []).filter(p => p.quote_id === q.quote_id);
  const d = documentPdf(q, s, doc, payments);
  const data = await helpers.prepareBinaryData(d.buffer, d.fileName, 'application/pdf');
  return { json: { ok: true, code: 200, quote_id: q.quote_id, doc, fileName: d.fileName, bytes: d.buffer.length }, binary: { data } };
}
// ---- end lib-pdf-request.js ----
