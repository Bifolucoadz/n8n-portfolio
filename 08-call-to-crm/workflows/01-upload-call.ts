import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const PROCESS_WF = { __rl: true, mode: 'id', value: 'tdwProcessCall02', cachedResultName: 'Tidewater 2: Process Call' };
const FORM_CSS =
  ':root {\n' +
  '  --font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;\n' +
  '  --color-background: #eef2fb;\n' +
  '  --color-card-bg: #ffffff;\n' +
  '  --color-card-border: #d9e1f2;\n' +
  '  --color-header: #0f1b3d;\n' +
  '  --color-label: #344054;\n' +
  '  --color-focus-border: #1d4ed8;\n' +
  '  --color-submit-btn-bg: #1d4ed8;\n' +
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
    name: 'Upload Call',
    position: [200, 300],
    parameters: {
      formTitle: 'Log a sales call',
      formDescription: 'Upload the recording and pick the deal. The call is transcribed and analysed, safe updates go straight into the CRM, and you review the rest and the follow-up email.<br><small>Tidewater Software is a demo company; use the sample recordings.</small>',
      formFields: { values: [
        { fieldLabel: 'Deal', fieldName: 'deal', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [
          { option: 'Calloway Dental Group: patient reminders (D-1001)' },
          { option: 'Pemberton Freight: customer tracking portal (D-1002)' },
          { option: 'Ostara Home Care: caregiver scheduling app (D-1003)' }
        ] } },
        { fieldLabel: 'Rep', fieldName: 'rep', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [{ option: 'Maya Collins' }] } },
        { fieldLabel: 'Call recording', fieldName: 'recording', fieldType: 'file', multipleFiles: false, acceptFileTypes: '.mp3,.m4a,.wav,.webm,.mp4,.ogg', requiredField: true },
        { fieldLabel: 'Anything to add?', fieldName: 'notes', fieldType: 'textarea', placeholder: 'Optional' }
      ] },
      responseMode: 'lastNode',
      options: { appendAttribution: false, buttonLabel: 'Process call', path: 'tidewater-call', customCss: FORM_CSS, ignoreBots: true, useWorkflowTimezone: true }
    }
  },
  output: [{ deal: 'Calloway Dental Group: patient reminders (D-1001)', rep: 'Maya Collins', notes: '' }]
});

const prepare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prepare Upload', position: [440, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Checks the upload and works out which deal the call belongs to.\n' +
        '// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----\n' +
        'const TZ = \'America/New_York\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const dollars = n => \'$\' + Math.round(Number(n) || 0).toLocaleString(\'en-US\');\n' +
        'const day = d => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat(\'ccc, LLL d\') : String(d || \'\');\n' +
        'const mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\n' +
        '\n' +
        '// HubSpot\'s default sales pipeline.\n' +
        'const STAGES = [\n' +
        '  [\'appointmentscheduled\', \'Appointment scheduled\', \'A first meeting is booked.\'],\n' +
        '  [\'qualifiedtobuy\', \'Qualified to buy\', \'Need, rough budget, decision process and timeline are understood.\'],\n' +
        '  [\'presentationscheduled\', \'Presentation scheduled\', \'A demo or presentation is booked or has been given.\'],\n' +
        '  [\'decisionmakerboughtin\', \'Decision maker bought-in\', \'The person who signs has seen it and supports it.\'],\n' +
        '  [\'contractsent\', \'Contract sent\', \'A proposal or contract has been sent.\'],\n' +
        '  [\'closedwon\', \'Closed won\', \'Signed.\'],\n' +
        '  [\'closedlost\', \'Closed lost\', \'The prospect said no.\']\n' +
        '];\n' +
        'const stageIndex = id => STAGES.findIndex(s => s[0] === id);\n' +
        'const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];\n' +
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
        '// Is this quote really in the transcript? (case, punctuation and spacing ignored)\n' +
        'const norm = s => String(s || \'\').toLowerCase().replace(/[’\']/g, "\'").replace(/[^a-z0-9\' ]+/g, \' \').replace(/\\s+/g, \' \').trim();\n' +
        'const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };\n' +
        '\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'const plainToHtml = t => String(t || \'\').split(/\\n{2,}/).map(p => \'<p style="margin:0 0 14px;text-align:left">\' + esc(p).replace(/\\n/g, \'<br>\') + \'</p>\').join(\'\');\n' +
        '// n8n shows a form\'s completion HTML as the whole page, so it needs its own styling.\n' +
        'function formPage(title, inner) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}\'\n' +
        '    + \'.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>\'\n' +
        '    + \'<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>\' + inner + \'</div></body></html>\';\n' +
        '}\n' +
        '// ---- end lib-tdw.js ----\n' +
        'const item = $input.first();\n' +
        'const j = item.json;\n' +
        'const m = String(j.deal || \'\').match(/\\((D-\\d+)\\)/);\n' +
        'const errors = [];\n' +
        'if (!m) errors.push(\'Please choose the deal.\');\n' +
        'const [key, file] = Object.entries(item.binary || {})[0] || [];\n' +
        'if (!file) errors.push(\'Please attach the call recording.\');\n' +
        'else if (!/audio|video\\/(mp4|webm)/i.test(file.mimeType || \'\') && !/\\.(mp3|m4a|wav|webm|mp4|ogg)$/i.test(file.fileName || \'\')) errors.push(\'Please upload an audio file (MP3, M4A, WAV, WEBM or MP4).\');\n' +
        'else if ((await this.helpers.getBinaryDataBuffer(0, key)).length > 25 * 1024 * 1024) errors.push(\'The recording is over 25 MB. Please upload a shorter or compressed file.\');\n' +
        'return [{ json: { ok: errors.length === 0, errors, call_id: newId(\'CL-\'), deal_id: m ? m[1] : \'\', rep: String(j.rep || \'\'), notes: String(j.notes || \'\').slice(0, 1000) }, binary: file ? { data: file } : {} }];\n'
  } },
  output: [{ ok: true, errors: [], call_id: 'CL-ABCDE', deal_id: 'D-1001', rep: 'Maya Collins', notes: '' }]
});

