import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const JOBS = { __rl: true, mode: 'id', value: 'qycslNJXs6wOwRxE', cachedResultName: 'Northgate Jobs' };
const CANDIDATES = { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' };
const EVENTS = { __rl: true, mode: 'id', value: 'v5LAsWSJxw2Uj4Ig', cachedResultName: 'Northgate Events' };
const CAL_WF = { __rl: true, mode: 'id', value: 'ngtCalendar00009', cachedResultName: 'Northgate 9: Calendar' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ngtSendEmail0003', cachedResultName: 'Northgate 3: Send Email' };
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };

const link = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Booking Link', position: [200, 400], parameters: { httpMethod: 'GET', path: 'northgate/book', responseMode: 'responseNode', options: { ignoreBots: true } } },
  output: [{ query: { c: 'C1021-ABCD', t: 'token', s: '0' } }]
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
    parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true, filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr("{{ $('Booking Link').first().json.query.c || 'none' }}") }] } }
  },
  output: [{ candidate_id: 'C1021-ABCD', status: 'invited', token: 'token', slots_json: '[]' }]
});

const readJobs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Jobs', position: [860, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: JOBS, returnAll: true } },
  output: [{ job_id: 'NG-101', title: 'Customer Success Manager' }]
});

const check = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Link', position: [1080, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Checks the booking link (candidate, private token, one of the times offered) before anything is booked.\n' +
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
        'const q = $(\'Booking Link\').first().json.query || {};\n' +
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'const c = $(\'Read Candidate\').all().map(i => i.json).find(r => r.candidate_id === q.c) || null;\n' +
        'const job = c ? ($(\'Read Jobs\').all().map(i => i.json).find(j => j.job_id === c.job_id) || {}) : {};\n' +
        'const slots = c ? parseJson(c.slots_json, []) : [];\n' +
        'const n = Number(q.s);\n' +
        'const slot = Number.isInteger(n) && n >= 0 ? slots[n] || null : null;\n' +
        'let route = \'ok\';\n' +
        'if (!c || !q.t || q.t !== c.token) route = \'invalid\';\n' +
        'else if (c.status === \'interview_booked\') route = \'already\';\n' +
        'else if (c.status !== \'invited\' || !slot) route = \'closed\';\n' +
        'else if (Date.parse(slot.start) < Date.now() + 2 * 3600 * 1000) route = \'too_late\';\n' +
        'return [{ json: { route, candidate: c, job, slot, slot_index: n, slots, settings: s, action: \'busy\', from: slot ? slot.start : \'\', to: slot ? slot.end : \'\' } }];\n'
  } },
  output: [{ route: 'ok', action: 'busy', from: '2026-10-23T10:00:00.000+01:00', to: '2026-10-23T10:45:00.000+01:00' }]
});

const linkOk = ifElse({
  version: 2.2,
  config: {
    name: 'Link OK?',
    position: [1300, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'ok' }], combinator: 'and' } }
  }
});

const busyNow = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Busy at That Time?', position: [1540, 300], parameters: { source: 'database', workflowId: CAL_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const stillFree = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Still Free', position: [1760, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Is the chosen time still free? (Another candidate may have taken it, or the interviewer got busy.)\n' +
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
        'const p = $(\'Check Link\').first().json;\n' +
        'const free = ($input.first().json.busy || []).length === 0;\n' +
        'const c = p.candidate, job = p.job;\n' +
        'return [{ json: {\n' +
        '  free,\n' +
        '  action: \'book\', start: p.slot.start, end: p.slot.end, candidate_id: c.candidate_id,\n' +
        '  title: \'Interview: \' + c.name + \' for \' + job.title,\n' +
        '  description: \'Video interview for \' + job.title + \' (\' + job.job_id + \'). Candidate \' + c.candidate_id + \', screening score \' + c.score + \'. Booked by the candidate from the Northgate invitation.\',\n' +
        '  attendees: [c.email, job.interviewer_email].filter(Boolean).join(\',\')\n' +
        '} }];\n'
  } },
  output: [{ free: true, action: 'book', start: '2026-10-23T10:00:00.000+01:00', end: '2026-10-23T10:45:00.000+01:00' }]
});

