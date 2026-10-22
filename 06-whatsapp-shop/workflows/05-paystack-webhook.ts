import { workflow, node, trigger, sticky, ifElse, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const SEND_WF = { __rl: true, mode: 'id', value: 'hcbSendWA0000004', cachedResultName: 'Honeycrumb 4: Send WhatsApp' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const OWNER = "{{ ($('Read Settings').all().find(i => i.json.key === 'owner_chat_id') || { json: {} }).json.value || '' }}";
const BOARD = "{{ ($('Read Settings').all().find(i => i.json.key === 'kitchen_sheet_id') || { json: {} }).json.value }}";

const event = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Paystack Event', position: [200, 400], parameters: { httpMethod: 'POST', path: 'honeycrumb/paystack', responseMode: 'onReceived', options: { responseCode: 200 } } },
  output: [{ body: { event: 'charge.success', data: { reference: 'HC-7K2Q-141500', amount: 5700000, currency: 'NGN', status: 'success' } } }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'owner_chat_id', value: '42' }]
});

const checkEvent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Event', position: [640, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Paystack webhook: only charge.success matters, and only as a hint. The payment is confirmed\n' +
        '// with Paystack\'s verify API next, so a forged webhook can\'t mark an order paid.\n' +
        'const b = $("Paystack Event").first().json.body ?? {};\n' +
        'if (b.event !== "charge.success" || !b.data?.reference) return [];\n' +
        'return [{ json: { reference: String(b.data.reference) } }];\n'
  } },
  output: [{ reference: 'HC-7K2Q-141500' }]
});

const verify = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Verify Payment',
    position: [860, 400],
    onError: 'continueRegularOutput',
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: {
      method: 'GET',
      url: expr('https://api.paystack.co/transaction/verify/{{ encodeURIComponent($json.reference) }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: { timeout: 15000 }
    },
    credentials: { httpHeaderAuth: newCredential('Paystack Test') }
  },
  output: [{ status: true, data: { status: 'success', amount: 5700000, currency: 'NGN', reference: 'HC-7K2Q-141500' } }]
});

const findOrder = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Find Order',
    position: [1080, 400],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, limit: 1, filters: { conditions: [{ keyName: 'paystack_ref', condition: 'eq', keyValue: expr("{{ $('Check Event').first().json.reference }}") }] } }
  },
  output: [{ order_id: 'HC-7K2Q', status: 'awaiting_payment', total_ngn: 57000 }]
});

const decide = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Decide', position: [1300, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
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
        '// Verified transaction + our order -> paid, duplicate, or mismatch.\n' +
        'const ref = $("Check Event").first().json.reference;\n' +
        'const v = $("Verify Payment").first().json;\n' +
        'const order = $input.all().map(i => i.json).find(o => o && o.order_id);\n' +
        'const tx = v?.data ?? {};\n' +
        'const now = DateTime.now().setZone(SHOP.TZ);\n' +
        'const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");\n' +
        'if (!order) return [{ json: { action: "alert", text: "⚠️ Paystack payment " + esc(ref) + " (" + naira((tx.amount || 0) / 100) + ") doesn\'t match any open order. Check the Paystack dashboard." } }];\n' +
        'if (order.status !== "awaiting_payment") return [{ json: { action: "ignore", reason: "order already " + order.status } }];\n' +
        'const okTx = v?.status === true && tx.status === "success" && tx.currency === "NGN" && Number(tx.amount) === Math.round(Number(order.total_ngn) * 100);\n' +
        'if (!okTx) return [{ json: { action: "alert", text: "⚠️ Payment for " + esc(order.order_id) + " didn\'t verify: Paystack says " + esc(tx.status) + ", " + naira((tx.amount || 0) / 100) + " vs order total " + naira(order.total_ngn) + ". Not marked paid." } }];\n' +
        'const items = parseItems(order.items_json);\n' +
        'const when = sayDay(DateTime.fromISO(order.deliver_on, { zone: SHOP.TZ })) + ", " + order.window;\n' +
        'return [{\n' +
        '  json: {\n' +
        '    action: "paid",\n' +
        '    order: { ...order, status: "paid", paid_at: now.toISO(), updated_at: now.toISO() },\n' +
        '    customer_text: "Payment received, thank you " + (order.customer_name.split(" ")[0] || "") + "! 🎉\\n\\n" +\n' +
        '      "*Order " + order.order_id + "* is confirmed:\\n" + items.map(i => "• " + i.qty + " × " + i.name + (i.cake_message ? \' ("\' + i.cake_message + \'")\' : "")).join("\\n") +\n' +
        '      "\\n\\n" + (order.fulfilment === "delivery" ? "🚚 Delivery " + when + " to " + order.address : "🛍️ Pickup " + when + " at " + SHOP.PICKUP) +\n' +
        '      "\\nTotal paid: " + naira(order.total_ngn) + "\\n\\nWe\'ll message you here when it\'s on its way.",\n' +
        '    owner_text: "🧁 <b>New paid order " + esc(order.order_id) + "</b> · " + naira(order.total_ngn) + "\\n" +\n' +
        '      esc(order.customer_name) + ", +" + esc(order.phone) + "\\n" + items.map(i => "• " + i.qty + " × " + esc(i.name) + (i.cake_message ? \' ("\' + esc(i.cake_message) + \'")\' : "")).join("\\n") +\n' +
        '      "\\n" + (order.fulfilment === "delivery" ? "🚚 " + esc(when) + ", " + esc(order.area) + ": " + esc(order.address) : "🛍️ Pickup " + esc(when)) + (order.note ? "\\n📝 " + esc(order.note) : ""),\n' +
        '    board_row: {\n' +
        '      order_id: order.order_id, status: "paid", deliver_on: order.deliver_on, window: order.window,\n' +
        '      fulfilment: order.fulfilment, area: order.area, address: order.address, customer: order.customer_name, phone: "+" + order.phone,\n' +
        '      items: items.map(i => i.qty + " × " + i.name + (i.cake_message ? \' ("\' + i.cake_message + \'")\' : "")).join("; "),\n' +
        '      total_ngn: String(order.total_ngn), note: order.note, paid_at: now.toFormat("yyyy-MM-dd HH:mm"),\n' +
        '    },\n' +
        '  },\n' +
        '}];\n'
  } },
  output: [{ action: 'paid', order: { order_id: 'HC-7K2Q', status: 'paid' }, customer_text: 'Payment received', owner_text: 'New paid order', board_row: { order_id: 'HC-7K2Q' } }]
});

