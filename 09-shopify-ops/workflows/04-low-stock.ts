import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'QbQi6BAEGxZmzGyT', cachedResultName: 'Kettle Settings' };
const REPORTS = { __rl: true, mode: 'id', value: 'AyZ17CcwolU182Td', cachedResultName: 'Kettle Reports' };
const STORE_WF = { __rl: true, mode: 'id', value: 'ktlStoreApi00001', cachedResultName: 'Kettle 1: Store API' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ktlSendEmail0006', cachedResultName: 'Kettle 6: Send Email' };

const daily = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every Morning 7:00', position: [200, 300], parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 7, triggerAtMinute: 0 }] } } },
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
  output: [{ key: 'safety_days', value: '7' }]
});

const askInventory = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Inventory Request', position: [660, 400], executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [{ id: 'a', name: 'action', value: 'inventory', type: 'string' }] } } },
  output: [{ action: 'inventory' }]
});

const getInventory = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Inventory', position: [880, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ products: [] }]
});

const askOrders = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Orders Request', position: [1100, 400], executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
    { id: 'a', name: 'action', value: 'orders_since', type: 'string' }, { id: 'd', name: 'days', value: 28, type: 'number' }
  ] } } },
  output: [{ action: 'orders_since', days: 28 }]
});

const getOrders = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Orders', position: [1320, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ orders: [] }]
});

const compute = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Stock Check', position: [1540, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Stock check in code (no AI). For each product: units sold per day over the last 28 days, days of\n' +
        '// stock left, the date it runs out, and whether that is inside the supplier lead time plus a safety\n' +
        '// buffer. Reorder quantity covers the lead time plus N more days of sales, at least the supplier minimum.\n' +
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
        'const products = $(\'Get Inventory\').first().json.products || [];\n' +
        'const orders = $(\'Get Orders\').first().json.orders || [];\n' +
        'const safety = Number(s.safety_days || 7), after = Number(s.cover_days_after_restock || 30);\n' +
        'const sold = {};\n' +
        'for (const o of orders) for (const l of parseJson(o.items_json, [])) sold[l.sku] = (sold[l.sku] || 0) + Number(l.qty || 0);\n' +
        'const today = DateTime.now().setZone(TZ).startOf(\'day\');\n' +
        'const rows = products.map(p => {\n' +
        '  const perDay = (sold[p.sku] || 0) / 28;\n' +
        '  const cover = perDay > 0 ? p.inventory / perDay : Infinity;\n' +
        '  const need = p.lead_time_days + safety;\n' +
        '  const low = cover < need;\n' +
        '  const qty = low ? Math.max(p.min_order_qty || 1, Math.ceil(perDay * (p.lead_time_days + after) - p.inventory)) : 0;\n' +
        '  const runsOut = isFinite(cover) ? today.plus({ days: Math.floor(cover) }) : null;\n' +
        '  const orderBy = runsOut ? runsOut.minus({ days: p.lead_time_days }) : null;\n' +
        '  return { sku: p.sku, title: p.title, inventory: p.inventory, sold_28d: sold[p.sku] || 0, per_day: Math.round(perDay * 10) / 10,\n' +
        '    days_left: isFinite(cover) ? Math.round(cover) : null, lead_time_days: p.lead_time_days, low, reorder_qty: qty, supplier: p.supplier,\n' +
        '    runs_out: runsOut ? runsOut.toISODate() : \'\', order_by: orderBy ? (orderBy < today ? \'today (already late)\' : orderBy.toISODate()) : \'\' };\n' +
        '}).sort((a, b) => (a.days_left ?? 1e9) - (b.days_left ?? 1e9));\n' +
        'const low = rows.filter(r => r.low);\n' +
        'const cell = \'padding:6px 8px;border-bottom:1px solid #ebe6dc;text-align:left;font-family:Helvetica,Arial,sans-serif;font-size:13px\';\n' +
        'const table = \'<table style="border-collapse:collapse;margin:0 0 16px"><tr>\' + [\'Product\', \'In stock\', \'Sells/day\', \'Days left\', \'Lead time\', \'Order by\', \'Reorder\'].map(h => \'<th style="\' + cell + \';color:#8a857a;font-size:12px">\' + h + \'</th>\').join(\'\') + \'</tr>\'\n' +
        '  + low.map(r => \'<tr><td style="\' + cell + \'"><b>\' + esc(r.title) + \'</b><br><span style="color:#8a857a">\' + esc(r.supplier) + \'</span></td><td style="\' + cell + \'">\' + r.inventory + \'</td><td style="\' + cell + \'">\' + r.per_day + \'</td><td style="\' + cell + \';color:#b42318"><b>\' + r.days_left + \'</b></td><td style="\' + cell + \'">\' + r.lead_time_days + \' d</td><td style="\' + cell + \'">\' + esc(/^\\d{4}-/.test(r.order_by) ? day(r.order_by) : r.order_by) + \'</td><td style="\' + cell + \'"><b>\' + r.reorder_qty + \'</b></td></tr>\').join(\'\') + \'</table>\';\n' +
        'const period = today.toISODate();\n' +
        'const html = emailHtml(s.store_name || \'Kettle & Fern\', [\n' +
        '  low.length + \' product\' + (low.length === 1 ? \' is\' : \'s are\') + \' running low. Each will sell out before a new delivery could arrive unless you reorder now (supplier lead time plus \' + safety + \' days\\\' safety).\'\n' +
        '], table + \'<p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8a857a;text-align:left">Based on \' + orders.length + \' orders in the last 28 days. Reorder quantities cover the lead time plus \' + after + \' days of sales, never below the supplier\\\'s minimum.</p>\');\n' +
        'return [{ json: {\n' +
        '  any: low.length > 0,\n' +
        '  email: { to: s.owner_email, subject: \'Low stock: \' + low.map(r => r.title.replace(/ \\d+(g|ml|L)$/, \'\')).join(\', \'), html, kind: \'low_stock\', ref: period },\n' +
        '  report: { kind: \'low_stock\', period, summary: low.length + \' low: \' + low.map(r => r.sku + \' (\' + r.days_left + \' days left)\').join(\', \'), data_json: JSON.stringify(rows), created_at: nowIso() }\n' +
        '} }];\n'
  } },
  output: [{ any: true, email: {}, report: {} }]
});

