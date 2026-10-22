import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const CUSTOMERS_TABLE = { __rl: true, mode: 'id', value: 'QGkic5oor2SFHsoJ', cachedResultName: 'Honeycrumb Customers' };
const SEND_WF = { __rl: true, mode: 'id', value: 'hcbSendWA0000004', cachedResultName: 'Honeycrumb 4: Send WhatsApp' };

const every15 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every 15 Minutes', position: [200, 300], parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } } },
  output: [{}]
});

const readUnpaid = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Unpaid', position: [420, 300], parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, returnAll: true, filters: { conditions: [{ keyName: 'status', condition: 'eq', keyValue: 'awaiting_payment' }] } } },
  output: [{ order_id: 'HC-7K2Q', phone: '2348010000000', status: 'awaiting_payment', reminder_sent: false }]
});

const readCustomers = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Customers', position: [640, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CUSTOMERS_TABLE, returnAll: true } },
  output: [{ phone: '2348010000000', last_inbound_at: '2026-10-28T10:00:00.000+01:00' }]
});

const due = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Due', position: [860, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// ---- lib-shop.js (included by build.py): prices, carts, zones and delivery rules ----\n' +
        'const SHOP = {\n' +
        '  TZ: "Africa/Lagos",\n' +
        '  OPEN_DAYS: [1, 2, 3, 4, 5, 6], // Monday-Saturday\n' +
        '  CLOSED: ["2026-12-25", "2026-12-26", "2027-01-01"],\n' +
        '  // window label -> start hour\n' +
        '  WINDOWS: {\n' +
        '    delivery: { "10am-1pm": 10, "1pm-4pm": 13, "4pm-6pm": 16 },\n' +
        '    pickup: { "9am-12pm": 9, "12pm-3pm": 12, "3pm-7pm": 15 },\n' +
        '  },\n' +
        '  DAYS_AHEAD: 21,\n' +
        '  MAX_QTY: 50,\n' +
        '  CAKE_MESSAGE_MAX: 30,\n' +
        '  PICKUP: "14 Admiralty Way, Lekki Phase 1, Lagos",\n' +
        '};\n' +
        '\n' +
        'const naira = n => "₦" + String(Math.round(Number(n) || 0)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");\n' +
        'const clean = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\\s+/g, " ").trim();\n' +
        'const parseItems = json => {\n' +
        '  try { const a = JSON.parse(json || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; }\n' +
        '};\n' +
        'const subtotalOf = items => items.reduce((s, i) => s + i.qty * i.unit_ngn, 0);\n' +
        'const itemLine = i => i.qty + " × " + i.name + (i.cake_message ? \' (message: "\' + i.cake_message + \'")\' : "") + " = " + naira(i.qty * i.unit_ngn);\n' +
        'const newId = prefix => prefix + Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");\n' +
        '\n' +
        '// Product by SKU, else by name words (all words of the query must appear).\n' +
        'function findProduct(products, ref) {\n' +
        '  const r = String(ref ?? "").trim();\n' +
        '  if (!r) return null;\n' +
        '  const bySku = products.find(p => p.sku.toLowerCase() === r.toLowerCase());\n' +
        '  if (bySku) return bySku;\n' +
        '  const words = clean(r).split(" ").filter(w => w.length > 1);\n' +
        '  const hits = products.filter(p => words.every(w => clean(p.name + " " + p.sku).includes(w)));\n' +
        '  return hits.length === 1 ? hits[0] : null;\n' +
        '}\n' +
        '\n' +
        '// Delivery zone whose name or alias appears in the customer\'s text.\n' +
        'function matchZone(zones, text) {\n' +
        '  const t = " " + clean(text) + " ";\n' +
        '  let best = null;\n' +
        '  for (const z of zones) {\n' +
        '    const names = [z.area, ...String(z.aliases ?? "").split(",")].map(clean).filter(Boolean);\n' +
        '    for (const n of names) {\n' +
        '      if (t.includes(" " + n + " ") && (!best || n.length > best.len)) best = { zone: z, len: n.length };\n' +
        '    }\n' +
        '  }\n' +
        '  return best ? best.zone : null;\n' +
        '}\n' +
        '\n' +
        'function isOpenDay(d) {\n' +
        '  return SHOP.OPEN_DAYS.includes(d.weekday) && !SHOP.CLOSED.includes(d.toISODate());\n' +
        '}\n' +
        '\n' +
        '// Earliest (day, window) that respects the longest lead time in the cart.\n' +
        'function earliestSlot(leadHours, fulfilment, now) {\n' +
        '  const windows = SHOP.WINDOWS[fulfilment] || SHOP.WINDOWS.delivery;\n' +
        '  const ready = now.plus({ hours: leadHours });\n' +
        '  for (let d = now.startOf("day"); d <= now.startOf("day").plus({ days: SHOP.DAYS_AHEAD }); d = d.plus({ days: 1 })) {\n' +
        '    if (!isOpenDay(d)) continue;\n' +
        '    for (const [label, hour] of Object.entries(windows)) {\n' +
        '      if (d.set({ hour }) >= ready) return { date: d, window: label };\n' +
        '    }\n' +
        '  }\n' +
        '  return null;\n' +
        '}\n' +
        '\n' +
        '// "Thursday 30 October, 1pm-4pm"\n' +
        'const sayDay = d => d.toFormat("cccc d LLLL");\n' +
        '// ---- end lib-shop.js ----\n' +
        '// Unpaid orders: one reminder after 60 minutes (inside the 24-hour window), expire after 24 hours.\n' +
        'const now = DateTime.now().setZone(SHOP.TZ);\n' +
        'const customers = Object.fromEntries($("Read Customers").all().map(i => i.json).filter(c => c.phone).map(c => [c.phone, c]));\n' +
        'const out = [];\n' +
        'for (const o of $("Read Unpaid").all().map(i => i.json).filter(o => o.order_id && o.status === "awaiting_payment")) {\n' +
        '  const age = now.diff(DateTime.fromISO(o.updated_at || o.created_at), "minutes").minutes;\n' +
        '  if (age >= 24 * 60) { out.push({ json: { action: "expire", order_id: o.order_id, phone: o.phone } }); continue; }\n' +
        '  const last = customers[o.phone]?.last_inbound_at ? DateTime.fromISO(customers[o.phone].last_inbound_at) : null;\n' +
        '  const inWindow = Boolean(last && last.isValid && now.diff(last, "hours").hours < 23.5);\n' +
        '  if (age >= 60 && !o.reminder_sent && inWindow) {\n' +
        '    out.push({ json: { action: "remind", order_id: o.order_id, phone: o.phone, url: o.pay_url, button_text: "Pay " + naira(o.total_ngn),\n' +
        '      body: "Hi " + (String(o.customer_name).split(" ")[0] || "there") + ", your order *" + o.order_id + "* is still waiting for payment. Tap below to pay and we\'ll start baking. If you\'d like to change anything, just reply here." } });\n' +
        '  }\n' +
        '}\n' +
        'return out;\n'
  } },
  output: [{ action: 'remind', order_id: 'HC-7K2Q', phone: '2348010000000', url: 'https://checkout.paystack.com/abc', button_text: 'Pay ₦57,000', body: 'Your order is still waiting for payment.' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Remind Or Expire?',
    position: [1080, 300],
    parameters: {
      rules: { values: [
        { outputKey: 'remind', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'remind' }], combinator: 'and' } },
        { outputKey: 'expire', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'expire' }], combinator: 'and' } }
      ] },
      options: {}
    }
  }
});

