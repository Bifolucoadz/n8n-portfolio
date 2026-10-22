// Draws the PDF from the quote's row (no template service): quote, invoice or receipt.
// @include lib-mgv.js
// @include lib-pdf.js
// @include lib-docs.js
// @include lib-pdf-request.js
const query = $('PDF Request').first().json.query || {};
return [await pdfFor(this.helpers, tablesOf($('Load Quote').first().json), String(query.t || ''), String(query.doc || 'quote'))];
