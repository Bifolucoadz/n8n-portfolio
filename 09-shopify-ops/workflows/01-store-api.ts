import { workflow, node, trigger, sticky, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'QbQi6BAEGxZmzGyT', cachedResultName: 'Kettle Settings' };
const CHECKOUTS = { __rl: true, mode: 'id', value: 'XluYD3lO9tEeAhBS', cachedResultName: 'Kettle Checkouts' };
const REVIEWS = { __rl: true, mode: 'id', value: 'D2bbJsHicEHPMugS', cachedResultName: 'Kettle Reviews' };
const SHOPIFY_CRED = { httpHeaderAuth: newCredential('Shopify Admin token') };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 500], parameters: { inputSource: 'passthrough' } },
  output: [{ action: 'inventory' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 500], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const route = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Route', position: [640, 500], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Which store: the Shopify Admin API in live mode, the Kettle tables in test mode. Reads go to one\n' +
        '// table; the two writes (checkout contacted, review tags) always go to our own tables.\n' +
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
        'const i = $(\'When Called\').first().json;\n' +
        'const TABLES = { abandoned_checkouts: \'XluYD3lO9tEeAhBS\', find_order: \'KVudLSbZlietFc9a\', orders_since: \'KVudLSbZlietFc9a\', inventory: \'Ep9njyaWF13y9SHL\', reviews_since: \'D2bbJsHicEHPMugS\' };\n' +
        'const writes = [\'mark_contacted\', \'tag_reviews\'];\n' +
        'let route = writes.includes(i.action) ? i.action : (s.mode === \'live\' && i.action !== \'reviews_since\' ? \'live_read\' : \'test_read\');\n' +
        'return [{ json: { ...i, route, table_id: TABLES[i.action] || \'\', shop: s.shopify_domain || \'\', api_version: s.shopify_api_version || \'2025-10\' } }];\n'
  } },
  output: [{ action: 'inventory', route: 'test_read', table_id: 'Ep9njyaWF13y9SHL' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Which Action?',
    position: [860, 500],
    parameters: {
      rules: { values: [
        { outputKey: 'test read', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'test_read' }], combinator: 'and' } },
        { outputKey: 'live read', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'live_read' }], combinator: 'and' } },
        { outputKey: 'mark contacted', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'mark_contacted' }], combinator: 'and' } },
        { outputKey: 'tag reviews', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'tag_reviews' }], combinator: 'and' } }
      ] }
    }
  }
});

const readTable = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Table', position: [1100, 260], alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: expr('{{ $json.table_id }}') }, returnAll: true } },
  output: [{ sku: 'EG-100', inventory: 140 }]
});

const shapeTest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer (Test)', position: [1320, 260], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Shapes the table rows into the answer for each read. Order lookups need the number AND the email to\n' +
        '// match; a wrong email gets the same answer as a wrong number, so nothing leaks.\n' +
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
        'const r = $(\'Route\').first().json;\n' +
        'const rows = $input.all().map(i => i.json).filter(x => x && Object.keys(x).length > 1);\n' +
        'const since = d => DateTime.now().setZone(TZ).minus({ days: Number(d || 7) }).toMillis();\n' +
        'const strip = x => { const { id, createdAt, updatedAt, ...rest } = x; return rest; };\n' +
        'let out;\n' +
        'if (r.action === \'abandoned_checkouts\') out = { checkouts: rows.map(strip) };\n' +
        'else if (r.action === \'orders_since\') out = { orders: rows.filter(o => Date.parse(o.created_at) >= since(r.days)).map(strip) };\n' +
        'else if (r.action === \'inventory\') out = { products: rows.map(strip) };\n' +
        'else if (r.action === \'reviews_since\') out = { reviews: rows.filter(v => Date.parse(v.created_at) >= since(r.days)).map(strip) };\n' +
        'else if (r.action === \'find_order\') {\n' +
        '  const num = String(r.order_number || \'\').replace(/[^0-9]/g, \'\');\n' +
        '  const email = String(r.email || \'\').trim().toLowerCase();\n' +
        '  const o = rows.find(x => x.order_number.replace(/[^0-9]/g, \'\') === num && num);\n' +
        '  out = o && email && o.email.toLowerCase() === email ? { found: true, order: strip(o) } : { found: false };\n' +
        '}\n' +
        'return [{ json: out || {} }];\n'
  } },
  output: [{ products: [] }]
});

