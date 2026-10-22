import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const JOBS = { __rl: true, mode: 'id', value: 'qycslNJXs6wOwRxE', cachedResultName: 'Northgate Jobs' };
const CANDIDATES = { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' };
const EVENTS = { __rl: true, mode: 'id', value: 'v5LAsWSJxw2Uj4Ig', cachedResultName: 'Northgate Events' };
const CAL_WF = { __rl: true, mode: 'id', value: 'ngtCalendar00009', cachedResultName: 'Northgate 9: Calendar' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ngtSendEmail0003', cachedResultName: 'Northgate 3: Send Email' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 400], parameters: { inputSource: 'passthrough' } },
  output: [{ candidate_id: 'C1021-ABCD', action: 'invite', actor: 'Priya Shah' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const readCandidate = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read Candidate',
    position: [640, 400],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true, filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr("{{ $('When Called').first().json.candidate_id }}") }] } }
  },
  output: [{ candidate_id: 'C1021-ABCD', status: 'new', band: 'shortlist', token: 't' }]
});

const readJobs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Jobs', position: [860, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: JOBS, returnAll: true } },
  output: [{ job_id: 'NG-101', title: 'Customer Success Manager' }]
});

const plan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan', position: [1080, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Checks that the decision makes sense for where the candidate is now, and picks the branch.\n' +
        '// invite: new or on hold (never a knockout) · hold: new · reject: new, on hold or invited.\n' +
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
        'const req = $(\'When Called\').first().json;\n' +
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'const c = $(\'Read Candidate\').all().map(i => i.json).find(r => r.candidate_id === req.candidate_id) || null;\n' +
        'const job = c ? ($(\'Read Jobs\').all().map(i => i.json).find(j => j.job_id === c.job_id) || {}) : {};\n' +
        'const allowed = { invite: [\'new\', \'hold\'], hold: [\'new\'], reject: [\'new\', \'hold\', \'invited\'] };\n' +
        'const said = { invited: \'invited\', interview_booked: \'booked for interview\', rejected: \'rejected\', hold: \'on hold\', new: \'new\' };\n' +
        'let route = req.action, message = \'\';\n' +
        'if (!c) { route = \'refuse\'; message = \'Candidate not found.\'; }\n' +
        'else if (!allowed[req.action]) { route = \'refuse\'; message = \'Unknown action.\'; }\n' +
        'else if (!allowed[req.action].includes(c.status)) { route = \'refuse\'; message = \'This candidate is already \' + (said[c.status] || c.status) + \'.\'; }\n' +
        'else if (req.action === \'invite\' && c.band === \'knockout\') { route = \'refuse\'; message = \'This candidate needs visa sponsorship, which the role can\\\'t offer.\'; }\n' +
        'const from = DateTime.now().setZone(TZ).plus({ days: 1 }).startOf(\'day\');\n' +
        'return [{ json: { route, message, candidate: c, job, settings: s, actor: req.actor || \'recruiter\', action: \'busy\', from: from.toISO(), to: from.plus({ days: 21 }).toISO() } }];\n'
  } },
  output: [{ route: 'invite', message: '', action: 'busy', from: '2026-10-22T00:00:00.000+01:00', to: '2026-11-12T00:00:00.000+00:00' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Decision',
    position: [1300, 400],
    parameters: {
      rules: { values: [
        { outputKey: 'invite', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'invite' }], combinator: 'and' } },
        { outputKey: 'reject', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'reject' }], combinator: 'and' } },
        { outputKey: 'hold', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'hold' }], combinator: 'and' } }
      ] },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'refused' }
    }
  }
});

