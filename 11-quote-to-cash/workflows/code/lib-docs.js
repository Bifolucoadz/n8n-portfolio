// ---- lib-docs.js (included by build.py): the quote, invoice and receipt PDFs (needs lib-pdf and lib-mgv) ----
const C = { brand: '#1f4d3a', leaf: '#7bb661', ink: '#1d2a24', body: '#3d4b44', muted: '#76847c', line: '#e1e7e2', soft: '#eef3ef', pale: '#f4f8f4', white: '#ffffff', tint: '#cfe3d3' };
const L = 48, R = PDF_W - 48, W = R - L, BOTTOM = PDF_H - 64;

function documentPdf(q, s, docType, payments) {
  const isQuote = docType === 'quote', isInvoice = docType === 'invoice', isReceipt = docType === 'receipt';
  const number = isQuote ? q.quote_id : (q.invoice_id || q.quote_id.replace('Q-', 'INV-'));
  const title = isQuote ? 'QUOTE' : (isInvoice ? 'INVOICE' : 'RECEIPT');
  const doc = newPdf(s.company + ' ' + title.toLowerCase() + ' ' + number);
  const accepted = !!q.accepted_at;
  const chosen = accepted ? (q.chosen_extras || []) : [];
  const vatPct = Math.round(Number(s.vat_rate === '' || s.vat_rate === undefined ? 0.2 : s.vat_rate) * 100);
  let y = 0;

  function leaf(x, top, size, color, vein) {
    const k = size / 34, X = u => x + u * k, Y = v => top + v * k;
    doc.shape([['M', X(2), Y(32)], ['C', X(2), Y(14), X(14), Y(2), X(32), Y(2)], ['C', X(32), Y(20), X(20), Y(32), X(2), Y(32)]], color);
    doc.line(X(5), Y(29), X(27), Y(7), vein, 1.4 * k);
  }
  function header() {
    doc.addPage();
    doc.rect(0, 0, PDF_W, 92, C.brand);
    leaf(L, 27, 38, C.leaf, C.brand);
    doc.text(L + 50, 49, s.company || 'Mossgrove Landscapes', { size: 18, bold: true, color: C.white });
    doc.text(L + 50, 65, 'Garden design · patios · fencing · lawns', { size: 9, color: C.tint });
    doc.text(R, 47, title, { size: 22, bold: true, color: C.white, align: 'right' });
    doc.text(R, 65, number, { size: 11, color: C.tint, align: 'right' });
    y = 92;
  }
  function continuation() {
    doc.addPage();
    doc.rect(0, 0, PDF_W, 34, C.brand);
    leaf(L, 9, 16, C.leaf, C.brand);
    doc.text(L + 24, 21.5, s.company || 'Mossgrove Landscapes', { size: 10, bold: true, color: C.white });
    doc.text(R, 21.5, title + ' ' + number + ' (continued)', { size: 9, color: C.tint, align: 'right' });
    y = 58;
  }
  const room = h => { if (y + h > BOTTOM) { continuation(); return true; } return false; };

  header();
  // Who and when
  y += 34;
  doc.text(L, y, isQuote ? 'PREPARED FOR' : 'BILL TO', { size: 7.5, bold: true, color: C.muted });
  let ly = y + 16;
  doc.text(L, ly, q.client_name, { size: 11.5, bold: true });
  for (const line of wrapText(String(q.site_address || '') + (q.postcode && String(q.site_address || '').indexOf(q.postcode) < 0 ? ', ' + q.postcode : ''), 9.5, false, 250)) { ly += 13.5; doc.text(L, ly, line, { size: 9.5, color: C.body }); }
  if (q.client_email) { ly += 13.5; doc.text(L, ly, q.client_email, { size: 9, color: C.muted }); }
  if (q.client_phone) { ly += 12.5; doc.text(L, ly, String(q.client_phone), { size: 9, color: C.muted }); }
  const meta = isQuote
    ? [['Quote number', q.quote_id], ['Date', day(q.sent_at || q.created_at)], ['Valid until', day(q.valid_until) || day(toDt(q.created_at).plus({ days: Number(s.validity_days) || 30 }).toISO())], ['Prepared by', q.estimator || s.owner_name]]
    : isInvoice
      ? [['Invoice number', number], ['Invoice date', day(q.completed_at)], ['Due date', day(toDt(q.completed_at).plus({ days: Number(s.payment_days) || 7 }).toISO())], ['Quote', q.quote_id]]
      : [['Receipt for', number], ['Paid on', day(q.balance_paid_at)], ['Quote', q.quote_id], ['Job', day(q.job_start) + ' to ' + day(q.job_end)]];
  let my = y;
  for (const [k, v] of meta) { doc.text(338, my + 4, k, { size: 9, color: C.muted }); doc.text(R, my + 4, String(v || ''), { size: 9.5, bold: true, align: 'right' }); my += 17; }
  y = Math.max(ly, my) + 16;
  doc.line(L, y, R, y, C.line, 0.75);

  // The job
  y += 27;
  doc.text(L, y, q.job_title || 'Garden works', { size: 15.5, bold: true });
  y += 8;
  if (isQuote && q.summary) for (const line of wrapText(q.summary, 10, false, W)) { y += 14.5; doc.text(L, y, line, { size: 10, color: C.body }); }
  y += 16;

  // Table
  const COL_QTY = 392, COL_PRICE = 470, COL_AMT = R - 10, DESC_W = 290;
  function tableHead() {
    doc.rect(L, y, W, 22, C.soft);
    doc.text(L + 10, y + 14.5, 'DESCRIPTION', { size: 7.5, bold: true, color: C.muted });
    doc.text(COL_QTY, y + 14.5, 'QUANTITY', { size: 7.5, bold: true, color: C.muted, align: 'right' });
    doc.text(COL_PRICE, y + 14.5, 'UNIT PRICE', { size: 7.5, bold: true, color: C.muted, align: 'right' });
    doc.text(COL_AMT, y + 14.5, 'AMOUNT', { size: 7.5, bold: true, color: C.muted, align: 'right' });
    y += 22;
  }
  function row(name, note, qty, unit, price, amount, muted) {
    const nameLines = wrapText(name, 9.5, true, DESC_W);
    const noteLines = note ? wrapText(note, 8.5, false, DESC_W) : [];
    const h = 9 + nameLines.length * 12 + noteLines.length * 10.5 + 5;
    if (room(h)) tableHead();
    let ty = y + 15;
    nameLines.forEach((t, i) => doc.text(L + 10, ty + i * 12, t, { size: 9.5, bold: true, color: muted ? C.body : C.ink }));
    const ny = ty + nameLines.length * 12 - 1.5;
    noteLines.forEach((t, i) => doc.text(L + 10, ny + i * 10.5, t, { size: 8.5, color: C.muted }));
    doc.text(COL_QTY, ty, qty, { size: 9.5, color: C.body, align: 'right' });
    doc.text(COL_PRICE, ty, price, { size: 9.5, color: C.body, align: 'right' });
    doc.text(COL_AMT, ty, amount, { size: 9.5, bold: !muted, color: muted ? C.body : C.ink, align: 'right' });
    y += h;
    doc.line(L, y, R, y, C.line, 0.5);
  }
  const qtyCell = l => l.unit === 'each' ? qtyText(l.quantity) : qtyText(l.quantity) + ' ' + unitText(l.unit, l.quantity);
  const priceCell = l => money(l.unit_price) + (l.unit === 'each' ? '' : ' / ' + (l.unit === 'metre' ? 'm' : l.unit));
  room(60);
  tableHead();
  for (const l of q.lines || []) row(l.item, l.label, qtyCell(l), l.unit, priceCell(l), money(l.amount));
  for (const c of q.custom || []) row(c.description, '', qtyCell(c), c.unit, c.unit_price === null ? 'to price' : money(c.unit_price), c.amount === null || c.amount === undefined ? 'to price' : money(c.amount));
  for (const x of (q.extras || []).filter(x => chosen.includes(x.code))) row(x.item, 'Optional extra you added' + (x.label ? ': ' + x.label : ''), qtyCell(x), x.unit, priceCell(x), money(x.amount));

  // Optional extras still on offer (quote only)
  const offer = isQuote && !accepted ? (q.extras || []) : [];
  if (offer.length) {
    y += 22;
    room(40);
    doc.text(L, y, 'Optional extras', { size: 10.5, bold: true });
    doc.text(L + textWidth('Optional extras', 10.5, true) + 8, y, '(not included in the total; tick them when you accept online)', { size: 8.5, color: C.muted });
    y += 8;
    for (const x of offer) row(x.item, x.why || x.label, qtyCell(x), x.unit, priceCell(x), money(x.amount), true);
  }

  // Totals
  const subtotal = accepted ? q.accepted_subtotal : q.subtotal, vat = accepted ? q.accepted_vat : q.vat, total = accepted ? q.accepted_total : q.total;
  const deposit = accepted ? q.deposit_due : q.deposit;
  const depositPaid = (payments || []).find(p => p.kind === 'deposit' && p.status === 'paid');
  const balancePaid = (payments || []).find(p => p.kind === 'balance' && p.status === 'paid');
  const rows = [['Subtotal', money(subtotal)], ['VAT (' + vatPct + '%)', money(vat)], ['Total', money(total), 'total']];
  if (isQuote) rows.push(['Deposit to book (' + (Number(s.deposit_pct) || 25) + '%)', money(deposit), 'note']);
  if (isInvoice || isReceipt) rows.push(['Deposit paid' + (depositPaid ? ' ' + day(depositPaid.paid_at) : ''), '-' + money(q.deposit_due)]);
  if (isReceipt) rows.push(['Balance paid ' + day(q.balance_paid_at), '-' + money(q.balance_due)]);
  rows.push(isInvoice ? ['Balance due', money(q.balance_due), 'total'] : isReceipt ? ['Still to pay', money(0), 'total'] : null);
  // Totals on the right; what the price assumes on the left
  const assumptions = isQuote ? (q.assumptions || []) : [];
  const aLines = assumptions.map(a => wrapText(a, 8.5, false, 262));
  const totalsH = rows.filter(Boolean).length * 18 + 14;
  const notesH = assumptions.length ? 22 + aLines.reduce((n, l) => n + l.length * 11.5, 0) : 0;
  y += 12;
  room(Math.max(totalsH, notesH) + 10);
  const top = y;
  for (const r of rows.filter(Boolean)) {
    if (r[2] === 'total') { doc.line(330, y + 4, R, y + 4, C.ink, 0.9); y += 6; }
    y += 18;
    doc.text(340, y, r[0], { size: r[2] === 'total' ? 11 : 9.5, bold: r[2] === 'total', color: r[2] === 'note' ? C.brand : C.body });
    doc.text(COL_AMT, y, r[1], { size: r[2] === 'total' ? 12 : 9.5, bold: r[2] === 'total' || r[2] === 'note', color: r[2] === 'note' ? C.brand : C.ink, align: 'right' });
  }
  if (assumptions.length) {
    let ay = top + 18;
    doc.text(L, ay, 'What this price assumes', { size: 9.5, bold: true });
    ay += 3;
    aLines.forEach(lines => lines.forEach((t, i) => { ay += 11.5; if (!i) doc.text(L + 1, ay, '•', { size: 8.5, color: C.leaf }); doc.text(L + 12, ay, t, { size: 8.5, color: C.body }); }));
    y = Math.max(y, ay);
  }
  y += 24;

  // Accept / pay / paid box
  const boxLines = [];
  let boxTitle = '', link = '';
  if (isQuote && accepted) {
    boxTitle = 'Accepted online';
    boxLines.push('Signed by ' + q.signed_name + ' on ' + toDt(q.accepted_at).toFormat("d LLL yyyy 'at' HH:mm") + '.');
    if (q.sign_meta && q.sign_meta.fingerprint) boxLines.push('Quote fingerprint (SHA-256): ' + String(q.sign_meta.fingerprint).slice(0, 32) + '…');
  } else if (isQuote) {
    boxTitle = 'Accept online';
    boxLines.push('Choose any extras, sign and book your start date at:');
    link = quoteUrl(s, q.token);
  } else if (isInvoice) {
    boxTitle = 'How to pay ' + money(q.balance_due);
    boxLines.push('By card: use the link below (or the button in our email).');
    boxLines.push('By bank transfer: ' + (s.bank_name || s.company_legal) + ' · sort code ' + (s.bank_sort_code || '') + ' · account ' + (s.bank_account || '') + ' · reference ' + number);
    link = payUrl(s, q.token, 'balance');
  } else {
    boxTitle = 'Paid in full. Thank you!';
    boxLines.push('Received ' + money(Number(q.deposit_due) + Number(q.balance_due)) + ' in total. Your plants and turf are guaranteed for 3 months if watered as advised.');
  }
  const wrapped = boxLines.flatMap(t => wrapText(t, 9, false, W - 32));
  const boxH = 27 + wrapped.length * 12.5 + (link ? 15 : 0) + 6;
  room(boxH + 10);
  doc.rect(L, y, W, boxH, C.pale);
  doc.rect(L, y, 4, boxH, C.leaf);
  doc.text(L + 18, y + 19, boxTitle, { size: 11, bold: true, color: C.brand });
  let by = y + 19;
  for (const t of wrapped) { by += 12.5; doc.text(L + 18, by, t, { size: 9, color: C.body }); }
  if (link) { by += 15; const lw = doc.text(L + 18, by, link, { size: 9, bold: true, color: C.brand }); doc.link(L + 16, by - 10, lw + 4, 14, link); }
  y += boxH + 22;

  // Terms
  if (!isReceipt) {
    const terms = isInvoice ? [
      'Payment is due by ' + day(toDt(q.completed_at).plus({ days: Number(s.payment_days) || 7 }).toISO()) + '. For bank transfers please use the reference ' + number + '.',
      'New plants and turf are guaranteed for 3 months if watered as advised; paving and fencing workmanship for 5 years.'
    ] : quoteTerms(q, s);
    const termLines = terms.map(t => wrapText(t, 8, false, W - 16));
    room(16 + termLines.reduce((n, l) => n + l.length * 11, 0));
    doc.text(L, y, 'Terms', { size: 9, bold: true, color: C.body });
    termLines.forEach((lines, i) => lines.forEach((l, j) => { y += 11; if (!j) doc.text(L, y, (i + 1) + '.', { size: 8, color: C.muted }); doc.text(L + 14, y, l, { size: 8, color: C.muted }); }));
  }

  // Footers
  doc.pages.forEach((p, i) => {
    doc.cur = p;
    doc.line(L, PDF_H - 52, R, PDF_H - 52, C.line, 0.5);
    doc.text(L, PDF_H - 38, (s.company_legal || s.company) + ' · Company no. ' + (s.company_number || '') + ' · VAT ' + (s.vat_number || ''), { size: 7.5, color: C.muted });
    doc.text(L, PDF_H - 27, (s.company_address || '') + ' · ' + (s.company_phone || '') + ' · ' + (s.company_email || ''), { size: 7.5, color: C.muted });
    doc.text(R, PDF_H - 38, 'Page ' + (i + 1) + ' of ' + doc.pages.length, { size: 7.5, color: C.muted, align: 'right' });
  });
  return { buffer: doc.render(), fileName: number + (isReceipt ? '-receipt' : '') + '.pdf', title: doc.title };
}
// ---- end lib-docs.js ----
