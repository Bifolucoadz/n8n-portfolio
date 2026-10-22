// Shown when the upload can't be used.
// @include lib-tdw.js
const a = $('Prepare Upload').first().json;
return [{ json: { html: formPage('Something needs fixing', '<h2 style="margin:0 0 8px;font-size:21px">Something needs fixing</h2><ul style="color:#b42318;padding-left:20px">' + a.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul><p style="color:#6b7a99">Please go back and try again.</p>') } }];
