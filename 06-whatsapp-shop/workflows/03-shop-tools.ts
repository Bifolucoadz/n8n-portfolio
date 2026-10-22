import { workflow, node, trigger, sticky, ifElse, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const PRODUCTS_TABLE = { __rl: true, mode: 'id', value: 'Z1zpXdhWaw6s43du', cachedResultName: 'Honeycrumb Products' };
const ZONES_TABLE = { __rl: true, mode: 'id', value: 'edO4Fs5LOquec5e1', cachedResultName: 'Honeycrumb Zones' };
const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const CUSTOMERS_TABLE = { __rl: true, mode: 'id', value: 'QGkic5oor2SFHsoJ', cachedResultName: 'Honeycrumb Customers' };
const CHATS_TABLE = { __rl: true, mode: 'id', value: 'pz1RGq7g1nLY7stj', cachedResultName: 'Honeycrumb Chats' };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const PHONE_FILTER = { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr("{{ $('Config').first().json.phone }}") }] };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called by Agent',
    position: [200, 800],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'action', type: 'string' },
          { name: 'phone', type: 'string' },
          { name: 'customer_name', type: 'string' },
          { name: 'turn_id', type: 'string' },
          { name: 'test', type: 'boolean' },
          { name: 'query', type: 'string' },
          { name: 'category', type: 'string' },
          { name: 'sku', type: 'string' },
          { name: 'qty', type: 'number' },
          { name: 'op', type: 'string' },
          { name: 'cake_message', type: 'string' },
          { name: 'area', type: 'string' },
          { name: 'fulfilment', type: 'string' },
          { name: 'address', type: 'string' },
          { name: 'deliver_on', type: 'string' },
          { name: 'window', type: 'string' },
          { name: 'note', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'reason', type: 'string' }
        ]
      }
    }
  },
  output: [{ action: 'search_menu', phone: '2348010000000', query: 'red velvet', test: true }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 800], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'payments', value: 'mock' }]
});

const config = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Config', position: [640, 800], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One tool call from the Honeycrumb agent, plus the shop settings.\n' +
        'const c = $("When Called by Agent").first().json;\n' +
        'const settings = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));\n' +
        'const s = v => String(v ?? "").trim();\n' +
        'return [{\n' +
        '  json: {\n' +
        '    action: s(c.action), phone: s(c.phone).replace(/\\D/g, ""), customer_name: s(c.customer_name), turn_id: s(c.turn_id),\n' +
        '    test: c.test === true || s(c.test) === "true",\n' +
        '    query: s(c.query), category: s(c.category).toLowerCase(), sku: s(c.sku), qty: Number(c.qty ?? 1), op: s(c.op).toLowerCase() || "view",\n' +
        '    cake_message: s(c.cake_message), area: s(c.area), fulfilment: s(c.fulfilment).toLowerCase(), address: s(c.address),\n' +
        '    deliver_on: s(c.deliver_on), window: s(c.window), note: s(c.note), email: s(c.email), reason: s(c.reason),\n' +
        '    settings,\n' +
        '  },\n' +
        '}];\n'
  } },
  output: [{ action: 'search_menu', phone: '2348010000000', query: 'red velvet', op: 'view', settings: { payments: 'mock' } }]
});

const whichAction = switchCase({
  version: 3.2,
  config: {
    name: 'Which Action?',
    position: [860, 800],
    parameters: {
      rules: {
        values: [
          { outputKey: 'menu', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'search_menu' }], combinator: 'and' } },
          { outputKey: 'cart', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'update_cart' }], combinator: 'and' } },
          { outputKey: 'delivery', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'delivery_quote' }], combinator: 'and' } },
          { outputKey: 'checkout', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'checkout' }], combinator: 'and' } },
          { outputKey: 'status', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'order_status' }], combinator: 'and' } },
          { outputKey: 'human', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'request_human' }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'other' }
    }
  }
});

// ---- search_menu ----
const readProducts = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Products', position: [1100, 160], parameters: { resource: 'row', operation: 'get', dataTableId: PRODUCTS_TABLE, returnAll: true } },
  output: [{ sku: 'CK-RV6', name: 'Red Velvet Celebration Cake, 6-inch', category: 'cakes', price_ngn: 38000, lead_hours: 48, available: true }]
});

