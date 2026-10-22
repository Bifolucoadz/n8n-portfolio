import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'QbQi6BAEGxZmzGyT', cachedResultName: 'Kettle Settings' };
const STORE_WF = { __rl: true, mode: 'id', value: 'ktlStoreApi00001', cachedResultName: 'Kettle 1: Store API' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ktlSendEmail0006', cachedResultName: 'Kettle 6: Send Email' };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const every = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every 30 Minutes', position: [200, 300], parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] } } },
  output: [{}]
});

const runNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [440, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const askCheckouts = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Checkouts Request', position: [660, 400], executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [{ id: 'a', name: 'action', value: 'abandoned_checkouts', type: 'string' }] } } },
  output: [{ action: 'abandoned_checkouts' }]
});

const getCheckouts = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Checkouts', position: [880, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ checkouts: [] }]
});

const askProducts = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Products Request', position: [1100, 400], executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [{ id: 'a', name: 'action', value: 'inventory', type: 'string' }] } } },
  output: [{ action: 'inventory' }]
});

const getProducts = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Products', position: [1320, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ products: [] }]
});

const pick = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Pick Carts', position: [1540, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Which abandoned checkouts get an email, and what offer each one gets. Rules, not AI:\n' +
        '// - only checkouts that weren\'t completed, have an email, have marketing consent, haven\'t been\n' +
        '//   contacted, and were left between abandoned_min_hours and abandoned_max_hours ago;\n' +
        '// - first-time customers with a cart of welcome_min_subtotal or more get the welcome code;\n' +
        '// - carts within free_shipping_nudge of the free-shipping threshold get a free-shipping nudge;\n' +
        '// - everyone else gets a friendly reminder with no offer.\n' +
        '// ---- lib-kettle.js (included by build.py): shared helpers for the Kettle & Fern workflows ----\n' +
        'const TZ = \'America/Los_Angeles\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const usd = n => \'$\' + (Math.round(Number(n || 0) * 100) / 100).toFixed(2).replace(/\\.00$/, \'\');\n' +
        'const clip = (t, n) => { t = String(t || \'\').trim().replace(/\\.$/, \'\'); return t.length <= n ? t : t.slice(0, n).replace(/\\s+\\S*$/, \'\') + \'…\'; };\n' +
        'const day = iso => iso ? DateTime.fromISO(String(iso), { zone: TZ }).toFormat(\'ccc d LLL\') : \'\';\n' +
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
        '// Store-branded email: a header with the shop name, paragraphs, optional extra HTML (buttons, tables).\n' +
        'function emailHtml(store, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Georgia,\\\'Times New Roman\\\',serif;font-size:16px;line-height:1.6;color:#2b2a26;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#3f6b4a;margin:0 0 20px">\' + esc(store) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '// Plain text (blank lines between paragraphs) as escaped paragraphs for emailHtml.\n' +
        'const paragraphsOf = t => String(t || \'\').split(/\\n{2,}/).map(p => esc(p).replace(/\\n/g, \'<br>\'));\n' +
        'const button = (href, label) => \'<p style="margin:6px 0 18px;text-align:left"><a href="\' + esc(href) + \'" style="display:inline-block;background:#3f6b4a;color:#fff;font-family:Helvetica,Arial,sans-serif;font-weight:600;padding:12px 22px;border-radius:999px;text-decoration:none">\' + esc(label) + \'</a></p>\';\n' +
        '// ---- end lib-kettle.js ----\n' +
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'const all = ($(\'Get Checkouts\').first().json.checkouts || []);\n' +
        'const notes = Object.fromEntries(($(\'Get Products\').first().json.products || []).map(p => [p.sku, p.notes]));\n' +
        'const now = Date.now();\n' +
        'const minH = Number(s.abandoned_min_hours || 1), maxH = Number(s.abandoned_max_hours || 48);\n' +
        'const threshold = Number(s.free_shipping_threshold || 50), nudge = Number(s.free_shipping_nudge || 15), welcomeMin = Number(s.welcome_min_subtotal || 60);\n' +
        'const skipped = [], send = [];\n' +
        'for (const c of all) {\n' +
        '  const hours = (now - Date.parse(c.created_at)) / 3600000;\n' +
        '  const why = c.completed ? \'completed the order\' : !c.email ? \'no email\' : !c.accepts_marketing ? \'no marketing consent\' : c.contacted_at ? \'already contacted\' : hours < minH ? \'too recent (\' + Math.round(hours * 60) + \' min)\' : hours > maxH ? \'too old (\' + Math.round(hours / 24) + \' days)\' : \'\';\n' +
        '  if (why) { skipped.push({ checkout_id: c.checkout_id, reason: why }); continue; }\n' +
        '  const items = parseJson(c.items_json, []);\n' +
        '  let offer = null;\n' +
        '  if (Number(c.orders_count || 0) === 0 && c.subtotal >= welcomeMin) offer = { type: \'code\', code: s.welcome_code || \'WELCOME10\', text: \'10% off your first order with the code \' + (s.welcome_code || \'WELCOME10\') };\n' +
        '  else if (c.subtotal < threshold && threshold - c.subtotal <= nudge) offer = { type: \'free_shipping\', text: \'add \' + usd(threshold - c.subtotal) + \' more and shipping is free\' };\n' +
        '  const prompt = \'Customer first name: \' + c.first_name + \'\\n\\nItems in the cart:\\n\'\n' +
        '    + items.map(i => \'- \' + i.qty + \' × \' + i.title + \' (shop notes: \' + (notes[i.sku] || \'none\') + \')\').join(\'\\n\')\n' +
        '    + \'\\n\\nOffer: \' + (offer ? offer.text : \'none\');\n' +
        '  send.push({ ...c, items, offer, prompt, hours: Math.round(hours * 10) / 10 });\n' +
        '}\n' +
        'return send.length ? send.map(json => ({ json: { ...json, skipped } })) : [{ json: { none: true, skipped } }];\n'
  } },
  output: [{ checkout_id: 'CK-7001', email: 'ava.morgan@example.com', first_name: 'Ava', prompt: 'Customer first name: Ava', skipped: [] }]
});

