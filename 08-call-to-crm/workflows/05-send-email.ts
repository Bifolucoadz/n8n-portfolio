import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'IFuurjqqfST0GLCi', cachedResultName: 'Tidewater Settings' };
const OUTBOX = { __rl: true, mode: 'id', value: 'VGQHvXZw7QIaNJgY', cachedResultName: 'Tidewater Outbox' };
const GMAIL_CRED = { gmailOAuth2: { id: '7rH5EpTCyRAbJqwK', name: 'Gmail account 2' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'When Called',
    position: [200, 300],
    parameters: { inputSource: 'passthrough' }
  },
  output: [{ to: 'renee.alvarez@callowaydental.example', subject: 'Hello', html: '<p>Hi</p>', kind: 'acknowledgement', call_id: 'CL-ABCDE' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const route = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Route', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One item per email (items without a recipient are skipped), with the sending mode from Settings\n' +
        '// (test writes to the Outbox table).\n' +
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
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'return $(\'When Called\').all().filter(i => i.json.to).map(i => ({ json: {\n' +
        '  to: String(i.json.to || \'\'),\n' +
        '  subject: String(i.json.subject || \'\'),\n' +
        '  html: String(i.json.html || \'\'),\n' +
        '  kind: String(i.json.kind || \'\'),\n' +
        '  call_id: String(i.json.call_id || \'\'),\n' +
        '  live: s.mode === \'live\',\n' +
        '  sender: s.rep_name ? s.rep_name + \' (\' + (s.company || \'Tidewater Software\') + \')\' : \'Tidewater Software\',\n' +
        '  reply_to: s.rep_email || \'\',\n' +
        '  at: nowIso()\n' +
        '} }));\n'
  } },
  output: [{ to: 'renee.alvarez@callowaydental.example', subject: 'Hello', html: '<p>Hi</p>', kind: 'acknowledgement', call_id: 'CL-ABCDE', live: false, sender: 'Maya Collins (Tidewater Software)', reply_to: '', at: '2026-10-21T14:00:00.000-04:00' }]
});

const isLive = ifElse({
  version: 2.2,
  config: {
    name: 'Live Mode?',
    position: [860, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.live }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const gmail = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send with Gmail',
    position: [1100, 200],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'message', operation: 'send',
      sendTo: expr('{{ $json.to }}'), subject: expr('{{ $json.subject }}'), emailType: 'html', message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: expr('{{ $json.sender }}'), replyTo: expr('{{ $json.reply_to }}') }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: 'msg1' }]
});

const outbox = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Write to Outbox', position: [1100, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: OUTBOX, columns: { mappingMode: 'defineBelow', value: {
    to: expr('{{ $json.to }}'), subject: expr('{{ $json.subject }}'), body: expr('{{ $json.html }}'),
    kind: expr("{{ $json.kind }}"), call_id: expr('{{ $json.call_id }}'), at: expr('{{ $json.at }}')
  }, schema: [
          { id: 'to', displayName: 'to', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'subject', displayName: 'subject', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'body', displayName: 'body', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'call_id', displayName: 'call_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});

const note = sticky(
  '## Tidewater 5: Send Email\nEvery email (follow-ups to prospects, notices to the rep) goes through here. With `mode = live` in **Tidewater Settings** it sends with Gmail; in test mode it writes to the **Tidewater Outbox** table instead, so nothing reaches a real prospect while testing.',
  [], { position: [160, 40], width: 900, height: 160, color: 7 }
);

export default workflow('tidewater-send-email', 'Tidewater 5: Send Email')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(isLive
    .onTrue(gmail)
    .onFalse(outbox))
  .add(note);