const whatNext = switchCase({
  version: 3.2,
  config: {
    name: 'What Next?',
    position: [1520, 400],
    parameters: {
      rules: { values: [
        { outputKey: 'paid', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'paid' }], combinator: 'and' } },
        { outputKey: 'alert', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'alert' }], combinator: 'and' } }
      ] },
      options: {}
    }
  }
});

const markPaid = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Paid',
    position: [1740, 300],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.order.order_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          order_id: expr('{{ $json.order.order_id }}'),
          phone: expr('{{ $json.order.phone }}'),
          customer_name: expr('{{ $json.order.customer_name }}'),
          status: expr('{{ $json.order.status }}'),
          items_json: expr('{{ $json.order.items_json }}'),
          subtotal_ngn: expr('{{ $json.order.subtotal_ngn }}'),
          delivery_fee_ngn: expr('{{ $json.order.delivery_fee_ngn }}'),
          total_ngn: expr('{{ $json.order.total_ngn }}'),
          fulfilment: expr('{{ $json.order.fulfilment }}'),
          area: expr('{{ $json.order.area }}'),
          address: expr('{{ $json.order.address }}'),
          deliver_on: expr('{{ $json.order.deliver_on }}'),
          window: expr('{{ $json.order.window }}'),
          note: expr('{{ $json.order.note }}'),
          email: expr('{{ $json.order.email }}'),
          paystack_ref: expr('{{ $json.order.paystack_ref }}'),
          pay_url: expr('{{ $json.order.pay_url }}'),
          turn_id: expr('{{ $json.order.turn_id }}'),
          reminder_sent: expr('{{ $json.order.reminder_sent }}'),
          created_at: expr('{{ $json.order.created_at }}'),
          paid_at: expr('{{ $json.order.paid_at }}'),
          updated_at: expr('{{ $json.order.updated_at }}')
        },
        schema: [
          { id: 'order_id', displayName: 'order_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'customer_name', displayName: 'customer_name', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'items_json', displayName: 'items_json', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'subtotal_ngn', displayName: 'subtotal_ngn', required: false, defaultMatch: false, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'delivery_fee_ngn', displayName: 'delivery_fee_ngn', required: false, defaultMatch: false, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'total_ngn', displayName: 'total_ngn', required: false, defaultMatch: false, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'fulfilment', displayName: 'fulfilment', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'area', displayName: 'area', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'address', displayName: 'address', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'deliver_on', displayName: 'deliver_on', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'window', displayName: 'window', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'paystack_ref', displayName: 'paystack_ref', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'pay_url', displayName: 'pay_url', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'turn_id', displayName: 'turn_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'reminder_sent', displayName: 'reminder_sent', required: false, defaultMatch: false, display: true, type: 'boolean', readOnly: false, removed: false },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'paid_at', displayName: 'paid_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
        ]
      }
    }
  },
  output: [{ order_id: 'HC-7K2Q', status: 'paid' }]
});

