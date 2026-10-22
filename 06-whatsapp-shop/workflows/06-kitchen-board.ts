import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const CUSTOMERS_TABLE = { __rl: true, mode: 'id', value: 'QGkic5oor2SFHsoJ', cachedResultName: 'Honeycrumb Customers' };
const SEND_WF = { __rl: true, mode: 'id', value: 'hcbSendWA0000004', cachedResultName: 'Honeycrumb 4: Send WhatsApp' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const BOARD = "{{ ($('Read Settings').all().find(i => i.json.key === 'kitchen_sheet_id') || { json: {} }).json.value || '' }}";

const everyMinute = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every Minute', position: [200, 300], parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } } },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'kitchen_sheet_id', value: '1abc' }]
});

const boardSet = ifElse({
  version: 2.2,
  config: {
    name: 'Board Set Up?',
    position: [640, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr(BOARD), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const readBoard = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Board',
    position: [860, 240],
    executeOnce: true,
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: { __rl: true, mode: 'id', value: expr(BOARD) }, sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Orders' } },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, order_id: 'HC-7K2Q', status: 'baking' }]
});

const readOrders = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Orders', position: [1080, 240], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, returnAll: true } },
  output: [{ order_id: 'HC-7K2Q', phone: '2348010000000', status: 'paid' }]
});

const readCustomers = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Customers', position: [1300, 240], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CUSTOMERS_TABLE, returnAll: true } },
  output: [{ phone: '2348010000000', last_inbound_at: '2026-10-28T10:00:00.000+01:00' }]
});

const statusChange = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Status Change', position: [1520, 240], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
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
        '// Kitchen board rows whose status differs from the order (staff changed it) -> order update + customer message.\n' +
        '// WhatsApp only allows free-form messages within 24 hours of the customer\'s last message.\n' +
        'const STATUS = {\n' +
        '  baking: "👩‍🍳 Your order {id} is in the oven now!",\n' +
        '  out_for_delivery: "🚚 Your order {id} is on its way! The rider will call you when they\'re close.",\n' +
        '  ready_for_pickup: "🛍️ Your order {id} is ready for pickup at " + SHOP.PICKUP + ".",\n' +
        '  delivered: "✅ Order {id} delivered. Enjoy, and thank you for choosing Honeycrumb! 🧡",\n' +
        '  cancelled: "Your order {id} has been cancelled. Our team will contact you about the refund.",\n' +
        '};\n' +
        'const orders = Object.fromEntries($("Read Orders").all().map(i => i.json).filter(o => o.order_id).map(o => [o.order_id, o]));\n' +
        'const customers = Object.fromEntries($("Read Customers").all().map(i => i.json).filter(c => c.phone).map(c => [c.phone, c]));\n' +
        'const now = DateTime.now().setZone(SHOP.TZ);\n' +
        'const out = [];\n' +
        'for (const r of $("Read Board").all().map(i => i.json)) {\n' +
        '  const status = String(r.status ?? "").trim().toLowerCase().replace(/\\s+/g, "_");\n' +
        '  const o = orders[String(r.order_id ?? "").trim()];\n' +
        '  if (!o || !STATUS[status] || o.status === status) continue;\n' +
        '  const last = customers[o.phone]?.last_inbound_at ? DateTime.fromISO(customers[o.phone].last_inbound_at) : null;\n' +
        '  const inWindow = Boolean(last && last.isValid && now.diff(last, "hours").hours < 23.5);\n' +
        '  out.push({ json: {\n' +
        '    order_id: o.order_id, phone: o.phone, status, in_window: inWindow,\n' +
        '    text: STATUS[status].replace("{id}", o.order_id),\n' +
        '    updated_at: now.toISO(),\n' +
        '  } });\n' +
        '}\n' +
        'return out;\n'
  } },
  output: [{ order_id: 'HC-7K2Q', phone: '2348010000000', status: 'baking', in_window: true, text: 'Your order HC-7K2Q is in the oven now!', updated_at: '2026-10-28T10:00:00.000+01:00' }]
});

const saveStatus = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Status',
    position: [1740, 240],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.order_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { order_id: expr('{{ $json.order_id }}'), status: expr('{{ $json.status }}'), updated_at: expr('{{ $json.updated_at }}') },
        schema: [
          { id: 'order_id', displayName: 'order_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
        ]
      }
    }
  },
  output: [{ order_id: 'HC-7K2Q', status: 'baking' }]
});

const inWindow = ifElse({
  version: 2.2,
  config: {
    name: 'Within 24 Hours?',
    position: [1960, 240],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $('Status Change').item.json.in_window }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const updateMessage = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Update Message',
    position: [2180, 180],
    parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
      { id: 't', name: 'to', value: expr("{{ $('Status Change').item.json.phone }}"), type: 'string' },
      { id: 'k', name: 'kind', value: 'text', type: 'string' },
      { id: 'b', name: 'body', value: expr("{{ $('Status Change').item.json.text }}"), type: 'string' },
      { id: 'x', name: 'test', value: false, type: 'boolean' }
    ] } }
  },
  output: [{ to: '2348010000000', kind: 'text', body: 'Your order is in the oven now!', test: false }]
});

const sendUpdate = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Update', position: [2400, 180], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'each', options: { waitForSubWorkflow: false } } }
});

const note = sticky(
  '## Honeycrumb 6: Kitchen Board\nThe owner runs the day from the **Honeycrumb Kitchen Board** sheet: paid orders arrive there, and staff change the `status` dropdown (baking, out_for_delivery, ready_for_pickup, delivered, cancelled).\n\nEvery minute this compares the board with the orders table; each change is saved and the customer gets a WhatsApp update. WhatsApp only allows free-form messages within 24 hours of the customer\'s last message, so older chats are updated silently (production would use an approved template).',
  [], { position: [160, -20], width: 1000, height: 220, color: 5 }
);

export default workflow('honeycrumb-kitchen-board', 'Honeycrumb 6: Kitchen Board')
  .add(everyMinute)
  .to(readSettings)
  .to(boardSet.onTrue(readBoard.to(readOrders).to(readCustomers).to(statusChange).to(saveStatus).to(inWindow.onTrue(updateMessage.to(sendUpdate)))))
  .add(note);