const isFree = ifElse({
  version: 2.2,
  config: {
    name: 'Free?',
    position: [1980, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.free }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const book = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Book Interview', position: [2200, 200], parameters: { source: 'database', workflowId: CAL_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const booked = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Booked', position: [2420, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The interview is in the calendar: update the candidate, write the history line, email both sides and\n' +
        '// show the candidate a confirmation page.\n' +
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
        'const p = $(\'Check Link\').first().json;\n' +
        'const ev = $input.first().json || {};\n' +
        'const c = p.candidate, job = p.job, s = p.settings, slot = p.slot;\n' +
        'const company = s.company || \'Northgate Talent\';\n' +
        'const when = whenText(slot.start);\n' +
        'const now = nowIso();\n' +
        'return [{ json: {\n' +
        '  candidate_id: c.candidate_id, status: \'interview_booked\', slots_json: c.slots_json, interview_at: slot.start, updated_at: now,\n' +
        '  event: \'interview_booked\', detail: \'Booked an interview for \' + when, actor: \'candidate\', at: now,\n' +
        '  emails: [\n' +
        '    { to: c.email, kind: \'interview_confirmed\', candidate_id: c.candidate_id, subject: \'Confirmed: your interview on \' + DateTime.fromISO(slot.start, { zone: TZ }).toFormat(\'ccc d LLL\'),\n' +
        '      html: emailHtml(company, [\n' +
        '        \'Hi \' + esc(firstName(c.name)) + \',\',\n' +
        '        \'You\\\'re booked in for your <b>\' + esc(job.title) + \'</b> interview with \' + esc(job.interviewer) + \' on <b>\' + esc(when) + \'</b> (UK time).\',\n' +
        '        \'It\\\'s a video call of about \' + (s.interview_minutes || 45) + \' minutes; the link will be in the calendar invitation. If you need to change the time, just reply to this email.\',\n' +
        '        \'Good luck!<br>\' + esc(s.recruiter_name || \'The Northgate team\')\n' +
        '      ]) },\n' +
        '    { to: job.interviewer_email || s.recruiter_email, kind: \'interviewer_notice\', candidate_id: c.candidate_id, subject: \'Interview booked: \' + c.name + \', \' + job.title,\n' +
        '      html: emailHtml(company, [\n' +
        '        \'<b>\' + esc(c.name) + \'</b> booked an interview for <b>\' + esc(job.title) + \'</b> on <b>\' + esc(when) + \'</b>.\',\n' +
        '        \'Screening score \' + c.score + \'. \' + esc(c.summary)\n' +
        '      ]) }\n' +
        '  ],\n' +
        '  page: pageHtml(company, \'You\\\'re booked in\', \'<p class="big">\' + esc(when) + \'</p><p>Your \' + esc(job.title) + \' interview with \' + esc(job.interviewer) + \' is confirmed. We\\\'ve emailed you the details.</p><p class="muted">Need a different time? Reply to the email and we\\\'ll sort it out.</p>\'),\n' +
        '  event_id: ev.event_id || \'\'\n' +
        '} }];\n'
  } },
  output: [{ candidate_id: 'C1021-ABCD', status: 'interview_booked', interview_at: '2026-10-23T10:00:00.000+01:00', page: '<html></html>' }]
});

