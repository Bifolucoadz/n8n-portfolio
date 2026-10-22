// A friendly page when the link is wrong or the document doesn't exist yet.
// @include lib-mgv.js
const s = settingsOf(tablesOf($('Load Quote').first().json).Settings);
return [{ json: { html: pageHtml(s, 'Document not available', '<p>' + esc($input.first().json.message || 'This link is not valid.') + '</p><p class="muted">If you think this is a mistake, call us on ' + esc(s.company_phone || '') + '.</p>') } }];
