import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'QbQi6BAEGxZmzGyT', cachedResultName: 'Kettle Settings' };
const STORE_WF = { __rl: true, mode: 'id', value: 'ktlStoreApi00001', cachedResultName: 'Kettle 1: Store API' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ktlSendEmail0006', cachedResultName: 'Kettle 6: Send Email' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called',
    position: [200, 400],
    parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [
      { name: 'action', type: 'string' }, { name: 'order_number', type: 'string' }, { name: 'email', type: 'string' }, { name: 'summary', type: 'string' }
    ] } }
  },
  output: [{ action: 'lookup', order_number: '#1838', email: 'marcus.lee@example.com', summary: '' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'stale_tracking_days', value: '4' }]
});

const route = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Lookup Request', position: [640, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The help tool asked for, as a Store API lookup (both tools start by finding the order).\n' +
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
        'const i = $(\'When Called\').first().json;\n' +
        'return [{ json: { action: \'find_order\', order_number: String(i.order_number || \'\'), email: String(i.email || \'\'), tool: i.action } }];\n'
  } },
  output: [{ action: 'find_order', order_number: '#1838', email: 'marcus.lee@example.com', tool: 'lookup' }]
});

const find = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Find Order', position: [860, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ found: true, order: {} }]
});

const isTicket = ifElse({
  version: 2.2,
  config: {
    name: 'Open a Ticket?',
    position: [1080, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('When Called').first().json.action }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'ticket' }], combinator: 'and' } }
  }
});

const status = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Order Status', position: [1300, 520], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Plain-English order status for the help agent, worked out in code: late means the delivery estimate\n' +
        '// has passed, or tracking hasn\'t moved for stale_tracking_days. Only orders that matched number and\n' +
        '// email get here; everything else gets "not found".\n' +
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
        'const res = $input.first().json || {};\n' +
        'if (!res.found) return [{ json: { found: false, message: \'No order matches that order number and email.\' } }];\n' +
        'const o = res.order;\n' +
        'const now = DateTime.now().setZone(TZ);\n' +
        'const items = parseJson(o.items_json, []).map(i => i.qty + \' × \' + i.title).join(\', \');\n' +
        'const out = { found: true, order_number: o.order_number, ordered: day(o.created_at), items, total: usd(o.total) };\n' +
        'if (o.fulfillment_status !== \'fulfilled\') {\n' +
        '  return [{ json: { ...out, status: \'Being packed. It hasn\\\'t shipped yet; orders ship within 1 business day (Monday to Friday).\', late: false } }];\n' +
        '}\n' +
        'if (o.tracking_status === \'delivered\') {\n' +
        '  return [{ json: { ...out, status: \'Delivered \' + day(o.delivered_at) + \' (\' + o.last_event + \').\', carrier: o.carrier, tracking_url: o.tracking_url, late: false } }];\n' +
        '}\n' +
        'const eta = o.estimated_delivery ? DateTime.fromISO(o.estimated_delivery, { zone: TZ }).endOf(\'day\') : null;\n' +
        'const quietDays = o.last_event_at ? Math.floor(now.diff(DateTime.fromISO(o.last_event_at), \'days\').days) : 0;\n' +
        'const pastEta = eta && eta < now;\n' +
        'const stale = quietDays >= Number(s.stale_tracking_days || 4);\n' +
        'const late = !!(pastEta || stale);\n' +
        'return [{ json: { ...out,\n' +
        '  status: \'Shipped \' + day(o.shipped_at) + \' with \' + o.carrier + \'. Last tracking update: "\' + o.last_event + \'" on \' + day(o.last_event_at) + \'. Estimated delivery: \' + day(o.estimated_delivery) + \'.\',\n' +
        '  carrier: o.carrier, tracking_number: o.tracking_number, tracking_url: o.tracking_url, late,\n' +
        '  late_reason: late ? [pastEta ? \'the estimated delivery date (\' + day(o.estimated_delivery) + \') has passed\' : \'\', stale ? \'tracking hasn\\\'t updated for \' + quietDays + \' days\' : \'\'].filter(Boolean).join(\' and \') : \'\'\n' +
        '} }];\n'
  } },
  output: [{ found: true, order_number: '#1838', status: 'Shipped', late: true }]
});

const ticket = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Ticket', position: [1300, 280], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// A support ticket for the team: who, which order, what the tracking says, and the customer\'s words.\n' +
        '// Only created when the order number and email matched.\n' +
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
        'const req = $(\'When Called\').first().json;\n' +
        'const res = $input.first().json || {};\n' +
        'if (!res.found) return [{ json: { skip: true, answer: { ok: false, message: \'No order matches that order number and email, so no ticket was opened.\' } } }];\n' +
        'const o = res.order;\n' +
        'const id = newId(\'KF-\', 5);\n' +
        'const html = emailHtml(s.store_name || \'Kettle & Fern\', [\n' +
        '  \'<b>Ticket \' + id + \'</b> from the help chat.\',\n' +
        '  \'Customer: \' + esc(o.customer_name) + \' &lt;\' + esc(o.email) + \'&gt;<br>Order: \' + esc(o.order_number) + \', placed \' + esc(day(o.created_at)) + \', \' + esc(usd(o.total)),\n' +
        '  \'Carrier: \' + esc(o.carrier) + \' \' + esc(o.tracking_number) + \'<br>Last tracking: \' + esc(o.last_event) + \' (\' + esc(day(o.last_event_at)) + \')<br>Estimated delivery: \' + esc(day(o.estimated_delivery)),\n' +
        '  \'Summary: \' + esc(req.summary || \'\')\n' +
        ']);\n' +
        'return [{ json: {\n' +
        '  to: s.support_email, subject: \'Ticket \' + id + \': order \' + o.order_number + \' (\' + clip(req.summary || \'help chat\', 60) + \')\', html, kind: \'support_ticket\', ref: id,\n' +
        '  answer: { ok: true, ticket_id: id, message: \'Ticket \' + id + \' opened. The team will reply by email within 1 business day.\' }\n' +
        '} }];\n'
  } },
  output: [{ to: 'help@kettleandfern.example', subject: 'Ticket KF-ABCDE', html: '<p>Ticket</p>', kind: 'support_ticket', ref: 'KF-ABCDE', answer: { ok: true, ticket_id: 'KF-ABCDE' } }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Email the Team', position: [1520, 280], alwaysOutputData: true, onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const ticketAnswer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Ticket Answer', position: [1740, 280], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// What the agent hears back.\nreturn [{ json: $(\'Ticket\').first().json.answer }];\n' } },
  output: [{ ok: true, ticket_id: 'KF-ABCDE', message: 'Ticket opened.' }]
});

const note = sticky(
  '## Kettle 7: Help Tools\nThe help chat\'s two tools. Both look the order up first through **Kettle 1** (order number and email must both match).\n- **lookup**: a plain-English status worked out in code. "Late" means the delivery estimate has passed or tracking hasn\'t moved for 4 days.\n- **ticket**: emails the team a ticket with the order, tracking and the customer\'s words, and returns the ticket number.',
  [], { position: [160, 80], width: 1100, height: 180, color: 7 }
);

export default workflow('kettle-help-tools', 'Kettle 7: Help Tools')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(find)
  .to(isTicket
    .onTrue(ticket.to(send).to(ticketAnswer))
    .onFalse(status))
  .add(note);
