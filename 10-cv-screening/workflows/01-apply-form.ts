import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SCREEN_WF = { __rl: true, mode: 'id', value: 'ngtScreenApp0002', cachedResultName: 'Northgate 2: Screen Application' };
const FORM_CSS =
  ':root {\n' +
  '  --font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;\n' +
  '  --color-background: #eef3f0;\n' +
  '  --color-card-bg: #ffffff;\n' +
  '  --color-card-border: #dbe5df;\n' +
  '  --color-header: #10231a;\n' +
  '  --color-label: #344054;\n' +
  '  --color-focus-border: #0b6e4f;\n' +
  '  --color-submit-btn-bg: #0b6e4f;\n' +
  '  --color-submit-btn-text: #ffffff;\n' +
  '  --border-radius-card: 14px;\n' +
  '  --border-radius-input: 10px;\n' +
  '  --font-size-header: 24px;\n' +
  '}\n' +
  '.form-header h1 { letter-spacing: -0.3px; }\n' +
  'button[type="submit"] { font-weight: 600; }\n';

const form = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: {
    name: 'Application Form',
    position: [200, 300],
    parameters: {
      formTitle: 'Apply with Northgate Talent',
      formDescription: 'Pick the role, attach your CV as a PDF and answer four quick questions. A recruiter reads every application.<br><small>Northgate Talent is a demo recruitment agency; the jobs are examples.</small>',
      formFields: { values: [
        { fieldLabel: 'Job', fieldName: 'job', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [
          { option: 'Customer Success Manager · Leeds, hybrid (NG-101)' },
          { option: 'Junior Data Analyst · Remote, UK (NG-102)' },
          { option: 'Warehouse Team Leader, nights · Wakefield (NG-103)' }
        ] } },
        { fieldLabel: 'Full name', fieldName: 'name', fieldType: 'text', requiredField: true },
        { fieldLabel: 'Email', fieldName: 'email', fieldType: 'email', requiredField: true },
        { fieldLabel: 'Phone', fieldName: 'phone', fieldType: 'text', placeholder: 'Optional' },
        { fieldLabel: 'LinkedIn profile', fieldName: 'linkedin', fieldType: 'text', placeholder: 'Optional' },
        { fieldLabel: 'CV (PDF)', fieldName: 'cv', fieldType: 'file', multipleFiles: false, acceptFileTypes: '.pdf', requiredField: true },
        { fieldLabel: 'Do you have the right to work in the UK?', fieldName: 'right_to_work', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [
          { option: 'Yes' },
          { option: 'No, I would need visa sponsorship' }
        ] } },
        { fieldLabel: 'Notice period', fieldName: 'notice', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [
          { option: 'Available now' }, { option: '1 week' }, { option: '2 weeks' }, { option: '4 weeks' },
          { option: '1 month' }, { option: '2 months' }, { option: '3 months or more' }
        ] } },
        { fieldLabel: 'Salary expectation (£ a year)', fieldName: 'salary', fieldType: 'number', placeholder: 'Optional, e.g. 40000' },
        { fieldLabel: 'Privacy', fieldName: 'consent', fieldType: 'checkbox', requiredField: true, fieldOptions: { values: [
          { option: 'I agree to Northgate Talent keeping my application and CV for this role' }
        ] } }
      ] },
      responseMode: 'lastNode',
      options: { appendAttribution: false, buttonLabel: 'Send application', path: 'northgate-apply', customCss: FORM_CSS, ignoreBots: true, useWorkflowTimezone: true }
    }
  },
  output: [{ job: 'Customer Success Manager · Leeds, hybrid (NG-101)', name: 'Amara Okafor', email: 'amara.okafor@example.com', phone: '', linkedin: '', right_to_work: 'Yes', notice: '1 month', salary: 44000, consent: ['I agree'] }]
});