const saveReport = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Report', position: [1760, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: REPORTS, columns: { mappingMode: 'defineBelow', value: {
    kind: expr('{{ $json.report.kind }}'), period: expr('{{ $json.report.period }}'), summary: expr('{{ $json.report.summary }}'), data_json: expr('{{ $json.report.data_json }}'), created_at: expr('{{ $json.report.created_at }}')
  }, schema: [
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'period', displayName: 'period', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'summary', displayName: 'summary', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'data_json', displayName: 'data_json', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});

const anyLow = ifElse({
  version: 2.2,
  config: {
    name: 'Anything Low?',
    position: [1980, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $('Stock Check').first().json.any }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const emailItem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Email Item', position: [2200, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// The alert email for Send Email.\nreturn [{ json: $(\'Stock Check\').first().json.email }];\n' } },
  output: [{ to: 'hannah@kettleandfern.example', subject: 'Low stock', html: '<p>Low</p>', kind: 'low_stock', ref: '' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Email the Owner', position: [2420, 300], parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Kettle 4: Low Stock\nEvery morning at 7:00, in code (no AI). For every product: units sold per day over 28 days, days of stock left, the day it runs out and the last day to order. It flags anything that will run out before a delivery could arrive (supplier lead time plus a safety buffer) and suggests a reorder quantity: enough for the lead time plus 30 days, never below the supplier\'s minimum. The check is saved in **Kettle Reports**; the owner gets an email only when something is low.',
  [], { position: [160, 40], width: 1300, height: 200, color: 5 }
);

export default workflow('kettle-low-stock', 'Kettle 4: Low Stock')
  .add(daily)
  .to(readSettings)
  .to(askInventory)
  .to(getInventory)
  .to(askOrders)
  .to(getOrders)
  .to(compute)
  .to(saveReport)
  .to(anyLow.onTrue(emailItem.to(send)))
  .add(runNow)
  .to(readSettings)
  .add(note);