const searchMenu = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Search Menu', position: [1320, 160], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
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
        '// Menu lines for the agent: by words and/or category, or a category overview when nothing is asked.\n' +
        'const c = $("Config").first().json;\n' +
        'const products = $input.all().map(i => i.json).filter(p => p.sku);\n' +
        'const line = p => p.name + " [" + p.sku + "]: " + naira(p.price_ngn) + ", serves " + p.serves + ", " +\n' +
        '  (p.lead_hours >= 24 ? p.lead_hours + " hours\' notice" : "same day") + ", contains " + p.allergens +\n' +
        '  (p.available ? "" : " (SOLD OUT today)") + ". " + p.description;\n' +
        'const words = clean(c.query).split(" ").filter(w => w.length > 1 && !["the", "and", "for", "you", "have", "any", "do", "of", "a"].includes(w));\n' +
        'let list = products.filter(p => !c.category || p.category === c.category || p.category.startsWith(c.category));\n' +
        'if (words.length) {\n' +
        '  list = list\n' +
        '    .map(p => ({ p, score: words.filter(w => clean([p.name, p.category, p.description, p.allergens, p.sku].join(" ")).includes(w.replace(/s$/, ""))).length }))\n' +
        '    .filter(x => x.score > 0)\n' +
        '    .sort((a, b) => b.score - a.score)\n' +
        '    .map(x => x.p);\n' +
        '}\n' +
        'if (!words.length && !c.category) {\n' +
        '  const cats = [...new Set(products.map(p => p.category))];\n' +
        '  return [{ json: { result: "Menu categories: " + cats.map(cat => {\n' +
        '    const ps = products.filter(p => p.category === cat && p.available);\n' +
        '    return cat + " (" + ps.length + " items, from " + naira(Math.min(...ps.map(p => p.price_ngn))) + ")";\n' +
        '  }).join("; ") + ". Search a category or words for details." } }];\n' +
        '}\n' +
        'if (!list.length) return [{ json: { result: "Nothing on the menu matches \\"" + (c.query || c.category) + "\\". Categories: " + [...new Set(products.map(p => p.category))].join(", ") + "." } }];\n' +
        'return [{ json: { result: list.slice(0, 8).map(line).join("\\n") + "\\nEverything is made in a kitchen that also handles nuts, gluten, dairy and eggs." } }];\n'
  } },
  output: [{ result: 'Red Velvet Celebration Cake, 6-inch [CK-RV6]: ₦38,000' }]
});

// ---- update_cart ----
const readProductsCart = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Products (Cart)', position: [1100, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: PRODUCTS_TABLE, returnAll: true } },
  output: [{ sku: 'CK-RV6', name: 'Red Velvet Celebration Cake, 6-inch', category: 'cakes', price_ngn: 38000, lead_hours: 48, available: true }]
});

const readOrdersCart = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Orders (Cart)', position: [1320, 400], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, filters: PHONE_FILTER, limit: 10, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC' } },
  output: [{ order_id: 'HC-7K2Q', phone: '2348010000000', status: 'cart', items_json: '[]' }]
});

