// Shown when the form answers or the file can't be used. Nothing is saved.
// @include lib-ngt.js
const a = $('Prepare Application').first().json;
const items = a.errors.map(e => '<li style="margin:4px 0">' + esc(e) + '</li>').join('');
const html = '<div style="text-align:left;max-width:460px;margin:0 auto">'
  + '<h2 style="margin:0 0 8px;font-size:22px;color:#101828">Something needs fixing</h2>'
  + '<ul style="margin:0 0 14px;padding-left:20px;color:#b42318;font-size:15px">' + items + '</ul>'
  + '<p style="margin:0;color:#475467;font-size:14px">Please go back and try again. Nothing has been saved.</p></div>';
return [{ json: { html: pageHtml('Northgate Talent', 'Something needs fixing', html.replace(/<h2[^>]*>.*?<\/h2>/, '')) } }];
