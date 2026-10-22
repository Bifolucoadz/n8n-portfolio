import { workflow, node, trigger, sticky, newCredential } from '@n8n/workflow-sdk';

const HANDLE_WF = { __rl: true, mode: 'id', value: 'hcbHandleMsg0002', cachedResultName: 'Honeycrumb 2: Handle Message' };

const incoming = trigger({
  type: 'n8n-nodes-base.whatsAppTrigger',
  version: 1,
  config: {
    name: 'WhatsApp Message',
    position: [200, 300],
    parameters: { updates: ['messages'], options: { messageStatusUpdates: [] } },
    credentials: { whatsAppTriggerApi: newCredential('WhatsApp Trigger account') }
  },
  output: [{ messaging_product: 'whatsapp', metadata: { phone_number_id: '123' }, contacts: [{ profile: { name: 'Ada' }, wa_id: '2348010000000' }], messages: [{ from: '2348010000000', id: 'wamid.1', timestamp: '1792588000', type: 'text', text: { body: 'Hi' } }], field: 'messages' }]
});

const normalise = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Normalise', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// WhatsApp Cloud API webhook value -> one item per customer message (statuses are filtered by the trigger).\n' +
        'const out = [];\n' +
        'for (const item of $input.all()) {\n' +
        '  const v = item.json;\n' +
        '  const names = Object.fromEntries((v.contacts ?? []).map(c => [c.wa_id, c.profile?.name ?? ""]));\n' +
        '  for (const m of v.messages ?? []) {\n' +
        '    let text = "", media_id = "", location = null;\n' +
        '    const type = m.type;\n' +
        '    if (type === "text") text = m.text?.body ?? "";\n' +
        '    else if (type === "interactive") text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";\n' +
        '    else if (type === "button") text = m.button?.text ?? "";\n' +
        '    else if (type === "audio") media_id = m.audio?.id ?? "";\n' +
        '    else if (type === "image") { media_id = m.image?.id ?? ""; text = m.image?.caption ?? ""; }\n' +
        '    else if (type === "location") location = m.location ?? null;\n' +
        '    out.push({ json: {\n' +
        '      phone: m.from, name: names[m.from] ?? "", message_id: m.id,\n' +
        '      type: type === "button" ? "text" : type, text, media_id, location,\n' +
        '      test: false, received_at: m.timestamp,\n' +
        '    } });\n' +
        '  }\n' +
        '}\n' +
        'return out;\n'
  } },
  output: [{ phone: '2348010000000', name: 'Ada', message_id: 'wamid.1', type: 'text', text: 'Hi', media_id: '', location: null, test: false }]
});

const handle = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Handle Each Message', position: [640, 300], parameters: { source: 'database', workflowId: HANDLE_WF, mode: 'each', options: { waitForSubWorkflow: false } } }
});

const note = sticky(
  '## Honeycrumb 1: WhatsApp In\nMeta calls this for every customer message (n8n checks the `X-Hub-Signature-256` signature with the app secret; delivery and read receipts are switched off). Text, button replies, voice notes, photos and location pins become one tidy item each, handed to **Honeycrumb 2** without waiting, so Meta always gets its 200 at once.\n\nNeeds n8n on a public HTTPS address (`WEBHOOK_URL` = the ngrok domain) and one WhatsApp Trigger per Meta app.',
  [], { position: [160, 40], width: 760, height: 200, color: 5 }
);

export default workflow('honeycrumb-whatsapp-in', 'Honeycrumb 1: WhatsApp In')
  .add(incoming)
  .to(normalise)
  .to(handle)
  .add(note);