const applyCart = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Apply Cart', position: [1540, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
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
        '// add / set / remove / clear / view on the customer\'s open cart. Prices come from the menu.\n' +
        'const c = $("Config").first().json;\n' +
        'const products = $("Read Products (Cart)").all().map(i => i.json).filter(p => p.sku);\n' +
        'const orders = $input.all().map(i => i.json).filter(o => o.order_id);\n' +
        'const now = DateTime.now().setZone(SHOP.TZ);\n' +
        'const reply = (result, extra = {}) => [{ json: { write: false, result, ...extra } }];\n' +
        'const order = orders.find(o => o.status === "cart") || orders.find(o => o.status === "awaiting_payment");\n' +
        'let items = order ? parseItems(order.items_json) : [];\n' +
        'const notes = [];\n' +
        'const op = ["add", "set", "remove", "clear", "view"].includes(c.op) ? c.op : "view";\n' +
        '\n' +
        'if (op === "add" || op === "set" || op === "remove") {\n' +
        '  const p = findProduct(products, c.sku);\n' +
        '  if (!p) return reply(\'No single menu item matches "\' + c.sku + \'". Call search_menu and use the exact SKU.\');\n' +
        '  if (op !== "remove" && !p.available) return reply(p.name + " is sold out today. Suggest something similar from search_menu.");\n' +
        '  const qty = Math.max(0, Math.min(SHOP.MAX_QTY, Math.round(Number.isFinite(c.qty) ? c.qty : 1)));\n' +
        '  let msg = p.category === "cakes" ? c.cake_message : "";\n' +
        '  if (c.cake_message && p.category !== "cakes") notes.push("Messages can only go on cakes, so none was added.");\n' +
        '  if (msg.length > SHOP.CAKE_MESSAGE_MAX) { msg = msg.slice(0, SHOP.CAKE_MESSAGE_MAX); notes.push(\'Cake message shortened to 30 characters: "\' + msg + \'".\'); }\n' +
        '  const idx = items.findIndex(i => i.sku === p.sku && (op === "remove" || (i.cake_message || "") === msg));\n' +
        '  const fresh = q => ({ sku: p.sku, name: p.name, qty: q, unit_ngn: p.price_ngn, lead_hours: p.lead_hours, cake_message: msg });\n' +
        '  if (op === "add") {\n' +
        '    if (idx >= 0) items[idx].qty = Math.min(SHOP.MAX_QTY, items[idx].qty + (qty || 1));\n' +
        '    else items.push(fresh(qty || 1));\n' +
        '  } else if (op === "set") {\n' +
        '    if (idx >= 0) { if (qty === 0) items.splice(idx, 1); else items[idx].qty = qty; }\n' +
        '    else if (qty > 0) items.push(fresh(qty));\n' +
        '  } else {\n' +
        '    if (idx < 0) return reply(p.name + " isn\'t in the cart.");\n' +
        '    items.splice(idx, 1);\n' +
        '  }\n' +
        '} else if (op === "clear") {\n' +
        '  items = [];\n' +
        '}\n' +
        '\n' +
        'const sub = subtotalOf(items);\n' +
        'const fee = Number(order?.delivery_fee_ngn) || 0;\n' +
        'const summary = items.length\n' +
        '  ? "Cart " + (order?.order_id ?? "(new)") + ":\\n" + items.map(itemLine).join("\\n") + "\\nSubtotal: " + naira(sub) + (fee ? "\\nDelivery: " + naira(fee) + "\\nTotal: " + naira(sub + fee) : "")\n' +
        '  : "The cart is empty.";\n' +
        'if (op === "view") return reply(summary);\n' +
        '\n' +
        'const reverted = order?.status === "awaiting_payment";\n' +
        'const row = {\n' +
        '  order_id: order?.order_id ?? newId("HC-"),\n' +
        '  phone: c.phone,\n' +
        '  customer_name: order?.customer_name || c.customer_name,\n' +
        '  status: "cart",\n' +
        '  items_json: JSON.stringify(items),\n' +
        '  subtotal_ngn: sub,\n' +
        '  delivery_fee_ngn: fee,\n' +
        '  total_ngn: sub + fee,\n' +
        '  fulfilment: order?.fulfilment ?? "",\n' +
        '  area: order?.area ?? "",\n' +
        '  address: order?.address ?? "",\n' +
        '  deliver_on: order?.deliver_on ?? "",\n' +
        '  window: order?.window ?? "",\n' +
        '  note: order?.note ?? "",\n' +
        '  email: order?.email ?? "",\n' +
        '  paystack_ref: "",\n' +
        '  pay_url: "",\n' +
        '  turn_id: c.turn_id,\n' +
        '  reminder_sent: false,\n' +
        '  created_at: order?.created_at || now.toISO(),\n' +
        '  paid_at: "",\n' +
        '  updated_at: now.toISO(),\n' +
        '};\n' +
        'const result = summary.replace("Cart (new)", "Cart " + row.order_id) +\n' +
        '  (notes.length ? "\\n" + notes.join(" ") : "") +\n' +
        '  (reverted ? "\\nThe cart changed after checkout, so the earlier payment link no longer applies. Checkout again for a new link." : "");\n' +
        'return [{ json: { write: true, result, row } }];\n'
  } },
  output: [{ write: true, result: 'Cart HC-7K2Q: 1 × Red Velvet Celebration Cake, 6-inch = ₦38,000', row: { order_id: 'HC-7K2Q', phone: '2348010000000', status: 'cart' } }]
});