const any = ifElse({
  version: 2.2,
  config: {
    name: 'Any to Email?',
    position: [1760, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ !$json.none }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const write = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Write Email',
    position: [1980, 300],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
        'You write a short, warm note from Hannah, who runs Kettle & Fern, a small online tea shop, to a customer who left tea in their cart.\n' +
        '\n' +
        '- 60 to 100 words, plain text, two or three short paragraphs, starting with "Hi <first name>,".\n' +
        '- Mention what they picked by name and, for one item, a short tip taken from the shop\'s notes (brewing temperature, how to enjoy it). Use only the notes given; don\'t invent tasting notes or facts.\n' +
        '- If an offer is given, mention it once using its exact wording. If no offer is given, don\'t mention discounts, codes or free shipping at all.\n' +
        '- No pressure: no fake urgency, no "only a few left", no "last chance", no guilt.\n' +
        '- Don\'t include links, prices or a sign-off line; those are added for you. End with a friendly sentence.\n' +
        '- subject: under 50 characters, in sentence case (capital first letter), friendly, no shouting and no emojis. preheader: under 90 characters.\n'
        ,
        maxTokens: 2000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'cart_email', strict: true, schema:
        '{"type": "object", "additionalProperties": false, "required": ["subject", "preheader", "body"], "properties": {"subject": {"type": "string"}, "preheader": {"type": "string"}, "body": {"type": "string"}}}\n'
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { subject: 'Your tea is waiting', preheader: '', body: 'Hi Ava,' } }] }] }]
});