const gql = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'GraphQL Query', position: [1100, 460], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The Shopify Admin GraphQL query for a read (live mode).\n' +
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
        'const r = $(\'Route\').first().json;\n' +
        'const since = DateTime.now().setZone(TZ).minus({ days: Number(r.days || 30) }).toISODate();\n' +
        'const Q = {\n' +
        '  abandoned_checkouts: \'{ abandonedCheckouts(first: 100, sortKey: CREATED_AT, reverse: true) { nodes { id name createdAt completedAt abandonedCheckoutUrl subtotalPriceSet { shopMoney { amount } } customer { firstName email numberOfOrders emailMarketingConsent { marketingState } } lineItems(first: 20) { nodes { title quantity variant { sku } originalUnitPriceSet { shopMoney { amount } } } } } } }\',\n' +
        '  orders_since: \'{ orders(first: 250, query: "created_at:>=\' + since + \'") { nodes { name email createdAt totalPriceSet { shopMoney { amount } } lineItems(first: 20) { nodes { sku title quantity } } } } }\',\n' +
        '  find_order: \'{ orders(first: 1, query: "name:\' + String(r.order_number || \'\').replace(/[^0-9#]/g, \'\') + \'") { nodes { name email createdAt displayFulfillmentStatus totalPriceSet { shopMoney { amount } } lineItems(first: 20) { nodes { title quantity } } fulfillments { createdAt displayStatus estimatedDeliveryAt deliveredAt trackingInfo { company number url } } } } }\',\n' +
        '  inventory: \'{ productVariants(first: 250) { nodes { sku title price inventoryQuantity product { title productType } } } }\'\n' +
        '};\n' +
        'return [{ json: { url: \'https://\' + r.shop + \'/admin/api/\' + r.api_version + \'/graphql.json\', body: { query: Q[r.action] } } }];\n'
  } },
  output: [{ url: 'https://kettle-and-fern.myshopify.com/admin/api/2025-10/graphql.json', body: { query: '{ shop { name } }' } }]
});

const shopify = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Shopify GraphQL',
    position: [1320, 460],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: 'POST', url: expr('{{ $json.url }}'),
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: {}
    },
    credentials: SHOPIFY_CRED
  },
  output: [{ data: {} }]
});

const shapeLive = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer (Live)', position: [1540, 460], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Turns Shopify\'s answer into the same shapes as test mode. Lead times and minimum orders aren\'t in\n' +
        '// Shopify, so they come from the Kettle Products table (by SKU) when it has them.\n' +
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
        'const r = $(\'Route\').first().json;\n' +
        'const d = ($input.first().json || {}).data || {};\n' +
        'let out = {};\n' +
        'if (r.action === \'abandoned_checkouts\') out = { checkouts: (d.abandonedCheckouts?.nodes || []).map(c => ({\n' +
        '  checkout_id: c.id, email: c.customer?.email || \'\', first_name: c.customer?.firstName || \'\', created_at: c.createdAt, completed: !!c.completedAt,\n' +
        '  accepts_marketing: c.customer?.emailMarketingConsent?.marketingState === \'SUBSCRIBED\', orders_count: Number(c.customer?.numberOfOrders || 0),\n' +
        '  subtotal: Number(c.subtotalPriceSet?.shopMoney?.amount || 0), recovery_url: c.abandonedCheckoutUrl,\n' +
        '  items_json: JSON.stringify((c.lineItems?.nodes || []).map(l => ({ sku: l.variant?.sku || \'\', title: l.title, qty: l.quantity, price: Number(l.originalUnitPriceSet?.shopMoney?.amount || 0) })))\n' +
        '})) };\n' +
        'else if (r.action === \'orders_since\') out = { orders: (d.orders?.nodes || []).map(o => ({ order_number: o.name, email: o.email, created_at: o.createdAt, total: Number(o.totalPriceSet?.shopMoney?.amount || 0),\n' +
        '  items_json: JSON.stringify((o.lineItems?.nodes || []).map(l => ({ sku: l.sku, title: l.title, qty: l.quantity }))) })) };\n' +
        'else if (r.action === \'inventory\') out = { products: (d.productVariants?.nodes || []).map(v => ({ sku: v.sku, title: v.product?.title + (v.title && v.title !== \'Default Title\' ? \' \' + v.title : \'\'), category: v.product?.productType || \'\', price: Number(v.price), inventory: Number(v.inventoryQuantity || 0), lead_time_days: 14, min_order_qty: 1, supplier: \'\' })) };\n' +
        'else if (r.action === \'find_order\') {\n' +
        '  const o = (d.orders?.nodes || [])[0];\n' +
        '  const f = (o?.fulfillments || [])[0] || {};\n' +
        '  const ok = o && String(o.email || \'\').toLowerCase() === String(r.email || \'\').trim().toLowerCase();\n' +
        '  out = ok ? { found: true, order: { order_number: o.name, email: o.email, created_at: o.createdAt, total: Number(o.totalPriceSet?.shopMoney?.amount || 0),\n' +
        '    items_json: JSON.stringify((o.lineItems?.nodes || []).map(l => ({ title: l.title, qty: l.quantity }))), fulfillment_status: o.displayFulfillmentStatus === \'FULFILLED\' ? \'fulfilled\' : \'unfulfilled\',\n' +
        '    shipped_at: f.createdAt || \'\', carrier: f.trackingInfo?.[0]?.company || \'\', tracking_number: f.trackingInfo?.[0]?.number || \'\', tracking_url: f.trackingInfo?.[0]?.url || \'\',\n' +
        '    tracking_status: f.deliveredAt ? \'delivered\' : f.createdAt ? \'in_transit\' : \'\', estimated_delivery: (f.estimatedDeliveryAt || \'\').slice(0, 10), last_event: f.displayStatus || \'\', last_event_at: \'\', delivered_at: f.deliveredAt || \'\' } } : { found: false };\n' +
        '}\n' +
        'return [{ json: out }];\n'
  } },
  output: [{ products: [] }]
});

const contactedRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Contacted Row', position: [1100, 660], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Marks a checkout as contacted (and which offer it got), so it is never emailed twice.\n' +
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
        'const r = $(\'Route\').first().json;\n' +
        'return [{ json: { checkout_id: r.checkout_id, contacted_at: nowIso(), offer: r.offer || \'\' } }];\n'
  } },
  output: [{ checkout_id: 'CK-7001', contacted_at: '2026-10-21T12:00:00.000-07:00', offer: 'WELCOME10' }]
});

const markContacted = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Contacted',
    position: [1320, 660],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: CHECKOUTS,
      filters: { conditions: [{ keyName: 'checkout_id', condition: 'eq', keyValue: expr('{{ $json.checkout_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: {
        checkout_id: expr('{{ $json.checkout_id }}'),
          contacted_at: expr('{{ $json.contacted_at }}'),
          offer: expr('{{ $json.offer }}')
      }, schema: [
        { id: 'checkout_id', displayName: 'checkout_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'contacted_at', displayName: 'contacted_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'offer', displayName: 'offer', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ id: 1 }]
});

const tagRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Tag Rows', position: [1100, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One item per review with the AI\'s tags.\n' +
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
        'const r = $(\'Route\').first().json;\n' +
        'const at = nowIso();\n' +
        'return parseJson(r.tags_json, []).map(t => ({ json: { review_id: t.review_id, topics_json: JSON.stringify(t.topics || []), sentiment: t.sentiment || \'\', issue: t.issue || \'\', analysed_at: at } }));\n'
  } },
  output: [{ review_id: 'RV-5100', topics_json: '["shipping speed"]', sentiment: 'negative', issue: 'Slow delivery', analysed_at: '2026-10-21T12:00:00.000-07:00' }]
});

const saveTags = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Review Tags',
    position: [1320, 860],
    parameters: {
      resource: 'row', operation: 'update', dataTableId: REVIEWS,
      filters: { conditions: [{ keyName: 'review_id', condition: 'eq', keyValue: expr('{{ $json.review_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: {
          topics_json: expr('{{ $json.topics_json }}'),
          sentiment: expr('{{ $json.sentiment }}'),
          issue: expr('{{ $json.issue }}'),
          analysed_at: expr('{{ $json.analysed_at }}')
      }, schema: [
          { id: 'topics_json', displayName: 'topics_json', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'sentiment', displayName: 'sentiment', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'issue', displayName: 'issue', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'analysed_at', displayName: 'analysed_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ id: 1 }]
});

const done = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Done', position: [1540, 760], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Same answer for both writes.\n' +
        'return [{ json: { ok: true, action: $(\'Route\').first().json.action, count: $input.all().length } }];\n'
  } },
  output: [{ ok: true }]
});

const note = sticky(
  '## Kettle 1: Store API\nThe one place that talks to the store, so every other workflow works the same in test and live.\n- Reads: **abandoned_checkouts**, **orders_since**, **find_order** (number + email must both match), **inventory**, **reviews_since**.\n- Writes to our own tables: **mark_contacted** (never email a checkout twice), **tag_reviews**.\nLive mode reads the Shopify Admin GraphQL API (needs a **Shopify Admin token** credential: header `X-Shopify-Access-Token`); reviews come from the review app, kept in **Kettle Reviews**.',
  [], { position: [160, 0], width: 1300, height: 220, color: 7 }
);

export default workflow('kettle-store-api', 'Kettle 1: Store API')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(which
    .onCase(0, readTable.to(shapeTest))
    .onCase(1, gql.to(shopify).to(shapeLive))
    .onCase(2, contactedRow.to(markContacted).to(done))
    .onCase(3, tagRows.to(saveTags).to(done)))
  .add(note);