const shouldSave = ifElse({
  version: 2.2,
  config: {
    name: 'Cart Changed?',
    position: [1760, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.write }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const saveCart = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Cart',
    position: [1980, 340],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.row.order_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          order_id: expr('{{ $json.row.order_id }}'),
          phone: expr('{{ $json.row.phone }}'),
          customer_name: expr('{{ $json.row.customer_name }}'),
          status: expr('{{ $json.row.status }}'),
          items_json: expr('{{ $json.row.items_json }}'),
          subtotal_ngn: expr('{{ $json.row.subtotal_ngn }}'),
          delivery_fee_ngn: expr('{{ $json.row.delivery_fee_ngn }}'),
          total_ngn: expr('{{ $json.row.total_ngn }}'),
          fulfilment: expr('{{ $json.row.fulfilment }}'),
          area: expr('{{ $json.row.area }}'),
          address: expr('{{ $json.row.address }}'),
          deliver_on: expr('{{ $json.row.deliver_on }}'),
          window: expr('{{ $json.row.window }}'),
          note: expr('{{ $json.row.note }}'),
          email: expr('{{ $json.row.email }}'),
          paystack_ref: expr('{{ $json.row.paystack_ref }}'),
          pay_url: expr('{{ $json.row.pay_url }}'),
          turn_id: expr('{{ $json.row.turn_id }}'),
          reminder_sent: expr('{{ $json.row.reminder_sent }}'),
          created_at: expr('{{ $json.row.created_at }}'),
          paid_at: expr('{{ $json.row.paid_at }}'),
          updated_at: expr('{{ $json.row.updated_at }}')
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
  output: [{ order_id: 'HC-7K2Q' }]
});

const cartResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Cart Result', position: [2200, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'return [{ json: { result: $("Apply Cart").first().json.result } }];\n'
  } },
  output: [{ result: 'Cart HC-7K2Q: 1 × Red Velvet Celebration Cake, 6-inch = ₦38,000' }]
});

// ---- delivery_quote ----
const readZones = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Zones', position: [1100, 620], parameters: { resource: 'row', operation: 'get', dataTableId: ZONES_TABLE, returnAll: true } },
  output: [{ area: 'Lekki Phase 1', aliases: 'lekki', fee_ngn: 2000, eta: '1-2 hours', covered: true }]
});

const deliveryQuote = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Delivery Quote', position: [1320, 620], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
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
        'const c = $("Config").first().json;\n' +
        'const zones = $input.all().map(i => i.json).filter(z => z.area);\n' +
        'const covered = zones.filter(z => z.covered).map(z => z.area + " " + naira(z.fee_ngn)).join("; ");\n' +
        'const z = matchZone(zones, c.area || c.address);\n' +
        'if (!z) return [{ json: { result: \'Area "\' + c.area + \'" not recognised. We deliver to: \' + covered + ". Ask for the nearest of these, or offer pickup at " + SHOP.PICKUP + "." } }];\n' +
        'if (!z.covered) return [{ json: { result: "We don\'t deliver to " + z.area + " yet. Offer pickup at " + SHOP.PICKUP + "." } }];\n' +
        'return [{ json: { result: "Delivery to " + z.area + ": " + naira(z.fee_ngn) + ", usually " + z.eta + " within the chosen window. Windows: 10am-1pm, 1pm-4pm, 4pm-6pm, Monday to Saturday." } }];\n'
  } },
  output: [{ result: 'Delivery to Lekki Phase 1: ₦2,000' }]
});

// ---- checkout ----
const readProductsCheckout = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Products (Checkout)', position: [1100, 860], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: PRODUCTS_TABLE, returnAll: true } },
  output: [{ sku: 'CK-RV6', price_ngn: 38000, lead_hours: 48, available: true }]
});

const readZonesCheckout = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Zones (Checkout)', position: [1320, 860], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: ZONES_TABLE, returnAll: true } },
  output: [{ area: 'Lekki Phase 1', fee_ngn: 2000, covered: true }]
});

const readOrdersCheckout = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Orders (Checkout)', position: [1540, 860], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, filters: PHONE_FILTER, limit: 10, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC' } },
  output: [{ order_id: 'HC-7K2Q', status: 'cart', items_json: '[]' }]
});

