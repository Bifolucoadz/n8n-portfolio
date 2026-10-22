// Same PDF for an email attachment (called by Mossgrove 7 in live mode, one item per email).
// @include lib-mgv.js
// @include lib-pdf.js
// @include lib-docs.js
// @include lib-pdf-request.js
const T = tablesOf($('Load Quote (Email)').first().json);
const out = [];
for (const item of $('When Called').all()) out.push(await pdfFor(this.helpers, T, String(item.json.token || ''), String(item.json.attach || 'quote')));
return out;
