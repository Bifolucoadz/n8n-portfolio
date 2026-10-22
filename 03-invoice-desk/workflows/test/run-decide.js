// Runs code/01-decide.js locally against saved AI outputs, in order, building up a fake register.
// node workflows/test/run-decide.js <dir with *.json spike outputs>
const fs = require('fs'), path = require('path');
const { DateTime } = require('/Users/mac/.npm-global/lib/node_modules/n8n/node_modules/luxon');
const code = fs.readFileSync(path.join(__dirname, '../code/01-decide.js'), 'utf8');
const fn = new Function('$', '$json', 'DateTime', code);
const dir = process.argv[2];
const order = ['harborline-produce-INV-10482.pdf', 'pinecrest-dairy-2291.pdf', 'frostline-refrigeration-FR-7731.pdf',
  'gullrock-seafood-55120.pdf', 'bluewick-linen-8840.pdf', 'ledgestone-hardware-receipt.jpg',
  'tidewater-electric-bill-scan.pdf', 'saltmarsh-fall-menu.pdf', 'harborline-produce-INV-10482-copy.pdf', 'harborline-produce-INV-10482.pdf'];
const suppliers = [
  { supplier: 'Harborline Produce Co.', aliases: 'Harborline Produce; Harborline', email_domain: 'harborline-produce.example', tax_id: '00-0482231', default_category: 'Food & beverage', bank_last4: '3391', status: 'active' },
  { supplier: 'Pinecrest Dairy Cooperative', aliases: 'Pinecrest Dairy; Pinecrest Dairy Co-op', email_domain: 'pinecrestdairy.example', tax_id: '00-0559817', default_category: 'Food & beverage', bank_last4: '7720', status: 'active' },
  { supplier: 'Gullrock Seafood Co.', aliases: 'Gullrock Seafood', email_domain: 'gullrockseafood.example', tax_id: '00-0611402', default_category: 'Food & beverage', bank_last4: '2264', status: 'active' },
  { supplier: 'Bluewick Linen Service', aliases: 'Bluewick Linen', email_domain: 'bluewicklinen.example', tax_id: '00-0733950', default_category: 'Linen & uniforms', bank_last4: '4418', status: 'active' },
  { supplier: 'Tidewater Electric Cooperative', aliases: 'Tidewater Electric; Tidewater Electric Co-op', email_domain: 'tidewater-electric.example', tax_id: '', default_category: 'Utilities', bank_last4: '', status: 'active' },
];
const register = [];
const cfg = { APPROVAL_LIMIT: 1000, BASE_CURRENCY: 'USD', TIMEZONE: 'America/New_York', MAX_FILE_MB: 10 };
let n = 0;
for (const f of order) {
  n++;
  const ai = JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8'))[0];
  const hash = 'hash-' + f;                       // same file name = same bytes
  const dupFile = register.find(r => r.file_hash === hash);
  const pre = { json: { doc_id: 'SK-T-' + n, original_filename: f, ext: f.split('.').pop(), kind: f.endsWith('.pdf') ? 'pdf' : 'image', file_hash: hash,
    route: dupFile ? 'skip' : (f.endsWith('.pdf') ? 'pdf' : 'image'), skip_reason: dupFile ? 'duplicate_file' : '', duplicate_of: dupFile ? dupFile.doc_id : '' }, binary: {} };
  const nodes = { Config: [{ json: cfg }], Precheck: [pre], 'Read Documents': register.map(r => ({ json: r })), 'Read Suppliers': suppliers.map(s => ({ json: s })) };
  const $ = name => ({ first: () => nodes[name][0], all: () => nodes[name] });
  const out = fn($, dupFile ? pre.json : ai, DateTime)[0].json;
  register.push({ doc_id: out.doc_id, status: out.status, supplier: out.supplier, invoice_number: out.invoice_number, invoice_date: out.invoice_date, total: out.total, file_hash: hash, drive_link: 'https://drive/' + out.doc_id, received_at: '2026-10-01T18:00:00-04:00', doc_type: out.doc_type, currency: out.currency, category: out.category });
  console.log(`\n${f}\n  ${out.status.toUpperCase()}  ${out.supplier} | ${out.doc_type} ${out.invoice_number} | ${out.invoice_date} due ${out.due_date} | ${out.currency} ${out.total} | ${out.category} | ${out.supplier_status} | pay ${out.payment_status} | bank ${out.bank_last4}`);
  console.log('  file:', out.file_name, '| folder:', out.folder, '| upload:', out.upload, '| dup:', out.duplicate_of);
  if (process.env.DUMP) fs.writeFileSync(path.join(process.env.DUMP, f + ".decide.json"), JSON.stringify(out));
  for (const fl of out.flags) console.log('   -', fl.level, fl.text);
}