const update = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Candidate',
    position: [2640, 200],
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
  config: { name: 'Log Event', position: [2860, 200], executeOnce: true, parameters: { resource: 'row', operation: 'insert', dataTableId: EVENTS, columns: { mappingMode: 'defineBelow', value: {
    candidate_id: expr("{{ $('Booked').first().json.candidate_id }}"),
    event: expr("{{ $('Booked').first().json.event }}"),
    detail: expr("{{ $('Booked').first().json.detail }}"),
    actor: expr("{{ $('Booked').first().json.actor }}"),
    at: expr("{{ $('Booked').first().json.at }}")
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
  config: { name: 'Emails', position: [3080, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The two emails for a booking.\n' +
        'return ($(\'Booked\').first().json.emails || []).map(json => ({ json }));\n'
  } },
  output: [{ to: 'amara.okafor@example.com', subject: 'Confirmed', html: '<p>Hi</p>', kind: 'interview_confirmed', candidate_id: 'C1021-ABCD' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Emails', position: [3300, 200], alwaysOutputData: true, onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const confirmation = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Confirmation Page', position: [3520, 200], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The confirmation page.\n' +
        'return [{ json: { code: 200, html: $(\'Booked\').first().json.page } }];\n'
  } },
  output: [{ code: 200, html: '<html></html>' }]
});

const takenPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Taken Page', position: [2200, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// That time has gone: offer the other times from the invitation (each is checked again when clicked).\n' +
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
        'const p = $(\'Check Link\').first().json;\n' +
        'const c = p.candidate, s = p.settings;\n' +
        'const base = (s.base_url || \'http://localhost:5678\') + \'/webhook/northgate/book?c=\' + c.candidate_id + \'&t=\' + c.token + \'&s=\';\n' +
        'const others = p.slots.map((t, i) => ({ ...t, i })).filter(t => t.i !== p.slot_index && Date.parse(t.start) > Date.now() + 2 * 3600 * 1000);\n' +
        'const list = others.map(t => \'<a class="slot" href="\' + esc(base + t.i) + \'">\' + esc(t.label) + \'</a>\').join(\'\');\n' +
        'const body = \'<p>Sorry, <b>\' + esc(p.slot.label) + \'</b> has just been taken.</p>\'\n' +
        '  + (list ? \'<p>Please choose another time:</p>\' + list : \'<p>Please reply to your invitation email and we\\\'ll find another time.</p>\');\n' +
        'return [{ json: { code: 409, html: pageHtml(s.company || \'Northgate Talent\', \'That time has gone\', body) } }];\n'
  } },
  output: [{ code: 409, html: '<html></html>' }]
});

const messagePage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Message Page', position: [1540, 600], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Every other case: a bad or old link, a time that\'s too soon, or already booked.\n' +
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
        'const p = $(\'Check Link\').first().json;\n' +
        'const s = p.settings || {};\n' +
        'const company = s.company || \'Northgate Talent\';\n' +
        'const c = p.candidate;\n' +
        'const pages = {\n' +
        '  invalid: [404, \'Link not recognised\', \'<p>This link isn\\\'t valid. Please use the link in your invitation email.</p>\'],\n' +
        '  closed: [410, \'This invitation has closed\', \'<p>This invitation is no longer open. If you think that\\\'s a mistake, reply to the email and we\\\'ll help.</p>\'],\n' +
        '  too_late: [409, \'That time is too soon\', \'<p>Interviews need at least two hours\\\' notice. Please pick a later time from your email.</p>\'],\n' +
        '  already: [200, \'You\\\'re already booked\', \'<p>Your interview is booked for <b>\' + esc(c && c.interview_at ? whenText(c.interview_at) : \'\') + \'</b>. To change it, reply to your confirmation email.</p>\']\n' +
        '};\n' +
        'const [code, title, body] = pages[p.route] || pages.invalid;\n' +
        'return [{ json: { code, html: pageHtml(company, title, body) } }];\n'
  } },
  output: [{ code: 404, html: '<html></html>' }]
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [3740, 400], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.code }}'), responseHeaders: HTML_HEADERS } } }
});

const note = sticky(
  '## Northgate 6: Book Interview\nThe candidate clicks a time in their invitation (`/webhook/northgate/book?c=…&t=…&s=…`).\n1. **Check Link**: the private token must match, the candidate must still be invited, and the time must be one of those offered and at least 2 hours away.\n2. The time is checked against the calendar again right now (**Northgate 9**), so two candidates can\'t get the same slot.\n3. The interview is booked with both people as guests, the candidate is marked **interview booked**, both get an email and the candidate sees a confirmation page. If the time has gone, they see the other times.',
  [], { position: [160, -20], width: 1400, height: 240, color: 5 }
);

export default workflow('northgate-book-interview', 'Northgate 6: Book Interview')
  .add(link)
  .to(readSettings)
  .to(readCandidate)
  .to(readJobs)
  .to(check)
  .to(linkOk
    .onTrue(busyNow.to(stillFree).to(isFree
      .onTrue(book.to(booked).to(update).to(logEvent).to(emails).to(send).to(confirmation).to(respond))
      .onFalse(takenPage.to(respond))))
    .onFalse(messagePage.to(respond)))
  .add(note);
