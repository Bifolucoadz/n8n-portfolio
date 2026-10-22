// The demo set, in the order a busy inbox might get it, each as its own email "from" the supplier.
// The menu is a real-world mistake (sent to the wrong inbox); the Harborline reminder is a re-sent copy.
const plan = [
  ['harborline-produce-INV-10482.pdf', 'Harborline Produce Co.', 'Invoice INV-10482 from Harborline Produce Co.', 'Hi,\n\nPlease find attached invoice INV-10482 for this week\'s produce delivery.\n\nThanks,\nHarborline Produce accounts'],
  ['pinecrest-dairy-2291.pdf', 'Pinecrest Dairy Cooperative', 'Pinecrest Dairy invoice 2291', 'Invoice 2291 for your Tuesday and Friday deliveries is attached.\n\nPinecrest Dairy Cooperative'],
  ['frostline-refrigeration-FR-7731.pdf', 'Frostline Refrigeration Services', 'Invoice FR-7731: walk-in cooler emergency repair', 'Thanks for calling us out on Sunday night. The invoice for the compressor replacement is attached.\n\nFrostline Refrigeration Services'],
  ['gullrock-seafood-55120.pdf', 'Gullrock Seafood Co.', 'Gullrock Seafood - Invoice #55120', 'Invoice #55120 attached. Fresh off the boat as always.\n\nGullrock Seafood'],
  ['bluewick-linen-8840.pdf', 'Bluewick Linen Service', 'Invoice 8840 and updated payment details', 'Hello,\n\nAttached is invoice 8840. Please note we have changed banks; the new account details are on the invoice.\n\nKind regards,\nBluewick Linen accounts'],
  ['ledgestone-hardware-receipt.jpg', 'Dana at Saltmarsh Kitchen', 'Receipt from the hardware store', 'Snapped this at Ledgestone: mop heads, shelf liner and bulbs for the kitchen.\n\nDana'],
  ['tidewater-electric-bill-scan.pdf', 'Tidewater Electric Cooperative', 'Your Tidewater Electric bill is ready', 'Your bill for account 40-1187-22 is attached. Amount due $665.54 by 10/06/2026.\n\nTidewater Electric Cooperative'],
  ['saltmarsh-fall-menu.pdf', 'Dana at Saltmarsh Kitchen', 'Fall menu final', 'Final version of the fall menu for the printer.\n\nDana'],
  ['harborline-produce-INV-10482-copy.pdf', 'Harborline Produce Co.', 'Reminder: invoice INV-10482', 'Friendly reminder that INV-10482 is due Oct 12. A copy is attached. Please ignore if already paid.\n\nHarborline Produce accounts']
];
const files = $input.all().map(i => i.json);
return plan
  .map(([file, from, subject, body], i) => {
    const f = files.find(x => x.name === file);
    return f ? { json: { order: i + 1, file_id: f.id, file, from, subject, body } } : null;
  })
  .filter(Boolean);