const prepare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prepare Application', position: [440, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Checks the form answers and the CV, and gives the application an ID.\n' +
        '// The CV goes on to screening as binary "data".\n' +
        '// ---- lib-ngt.js (included by build.py): shared helpers for the Northgate workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const pounds = n => \'£\' + Math.round(Number(n) || 0).toLocaleString(\'en-GB\');\n' +
        'const whenText = iso => DateTime.fromISO(String(iso), { zone: TZ }).toFormat("cccc d LLLL \'at\' h:mm a").replace(\':00 \', \' \');\n' +
        'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
        '\n' +
        '// OpenAI node (Responses API) output: the JSON object from the first output_text part, or null.\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        '\n' +
        '// Plain, left-aligned email body with the agency\'s name at the top.\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#0b6e4f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '\n' +
        '// A small standalone web page for candidates (booking links, confirmations, problems).\n' +
        'function pageHtml(company, title, bodyHtml) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \' · \' + esc(company) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef3f0;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#10231a}\'\n' +
        '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #dbe5df;border-radius:16px;padding:32px 30px;box-shadow:0 6px 24px rgba(16,35,26,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0b6e4f;margin-bottom:18px}\'\n' +
        '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4f45;margin:0 0 12px}\'\n' +
        '    + \'.slot{display:block;padding:12px 16px;border:1px solid #dbe5df;border-radius:12px;margin:8px 0;color:#0b6e4f;font-weight:600;text-decoration:none}.slot:hover{border-color:#0b6e4f;background:#f3faf6}\'\n' +
        '    + \'.big{font-size:19px;font-weight:700;color:#10231a;margin:6px 0 14px}.muted{color:#6b7c72;font-size:13px}</style></head><body><div class="card">\'\n' +
        '    + \'<div class="brand">\' + esc(company) + \'</div><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
        '}\n' +
        '\n' +
        'const BAND_LABEL = { shortlist: \'Shortlist\', review: \'Worth a look\', unlikely: \'Unlikely fit\', knockout: \'Knockout\' };\n' +
        '// ---- end lib-ngt.js ----\n' +
        'const item = $input.first();\n' +
        'const j = item.json;\n' +
        'const errors = [];\n' +
        '\n' +
        'const jobMatch = String(j.job || \'\').match(/\\((NG-\\d+)\\)/);\n' +
        'const job_id = jobMatch ? jobMatch[1] : \'\';\n' +
        'if (!job_id) errors.push(\'Please choose the job you are applying for.\');\n' +
        '\n' +
        'const name = String(j.name || \'\').trim().replace(/\\s+/g, \' \').slice(0, 80);\n' +
        'if (name.length < 2) errors.push(\'Please enter your name.\');\n' +
        'const email = String(j.email || \'\').trim().toLowerCase().slice(0, 120);\n' +
        'if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) errors.push(\'Please enter a valid email address.\');\n' +
        '\n' +
        'const [key, cv] = Object.entries(item.binary || {})[0] || [];\n' +
        'let size = 0;\n' +
        'if (!cv) errors.push(\'Please attach your CV as a PDF.\');\n' +
        'else {\n' +
        '  const isPdf = /pdf/i.test(cv.mimeType || \'\') || /\\.pdf$/i.test(cv.fileName || \'\');\n' +
        '  if (!isPdf) errors.push(\'Please send your CV as a PDF.\');\n' +
        '  size = (await this.helpers.getBinaryDataBuffer(0, key)).length;\n' +
        '  if (size > 5 * 1024 * 1024) errors.push(\'Your CV is over 5 MB. Please send a smaller PDF.\');\n' +
        '}\n' +
        'const consent = [].concat(j.consent || []).length > 0;\n' +
        'if (!consent) errors.push(\'Please agree to us keeping your application.\');\n' +
        '\n' +
        'const salary = Number(String(j.salary ?? \'\').replace(/[^0-9.]/g, \'\')) || 0;\n' +
        'const stamp = DateTime.now().setZone(TZ);\n' +
        'const candidate_id = \'C\' + stamp.toFormat(\'LLdd\') + \'-\' + newToken(4).toUpperCase();\n' +
        '\n' +
        'const json = {\n' +
        '  ok: errors.length === 0,\n' +
        '  errors,\n' +
        '  candidate_id,\n' +
        '  job_id,\n' +
        '  job_label: String(j.job || \'\').replace(/\\s*\\(NG-\\d+\\)\\s*$/, \'\'),\n' +
        '  name,\n' +
        '  email,\n' +
        '  phone: String(j.phone || \'\').trim().slice(0, 40),\n' +
        '  linkedin: String(j.linkedin || \'\').trim().slice(0, 200),\n' +
        '  right_to_work: String(j.right_to_work || \'\'),\n' +
        '  notice_period: String(j.notice || \'\'),\n' +
        '  salary_expectation: salary,\n' +
        '  cv_filename: cv ? (cv.fileName || \'cv.pdf\') : \'\',\n' +
        '  cv_bytes: size,\n' +
        '  applied_at: stamp.toISO()\n' +
        '};\n' +
        'return [{ json, binary: cv ? { data: cv } : {} }];\n'
  } },
  output: [{ ok: true, errors: [], candidate_id: 'C1021-ABCD', job_id: 'NG-101', name: 'Amara Okafor', email: 'amara.okafor@example.com' }]
});