const busy = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Interviewer Busy Times', position: [1540, 200], parameters: { source: 'database', workflowId: CAL_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const invite = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Invite', position: [1760, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Picks interview times and writes the invitation. Working days only, the hours in Settings, one time\n' +
        '// a day (rotating through the hours so the choice varies), never over the interviewer\'s busy periods.\n' +
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
        'const p = $(\'Plan\').first().json;\n' +
        'const c = p.candidate, job = p.job, s = p.settings;\n' +
        'const busy = ($input.first().json.busy || []).map(b => [Date.parse(b.start), Date.parse(b.end)]);\n' +
        'const hours = String(s.interview_hours || \'10,11,14,15\').split(\',\').map(Number).filter(n => n >= 7 && n <= 19);\n' +
        'const minutes = Number(s.interview_minutes || 45);\n' +
        'const want = Number(s.slots_offered || 5);\n' +
        'const slots = [];\n' +
        'let day = DateTime.fromISO(p.from, { zone: TZ });\n' +
        'const end = DateTime.fromISO(p.to, { zone: TZ });\n' +
        'let turn = 0;\n' +
        'while (slots.length < want && day < end) {\n' +
        '  if (day.weekday <= 5) {\n' +
        '    for (let k = 0; k < hours.length; k++) {\n' +
        '      const h = hours[(turn + k) % hours.length];\n' +
        '      const st = day.set({ hour: h, minute: 0, second: 0, millisecond: 0 });\n' +
        '      const en = st.plus({ minutes });\n' +
        '      if (busy.some(([a, b]) => st.toMillis() < b && en.toMillis() > a)) continue;\n' +
        '      slots.push({ start: st.toISO(), end: en.toISO(), label: st.toFormat("cccc d LLLL, h:mm a").replace(\':00 \', \' \') });\n' +
        '      break;\n' +
        '    }\n' +
        '    turn++;\n' +
        '  }\n' +
        '  day = day.plus({ days: 1 });\n' +
        '}\n' +
        'if (!slots.length) {\n' +
        '  const at = nowIso();\n' +
        '  return [{ json: { candidate_id: c.candidate_id, status: c.status, slots_json: c.slots_json || \'[]\', interview_at: c.interview_at || \'\', updated_at: at,\n' +
        '    event: \'invite_failed\', detail: \'No free interview times in the next three weeks\', actor: p.actor, at, emails: [],\n' +
        '    answer: { ok: false, message: \'No free interview times in the next three weeks. Check the calendar.\' } } }];\n' +
        '}\n' +
        'const base = (s.base_url || \'http://localhost:5678\') + \'/webhook/northgate/book?c=\' + c.candidate_id + \'&t=\' + c.token + \'&s=\';\n' +
        'const buttons = slots.map((t, i) => \'<a href="\' + esc(base + i) + \'" style="display:block;padding:11px 14px;border:1px solid #cfe0d7;border-radius:10px;margin:0 0 8px;color:#0b6e4f;font-weight:600;text-decoration:none">\' + esc(t.label) + \'</a>\').join(\'\');\n' +
        'const now = nowIso();\n' +
        'return [{ json: {\n' +
        '  candidate_id: c.candidate_id, status: \'invited\', slots_json: JSON.stringify(slots), interview_at: \'\', updated_at: now,\n' +
        '  event: \'invited\', detail: \'Invited to interview; offered \' + slots.length + \' times (first \' + slots[0].label + \')\', actor: p.actor, at: now,\n' +
        '  emails: [{\n' +
        '    to: c.email, kind: \'interview_invite\', candidate_id: c.candidate_id,\n' +
        '    subject: \'Interview invitation: \' + job.title,\n' +
        '    html: emailHtml(s.company || \'Northgate Talent\', [\n' +
        '      \'Hi \' + esc(firstName(c.name)) + \',\',\n' +
        '      \'Thanks for applying for <b>\' + esc(job.title) + \'</b>. We\\\'d like to invite you to a \' + minutes + \'-minute video interview with \' + esc(job.interviewer || s.recruiter_name) + \'.\',\n' +
        '      \'Please pick the time that suits you best. The first person to choose a time gets it, so it\\\'s worth booking soon:\'\n' +
        '    ], buttons + \'<p style="margin:14px 0 0;color:#6b7c72;font-size:13px;text-align:left">None of these work? Just reply and we\\\'ll find another time.</p>\')\n' +
        '  }],\n' +
        '  answer: { ok: true, message: \'Invite sent with \' + slots.length + \' times to choose from.\' }\n' +
        '} }];\n'
  } },
  output: [{ candidate_id: 'C1021-ABCD', status: 'invited', emails: [], answer: { ok: true, message: 'Invite sent.' } }]
});

const reject = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Reject', position: [1760, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// A polite, fixed rejection. The wording is a template, never AI-written, and it gives no score.\n' +
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
        'const p = $(\'Plan\').first().json;\n' +
        'const c = p.candidate, job = p.job, s = p.settings;\n' +
        'const now = nowIso();\n' +
        'return [{ json: {\n' +
        '  candidate_id: c.candidate_id, status: \'rejected\', slots_json: c.slots_json || \'[]\', interview_at: \'\', updated_at: now,\n' +
        '  event: \'rejected\', detail: \'Rejected by \' + p.actor + \'; rejection email sent\', actor: p.actor, at: now,\n' +
        '  emails: [{\n' +
        '    to: c.email, kind: \'rejection\', candidate_id: c.candidate_id,\n' +
        '    subject: \'Your application for \' + job.title,\n' +
        '    html: emailHtml(s.company || \'Northgate Talent\', [\n' +
        '      \'Hi \' + esc(firstName(c.name)) + \',\',\n' +
        '      \'Thank you for applying for <b>\' + esc(job.title) + \'</b> and for the time you put into your application.\',\n' +
        '      \'We\\\'ve read it carefully, and on this occasion we won\\\'t be taking it further. We know that\\\'s disappointing to hear.\',\n' +
        '      \'We keep applications for six months unless you ask us not to, and we\\\'d be glad to hear from you about future roles.\',\n' +
        '      \'Best wishes,<br>\' + esc(s.recruiter_name || \'The Northgate team\') + \'<br>\' + esc(s.company || \'Northgate Talent\')\n' +
        '    ])\n' +
        '  }],\n' +
        '  answer: { ok: true, message: \'Rejected. A polite email is on its way.\' }\n' +
        '} }];\n'
  } },
  output: [{ candidate_id: 'C1021-ABCD', status: 'rejected', emails: [], answer: { ok: true, message: 'Rejected.' } }]
});