const compose = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Compose', position: [2200, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Wraps the AI\'s note in the shop\'s email: the items, the offer box (from the rules), a button back\n' +
        '// to the cart and the footer. The AI never writes prices, codes or links.\n' +
        '// ---- lib-kettle.js (included by build.py): shared helpers for the Kettle & Fern workflows ----\n' +
        'const TZ = \'America/Los_Angeles\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const usd = n => \'$\' + (Math.round(Number(n || 0) * 100) / 100).toFixed(2).replace(/\\.00$/, \'\');\n' +
        'const clip = (t, n) => { t = String(t || \'\').trim().replace(/\\.$/, \'\'); return t.length <= n ? t : t.slice(0, n).replace(/\\s+\\S*$/, \'\') + \'…\'; };\n' +
        'const day = iso => iso ? DateTime.fromISO(String(iso), { zone: TZ }).toFormat(\'ccc d LLL\') : \'\';\n' +
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
        '// Store-branded email: a header with the shop name, paragraphs, optional extra HTML (buttons, tables).\n' +
        'function emailHtml(store, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Georgia,\\\'Times New Roman\\\',serif;font-size:16px;line-height:1.6;color:#2b2a26;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#3f6b4a;margin:0 0 20px">\' + esc(store) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '// Plain text (blank lines between paragraphs) as escaped paragraphs for emailHtml.\n' +
        'const paragraphsOf = t => String(t || \'\').split(/\\n{2,}/).map(p => esc(p).replace(/\\n/g, \'<br>\'));\n' +
        'const button = (href, label) => \'<p style="margin:6px 0 18px;text-align:left"><a href="\' + esc(href) + \'" style="display:inline-block;background:#3f6b4a;color:#fff;font-family:Helvetica,Arial,sans-serif;font-weight:600;padding:12px 22px;border-radius:999px;text-decoration:none">\' + esc(label) + \'</a></p>\';\n' +
        '// ---- end lib-kettle.js ----\n' +
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'const picks = $(\'Pick Carts\').all().map(i => i.json);\n' +
        'return $input.all().map((it, k) => {\n' +
        '  const c = picks[k];\n' +
        '  const x = aiJson(it.json) || { subject: \'Your tea is still in your cart\', preheader: \'\', body: \'Hi \' + c.first_name + \',\\n\\nYou left a few things in your cart. They\\\'re saved for you whenever you\\\'re ready.\' };\n' +
        '  const rows = c.items.map(i => \'<tr><td style="padding:6px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px">\' + i.qty + \' × \' + esc(i.title) + \'</td><td style="padding:6px 0;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:14px">\' + usd(i.qty * i.price) + \'</td></tr>\').join(\'\');\n' +
        '  const offerBox = c.offer ? \'<div style="background:#f1f6ef;border:1px dashed #3f6b4a;border-radius:10px;padding:12px 14px;margin:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#2f4f37">\'\n' +
        '    + (c.offer.type === \'code\' ? \'Your first-order code: <b style="letter-spacing:1px">\' + esc(c.offer.code) + \'</b> (10% off)\' : \'You\\\'re \' + usd(Number(s.free_shipping_threshold || 50) - c.subtotal) + \' away from free shipping.\') + \'</div>\' : \'\';\n' +
        '  const html = \'<span style="display:none">\' + esc(x.preheader) + \'</span>\' + emailHtml(s.store_name || \'Kettle & Fern\', paragraphsOf(x.body).concat([\'Hannah<br>\' + esc(s.store_name || \'Kettle & Fern\')]),\n' +
        '    \'<table style="width:100%;border-top:1px solid #e5e0d6;border-bottom:1px solid #e5e0d6;margin:4px 0 16px;border-collapse:collapse">\' + rows + \'</table>\'\n' +
        '    + offerBox + button(c.recovery_url, \'Return to your cart\')\n' +
        '    + \'<p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8a857a;text-align:left">You\\\'re getting this because you started a checkout and agreed to emails from us. One reminder only. <a href="\' + esc((s.store_url || \'\') + \'/unsubscribe\') + \'" style="color:#8a857a">Unsubscribe</a>.</p>\');\n' +
        '  return { json: { to: c.email, subject: x.subject, html, kind: \'cart_recovery\', ref: c.checkout_id, action: \'mark_contacted\', checkout_id: c.checkout_id, offer: c.offer ? (c.offer.code || \'free_shipping\') : \'\' } };\n' +
        '});\n'
  } },
  output: [{ to: 'ava.morgan@example.com', subject: 'Your tea is waiting', html: '<p>Hi</p>', kind: 'cart_recovery', ref: 'CK-7001', action: 'mark_contacted', checkout_id: 'CK-7001', offer: 'WELCOME10' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Emails', position: [2420, 300], parameters: { source: 'database', workflowId: SEND_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const marks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Contacted', position: [2640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// One "contacted" write per email sent, so nobody is emailed twice.\nreturn $(\'Compose\').all().map(i => ({ json: { action: \'mark_contacted\', checkout_id: i.json.checkout_id, offer: i.json.offer } }));\n' } },
  output: [{ action: 'mark_contacted', checkout_id: 'CK-7001', offer: 'WELCOME10' }]
});

const mark = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Mark Contacted', position: [2860, 300], parameters: { source: 'database', workflowId: STORE_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [3080, 400], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What this run did.\n' +
        'const picks = $(\'Pick Carts\').all().map(i => i.json);\n' +
        'const sent = picks.filter(p => !p.none).map(p => ({ checkout_id: p.checkout_id, to: p.email, offer: p.offer ? p.offer.text : \'none\', left_hours_ago: p.hours }));\n' +
        'return [{ json: { sent, skipped: picks[0].skipped } }];\n'
  } },
  output: [{ sent: [], skipped: [] }]
});

const note = sticky(
  '## Kettle 2: Abandoned Carts\nEvery 30 minutes. **Pick Carts** (code) chooses who to email: not completed, has consent, not contacted yet, left 1-48 hours ago. It also decides the offer: the welcome code for first-time customers with $60 or more in the cart, a free-shipping nudge when they are within $15 of it, otherwise none.\n**Write Email** (GPT-5.4 mini) writes a short personal note from the shop owner using the shop\'s product notes, and may only mention the offer it was given. **Compose** adds the items, offer box, button and footer. Each checkout is then marked so it is never emailed twice.',
  [], { position: [160, -20], width: 1400, height: 220, color: 5 }
);

export default workflow('kettle-abandoned-carts', 'Kettle 2: Abandoned Carts')
  .add(every)
  .to(readSettings)
  .to(askCheckouts)
  .to(getCheckouts)
  .to(askProducts)
  .to(getProducts)
  .to(pick)
  .to(any
    .onTrue(write.to(compose).to(send).to(marks).to(mark).to(summary))
    .onFalse(summary))
  .add(runNow)
  .to(readSettings)
  .add(note);
