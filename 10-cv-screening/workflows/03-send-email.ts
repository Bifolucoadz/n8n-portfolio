import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const OUTBOX = { __rl: true, mode: 'id', value: 'ygMH59WjeBt0Og19', cachedResultName: 'Northgate Outbox' };
const GMAIL_CRED = { gmailOAuth2: { id: '7rH5EpTCyRAbJqwK', name: 'Gmail account 2' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'When Called',
    position: [200, 300],
    parameters: { inputSource: 'passthrough' }
  },
  output: [{ to: 'amara.okafor@example.com', subject: 'Hello', html: '<p>Hi</p>', kind: 'acknowledgement', candidate_id: 'C1021-ABCD' }]
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
        'return $(\'When Called\').all().filter(i => i.json.to).map(i => ({ json: {\n' +
        '  to: String(i.json.to || \'\'),\n' +
        '  subject: String(i.json.subject || \'\'),\n' +
        '  html: String(i.json.html || \'\'),\n' +
        '  kind: String(i.json.kind || \'\'),\n' +
        '  candidate_id: String(i.json.candidate_id || \'\'),\n' +
        '  live: s.mode === \'live\',\n' +
        '  sender: s.company || \'Northgate Talent\',\n' +
        '  reply_to: s.recruiter_email || \'\',\n' +
        '  at: nowIso()\n' +
        '} }));\n'
  } },
  output: [{ to: 'amara.okafor@example.com', subject: 'Hello', html: '<p>Hi</p>', kind: 'acknowledgement', candidate_id: 'C1021-ABCD', live: false, sender: 'Northgate Talent', reply_to: '', at: '2026-10-21T19:00:00.000+01:00' }]
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
    kind: expr('{{ $json.kind }}'), candidate_id: expr('{{ $json.candidate_id }}'), at: expr('{{ $json.at }}')
  }, schema: [
          { id: 'to', displayName: 'to', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'subject', displayName: 'subject', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'body', displayName: 'body', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'candidate_id', displayName: 'candidate_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});

const note = sticky(
  '## Northgate 3: Send Email\nEvery email to applicants and the recruiter goes through here. With `mode = live` in **Northgate Settings** it sends with Gmail; in test mode it writes to the **Northgate Outbox** table instead, so the whole pipeline can be tested without emailing anyone.',
  [], { position: [160, 40], width: 900, height: 160, color: 7 }
);

export default workflow('northgate-send-email', 'Northgate 3: Send Email')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(isLive
    .onTrue(gmail)
    .onFalse(outbox))
  .add(note);