const valid = ifElse({
  version: 2.2,
  config: {
    name: 'Valid?',
    position: [680, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const screen = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Screen in Background', position: [920, 200], parameters: { source: 'database', workflowId: SCREEN_WF, mode: 'once', options: { waitForSubWorkflow: false } } }
});

const thanks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Thank-you Page', position: [1160, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The page the applicant sees after sending. No score or decision is shown to the applicant.\n' +
        '// ---- lib-ngt.js (included by build.py): shared helpers for the Northgate workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const pounds = n => \'£\' + Math.round(Number(n) || 0).toLocaleString(\'en-GB\');\n' +
        'const whenText = iso => DateTime.fromISO(String(iso), { zone: TZ }).toFormat("cccc d LLLL \'at\' h:mm a").replace(\':00 \', \' \');\n' +
        'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
        '\n' +
        '// OpenAI node (Responses API) output: the JSON object from the first output_text part, or null.\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        '\n' +
        '// Plain, left-aligned email body with the agency\'s name at the top.\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#0b6e4f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '\n' +
        '// A small standalone web page for candidates (booking links, confirmations, problems).\n' +
        'function pageHtml(company, title, bodyHtml) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \' · \' + esc(company) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef3f0;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#10231a}\'\n' +
        '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #dbe5df;border-radius:16px;padding:32px 30px;box-shadow:0 6px 24px rgba(16,35,26,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0b6e4f;margin-bottom:18px}\'\n' +
        '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4f45;margin:0 0 12px}\'\n' +
        '    + \'.slot{display:block;padding:12px 16px;border:1px solid #dbe5df;border-radius:12px;margin:8px 0;color:#0b6e4f;font-weight:600;text-decoration:none}.slot:hover{border-color:#0b6e4f;background:#f3faf6}\'\n' +
        '    + \'.big{font-size:19px;font-weight:700;color:#10231a;margin:6px 0 14px}.muted{color:#6b7c72;font-size:13px}</style></head><body><div class="card">\'\n' +
        '    + \'<div class="brand">\' + esc(company) + \'</div><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
        '}\n' +
        '\n' +
        'const BAND_LABEL = { shortlist: \'Shortlist\', review: \'Worth a look\', unlikely: \'Unlikely fit\', knockout: \'Knockout\' };\n' +
        '// ---- end lib-ngt.js ----\n' +
        'const a = $(\'Prepare Application\').first().json;\n' +
        'const html = \'<div style="text-align:left;max-width:460px;margin:0 auto">\'\n' +
        '  + \'<div style="width:48px;height:48px;border-radius:50%;background:#e7f6ef;color:#0b6e4f;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 0 16px">&#10003;</div>\'\n' +
        '  + \'<h2 style="margin:0 0 8px;font-size:22px;color:#101828">Thanks, \' + esc(firstName(a.name)) + \'. Your application is in.</h2>\'\n' +
        '  + \'<p style="margin:0 0 14px;color:#475467;font-size:15px">We\\\'ve received your CV for <b>\' + esc(a.job_label) + \'</b>. A recruiter reads every application, and you\\\'ll hear from us within 3 working days either way.</p>\'\n' +
        '  + \'<p style="margin:0 0 6px;color:#475467;font-size:14px">A confirmation is on its way to <b>\' + esc(a.email) + \'</b>. Your reference is <b>\' + esc(a.candidate_id) + \'</b>.</p>\'\n' +
        '  + \'<p style="margin:16px 0 0;color:#98a2b3;font-size:12px">Northgate Talent is a demo recruitment agency. Your details are kept only for this application.</p>\'\n' +
        '  + \'</div>\';\n' +
        'return [{ json: { html: pageHtml(\'Northgate Talent\', \'Application received\', html.replace(/<h2[^>]*>.*?<\\/h2>/, \'<p class="big">Thanks, \' + esc(firstName(a.name)) + \'. Your application is in.</p>\')) } }];\n'
  } },
  output: [{ html: '<h2>Thanks</h2>' }]
});

