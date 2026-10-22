// Check what the AI read and decide what happens to the document. Every rule lives here, in code:
// the AI only transcribes, so nothing printed on a document can approve it.
const cfg = $('Config').first().json;
const pre = $('Precheck').first();
const doc = { ...pre.json };
const tz = cfg.TIMEZONE;
const base = String(cfg.BASE_CURRENCY);
const limit = Number(cfg.APPROVAL_LIMIT);
const today = DateTime.now().setZone(tz).startOf('day');
const register = $('Read Documents').all().map(i => i.json).filter(r => r.doc_id && r.status !== 'error');
const suppliers = $('Read Suppliers').all().map(i => i.json).filter(r => r.supplier && String(r.status || 'active') !== 'inactive');

const r2 = v => Math.round(v * 100) / 100;
const raw = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
const num = v => raw(v) === null ? null : r2(raw(v));
const fmt = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtRate = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const close = (a, b) => Math.abs(a - b) <= Math.max(0.02, Math.abs(b) * 0.005);
const short = s => { s = String(s || '').trim(); return s.length > 40 ? s.slice(0, 38) + '…' : s; };
const norm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b(cooperative|co op|coop|company|corporation|corp|incorporated|inc|llc|ltd|limited|the|co)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const normNo = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const digits = s => String(s || '').replace(/\D/g, '');
const sameNumber = (a, b) => {
  if (!a || !b) return false;
  if (normNo(a) === normNo(b)) return true;
  return digits(a).length >= 4 && digits(a) === digits(b);
};
const titleCase = s => s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : s;
const date = s => { if (!s) return null; const t = DateTime.fromISO(String(s), { zone: tz }); return t.isValid ? t : null; };

const flags = [];
const flag = (level, text, short) => flags.push({ level, text, short: short || '' });

// 1. What the AI returned (nothing if the file was skipped before the AI step).
let x = null;
let aiError = '';
if (doc.route !== 'skip') {
  const res = $json || {};
  if (res.error) aiError = String(res.error.message || res.error);
  else {
    const msg = (res.output || []).find(o => o && o.type === 'message');
    const part = msg && (msg.content || []).find(c => c && c.type === 'output_text');
    let t = part ? part.text : null;
    if (typeof t === 'string') { try { t = JSON.parse(t); } catch (e) { t = null; aiError = 'The AI reply was not valid JSON.'; } }
    if (t && typeof t === 'object') x = t;
    else if (!aiError) aiError = 'The AI returned no document data.';
  }
}

let rec = {
  doc_type: '', supplier: '', supplier_status: '', invoice_number: '', invoice_date: '', due_date: '',
  currency: '', subtotal: null, tax: null, total: null, category: '', payment_status: '', confidence: '',
  bank_last4: '', summary: '', lines: [], supplier_email_domain: '', supplier_tax_id: '', bank_changed: false,
  duplicate_of: doc.duplicate_of || '', duplicate_drive_link: ''
};
let status;