const confirmMessage = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Confirmation Message',
    position: [1960, 300],
    parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
      { id: 't', name: 'to', value: expr("{{ $('Decide').first().json.order.phone }}"), type: 'string' },
      { id: 'k', name: 'kind', value: 'text', type: 'string' },
      { id: 'b', name: 'body', value: expr("{{ $('Decide').first().json.customer_text }}"), type: 'string' },
      { id: 'x', name: 'test', value: false, type: 'boolean' }
    ] } }
  },
  output: [{ to: '2348010000000', kind: 'text', body: 'Payment received', test: false }]
});

const sendConfirmation = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Confirmation', position: [2180, 300], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: false } } }
});

const addToBoard = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add To Kitchen Board',
    position: [2400, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'sheet', operation: 'append',
      documentId: { __rl: true, mode: 'id', value: expr(BOARD) },
      sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Orders' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          order_id: expr("{{ $('Decide').first().json.board_row.order_id }}"),
          status: expr("{{ $('Decide').first().json.board_row.status }}"),
          deliver_on: expr("{{ $('Decide').first().json.board_row.deliver_on }}"),
          window: expr("{{ $('Decide').first().json.board_row.window }}"),
          fulfilment: expr("{{ $('Decide').first().json.board_row.fulfilment }}"),
          area: expr("{{ $('Decide').first().json.board_row.area }}"),
          address: expr("{{ $('Decide').first().json.board_row.address }}"),
          customer: expr("{{ $('Decide').first().json.board_row.customer }}"),
          phone: expr("{{ $('Decide').first().json.board_row.phone }}"),
          items: expr("{{ $('Decide').first().json.board_row.items }}"),
          total_ngn: expr("{{ $('Decide').first().json.board_row.total_ngn }}"),
          note: expr("{{ $('Decide').first().json.board_row.note }}"),
          paid_at: expr("{{ $('Decide').first().json.board_row.paid_at }}")
        },
        schema: [
          { id: 'order_id', displayName: 'order_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'deliver_on', displayName: 'deliver_on', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'window', displayName: 'window', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'fulfilment', displayName: 'fulfilment', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'area', displayName: 'area', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'address', displayName: 'address', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'customer', displayName: 'customer', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'items', displayName: 'items', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'total_ngn', displayName: 'total_ngn', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'paid_at', displayName: 'paid_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true }
    },
    credentials: SHEETS_CRED
  },
  output: [{ order_id: 'HC-7K2Q' }]
});

const ownerSetPaid = ifElse({
  version: 2.2,
  config: {
    name: 'Owner Chat Set?',
    position: [2620, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr(OWNER), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const alertPaid = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'New Order Alert',
    position: [2840, 240],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: { resource: 'message', operation: 'sendMessage', chatId: expr(OWNER), text: expr("{{ $('Decide').first().json.owner_text }}"), additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true } },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const ownerSetAlert = ifElse({
  version: 2.2,
  config: {
    name: 'Owner Chat Set? (problem)',
    position: [1740, 520],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr(OWNER), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const alertProblem = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Payment Problem Alert',
    position: [1960, 520],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: { resource: 'message', operation: 'sendMessage', chatId: expr(OWNER), text: expr('{{ $json.text }}'), additionalFields: { appendAttribution: false, parse_mode: 'HTML' } },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## Honeycrumb 5: Paystack Webhook\n`POST /webhook/honeycrumb/paystack` (set as the Test Webhook URL in Paystack). The webhook is only a hint: every `charge.success` is re-checked with Paystack\'s **verify** API, and the order is marked paid only if the status is success, the currency is NGN and the amount matches the order total to the kobo. Duplicates are ignored.\n\nPaid: order updated, customer confirmation on WhatsApp, a row on the **kitchen board**, and a Telegram alert to the owner. Anything that doesn\'t match: owner alert, nothing marked paid.',
  [], { position: [160, 80], width: 1000, height: 220, color: 5 }
);

export default workflow('honeycrumb-paystack-webhook', 'Honeycrumb 5: Paystack Webhook')
  .add(event)
  .to(readSettings)
  .to(checkEvent)
  .to(verify)
  .to(findOrder)
  .to(decide)
  .to(whatNext
    .onCase(0, markPaid.to(confirmMessage).to(sendConfirmation).to(addToBoard).to(ownerSetPaid.onTrue(alertPaid)))
    .onCase(1, ownerSetAlert.onTrue(alertProblem)))
  .add(note);