const showThanks = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Show Thanks', position: [1400, 200], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') } }
});

const problem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Problem Page', position: [920, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Shown when the form answers or the file can\'t be used. Nothing is saved.\n' +
        '// ---- lib-ngt.js (included by build.py): shared helpers for the Northgate workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const pounds = n => \'£\' + Math.round(Number(n) || 0).toLocaleString(\'en-GB\');\n' +
        'const whenText = iso => DateTime.fromISO(String(iso), { zone: TZ }).toFormat("cccc d LLLL \'at\' h:mm a").replace(\':00 \', \' \');\n' +
        'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
        '\n' +
        '// OpenAI node (Responses API) output: the JSON object from the first output_text part, or null.\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        '\n' +
        '// Plain, left-aligned email body with the agency\'s name at the top.\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#0b6e4f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '\n' +
        '// A small standalone web page for candidates (booking links, confirmations, problems).\n' +
        'function pageHtml(company, title, bodyHtml) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \' · \' + esc(company) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef3f0;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#10231a}\'\n' +
        '    + \'.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #dbe5df;border-radius:16px;padding:32px 30px;box-shadow:0 6px 24px rgba(16,35,26,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0b6e4f;margin-bottom:18px}\'\n' +
        '    + \'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4f45;margin:0 0 12px}\'\n' +
        '    + \'.slot{display:block;padding:12px 16px;border:1px solid #dbe5df;border-radius:12px;margin:8px 0;color:#0b6e4f;font-weight:600;text-decoration:none}.slot:hover{border-color:#0b6e4f;background:#f3faf6}\'\n' +
        '    + \'.big{font-size:19px;font-weight:700;color:#10231a;margin:6px 0 14px}.muted{color:#6b7c72;font-size:13px}</style></head><body><div class="card">\'\n' +
        '    + \'<div class="brand">\' + esc(company) + \'</div><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
        '}\n' +
        '\n' +
        'const BAND_LABEL = { shortlist: \'Shortlist\', review: \'Worth a look\', unlikely: \'Unlikely fit\', knockout: \'Knockout\' };\n' +
        '// ---- end lib-ngt.js ----\n' +
        'const a = $(\'Prepare Application\').first().json;\n' +
        'const items = a.errors.map(e => \'<li style="margin:4px 0">\' + esc(e) + \'</li>\').join(\'\');\n' +
        'const html = \'<div style="text-align:left;max-width:460px;margin:0 auto">\'\n' +
        '  + \'<h2 style="margin:0 0 8px;font-size:22px;color:#101828">Something needs fixing</h2>\'\n' +
        '  + \'<ul style="margin:0 0 14px;padding-left:20px;color:#b42318;font-size:15px">\' + items + \'</ul>\'\n' +
        '  + \'<p style="margin:0;color:#475467;font-size:14px">Please go back and try again. Nothing has been saved.</p></div>\';\n' +
        'return [{ json: { html: pageHtml(\'Northgate Talent\', \'Something needs fixing\', html.replace(/<h2[^>]*>.*?<\\/h2>/, \'\')) } }];\n'
  } },
  output: [{ html: '<h2>Something needs fixing</h2>' }]
});

const showProblem = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Show Problem', position: [1160, 420], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') } }
});

const note = sticky(
  '## Northgate 1: Apply Form\nThe public application form (`/form/northgate-apply`): job, name, email, CV as a PDF, right to work, notice period and salary expectation.\n\n**Prepare Application** checks the answers and the file (PDF, under 5 MB), then the CV goes to **Northgate 2** in the background. The applicant sees a thank-you page straight away and never sees a score.',
  [], { position: [160, 20], width: 900, height: 200, color: 4 }
);

export default workflow('northgate-apply-form', 'Northgate 1: Apply Form')
  .add(form)
  .to(prepare)
  .to(valid
    .onTrue(screen.to(thanks).to(showThanks))
    .onFalse(problem.to(showProblem)))
  .add(note);
