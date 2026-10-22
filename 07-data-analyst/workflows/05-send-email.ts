import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'eLHuDVWvuDw7XkhB', cachedResultName: 'Ironleaf Settings' };
const OUTBOX = { __rl: true, mode: 'id', value: 'jeTJyVYufE4q3cuM', cachedResultName: 'Ironleaf Outbox' };
const GMAIL_CRED = { gmailOAuth2: { id: '7rH5EpTCyRAbJqwK', name: 'Gmail account 2' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'When Called',
    position: [200, 300],
    parameters: { inputSource: 'passthrough' }
  },
  output: [{ to: 'rachel.moss@ironleaf.example', subject: 'Hello', html: '<p>Hi</p>', kind: 'acknowledgement', ref: '2026-10-12' }]
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
        '// ---- lib-ilf.js (included by build.py): shared helpers for the Ironleaf workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const clip = (t, n) => { t = String(t || \'\').trim().replace(/\\.$/, \'\'); return t.length <= n ? t : t.slice(0, n).replace(/\\s+\\S*$/, \'\') + \'…\'; };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && o.type === \'message\');\n' +
        '  const part = msg && (msg.content || []).find(c => c && c.type === \'output_text\');\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1f26;max-width:600px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:800;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#d9480f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '// ---- end lib-ilf.js ----\n' +
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'return $(\'When Called\').all().filter(i => i.json.to).map(i => ({ json: {\n' +
        '  to: String(i.json.to || \'\'),\n' +
        '  subject: String(i.json.subject || \'\'),\n' +
        '  html: String(i.json.html || \'\'),\n' +
        '  kind: String(i.json.kind || \'\'),\n' +
        '  ref: String(i.json.ref || \'\'),\n' +
        '  live: s.mode === \'live\',\n' +
        '  sender: s.company || \'Ironleaf Fitness\',\n' +
        '  reply_to: s.owner_email || \'\',\n' +
        '  at: nowIso()\n' +
        '} }));\n'
  } },
  output: [{ to: 'rachel.moss@ironleaf.example', subject: 'Hello', html: '<p>Hi</p>', kind: 'acknowledgement', ref: '2026-10-12', live: false, sender: 'Ironleaf Fitness', reply_to: '', at: '2026-10-21T19:00:00.000+01:00' }]
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
    kind: expr("{{ $json.kind }}"), ref: expr('{{ $json.ref }}'), at: expr('{{ $json.at }}')
  }, schema: [
          { id: 'to', displayName: 'to', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'subject', displayName: 'subject', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'body', displayName: 'body', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'ref', displayName: 'ref', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});

const note = sticky(
  '## Ironleaf 5: Send Email\nEvery email (the Monday report) goes through here. With `mode = live` in **Ironleaf Settings** it sends with Gmail; in test mode it writes to the **Ironleaf Outbox** table instead, so nothing is emailed while testing.',
  [], { position: [160, 40], width: 900, height: 160, color: 7 }
);

export default workflow('ironleaf-send-email', 'Ironleaf 5: Send Email')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(isLive
    .onTrue(gmail)
    .onFalse(outbox))
  .add(note);
