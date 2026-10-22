// The form answers had a problem: list what to fix.
// @include lib-mgv.js
const v = $('Check Visit').first().json;
return [{ json: { html: formPage('Please check the form', '<p class="sub">Nothing was saved. Go back, fix these and send it again:</p><ul>' + v.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>') } }];
