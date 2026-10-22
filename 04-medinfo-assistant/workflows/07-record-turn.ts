import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } };

const called = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called',
    position: [200, 300],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'payload', type: 'string' },
          { name: 'safety_chat_id', type: 'string' }
        ]
      }
    }
  },
  output: [{ payload: '{"turn":{"id":"t-1"},"cases":[],"mi_refs":[]}', safety_chat_id: '' }]
});

const record = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save Turn and Cases',
    position: [440, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    parameters: {
      operation: 'executeQuery',
      query: 'select kb_record_turn($1::jsonb) as result;',
      options: { queryReplacement: expr('{{ $json.payload }}') }
    },
    credentials: PG_CRED
  },
  output: [{ result: { turn_id: 't-1', cases: [{ ref: 'AE-261007-AB12', case_type: 'adverse_event', new: true }] } }]
});

const alerts = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Alerts to Send',
    position: [680, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// One Telegram alert per new case or follow-up, plus new Medical Information requests.\n' +
        '// No SAFETY_CHAT_ID configured: the cases are still recorded, just not alerted.\n' +
        'const call = $(\'When Called\').first().json;\n' +
        'const chat = String(call.safety_chat_id || \'\').trim();\n' +
        'if (!chat) return [];\n' +
        'const p = JSON.parse(call.payload);\n' +
        'const result = $input.first().json.result ?? {};\n' +
        'const info = Object.fromEntries((p.cases ?? []).map(c => [c.ref, c]));\n' +
        'const esc = s => String(s ?? \'\').replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\');\n' +
        'const label = { adverse_event: \'Adverse event\', product_complaint: \'Product complaint\' };\n' +
        'const alerts = [];\n' +
        'for (const c of result.cases ?? []) {\n' +
        '  const i = info[c.ref] ?? {};\n' +
        '  const d = i.details ?? {};\n' +
        '  const lines = [\n' +
        '    `<b>${c.new ? \'New\' : \'Follow-up\'}: ${label[c.case_type] ?? c.case_type} ${esc(c.ref)}</b>`,\n' +
        '    `Product: ${esc(i.product || \'not stated\')}`,\n' +
        '    `Report: ${esc(i.summary)}`,\n' +
        '  ];\n' +
        '  if (c.case_type === \'adverse_event\') {\n' +
        '    lines.push(`Seriousness: ${esc(d.seriousness)} | Special situation: ${esc(d.special_situation)}`);\n' +
        '    lines.push(`Missing: ${esc(d.missing_information)}`);\n' +
        '    lines.push(\'Forward to Pharmacovigilance within 24 hours (SOP-PV-001).\');\n' +
        '  } else {\n' +
        '    lines.push(`Lot: ${esc(d.lot_number || \'not given\')} | Missing: ${esc(d.missing_information)}`);\n' +
        '    lines.push(\'Forward to Quality Assurance within 1 business day (SOP-QA-004).\');\n' +
        '  }\n' +
        '  lines.push(`From: ${esc(i.reporter_role)} via ${esc(i.channel)} | Session ${esc(i.session_id)}`);\n' +
        '  alerts.push(lines.join(\'\\n\'));\n' +
        '}\n' +
        'for (const ref of p.mi_refs ?? []) {\n' +
        '  alerts.push(`<b>New Medical Information request ${esc(ref)}</b>\\nFrom: ${esc(p.turn?.role)} via ${esc(p.turn?.channel)}\\nQuestion: ${esc(p.turn?.standalone_question)}\\nReply due within 2 business days (SOP-MI-002).`);\n' +
        '}\n' +
        'return alerts.map(text => ({ json: { chat_id: chat, text } }));\n'
    }
  },
  output: [{ chat_id: '123', text: '<b>New: Adverse event AE-261007-AB12</b>' }]
});

const telegram = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Alert Safety Team',
    position: [920, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.chat_id }}'),
      text: expr('{{ $json.text }}'),
      additionalFields: { parse_mode: 'HTML', appendAttribution: false }
    },
    credentials: { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } }
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## MedInfo 7: Record Turn\n' +
  'Called by **MedInfo 5** without waiting, so logging never slows a reply.\n\n' +
  '- `kb_record_turn` writes the audit row (question, answer, role, route, cited document versions, latency) and creates or updates the adverse event and product complaint cases detected this turn, in one transaction.\n' +
  '- New cases, follow-ups and Medical Information requests are alerted on Telegram when `SAFETY_CHAT_ID` is set in MedInfo 5. The case is recorded either way.',
  [called, record, alerts, telegram],
  { color: 4 }
);

export default workflow('medinfo-record-turn', 'MedInfo 7: Record Turn')
  .add(called)
  .to(record)
  .to(alerts)
  .to(telegram)
  .add(note);