const validateCheckout = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Validate Checkout', position: [1760, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
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
        '// Everything checkout needs, checked in code: items and current prices, name, delivery or pickup,\n' +
        '// zone and address, date and window against opening days and the longest lead time in the cart.\n' +
        'const c = $("Config").first().json;\n' +
        'const products = $("Read Products (Checkout)").all().map(i => i.json).filter(p => p.sku);\n' +
        'const zones = $("Read Zones (Checkout)").all().map(i => i.json).filter(z => z.area);\n' +
        'const orders = $input.all().map(i => i.json).filter(o => o.order_id);\n' +
        'const now = DateTime.now().setZone(SHOP.TZ);\n' +
        'const order = orders.find(o => o.status === "cart") || orders.find(o => o.status === "awaiting_payment");\n' +
        'const fail = result => [{ json: { ok: false, result } }];\n' +
        'if (!order) return fail("There is no cart yet. Add items with update_cart first.");\n' +
        'let items = parseItems(order.items_json);\n' +
        'if (!items.length) return fail("The cart is empty. Add items with update_cart first.");\n' +
        '\n' +
        'const problems = [];\n' +
        'items = items.map(i => {\n' +
        '  const p = products.find(x => x.sku === i.sku);\n' +
        '  if (!p || !p.available) { problems.push(i.name + " is no longer available"); return i; }\n' +
        '  return { ...i, name: p.name, unit_ngn: p.price_ngn, lead_hours: p.lead_hours };\n' +
        '});\n' +
        'const name = c.customer_name || order.customer_name;\n' +
        'if (name.length < 2) problems.push("the customer\'s name");\n' +
        'const fulfilment = c.fulfilment.startsWith("pick") ? "pickup" : c.fulfilment.startsWith("deliv") ? "delivery" : "";\n' +
        'if (!fulfilment) problems.push("delivery or pickup");\n' +
        'let zone = null;\n' +
        'if (fulfilment === "delivery") {\n' +
        '  zone = matchZone(zones, c.area + " " + c.address);\n' +
        '  if (!zone) problems.push("a delivery area we recognise (use delivery_quote)");\n' +
        '  else if (!zone.covered) problems.push("a covered delivery area (" + zone.area + " is not covered; offer pickup)");\n' +
        '  if (c.address.length < 8) problems.push("the full delivery address with a landmark");\n' +
        '}\n' +
        'const lead = Math.max(...items.map(i => Number(i.lead_hours) || 0));\n' +
        'const windows = SHOP.WINDOWS[fulfilment || "delivery"];\n' +
        'const label = Object.keys(windows).find(k => k.replace(/\\s/g, "") === c.window.toLowerCase().replace(/\\s/g, ""));\n' +
        'const day = DateTime.fromISO(c.deliver_on.slice(0, 10), { zone: SHOP.TZ });\n' +
        'const first = earliestSlot(lead, fulfilment || "delivery", now);\n' +
        'const firstText = first ? sayDay(first.date) + ", " + first.window : "none in the next three weeks";\n' +
        'if (!day.isValid) problems.push("the " + (fulfilment || "delivery") + " date (earliest possible: " + firstText + ")");\n' +
        'if (!label) problems.push("a window: " + Object.keys(windows).join(", "));\n' +
        'if (problems.length) return fail("Can\'t check out yet. Still need: " + problems.join("; ") + ".");\n' +
        '\n' +
        'const start = day.set({ hour: windows[label], minute: 0, second: 0, millisecond: 0 });\n' +
        'if (!isOpenDay(day)) return fail("We\'re closed on " + sayDay(day) + " (we bake Monday to Saturday). Earliest possible: " + firstText + ".");\n' +
        'if (start < now.plus({ hours: lead })) return fail("Too soon: this order needs " + lead + " hours\' notice. Earliest possible: " + firstText + ".");\n' +
        'if (day > now.startOf("day").plus({ days: SHOP.DAYS_AHEAD })) return fail("We take orders up to " + SHOP.DAYS_AHEAD + " days ahead.");\n' +
        '\n' +
        'const sub = subtotalOf(items);\n' +
        'const fee = fulfilment === "delivery" ? Number(zone.fee_ngn) : 0;\n' +
        'const total = sub + fee;\n' +
        'const email = /^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$/i.test(c.email) ? c.email : "wa" + c.phone + "@customers.honeycrumb.example";\n' +
        'const reference = order.order_id + "-" + now.toFormat("HHmmss");\n' +
        'return [{\n' +
        '  json: {\n' +
        '    ok: true,\n' +
        '    mode: c.settings.payments === "paystack" ? "paystack" : "mock",\n' +
        '    row: {\n' +
        '      order_id: order.order_id, phone: c.phone, customer_name: name, status: "awaiting_payment",\n' +
        '      items_json: JSON.stringify(items), subtotal_ngn: sub, delivery_fee_ngn: fee, total_ngn: total,\n' +
        '      fulfilment, area: zone ? zone.area : "", address: fulfilment === "delivery" ? c.address : SHOP.PICKUP,\n' +
        '      deliver_on: day.toISODate(), window: label, note: c.note || order.note || "", email,\n' +
        '      paystack_ref: reference, pay_url: "", turn_id: c.turn_id, reminder_sent: false,\n' +
        '      created_at: order.created_at || now.toISO(), paid_at: "", updated_at: now.toISO(),\n' +
        '    },\n' +
        '    paystack: {\n' +
        '      email, amount: total * 100, currency: "NGN", reference,\n' +
        '      channels: ["card", "bank_transfer", "ussd", "bank"],\n' +
        '      metadata: { order_id: order.order_id, phone: c.phone, custom_fields: [{ display_name: "Order", variable_name: "order_id", value: order.order_id }] },\n' +
        '    },\n' +
        '  },\n' +
        '}];\n'
  } },
  output: [{ ok: true, mode: 'mock', row: { order_id: 'HC-7K2Q', total_ngn: 40000 }, paystack: { email: 'a@b.co', amount: 4000000 } }]
});