const markReminded = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Reminded',
    position: [1300, 220],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.order_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: { order_id: expr('{{ $json.order_id }}'), reminder_sent: true }, schema: [
        { id: 'order_id', displayName: 'order_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'reminder_sent', displayName: 'reminder_sent', required: false, defaultMatch: false, display: true, type: 'boolean', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ order_id: 'HC-7K2Q', reminder_sent: true }]
});

const reminderMessage = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Reminder Message',
    position: [1520, 220],
    parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
      { id: 't', name: 'to', value: expr("{{ $('Due').item.json.phone }}"), type: 'string' },
      { id: 'k', name: 'kind', value: 'cta', type: 'string' },
      { id: 'b', name: 'body', value: expr("{{ $('Due').item.json.body }}"), type: 'string' },
      { id: 'u', name: 'url', value: expr("{{ $('Due').item.json.url }}"), type: 'string' },
      { id: 'n', name: 'button_text', value: expr("{{ $('Due').item.json.button_text }}"), type: 'string' },
      { id: 'x', name: 'test', value: false, type: 'boolean' }
    ] } }
  },
  output: [{ to: '2348010000000', kind: 'cta', body: 'Still waiting for payment', url: 'https://checkout.paystack.com/abc', button_text: 'Pay ₦57,000', test: false }]
});

const sendReminder = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Reminder', position: [1740, 220], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'each', options: { waitForSubWorkflow: false } } }
});

const markExpired = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Expired',
    position: [1300, 400],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.order_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: { order_id: expr('{{ $json.order_id }}'), status: 'expired', updated_at: expr('{{ $now.toISO() }}') }, schema: [
        { id: 'order_id', displayName: 'order_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ order_id: 'HC-7K2Q', status: 'expired' }]
});

const note = sticky(
  '## Honeycrumb 7: Reminders\nEvery 15 minutes, for orders still waiting for payment: one friendly reminder with the **Pay** button after an hour (only inside WhatsApp\'s 24-hour window), and expiry after 24 hours so stale carts don\'t pile up.',
  [], { position: [160, 80], width: 900, height: 160, color: 5 }
);

export default workflow('honeycrumb-reminders', 'Honeycrumb 7: Reminders')
  .add(every15)
  .to(readUnpaid)
  .to(readCustomers)
  .to(due)
  .to(which
    .onCase(0, markReminded.to(reminderMessage).to(sendReminder))
    .onCase(1, markExpired))
  .add(note);
