// The page the applicant sees after sending. No score or decision is shown to the applicant.
// @include lib-ngt.js
const a = $('Prepare Application').first().json;
const html = '<div style="text-align:left;max-width:460px;margin:0 auto">'
  + '<div style="width:48px;height:48px;border-radius:50%;background:#e7f6ef;color:#0b6e4f;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 0 16px">&#10003;</div>'
  + '<h2 style="margin:0 0 8px;font-size:22px;color:#101828">Thanks, ' + esc(firstName(a.name)) + '. Your application is in.</h2>'
  + '<p style="margin:0 0 14px;color:#475467;font-size:15px">We\'ve received your CV for <b>' + esc(a.job_label) + '</b>. A recruiter reads every application, and you\'ll hear from us within 3 working days either way.</p>'
  + '<p style="margin:0 0 6px;color:#475467;font-size:14px">A confirmation is on its way to <b>' + esc(a.email) + '</b>. Your reference is <b>' + esc(a.candidate_id) + '</b>.</p>'
  + '<p style="margin:16px 0 0;color:#98a2b3;font-size:12px">Northgate Talent is a demo recruitment agency. Your details are kept only for this application.</p>'
  + '</div>';
return [{ json: { html: pageHtml('Northgate Talent', 'Application received', html.replace(/<h2[^>]*>.*?<\/h2>/, '<p class="big">Thanks, ' + esc(firstName(a.name)) + '. Your application is in.</p>')) } }];