const checkoutOk = ifElse({
  version: 2.2,
  config: {
    name: 'Ready To Pay?',
    position: [1980, 860],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const usePaystack = ifElse({
  version: 2.2,
  config: {
    name: 'Paystack Mode?',
    position: [2200, 800],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.mode }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'paystack' }], combinator: 'and' } }
  }
});

const paystackInit = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Paystack Initialize',
    position: [2420, 740],
    onError: 'continueRegularOutput',
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1500,
    parameters: {
      method: 'POST',
      url: 'https://api.paystack.co/transaction/initialize',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.paystack) }}'),
      options: { timeout: 15000 }
    },
    credentials: { httpHeaderAuth: newCredential('Paystack Test') }
  },
  output: [{ status: true, data: { authorization_url: 'https://checkout.paystack.com/abc', reference: 'HC-7K2Q-101500' } }]
});

const attachPayment = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Attach Payment', position: [2640, 800], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Paystack\'s authorization_url (or a mock link before the Paystack key exists) goes on the order.\n' +
        'const v = $("Validate Checkout").first().json;\n' +
        'const res = $input.first().json;\n' +
        'const url = v.mode === "paystack" ? res?.data?.authorization_url : "https://checkout.paystack.com/mock-" + v.row.paystack_ref.toLowerCase();\n' +
        'const ok = Boolean(url);\n' +
        'return [{ json: { ...v.row, status: ok ? "awaiting_payment" : "cart", pay_url: url || "", paystack_ref: ok ? (res?.data?.reference || v.row.paystack_ref) : "", _ok: ok, _error: ok ? "" : String(res?.message || res?.error?.message || "no link returned").slice(0, 200) } }];\n'
  } },
  output: [{ order_id: 'HC-7K2Q', status: 'awaiting_payment', pay_url: 'https://checkout.paystack.com/abc', _ok: true }]
});

