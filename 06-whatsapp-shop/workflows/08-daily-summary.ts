import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };

const nightly = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every Night 9 pm', position: [200, 300], parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 0 21 * * *' }] } } },
  output: [{}]
});

const sendNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'owner_chat_id', value: '42' }]
});

const readOrders = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Orders', position: [640, 400], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, returnAll: true } },
  output: [{ order_id: 'HC-7K2Q', status: 'paid', total_ngn: 57000, paid_at: '2026-10-28T10:00:00.000+01:00' }]
});

const buildSummary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Summary', position: [860, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
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
        'const now = DateTime.now().setZone(SHOP.TZ);\n' +
        'const today = now.toISODate();\n' +
        'const tomorrow = now.plus({ days: 1 }).toISODate();\n' +
        'const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        'const orders = $("Read Orders").all().map(i => i.json).filter(o => o.order_id);\n' +
        'const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");\n' +
        'const paidToday = orders.filter(o => o.paid_at && DateTime.fromISO(o.paid_at).setZone(SHOP.TZ).toISODate() === today);\n' +
        'const revenue = paidToday.reduce((s, o) => s + Number(o.total_ngn || 0), 0);\n' +
        'const counts = {};\n' +
        'for (const o of paidToday) for (const i of parseItems(o.items_json)) counts[i.name] = (counts[i.name] || 0) + i.qty;\n' +
        'const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);\n' +
        'const unpaid = orders.filter(o => o.status === "awaiting_payment");\n' +
        'const tmr = orders.filter(o => o.deliver_on === tomorrow && ["paid", "baking"].includes(o.status))\n' +
        '  .sort((a, b) => String(a.window).localeCompare(String(b.window)));\n' +
        'const lines = [\n' +
        '  "🍰 <b>Honeycrumb today</b> (" + now.toFormat("ccc d LLL") + ")",\n' +
        '  "",\n' +
        '  "Paid orders: <b>" + paidToday.length + "</b> · revenue <b>" + naira(revenue) + "</b>",\n' +
        '  top.length ? "Best sellers: " + top.map(([n, q]) => esc(n) + " ×" + q).join(", ") : "Best sellers: none yet",\n' +
        '  "Waiting for payment: " + unpaid.length,\n' +
        '  "",\n' +
        '  "<b>Tomorrow (" + DateTime.fromISO(tomorrow).toFormat("ccc d LLL") + ")</b>: " + (tmr.length ? tmr.length + " order" + (tmr.length > 1 ? "s" : "") : "nothing scheduled"),\n' +
        '  ...tmr.map(o => "• " + esc(o.window) + " " + esc(o.order_id) + " " + (o.fulfilment === "delivery" ? "🚚 " + esc(o.area) : "🛍️ pickup") + ": " + parseItems(o.items_json).map(i => i.qty + "× " + esc(i.name)).join(", ")),\n' +
        '];\n' +
        'return [{ json: { chat_id: settings.owner_chat_id, text: lines.join("\\n") } }];\n'
  } },
  output: [{ chat_id: '42', text: 'Honeycrumb today' }]
});

const chatSet = ifElse({
  version: 2.2,
  config: {
    name: 'Owner Chat Set?',
    position: [1080, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.chat_id }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const send = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Summary',
    position: [1300, 340],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    parameters: { resource: 'message', operation: 'sendMessage', chatId: expr('{{ $json.chat_id }}'), text: expr('{{ $json.text }}'), additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true } },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## Honeycrumb 8: Daily Summary\n9 pm Lagos time (or **Send Now**): paid orders and revenue today, best sellers, orders still waiting for payment, and tomorrow\'s bake and delivery list, on the owner\'s Telegram.',
  [], { position: [160, 120], width: 760, height: 160, color: 5 }
);

export default workflow('honeycrumb-daily-summary', 'Honeycrumb 8: Daily Summary')
  .add(nightly)
  .to(readSettings)
  .to(readOrders)
  .to(buildSummary)
  .to(chatSet.onTrue(send))
  .add(sendNow)
  .to(readSettings)
  .add(note);
