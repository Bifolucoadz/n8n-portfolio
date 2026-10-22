import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const JOBS = { __rl: true, mode: 'id', value: 'qycslNJXs6wOwRxE', cachedResultName: 'Northgate Jobs' };
const CANDIDATES = { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ngtSendEmail0003', cachedResultName: 'Northgate 3: Send Email' };

const monday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Mondays 8:00', position: [200, 300], parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 8, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const now = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Report Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [440, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'recruiter_email', value: 'priya@example.com' }]
});

const readJobs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Jobs', position: [660, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: JOBS, returnAll: true } },
  output: [{ job_id: 'NG-101', title: 'Customer Success Manager' }]
});

const readCands = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Candidates', position: [880, 400], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true } },
  output: [{ candidate_id: 'C1021-ABCD', job_id: 'NG-101', band: 'shortlist', status: 'new', score: 82 }]
});

const build = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Report', position: [1100, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Monday report for the recruiter: what came in, what\'s waiting for a decision, and interviews ahead.\n' +
        '// Built in code from the tables (no AI), so every number is exact.\n' +
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
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'const jobs = $(\'Read Jobs\').all().map(i => i.json).filter(j => j.job_id);\n' +
        'const cands = $(\'Read Candidates\').all().map(i => i.json).filter(c => c.candidate_id);\n' +
        'const now = DateTime.now().setZone(TZ);\n' +
        'const weekAgo = now.minus({ days: 7 }).toMillis();\n' +
        'const link = (s.base_url || \'http://localhost:5678\') + \'/webhook/northgate/dashboard?key=\' + encodeURIComponent(s.dashboard_key || \'\');\n' +
        'const cell = \'padding:6px 10px;border-bottom:1px solid #e3e9e5;text-align:left\';\n' +
        'let rows = \'\';\n' +
        'for (const j of jobs) {\n' +
        '  const all = cands.filter(c => c.job_id === j.job_id);\n' +
        '  const week = all.filter(c => Date.parse(c.applied_at) >= weekAgo);\n' +
        '  const n = b => all.filter(c => c.band === b).length;\n' +
        '  rows += \'<tr><td style="\' + cell + \'"><b>\' + esc(j.title) + \'</b></td><td style="\' + cell + \'">\' + week.length + \'</td><td style="\' + cell + \'">\' + all.length + \'</td>\'\n' +
        '    + \'<td style="\' + cell + \'">\' + n(\'shortlist\') + \'</td><td style="\' + cell + \'">\' + n(\'review\') + \'</td><td style="\' + cell + \'">\' + (n(\'unlikely\') + n(\'knockout\')) + \'</td>\'\n' +
        '    + \'<td style="\' + cell + \'">\' + all.filter(c => c.status === \'interview_booked\').length + \'</td></tr>\';\n' +
        '}\n' +
        'const head = [\'Role\', \'New this week\', \'Total\', \'Shortlist\', \'Worth a look\', \'Unlikely\', \'Interviews\'].map(h => \'<th style="\' + cell + \';color:#6b7c72;font-size:12px">\' + h + \'</th>\').join(\'\');\n' +
        'const waiting = cands.filter(c => c.status === \'new\' && (c.band === \'shortlist\' || c.band === \'review\')).sort((a, b) => b.score - a.score);\n' +
        'const waitList = waiting.slice(0, 8).map(c => \'<li style="margin:3px 0">\' + esc(c.name) + \', \' + esc(c.job_title) + \': \' + esc(BAND_LABEL[c.band]) + \' (\' + c.score + \'), waiting \' + Math.max(0, Math.round(now.diff(DateTime.fromISO(c.screened_at), \'days\').days)) + \' days</li>\').join(\'\');\n' +
        'const ahead = cands.filter(c => c.status === \'interview_booked\' && Date.parse(c.interview_at) > now.toMillis()).sort((a, b) => Date.parse(a.interview_at) - Date.parse(b.interview_at));\n' +
        'const aheadList = ahead.map(c => \'<li style="margin:3px 0">\' + esc(whenText(c.interview_at)) + \': \' + esc(c.name) + \', \' + esc(c.job_title) + \'</li>\').join(\'\');\n' +
        'const timed = cands.filter(c => c.screen_ms > 0);\n' +
        'const avg = timed.length ? (timed.reduce((t, c) => t + c.screen_ms, 0) / timed.length / 1000).toFixed(1) : \'0\';\n' +
        'const html = emailHtml(s.company || \'Northgate Talent\', [\n' +
        '  \'Good morning \' + esc(firstName(s.recruiter_name)) + \', here\\\'s the hiring pipeline for the week of \' + now.toFormat(\'d LLLL\') + \'.\'\n' +
        '], \'<table style="border-collapse:collapse;font-size:14px;margin:0 0 18px">\' + \'<tr>\' + head + \'</tr>\' + rows + \'</table>\'\n' +
        '  + \'<p style="margin:0 0 6px;text-align:left"><b>Waiting for your decision (\' + waiting.length + \')</b></p>\' + (waitList ? \'<ul style="margin:0 0 16px;padding-left:18px;text-align:left">\' + waitList + \'</ul>\' : \'<p style="text-align:left">Nothing waiting.</p>\')\n' +
        '  + \'<p style="margin:0 0 6px;text-align:left"><b>Interviews ahead (\' + ahead.length + \')</b></p>\' + (aheadList ? \'<ul style="margin:0 0 16px;padding-left:18px;text-align:left">\' + aheadList + \'</ul>\' : \'<p style="text-align:left">None booked yet.</p>\')\n' +
        '  + \'<p style="margin:0 0 6px;color:#6b7c72;font-size:13px;text-align:left">Average screening time: \' + avg + \' seconds per application.</p>\'\n' +
        '  + \'<p style="text-align:left"><a href="\' + esc(link) + \'" style="color:#0b6e4f;font-weight:600">Open the dashboard</a></p>\');\n' +
        'return [{ json: { to: s.recruiter_email, subject: \'Hiring pipeline: week of \' + now.toFormat(\'d LLL\'), html, kind: \'weekly_report\', candidate_id: \'\' } }];\n'
  } },
  output: [{ to: 'priya@example.com', subject: 'Hiring pipeline', html: '<p>Report</p>', kind: 'weekly_report', candidate_id: '' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Email the Recruiter', position: [1320, 400], parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Northgate 7: Weekly Report\nEvery Monday at 8:00 (UK time) the recruiter gets one email: applications per role this week and in total, how they were banded, who is waiting for a decision (and for how long), interviews ahead and the average screening time. Built in code from the tables, so every number is exact.',
  [], { position: [160, 80], width: 1000, height: 180, color: 4 }
);

export default workflow('northgate-weekly-report', 'Northgate 7: Weekly Report')
  .add(monday)
  .to(readSettings)
  .to(readJobs)
  .to(readCands)
  .to(build)
  .to(send)
  .add(now)
  .to(readSettings)
  .add(note);