const saveCheckout = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Checkout',
    position: [2860, 800],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.order_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          order_id: expr('{{ $json.order_id }}'),
          phone: expr('{{ $json.phone }}'),
          customer_name: expr('{{ $json.customer_name }}'),
          status: expr('{{ $json.status }}'),
          items_json: expr('{{ $json.items_json }}'),
          subtotal_ngn: expr('{{ $json.subtotal_ngn }}'),
          delivery_fee_ngn: expr('{{ $json.delivery_fee_ngn }}'),
          total_ngn: expr('{{ $json.total_ngn }}'),
          fulfilment: expr('{{ $json.fulfilment }}'),
          area: expr('{{ $json.area }}'),
          address: expr('{{ $json.address }}'),
          deliver_on: expr('{{ $json.deliver_on }}'),
          window: expr('{{ $json.window }}'),
          note: expr('{{ $json.note }}'),
          email: expr('{{ $json.email }}'),
          paystack_ref: expr('{{ $json.paystack_ref }}'),
          pay_url: expr('{{ $json.pay_url }}'),
          turn_id: expr('{{ $json.turn_id }}'),
          reminder_sent: expr('{{ $json.reminder_sent }}'),
          created_at: expr('{{ $json.created_at }}'),
          paid_at: expr('{{ $json.paid_at }}'),
          updated_at: expr('{{ $json.updated_at }}')
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
  output: [{ order_id: 'HC-7K2Q' }]
});

const checkoutResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Checkout Result', position: [3080, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
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
        'const v = $("Validate Checkout").first().json;\n' +
        'if (!v.ok) return [{ json: { result: v.result } }];\n' +
        'const o = $("Attach Payment").first().json;\n' +
        'if (!o._ok) return [{ json: { result: "The payment link couldn\'t be created (" + o._error + "). Apologise and use request_human so the team can help." } }];\n' +
        'const items = parseItems(o.items_json);\n' +
        'return [{\n' +
        '  json: {\n' +
        '    result: "Order " + o.order_id + " is ready for payment. " + items.map(itemLine).join("; ") +\n' +
        '      (o.fulfilment === "delivery" ? "; delivery to " + o.area + " " + naira(o.delivery_fee_ngn) : "; pickup at " + SHOP.PICKUP) +\n' +
        '      ". Total " + naira(o.total_ngn) + ". " + (o.fulfilment === "delivery" ? "Delivery" : "Pickup") + " on " + sayDay(DateTime.fromISO(o.deliver_on, { zone: SHOP.TZ })) + ", " + o.window + "." +\n' +
        '      " A Pay button for this amount is sent automatically under your reply; don\'t paste the link. The order starts once payment is confirmed.",\n' +
        '  },\n' +
        '}];\n'
  } },
  output: [{ result: 'Order HC-7K2Q is ready for payment.' }]
});

// ---- order_status ----
const readOrdersStatus = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Orders (Status)', position: [1100, 1080], alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, filters: PHONE_FILTER, limit: 10, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC' } },
  output: [{ order_id: 'HC-7K2Q', status: 'paid', total_ngn: 40000 }]
});

const orderStatus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Order Status', position: [1320, 1080], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
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
        'const orders = $input.all().map(i => i.json).filter(o => o.order_id && o.status !== "cart");\n' +
        'const words = { awaiting_payment: "waiting for payment", paid: "paid, queued for baking", baking: "being baked", out_for_delivery: "out for delivery", ready_for_pickup: "ready for pickup", delivered: "delivered", cancelled: "cancelled", expired: "expired (not paid in time)" };\n' +
        'if (!orders.length) return [{ json: { result: "This customer has no placed orders yet." } }];\n' +
        'const lines = orders.slice(0, 3).map(o => o.order_id + ": " + (words[o.status] || o.status) + ", " + naira(o.total_ngn) + ", " +\n' +
        '  (o.fulfilment === "delivery" ? "delivery to " + o.area : "pickup") + " on " + (o.deliver_on ? sayDay(DateTime.fromISO(o.deliver_on, { zone: SHOP.TZ })) : "?") + ", " + o.window + ".");\n' +
        'return [{ json: { result: lines.join("\\n") } }];\n'
  } },
  output: [{ result: 'HC-7K2Q: paid, queued for baking' }]
});

// ---- request_human ----
const readChats = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Recent Chats', position: [1100, 1300], alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CHATS_TABLE, filters: PHONE_FILTER, limit: 6, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC' } },
  output: [{ phone: '2348010000000', role: 'user', text: 'I want to speak to someone' }]
});