if (doc.route === 'skip') {
  status = { duplicate_file: 'duplicate', unsupported: 'unsupported', too_large: 'unsupported', missing: 'error' }[doc.skip_reason] || 'error';
  if (doc.skip_reason === 'duplicate_file') {
    const orig = register.find(r => r.doc_id === doc.duplicate_of) || {};
    rec = {
      ...rec, doc_type: orig.doc_type || '', supplier: orig.supplier || '', invoice_number: String(orig.invoice_number || ''),
      invoice_date: orig.invoice_date || '', currency: orig.currency || '', total: num(orig.total), category: orig.category || '',
      duplicate_drive_link: orig.drive_link || ''
    };
    flag('info', 'Exact same file as ' + doc.duplicate_of + '. Not read again.');
  }
  if (doc.skip_reason === 'unsupported') flag('info', 'File type not supported (' + (doc.ext || doc.mime_type || 'unknown') + '). Send a PDF or a photo.');
  if (doc.skip_reason === 'too_large') flag('info', 'File is over ' + cfg.MAX_FILE_MB + ' MB.');
  if (doc.skip_reason === 'missing') flag('info', 'No file was received.');
} else if (aiError) {
  status = 'error';
  flag('block', 'Could not read the document: ' + aiError.slice(0, 200), "couldn't be read");
} else {
  const s = x.supplier || {};
  const type = String(x.document_type || 'other');
  const currency = String(x.currency || '').toUpperCase().slice(0, 3);
  if (!x.currency && type !== 'other') flag('info', 'Currency not shown; assumed ' + base + '.');
  const cur = currency || base;

  // Supplier: match the supplier list by name or alias, tax ID, or email domain.
  const emailDomain = (String(s.email || '').split('@')[1] || '').toLowerCase();
  const taxId = String(s.tax_id || '').replace(/[^0-9a-z]/gi, '');
  const nameKey = norm(s.name);
  const keysOf = r => [r.supplier].concat(String(r.aliases || '').split(';')).map(norm).filter(Boolean);
  const match = (nameKey && suppliers.find(r => keysOf(r).includes(nameKey)))
    || (taxId.length >= 6 && suppliers.find(r => String(r.tax_id || '').replace(/[^0-9a-z]/gi, '') === taxId))
    || (emailDomain && suppliers.find(r => r.email_domain && emailDomain === String(r.email_domain).toLowerCase()))
    || (nameKey.length >= 6 && suppliers.find(r => keysOf(r).some(k => k.length >= 6 && (nameKey.includes(k) || k.includes(nameKey)))))
    || null;
  const supplier = match ? String(match.supplier) : titleCase(String(s.name || '').trim()).slice(0, 120);

  const lines = (Array.isArray(x.line_items) ? x.line_items : []).slice(0, 200).map((l, i) => ({
    line_no: i + 1,
    description: String(l.description || '').slice(0, 300),
    quantity: raw(l.quantity),
    unit_price: raw(l.unit_price),
    amount: num(l.amount),
    line_check: ''
  }));
  const sub = num(x.subtotal), tax = num(x.tax), ship = num(x.shipping), disc = num(x.discount), total = num(x.total);
  const inv = date(x.invoice_date), due = date(x.due_date);
  const last4 = (String(x.bank_account_last4 || '').match(/(\d{4})\D*$/) || [])[1] || '';
  const onFile = match && match.bank_last4 !== '' && match.bank_last4 !== undefined && match.bank_last4 !== null ? String(match.bank_last4).padStart(4, '0') : '';

  rec = {
    ...rec,
    doc_type: type,
    supplier,
    supplier_status: type === 'other' ? '' : (match ? 'known' : 'new'),
    invoice_number: String(x.invoice_number || '').slice(0, 60),
    invoice_date: inv ? inv.toISODate() : '',
    due_date: due ? due.toISODate() : '',
    currency: type === 'other' ? '' : cur,
    subtotal: sub,
    tax,
    total,
    category: (match && match.default_category) || x.suggested_category || 'Other',
    payment_status: { invoice: 'unpaid', receipt: 'paid', credit_note: 'credit' }[type] || '',
    confidence: String(x.confidence || ''),
    bank_last4: last4,
    summary: String(x.summary || '').slice(0, 200),
    lines,
    supplier_email_domain: emailDomain,
    supplier_tax_id: String(s.tax_id || ''),
    bank_changed: false
  };

  if (type === 'other') {
    status = 'not_invoice';
    flag('info', 'Not an invoice or receipt' + (x.summary ? ': ' + String(x.summary).slice(0, 120) : '.'));
  } else {
    // Required fields.
    if (!supplier) flag('block', 'No supplier name found.', 'no supplier name');
    if (total === null) flag('block', 'No total found.', 'no total');
    if (!inv) flag('block', x.invoice_date ? 'Date not readable (' + x.invoice_date + ').' : 'No date found.', 'no date');
    if (!rec.invoice_number && (type === 'invoice' || type === 'credit_note')) flag('block', 'No invoice number found.', 'no invoice number');

    // Arithmetic: each line, the lines against the subtotal, and the subtotal against the total.
    for (const l of lines) {
      if (l.quantity !== null && l.unit_price !== null && l.amount !== null) {
        const expected = r2(l.quantity * l.unit_price);
        if (!close(expected, l.amount)) {
          l.line_check = l.quantity + ' × ' + fmtRate(l.unit_price) + ' = ' + fmt(expected) + ', not ' + fmt(l.amount);
          flag('block', 'Line ' + l.line_no + ' (' + short(l.description) + '): ' + l.line_check + '. ' + (l.amount > expected ? 'Overcharged by ' : 'Undercharged by ') + cur + ' ' + fmt(Math.abs(l.amount - expected)) + '.',
            'line ' + l.line_no + (l.amount > expected ? ' overcharged by ' : ' undercharged by ') + cur + ' ' + fmt(Math.abs(l.amount - expected)));
        }
      }
    }
    const extras = (tax || 0) + (ship || 0) - (disc || 0);
    const lineSum = r2(lines.reduce((a, l) => a + (l.amount || 0), 0));
    const allAmounts = lines.length > 0 && lines.every(l => l.amount !== null);
    if (allAmounts && sub !== null && !close(lineSum, sub)) flag('block', 'Lines add up to ' + fmt(lineSum) + ', but the subtotal says ' + fmt(sub) + '.', "lines don't add up");
    if (allAmounts && sub === null && total !== null && !close(r2(lineSum + extras), total)) flag('block', 'Lines plus tax and charges come to ' + fmt(r2(lineSum + extras)) + ', but the total says ' + fmt(total) + '.', "lines don't add up");
    if (sub !== null && total !== null && !close(r2(sub + extras), total)) flag('block', 'Subtotal ' + fmt(sub) + (tax ? ' + tax ' + fmt(tax) : '') + (ship ? ' + delivery ' + fmt(ship) : '') + (disc ? ' − discount ' + fmt(disc) : '') + ' = ' + fmt(r2(sub + extras)) + ', but the total says ' + fmt(total) + '.', "total doesn't add up");

    // Dates.
    if (inv && inv > today.plus({ days: 1 })) flag('block', 'Dated in the future (' + inv.toISODate() + ').', 'dated in the future');
    if (inv && inv < today.minus({ years: 1 })) flag('block', 'Over a year old (' + inv.toISODate() + ').', 'over a year old');
    if (inv && due && due < inv) flag('block', 'Due date is before the invoice date.', 'due before it was issued');
    if (due && due < today && type === 'invoice') flag('info', 'Past due since ' + due.toFormat('LLL d') + '.');

    // Bank details: a changed account is the classic invoice fraud, so it always goes to a person.
    const notice = x.bank_details_changed === true;
    const mismatch = !!(onFile && last4 && onFile !== last4);
    if (notice || mismatch) {
      rec.bank_changed = true;
      flag('block', (notice ? 'Says the bank details have changed: ' : 'Bank account differs: ') + 'pay to account ending ' + (last4 || '?') + (onFile ? ' (on file: ' + onFile + ')' : '') + '. Call the supplier on a number you already have before paying.', 'bank details changed');
    }

    // Duplicates: same supplier and number, or same supplier, date and total.
    const sameSupplier = r => norm(r.supplier) === norm(supplier);
    const earlier = register.filter(r => r.status !== 'not_invoice' && r.status !== 'unsupported' && sameSupplier(r));
    const byNumber = rec.invoice_number && earlier.find(r => r.status !== 'duplicate' && sameNumber(r.invoice_number, rec.invoice_number));
    const byAmount = !byNumber && total !== null && inv && earlier.find(r => r.status !== 'duplicate' && r.invoice_date === inv.toISODate() && num(r.total) === total);
    if (byNumber) {
      rec.duplicate_of = byNumber.doc_id;
      rec.duplicate_drive_link = byNumber.drive_link || '';
      flag('info', 'Already logged as ' + byNumber.doc_id + ' (' + supplier + ' ' + rec.invoice_number + ', received ' + String(byNumber.received_at || '').slice(0, 10) + ').');
    } else if (byAmount) {
      flag('block', 'Possible duplicate of ' + byAmount.doc_id + ': same supplier, date and total.', 'possible duplicate');
    }

    // Things that need the owner's OK even when every check passes.
    if (type === 'statement') flag('block', 'This is a statement (a list of invoices). Check each invoice is logged; do not pay from the statement.', 'a statement, not a bill');
    if (type === 'quote') flag('block', 'This is a quote, not a bill.', 'a quote, not a bill');
    if (type === 'credit_note') flag('approve', 'Credit note: take it off the next payment to ' + (supplier || 'this supplier') + '.', 'credit note');
    if (!match && type !== 'receipt') flag('approve', 'New supplier: not on the supplier list yet. Approving adds it.', 'new supplier');
    if (!match && type === 'receipt') flag('info', 'New supplier (receipt, already paid).');
    if (total !== null && total >= limit) flag('approve', 'Over the ' + base + ' ' + fmt(limit) + ' approval limit.', 'over the ' + base + ' ' + limit.toLocaleString('en-US') + ' limit');
    if (cur !== base) flag('approve', 'In ' + cur + ', not ' + base + '.', 'in ' + cur);
    if (x.confidence === 'low') flag('block', 'Parts of the document were hard to read. Check the figures against the file.', 'hard to read');
    if (x.confidence === 'medium') flag('info', 'Some parts were hard to read.');
    for (const issue of (x.issues || []).slice(0, 3)) {
      if (rec.bank_changed && /bank|account|payment details/i.test(issue)) continue;
      flag('info', 'AI note: ' + String(issue).slice(0, 160));
    }

    if (rec.duplicate_of) status = 'duplicate';
    else if (flags.some(f => f.level === 'block')) status = 'needs_review';
    else if (flags.some(f => f.level === 'approve')) status = 'pending_approval';
    else status = 'auto_approved';
  }
}

const financial = ['auto_approved', 'pending_approval', 'needs_review'].includes(status);
const clean = s => String(s).replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
const ext = doc.ext || (doc.kind === 'pdf' ? 'pdf' : 'jpg');
const fileName = financial || status === 'duplicate'
  ? clean((rec.invoice_date || today.toISODate()) + ' ' + (rec.supplier || 'Unknown supplier') + ' - ' + (rec.invoice_number || 'no number') + ' - ' + rec.currency + ' ' + fmt(rec.total)) + '.' + ext
  : clean(today.toISODate() + ' ' + doc.original_filename.replace(/\.[a-z0-9]+$/i, '')) + (ext ? '.' + ext : '');

const order = { block: 0, approve: 1, info: 2 };
flags.sort((a, b) => order[a.level] - order[b.level]);

return [{
  json: {
    ...doc,
    ...rec,
    status,
    flags,
    flags_text: flags.map(f => f.text).join('; '),
    needs_person: status === 'pending_approval' || status === 'needs_review',
    upload: status !== 'duplicate',
    folder: financial ? 'filed' : 'other',
    file_name: fileName,
    line_count: rec.lines.length,
    ai_error: aiError
  },
  binary: pre.binary
}];