const valid = ifElse({
  version: 2.2,
  config: {
    name: 'Valid?',
    position: [680, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const processCall = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Process Call', position: [920, 200], parameters: { source: 'database', workflowId: PROCESS_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const showResult = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Show Result', position: [1160, 200], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') } }
});

const problem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Problem Page', position: [920, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Shown when the upload can\'t be used.\n' +
        '// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----\n' +
        'const TZ = \'America/New_York\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const dollars = n => \'$\' + Math.round(Number(n) || 0).toLocaleString(\'en-US\');\n' +
        'const day = d => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat(\'ccc, LLL d\') : String(d || \'\');\n' +
        'const mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\n' +
        '\n' +
        '// HubSpot\'s default sales pipeline.\n' +
        'const STAGES = [\n' +
        '  [\'appointmentscheduled\', \'Appointment scheduled\', \'A first meeting is booked.\'],\n' +
        '  [\'qualifiedtobuy\', \'Qualified to buy\', \'Need, rough budget, decision process and timeline are understood.\'],\n' +
        '  [\'presentationscheduled\', \'Presentation scheduled\', \'A demo or presentation is booked or has been given.\'],\n' +
        '  [\'decisionmakerboughtin\', \'Decision maker bought-in\', \'The person who signs has seen it and supports it.\'],\n' +
        '  [\'contractsent\', \'Contract sent\', \'A proposal or contract has been sent.\'],\n' +
        '  [\'closedwon\', \'Closed won\', \'Signed.\'],\n' +
        '  [\'closedlost\', \'Closed lost\', \'The prospect said no.\']\n' +
        '];\n' +
        'const stageIndex = id => STAGES.findIndex(s => s[0] === id);\n' +
        'const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];\n' +
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
        '// Is this quote really in the transcript? (case, punctuation and spacing ignored)\n' +
        'const norm = s => String(s || \'\').toLowerCase().replace(/[’\']/g, "\'").replace(/[^a-z0-9\' ]+/g, \' \').replace(/\\s+/g, \' \').trim();\n' +
        'const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };\n' +
        '\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'const plainToHtml = t => String(t || \'\').split(/\\n{2,}/).map(p => \'<p style="margin:0 0 14px;text-align:left">\' + esc(p).replace(/\\n/g, \'<br>\') + \'</p>\').join(\'\');\n' +
        '// n8n shows a form\'s completion HTML as the whole page, so it needs its own styling.\n' +
        'function formPage(title, inner) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}\'\n' +
        '    + \'.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>\'\n' +
        '    + \'<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>\' + inner + \'</div></body></html>\';\n' +
        '}\n' +
        '// ---- end lib-tdw.js ----\n' +
        'const a = $(\'Prepare Upload\').first().json;\n' +
        'return [{ json: { html: formPage(\'Something needs fixing\', \'<h2 style="margin:0 0 8px;font-size:21px">Something needs fixing</h2><ul style="color:#b42318;padding-left:20px">\' + a.errors.map(e => \'<li>\' + esc(e) + \'</li>\').join(\'\') + \'</ul><p style="color:#6b7a99">Please go back and try again.</p>\') } }];\n'
  } },
  output: [{ html: '<h2>Something needs fixing</h2>' }]
});

const showProblem = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Show Problem', position: [1160, 420], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') } }
});

const note = sticky(
  '## Tidewater 1: Upload Call\nThe rep\'s form (`/form/tidewater-call`): pick the deal, attach the recording (MP3, M4A, WAV, WEBM or MP4, up to 25 MB). **Tidewater 2** processes it while the page waits (about a minute), then the page shows the summary, what went into the CRM and what is waiting for review, with a link to the review page.',
  [], { position: [160, 20], width: 900, height: 200, color: 4 }
);

export default workflow('tidewater-upload-call', 'Tidewater 1: Upload Call')
  .add(form)
  .to(prepare)
  .to(valid
    .onTrue(processCall.to(showResult))
    .onFalse(problem.to(showProblem)))
  .add(note);