const handoff = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Handoff', position: [1320, 1300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Pause the bot in this chat for 2 hours and tell the owner, with the last few messages.\n' +
        'const c = $("Config").first().json;\n' +
        'const now = DateTime.now().setZone("Africa/Lagos");\n' +
        'const chats = $input.all().map(i => i.json).filter(m => m.text).reverse().slice(-6);\n' +
        'const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");\n' +
        'const text = "🙋 <b>Customer wants a person</b>\\n" + esc(c.customer_name || "Customer") + ", +" + esc(c.phone) +\n' +
        '  "\\nReason: " + esc(c.reason || "not given") + "\\n\\n" +\n' +
        '  chats.map(m => (m.role === "user" ? "👤 " : "🤖 ") + esc(String(m.text).slice(0, 300))).join("\\n") +\n' +
        '  "\\n\\n<i>The bot stays quiet in this chat until " + now.plus({ hours: 2 }).toFormat("h:mm a") + ". Reply from the WhatsApp Business inbox.</i>";\n' +
        'return [{ json: { phone: c.phone, name: c.customer_name, handoff_until: now.plus({ hours: 2 }).toISO(), chat_id: c.settings.owner_chat_id, telegram: text } }];\n'
  } },
  output: [{ phone: '2348010000000', handoff_until: '2026-10-28T12:00:00.000+01:00', chat_id: '42', telegram: 'Customer wants a person' }]
});

const saveHandoff = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Pause Bot',
    position: [1540, 1300],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: CUSTOMERS_TABLE,
      filters: { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr('{{ $json.phone }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { phone: expr('{{ $json.phone }}'), handoff_until: expr('{{ $json.handoff_until }}') },
        schema: [
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'handoff_until', displayName: 'handoff_until', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
        ]
      }
    }
  },
  output: [{ phone: '2348010000000' }]
});

const ownerSet = ifElse({
  version: 2.2,
  config: {
    name: 'Owner Chat Set?',
    position: [1760, 1300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $('Handoff').first().json.chat_id }}"), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const alertOwner = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Alert Owner',
    position: [1980, 1240],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message', operation: 'sendMessage',
      chatId: expr("{{ $('Handoff').first().json.chat_id }}"),
      text: expr("{{ $('Handoff').first().json.telegram }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const handoffResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Handoff Result', position: [2200, 1300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'return [{ json: { result: "Done: a team member has been alerted and will reply in this chat shortly (the assistant pauses here for 2 hours). Tell the customer that, kindly and briefly." } }];\n'
  } },
  output: [{ result: 'Done: a team member has been alerted.' }]
});

const unknownAction = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Unknown Action', position: [1100, 1500], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        'return [{ json: { result: "Unknown action." } }];\n'
  } },
  output: [{ result: 'Unknown action.' }]
});

const note = sticky(
  '## Honeycrumb 3: Shop Tools\nThe agent\'s tools, one `action` each. All money and rules are code (`lib-shop.js`): prices are read from **Honeycrumb Products** every time, totals are computed here, delivery fees come from **Honeycrumb Zones**, and checkout checks name, address, opening days, windows and the longest lead time in the cart before it creates the Paystack link.\n\nOne open cart per phone in **Honeycrumb Orders**. Changing the cart after checkout drops the old payment link. `payments = mock` in Settings fakes the link for tests before the Paystack key exists.',
  [], { position: [160, -60], width: 1100, height: 220, color: 5 }
);

export default workflow('honeycrumb-shop-tools', 'Honeycrumb 3: Shop Tools')
  .add(whenCalled)
  .to(readSettings)
  .to(config)
  .to(whichAction
    .onCase(0, readProducts.to(searchMenu))
    .onCase(1, readProductsCart.to(readOrdersCart).to(applyCart).to(shouldSave
      .onTrue(saveCart.to(cartResult))
      .onFalse(cartResult)))
    .onCase(2, readZones.to(deliveryQuote))
    .onCase(3, readProductsCheckout.to(readZonesCheckout).to(readOrdersCheckout).to(validateCheckout).to(checkoutOk
      .onTrue(usePaystack
        .onTrue(paystackInit.to(attachPayment))
        .onFalse(attachPayment))
      .onFalse(checkoutResult)))
    .onCase(4, readOrdersStatus.to(orderStatus))
    .onCase(5, readChats.to(handoff).to(saveHandoff).to(ownerSet.onTrue(alertOwner.to(handoffResult)).onFalse(handoffResult)))
    .onCase(6, unknownAction))
  .add(attachPayment)
  .to(saveCheckout)
  .to(checkoutResult)
  .add(note);