const hold = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Hold', position: [1760, 600], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Parks the candidate without contacting them.\n' +
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
        'const p = $(\'Plan\').first().json;\n' +
        'const c = p.candidate;\n' +
        'const now = nowIso();\n' +
        'return [{ json: {\n' +
        '  candidate_id: c.candidate_id, status: \'hold\', slots_json: c.slots_json || \'[]\', interview_at: \'\', updated_at: now,\n' +
        '  event: \'hold\', detail: \'Put on hold by \' + p.actor, actor: p.actor, at: now,\n' +
        '  emails: [],\n' +
        '  answer: { ok: true, message: \'On hold. The candidate hasn\\\'t been contacted.\' }\n' +
        '} }];\n'
  } },
  output: [{ candidate_id: 'C1021-ABCD', status: 'hold', emails: [], answer: { ok: true, message: 'On hold.' } }]
});

const applyChange = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Apply Change', position: [1980, 400] }
});

const update = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Candidate',
    position: [2200, 400],
    parameters: {
      resource: 'row', operation: 'update', dataTableId: CANDIDATES,
      filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr('{{ $json.candidate_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: {
          status: expr('{{ $json.status }}'),
          slots_json: expr('{{ $json.slots_json }}'),
          interview_at: expr('{{ $json.interview_at }}'),
          updated_at: expr('{{ $json.updated_at }}')
      }, schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'slots_json', displayName: 'slots_json', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'interview_at', displayName: 'interview_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ id: 3 }]
});

const logEvent = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Log Event', position: [2420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'insert', dataTableId: EVENTS, columns: { mappingMode: 'defineBelow', value: {
    candidate_id: expr("{{ $('Apply Change').first().json.candidate_id }}"),
    event: expr("{{ $('Apply Change').first().json.event }}"),
    detail: expr("{{ $('Apply Change').first().json.detail }}"),
    actor: expr("{{ $('Apply Change').first().json.actor }}"),
    at: expr("{{ $('Apply Change').first().json.at }}")
  }, schema: [
          { id: 'candidate_id', displayName: 'candidate_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'event', displayName: 'event', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'detail', displayName: 'detail', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'actor', displayName: 'actor', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 9 }]
});

const emails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Emails', position: [2640, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The emails for this decision (an empty item when there are none, which Send Email skips).\n' +
        'const ch = $(\'Apply Change\').first().json;\n' +
        'const list = ch.emails || [];\n' +
        'return (list.length ? list : [{ to: \'\' }]).map(json => ({ json }));\n'
  } },
  output: [{ to: 'amara.okafor@example.com', subject: 'Interview invitation', html: '<p>Hi</p>', kind: 'interview_invite', candidate_id: 'C1021-ABCD' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Emails', position: [2860, 400], alwaysOutputData: true, onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const answer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer', position: [3080, 400], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The outcome for the dashboard: what happened, or why nothing did.\n' +
        'const plan = $(\'Plan\').first().json;\n' +
        'if (plan.route === \'refuse\') return [{ json: { ok: false, message: plan.message } }];\n' +
        'const ch = $(\'Apply Change\').first().json;\n' +
        'return [{ json: ch.answer }];\n'
  } },
  output: [{ ok: true, message: 'Invite sent with 5 times to choose from.' }]
});

const note = sticky(
  '## Northgate 5: Candidate Action\nCarries out a recruiter\'s decision from the dashboard. **Plan** refuses anything that doesn\'t fit the candidate\'s state (e.g. inviting a knockout or rejecting twice).\n- **Invite**: reads the interviewer\'s busy times (**Northgate 9**), offers up to 5 free times on different working days and emails private booking links.\n- **Reject**: a fixed, polite email (never AI-written, no score).\n- **Hold**: no contact.\nEvery decision is logged in **Northgate Events**.',
  [], { position: [160, -60], width: 1300, height: 220, color: 5 }
);

export default workflow('northgate-candidate-action', 'Northgate 5: Candidate Action')
  .add(whenCalled)
  .to(readSettings)
  .to(readCandidate)
  .to(readJobs)
  .to(plan)
  .to(which
    .onCase(0, busy.to(invite).to(applyChange))
    .onCase(1, reject.to(applyChange))
    .onCase(2, hold.to(applyChange))
    .onCase(3, answer))
  .add(applyChange)
  .to(update)
  .to(logEvent)
  .to(emails)
  .to(send)
  .to(answer)
  .add(note);
