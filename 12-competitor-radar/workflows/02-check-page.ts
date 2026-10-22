import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 300], parameters: { inputSource: 'passthrough' } },
  output: [{ run_id: 'RUN-ABC123', as_of: '', ignore_lines: 'DEMO SITE', page: { page_id: 'TS-BIKES', competitor: 'Torque Street', page_type: 'products', url: 'http://localhost:5678/webhook/demo-web/torque-street/bikes', last_hash: '', last_items_json: '[]', last_text: '', fail_count: 0 } }]
});

const fetchPage = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Page',
    position: [420, 300],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET', url: expr('{{ $json.page.url }}'),
      sendHeaders: true, headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (compatible; CobbleRadar/1.0; price monitoring)' }, { name: 'Accept-Language', value: 'en-GB' }] },
      options: { response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } }, timeout: 20000 }
    }
  },
  output: [{ statusCode: 200, headers: {}, body: '<html></html>' }]
});

const readPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Read Page', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Cleans the fetched page: pulls any JSON-LD product data, turns the rest into lines of readable text\n' +
        '// (dropping lines that change on every visit, like cookie banners), and builds the text to fingerprint.\n' +
        '// ---- lib-cs.js (included by build.py): shared helpers for the Competitor Radar workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowDt = () => DateTime.now().setZone(TZ);\n' +
        'const toDt = iso => DateTime.fromISO(String(iso), { zone: TZ });\n' +
        'const isoOf = dt => dt.set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });\n' +
        'const nowIso = () => isoOf(nowDt());\n' +
        'const newId = (p, n) => p + Array.from({ length: n || 8 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const gbp = n => n === null || n === undefined || n === \'\' ? \'\' : \'£\' + Number(n).toLocaleString(\'en-GB\', { minimumFractionDigits: 0, maximumFractionDigits: 2 });\n' +
        'const day = iso => iso ? toDt(iso).toFormat(\'d LLL yyyy\') : \'\';\n' +
        'const truthy = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());\n' +
        'const COLUMNS = {"Settings": ["key", "value", "note"], "Watchlist": ["page_id", "competitor", "page_type", "url", "active", "last_checked", "last_status", "last_hash", "last_method", "fail_count", "last_items_json", "last_text", "note"], "Our Products": ["sku", "name", "category", "price", "battery_wh", "range_km", "motor", "url"], "Matches": ["competitor", "competitor_product", "our_sku", "confidence", "matched_by", "matched_at"], "Prices": ["checked_at", "competitor", "product", "price", "was_price", "in_stock", "page_id", "our_sku"], "Changes": ["change_id", "detected_at", "run_id", "competitor", "page_id", "page_type", "kind", "item", "before", "after", "delta_pct", "our_sku", "our_price", "significance", "headline", "why_it_matters", "suggested_action", "alerted", "status"], "Runs": ["run_id", "started_at", "finished_at", "trigger", "pages", "unchanged", "changed", "failed", "changes", "alerts", "ai_calls", "ms"], "Outbox": ["at", "to", "subject", "kind", "links", "html"]};\n' +
        '// Product names compared without case, punctuation or the competitor\'s own name\n' +
        'const normName = (name, competitor) => String(name || \'\').toLowerCase().replace(String(competitor || \'\').toLowerCase(), \'\').replace(/[^a-z0-9]+/g, \' \').trim();\n' +
        '\n' +
        'function tablesOf(res) {\n' +
        '  const out = {};\n' +
        '  for (const vr of (res && res.valueRanges) || []) {\n' +
        '    const name = String(vr.range || \'\').split(\'!\')[0].replace(/^\'|\'$/g, \'\').replace(/\'\'/g, "\'");\n' +
        '    const rows = vr.values || [];\n' +
        '    const head = (rows[0] || []).map(h => String(h).trim());\n' +
        '    out[name] = rows.slice(1).map((r, i) => {\n' +
        '      const o = { _row: i + 2 };\n' +
        '      head.forEach((h, j) => { if (h) o[h] = r[j] === undefined || r[j] === null ? \'\' : r[j]; });\n' +
        '      return o;\n' +
        '    }).filter(o => Object.keys(o).some(k => k !== \'_row\' && o[k] !== \'\'));\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        'const settingsOf = rows => Object.fromEntries((rows || []).filter(r => r.key).map(r => [String(r.key).trim(), r.value === undefined ? \'\' : r.value]));\n' +
        'function sheetRow(o) {\n' +
        '  const r = {};\n' +
        '  for (const [k, v] of Object.entries(o)) if (k !== \'_row\') r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
        '  return r;\n' +
        '}\n' +
        '// OpenAI result (Responses API or the OpenAI node\'s simplified output) → the JSON object, or null\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && Array.isArray(o.content));\n' +
        '  const part = msg && (msg.content || []).find(c => c && (c.type === \'output_text\' || c.text !== undefined));\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        '\n' +
        'const baseUrl = s => String(s.base_url || \'http://localhost:5678\').replace(/\\/$/, \'\');\n' +
        'const dashboardUrl = s => baseUrl(s) + \'/webhook/radar/dashboard?key=\' + encodeURIComponent(s.dashboard_key || \'\');\n' +
        'function button(url, label) {\n' +
        '  return \'<p style="margin:22px 0;text-align:left"><a href="\' + esc(url) + \'" style="display:inline-block;background:#e4572e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">\' + esc(label) + \'</a></p>\';\n' +
        '}\n' +
        'function emailHtml(s, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c2430;max-width:620px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#e4572e;margin:0 0 18px">\' + esc(s.company || \'Cobble & Spoke\') + \' · Competitor Radar</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'function pageHtml(title, bodyHtml) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#f3f4f6;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1c2430}.card{max-width:520px;margin:48px auto;background:#fff;border-radius:16px;padding:30px;box-shadow:0 8px 28px rgba(0,0,0,.06)}h1{font-size:22px;margin:0 0 10px}</style></head><body><div class="card"><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
        '}\n' +
        'function emptyPlan(s) { return { mode: s.mode === \'live\' ? \'live\' : \'test\', appends: { Changes: [], Prices: [], Runs: [], Matches: [], Watchlist: [] }, updates: { Watchlist: [], Changes: [] }, emails: [], result: { ok: true } }; }\n' +
        'const emailItem = (to, subject, html, kind, links) => ({ to, subject, html, kind, links: (links || []).join(\' \') });\n' +
        '\n' +
        '// Latest price of every product a rival still sells: rows from each page\'s most recent snapshot only\n' +
        '// (a bike dropped from the page disappears instead of keeping its old price)\n' +
        'function currentPrices(rows) {\n' +
        '  const lastCheck = {};\n' +
        '  for (const p of rows || []) if (!lastCheck[p.page_id] || String(p.checked_at) > lastCheck[p.page_id]) lastCheck[p.page_id] = String(p.checked_at);\n' +
        '  const out = {};\n' +
        '  for (const p of rows || []) if (String(p.checked_at) === lastCheck[p.page_id]) out[p.competitor + \'|\' + p.product] = p;\n' +
        '  return out;\n' +
        '}\n' +
        '\n' +
        'const KIND_LABEL = { price_drop: \'Price cut\', price_rise: \'Price rise\', new_product: \'New product\', removed_product: \'Product gone\', out_of_stock: \'Out of stock\', back_in_stock: \'Back in stock\', promotion: \'Promotion\', hiring: \'Hiring\', news: \'News\', messaging: \'Messaging\', layout_warning: \'Check page\', fetch_failed: \'Page down\', other: \'Change\' };\n' +
        '// ---- end lib-cs.js ----\n' +
        'const input = $(\'When Called\').first().json;\n' +
        'const page = input.page;\n' +
        'const res = $input.first().json;\n' +
        'const status = Number(res.statusCode || 0);\n' +
        'const body = typeof res.body === \'string\' ? res.body : (typeof res.data === \'string\' ? res.data : \'\');\n' +
        'const ignore = String(input.ignore_lines || \'\').split(\'|\').map(s => s.trim()).filter(Boolean);\n' +
        'const decode = s => s.replace(/&nbsp;/g, \' \').replace(/&amp;/g, \'&\').replace(/&lt;/g, \'<\').replace(/&gt;/g, \'>\').replace(/&quot;/g, \'"\').replace(/&#39;|&rsquo;|&#8217;/g, \'\\\'\').replace(/&pound;/g, \'£\').replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(Number(n)));\n' +
        '\n' +
        '// JSON-LD products, wherever they sit (ItemList, @graph, arrays)\n' +
        'const products = [];\n' +
        'const seen = new Set();\n' +
        'function walk(o) {\n' +
        '  if (!o || typeof o !== \'object\') return;\n' +
        '  if (Array.isArray(o)) { o.forEach(walk); return; }\n' +
        '  const type = [].concat(o[\'@type\'] || []).join(\',\');\n' +
        '  if (/Product/.test(type) && o.name) {\n' +
        '    const offer = [].concat(o.offers || [])[0] || {};\n' +
        '    const price = Number(offer.price || offer.lowPrice || 0);\n' +
        '    const key = String(o.name).toLowerCase();\n' +
        '    if (price && !seen.has(key)) { seen.add(key); products.push({ name: String(o.name).trim(), price, was_price: null, in_stock: !/OutOfStock|SoldOut/i.test(String(offer.availability || \'\')) }); }\n' +
        '  }\n' +
        '  for (const v of Object.values(o)) if (v && typeof v === \'object\') walk(v);\n' +
        '}\n' +
        'for (const m of body.matchAll(/<script[^>]+application\\/ld\\+json[^>]*>([\\s\\S]*?)<\\/script>/gi)) { try { walk(JSON.parse(m[1])); } catch (e) { /* bad JSON-LD is ignored */ } }\n' +
        '\n' +
        'const text = decode(body\n' +
        '  .replace(/<(script|style|noscript|svg|template)[\\s\\S]*?<\\/\\1>/gi, \' \')\n' +
        '  .replace(/<(br|\\/p|\\/div|\\/li|\\/h[1-6]|\\/tr|\\/section|\\/article|\\/header|\\/footer|\\/a)\\b[^>]*>/gi, \'\\n\')\n' +
        '  .replace(/<\\/t[dh]>/gi, \' | \')\n' +
        '  .replace(/<[^>]+>/g, \' \'))\n' +
        '  .split(\'\\n\').map(l => l.replace(/\\s+/g, \' \').replace(/^\\|\\s*|\\s*\\|\\s*$/g, \'\').trim())\n' +
        '  .filter(l => l.length > 1 && !ignore.some(p => l.toLowerCase().indexOf(p.toLowerCase()) >= 0));\n' +
        'const lines = [...new Set(text)].slice(0, 400);\n' +
        'const ok = status >= 200 && status < 300 && lines.length > 0;\n' +
        'const method = page.page_type === \'products\' ? (products.length ? \'json-ld\' : \'ai\') : \'text\';\n' +
        'const sorted = products.slice().sort((a, b) => a.name < b.name ? -1 : 1);\n' +
        'return [{ json: {\n' +
        '  ok, http_status: status, error: ok ? \'\' : (res.error ? String(res.error.message || res.error) : \'HTTP \' + status),\n' +
        '  method, products: sorted, lines, text: lines.join(\'\\n\').slice(0, 20000),\n' +
        '  hash_input: ok ? (method === \'json-ld\' ? JSON.stringify(sorted) : lines.join(\'\\n\')) : \'\'\n' +
        '} }];\n'
  } },
  output: [{ ok: true, http_status: 200, method: 'json-ld', products: [], lines: [], text: '', hash_input: '' }]
});

const fingerprint = node({
  type: 'n8n-nodes-base.crypto',
  version: 1,
  config: { name: 'Fingerprint', position: [860, 300], parameters: { action: 'hash', type: 'SHA256', value: expr('{{ $json.hash_input }}'), dataPropertyName: 'hash', encoding: 'hex' } },
  output: [{ ok: true, hash: 'ab12' }]
});

const changed = ifElse({
  version: 2.2,
  config: {
    name: 'Changed?',
    position: [1080, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $json.ok && $json.hash !== $('When Called').first().json.page.last_hash }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const needsAi = ifElse({
  version: 2.2,
  config: {
    name: 'Needs AI?',
    position: [1300, 200],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $('Read Page').first().json.method === 'ai' }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const readProducts = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Read Products (AI)',
    position: [1540, 60],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr("Competitor: {{ $('When Called').first().json.page.competitor }}\nPage: {{ $('When Called').first().json.page.url }}\n\nPage text:\n{{ $('Read Page').first().json.text }}") }] },
      options: {
        instructions:
        'You read the text of a competitor\'s web page and list the products for sale with their prices.\n' +
        '\n' +
        '- is_product_listing: true only if the page lists products with prices. A bot check ("checking your browser"), an error, maintenance or login page, or an article is false.\n' +
        '- page_looks_like: a few words on what the page is, for example "e-bike product grid" or "browser check page".\n' +
        '- products: every bike or product with a price on the page. Use the product name exactly as shown. price is the current price in pounds as a number (1649, not "£1,649"). was_price is the crossed-out or "was" price if one is shown, otherwise null. in_stock is false only if the page says sold out, out of stock or unavailable for that product.\n' +
        '- Don\'t include accessories in a "related items" strip, and never invent a product or a price.\n'
        ,
        maxTokens: 4000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'products', strict: true, schema:
        '{"type": "object", "additionalProperties": false, "required": ["is_product_listing", "page_looks_like", "products"], "properties": {"is_product_listing": {"type": "boolean"}, "page_looks_like": {"type": "string"}, "products": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["name", "price", "was_price", "in_stock"], "properties": {"name": {"type": "string"}, "price": {"type": "number"}, "was_price": {"type": ["number", "null"]}, "in_stock": {"type": "boolean"}}}}}}\n'
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [] }]
});

const compare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Compare', position: [1840, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Compares this check with the last one and lists what changed. Guards against false alarms: if a\n' +
          '// product page suddenly has no products (a bot check, an error page, a redesign the reader can\'t follow),\n' +
          '// it reports "check this page" instead of "every product was removed", and keeps the last good data.\n' +
          '// ---- lib-cs.js (included by build.py): shared helpers for the Competitor Radar workflows ----\n' +
          'const TZ = \'Europe/London\';\n' +
          'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
          'const parseJson = (s, d) => { try { return typeof s === \'string\' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
          'const nowDt = () => DateTime.now().setZone(TZ);\n' +
          'const toDt = iso => DateTime.fromISO(String(iso), { zone: TZ });\n' +
          'const isoOf = dt => dt.set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });\n' +
          'const nowIso = () => isoOf(nowDt());\n' +
          'const newId = (p, n) => p + Array.from({ length: n || 8 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
          'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
          'const gbp = n => n === null || n === undefined || n === \'\' ? \'\' : \'£\' + Number(n).toLocaleString(\'en-GB\', { minimumFractionDigits: 0, maximumFractionDigits: 2 });\n' +
          'const day = iso => iso ? toDt(iso).toFormat(\'d LLL yyyy\') : \'\';\n' +
          'const truthy = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());\n' +
          'const COLUMNS = {"Settings": ["key", "value", "note"], "Watchlist": ["page_id", "competitor", "page_type", "url", "active", "last_checked", "last_status", "last_hash", "last_method", "fail_count", "last_items_json", "last_text", "note"], "Our Products": ["sku", "name", "category", "price", "battery_wh", "range_km", "motor", "url"], "Matches": ["competitor", "competitor_product", "our_sku", "confidence", "matched_by", "matched_at"], "Prices": ["checked_at", "competitor", "product", "price", "was_price", "in_stock", "page_id", "our_sku"], "Changes": ["change_id", "detected_at", "run_id", "competitor", "page_id", "page_type", "kind", "item", "before", "after", "delta_pct", "our_sku", "our_price", "significance", "headline", "why_it_matters", "suggested_action", "alerted", "status"], "Runs": ["run_id", "started_at", "finished_at", "trigger", "pages", "unchanged", "changed", "failed", "changes", "alerts", "ai_calls", "ms"], "Outbox": ["at", "to", "subject", "kind", "links", "html"]};\n' +
          '// Product names compared without case, punctuation or the competitor\'s own name\n' +
          'const normName = (name, competitor) => String(name || \'\').toLowerCase().replace(String(competitor || \'\').toLowerCase(), \'\').replace(/[^a-z0-9]+/g, \' \').trim();\n' +
          '\n' +
          'function tablesOf(res) {\n' +
          '  const out = {};\n' +
          '  for (const vr of (res && res.valueRanges) || []) {\n' +
          '    const name = String(vr.range || \'\').split(\'!\')[0].replace(/^\'|\'$/g, \'\').replace(/\'\'/g, "\'");\n' +
          '    const rows = vr.values || [];\n' +
          '    const head = (rows[0] || []).map(h => String(h).trim());\n' +
          '    out[name] = rows.slice(1).map((r, i) => {\n' +
          '      const o = { _row: i + 2 };\n' +
          '      head.forEach((h, j) => { if (h) o[h] = r[j] === undefined || r[j] === null ? \'\' : r[j]; });\n' +
          '      return o;\n' +
          '    }).filter(o => Object.keys(o).some(k => k !== \'_row\' && o[k] !== \'\'));\n' +
          '  }\n' +
          '  return out;\n' +
          '}\n' +
          'const settingsOf = rows => Object.fromEntries((rows || []).filter(r => r.key).map(r => [String(r.key).trim(), r.value === undefined ? \'\' : r.value]));\n' +
          'function sheetRow(o) {\n' +
          '  const r = {};\n' +
          '  for (const [k, v] of Object.entries(o)) if (k !== \'_row\') r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
          '  return r;\n' +
          '}\n' +
          '// OpenAI result (Responses API or the OpenAI node\'s simplified output) → the JSON object, or null\n' +
          'function aiJson(res) {\n' +
          '  if (!res || res.error) return null;\n' +
          '  const msg = (res.output || []).find(o => o && Array.isArray(o.content));\n' +
          '  const part = msg && (msg.content || []).find(c => c && (c.type === \'output_text\' || c.text !== undefined));\n' +
          '  let t = part ? part.text : null;\n' +
          '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
          '  return t && typeof t === \'object\' ? t : null;\n' +
          '}\n' +
          '\n' +
          'const baseUrl = s => String(s.base_url || \'http://localhost:5678\').replace(/\\/$/, \'\');\n' +
          'const dashboardUrl = s => baseUrl(s) + \'/webhook/radar/dashboard?key=\' + encodeURIComponent(s.dashboard_key || \'\');\n' +
          'function button(url, label) {\n' +
          '  return \'<p style="margin:22px 0;text-align:left"><a href="\' + esc(url) + \'" style="display:inline-block;background:#e4572e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">\' + esc(label) + \'</a></p>\';\n' +
          '}\n' +
          'function emailHtml(s, paragraphs, extraHtml) {\n' +
          '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
          '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c2430;max-width:620px;text-align:left">\'\n' +
          '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#e4572e;margin:0 0 18px">\' + esc(s.company || \'Cobble & Spoke\') + \' · Competitor Radar</div>\'\n' +
          '    + p + (extraHtml || \'\') + \'</div>\';\n' +
          '}\n' +
          'function pageHtml(title, bodyHtml) {\n' +
          '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>\' + esc(title) + \'</title>\'\n' +
          '    + \'<style>body{margin:0;background:#f3f4f6;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1c2430}.card{max-width:520px;margin:48px auto;background:#fff;border-radius:16px;padding:30px;box-shadow:0 8px 28px rgba(0,0,0,.06)}h1{font-size:22px;margin:0 0 10px}</style></head><body><div class="card"><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
          '}\n' +
          'function emptyPlan(s) { return { mode: s.mode === \'live\' ? \'live\' : \'test\', appends: { Changes: [], Prices: [], Runs: [], Matches: [], Watchlist: [] }, updates: { Watchlist: [], Changes: [] }, emails: [], result: { ok: true } }; }\n' +
          'const emailItem = (to, subject, html, kind, links) => ({ to, subject, html, kind, links: (links || []).join(\' \') });\n' +
          '\n' +
          '// Latest price of every product a rival still sells: rows from each page\'s most recent snapshot only\n' +
          '// (a bike dropped from the page disappears instead of keeping its old price)\n' +
          'function currentPrices(rows) {\n' +
          '  const lastCheck = {};\n' +
          '  for (const p of rows || []) if (!lastCheck[p.page_id] || String(p.checked_at) > lastCheck[p.page_id]) lastCheck[p.page_id] = String(p.checked_at);\n' +
          '  const out = {};\n' +
          '  for (const p of rows || []) if (String(p.checked_at) === lastCheck[p.page_id]) out[p.competitor + \'|\' + p.product] = p;\n' +
          '  return out;\n' +
          '}\n' +
          '\n' +
          'const KIND_LABEL = { price_drop: \'Price cut\', price_rise: \'Price rise\', new_product: \'New product\', removed_product: \'Product gone\', out_of_stock: \'Out of stock\', back_in_stock: \'Back in stock\', promotion: \'Promotion\', hiring: \'Hiring\', news: \'News\', messaging: \'Messaging\', layout_warning: \'Check page\', fetch_failed: \'Page down\', other: \'Change\' };\n' +
          '// ---- end lib-cs.js ----\n' +
          'const input = $(\'When Called\').first().json;\n' +
          'const page = input.page;\n' +
          'const read = $(\'Read Page\').first().json;\n' +
          'const hash = $(\'Fingerprint\').first().json.hash;\n' +
          'const at = input.as_of || nowIso();\n' +
          'const base = { page_id: page.page_id, competitor: page.competitor, page_type: page.page_type };\n' +
          'const changes = [];\n' +
          'let items = [], method = read.method, warning = \'\';\n' +
          '\n' +
          'if (page.page_type === \'products\') {\n' +
          '  if (read.method === \'json-ld\') items = read.products;\n' +
          '  else {\n' +
          '    const ai = aiJson($(\'Read Products (AI)\').first().json);\n' +
          '    if (!ai) warning = \'The AI could not read the products on this page.\';\n' +
          '    else if (!ai.is_product_listing) warning = \'This page no longer looks like a product list (\' + String(ai.page_looks_like || \'unknown\').slice(0, 80) + \').\';\n' +
          '    else items = (ai.products || []).filter(p => p.name && Number(p.price) > 0).map(p => ({ name: String(p.name).trim(), price: Number(p.price), was_price: p.was_price ? Number(p.was_price) : null, in_stock: p.in_stock !== false }));\n' +
          '  }\n' +
          '  const prev = parseJson(page.last_items_json, []);\n' +
          '  const now = new Map(items.map(p => [normName(p.name, page.competitor), p]));\n' +
          '  const before = new Map(prev.map(p => [normName(p.name, page.competitor), p]));\n'
        ) +
        (
          '  if (!warning && prev.length >= 3 && items.length < prev.length * 0.4) warning = \'Only \' + items.length + \' of the \' + prev.length + \' products were found. The page layout may have changed.\';\n' +
          '  if (warning) {\n' +
          '    changes.push(Object.assign({ kind: \'layout_warning\', item: page.page_type + \' page\', before: prev.length + \' products\', after: items.length + \' products\', detail: warning }, base));\n' +
          '    items = prev;\n' +
          '  } else if (prev.length) {\n' +
          '    for (const [k, p] of now) {\n' +
          '      const o = before.get(k);\n' +
          '      if (!o) { changes.push(Object.assign({ kind: \'new_product\', item: p.name, before: \'\', after: p.price, detail: p.in_stock ? \'\' : \'out of stock\' }, base)); continue; }\n' +
          '      if (Math.abs(p.price - o.price) >= 0.5) changes.push(Object.assign({ kind: p.price < o.price ? \'price_drop\' : \'price_rise\', item: p.name, before: o.price, after: p.price, delta_pct: Math.round((p.price - o.price) / o.price * 1000) / 10, detail: p.was_price ? \'shown as reduced from \' + gbp(p.was_price) : \'\' }, base));\n' +
          '      if (o.in_stock !== p.in_stock) changes.push(Object.assign({ kind: p.in_stock ? \'back_in_stock\' : \'out_of_stock\', item: p.name, before: o.in_stock ? \'in stock\' : \'out of stock\', after: p.in_stock ? \'in stock\' : \'out of stock\', detail: \'\' }, base));\n' +
          '    }\n' +
          '    for (const [k, o] of before) if (!now.has(k)) changes.push(Object.assign({ kind: \'removed_product\', item: o.name, before: o.price, after: \'\', detail: \'\' }, base));\n' +
          '  }\n' +
          '} else {\n' +
          '  const prev = String(page.last_text || \'\').split(\'\\n\').filter(Boolean);\n' +
          '  if (prev.length) {\n' +
          '    const was = new Set(prev), is = new Set(read.lines);\n' +
          '    const added = read.lines.filter(l => !was.has(l)), removed = prev.filter(l => !is.has(l));\n' +
          '    if (added.length || removed.length) changes.push(Object.assign({ kind: \'content\', item: page.page_type + \' page\', before: removed.slice(0, 15).join(\'\\n\'), after: added.slice(0, 15).join(\'\\n\'), detail: added.length + \' lines added, \' + removed.length + \' removed\' }, base));\n' +
          '  }\n' +
          '}\n' +
          'const first = !page.last_hash;\n' +
          'return [{ json: Object.assign({}, base, {\n' +
          '  status: first ? \'baseline\' : (warning ? \'warning\' : (changes.length ? \'changed\' : \'unchanged\')), method, at,\n' +
          '  items, changes, ai_used: method === \'ai\',\n' +
          '  state: { page_id: page.page_id, last_checked: at, last_status: first ? \'baseline\' : (warning ? \'warning\' : \'changed\'), last_hash: warning ? page.last_hash : hash, last_method: method, fail_count: 0,\n' +
          '    last_items_json: page.page_type === \'products\' ? JSON.stringify(items) : \'\', last_text: page.page_type === \'products\' ? \'\' : read.text.slice(0, 20000) }\n' +
          '}) }];\n'
        )
  } },
  output: [{ page_id: 'TS-BIKES', status: 'changed', changes: [], items: [], state: {} }]
});

const noChange = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'No Change or Failed', position: [1300, 440], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Nothing new (same fingerprint as last time), or the page couldn\'t be fetched. Three failures in a row\n' +
        '// raise a "page down" change.\n' +
        '// ---- lib-cs.js (included by build.py): shared helpers for the Competitor Radar workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowDt = () => DateTime.now().setZone(TZ);\n' +
        'const toDt = iso => DateTime.fromISO(String(iso), { zone: TZ });\n' +
        'const isoOf = dt => dt.set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });\n' +
        'const nowIso = () => isoOf(nowDt());\n' +
        'const newId = (p, n) => p + Array.from({ length: n || 8 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const gbp = n => n === null || n === undefined || n === \'\' ? \'\' : \'£\' + Number(n).toLocaleString(\'en-GB\', { minimumFractionDigits: 0, maximumFractionDigits: 2 });\n' +
        'const day = iso => iso ? toDt(iso).toFormat(\'d LLL yyyy\') : \'\';\n' +
        'const truthy = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());\n' +
        'const COLUMNS = {"Settings": ["key", "value", "note"], "Watchlist": ["page_id", "competitor", "page_type", "url", "active", "last_checked", "last_status", "last_hash", "last_method", "fail_count", "last_items_json", "last_text", "note"], "Our Products": ["sku", "name", "category", "price", "battery_wh", "range_km", "motor", "url"], "Matches": ["competitor", "competitor_product", "our_sku", "confidence", "matched_by", "matched_at"], "Prices": ["checked_at", "competitor", "product", "price", "was_price", "in_stock", "page_id", "our_sku"], "Changes": ["change_id", "detected_at", "run_id", "competitor", "page_id", "page_type", "kind", "item", "before", "after", "delta_pct", "our_sku", "our_price", "significance", "headline", "why_it_matters", "suggested_action", "alerted", "status"], "Runs": ["run_id", "started_at", "finished_at", "trigger", "pages", "unchanged", "changed", "failed", "changes", "alerts", "ai_calls", "ms"], "Outbox": ["at", "to", "subject", "kind", "links", "html"]};\n' +
        '// Product names compared without case, punctuation or the competitor\'s own name\n' +
        'const normName = (name, competitor) => String(name || \'\').toLowerCase().replace(String(competitor || \'\').toLowerCase(), \'\').replace(/[^a-z0-9]+/g, \' \').trim();\n' +
        '\n' +
        'function tablesOf(res) {\n' +
        '  const out = {};\n' +
        '  for (const vr of (res && res.valueRanges) || []) {\n' +
        '    const name = String(vr.range || \'\').split(\'!\')[0].replace(/^\'|\'$/g, \'\').replace(/\'\'/g, "\'");\n' +
        '    const rows = vr.values || [];\n' +
        '    const head = (rows[0] || []).map(h => String(h).trim());\n' +
        '    out[name] = rows.slice(1).map((r, i) => {\n' +
        '      const o = { _row: i + 2 };\n' +
        '      head.forEach((h, j) => { if (h) o[h] = r[j] === undefined || r[j] === null ? \'\' : r[j]; });\n' +
        '      return o;\n' +
        '    }).filter(o => Object.keys(o).some(k => k !== \'_row\' && o[k] !== \'\'));\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        'const settingsOf = rows => Object.fromEntries((rows || []).filter(r => r.key).map(r => [String(r.key).trim(), r.value === undefined ? \'\' : r.value]));\n' +
        'function sheetRow(o) {\n' +
        '  const r = {};\n' +
        '  for (const [k, v] of Object.entries(o)) if (k !== \'_row\') r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
        '  return r;\n' +
        '}\n' +
        '// OpenAI result (Responses API or the OpenAI node\'s simplified output) → the JSON object, or null\n' +
        'function aiJson(res) {\n' +
        '  if (!res || res.error) return null;\n' +
        '  const msg = (res.output || []).find(o => o && Array.isArray(o.content));\n' +
        '  const part = msg && (msg.content || []).find(c => c && (c.type === \'output_text\' || c.text !== undefined));\n' +
        '  let t = part ? part.text : null;\n' +
        '  if (typeof t === \'string\') { try { t = JSON.parse(t); } catch (e) { t = null; } }\n' +
        '  return t && typeof t === \'object\' ? t : null;\n' +
        '}\n' +
        '\n' +
        'const baseUrl = s => String(s.base_url || \'http://localhost:5678\').replace(/\\/$/, \'\');\n' +
        'const dashboardUrl = s => baseUrl(s) + \'/webhook/radar/dashboard?key=\' + encodeURIComponent(s.dashboard_key || \'\');\n' +
        'function button(url, label) {\n' +
        '  return \'<p style="margin:22px 0;text-align:left"><a href="\' + esc(url) + \'" style="display:inline-block;background:#e4572e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">\' + esc(label) + \'</a></p>\';\n' +
        '}\n' +
        'function emailHtml(s, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.filter(Boolean).map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c2430;max-width:620px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#e4572e;margin:0 0 18px">\' + esc(s.company || \'Cobble & Spoke\') + \' · Competitor Radar</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'function pageHtml(title, bodyHtml) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#f3f4f6;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1c2430}.card{max-width:520px;margin:48px auto;background:#fff;border-radius:16px;padding:30px;box-shadow:0 8px 28px rgba(0,0,0,.06)}h1{font-size:22px;margin:0 0 10px}</style></head><body><div class="card"><h1>\' + esc(title) + \'</h1>\' + bodyHtml + \'</div></body></html>\';\n' +
        '}\n' +
        'function emptyPlan(s) { return { mode: s.mode === \'live\' ? \'live\' : \'test\', appends: { Changes: [], Prices: [], Runs: [], Matches: [], Watchlist: [] }, updates: { Watchlist: [], Changes: [] }, emails: [], result: { ok: true } }; }\n' +
        'const emailItem = (to, subject, html, kind, links) => ({ to, subject, html, kind, links: (links || []).join(\' \') });\n' +
        '\n' +
        '// Latest price of every product a rival still sells: rows from each page\'s most recent snapshot only\n' +
        '// (a bike dropped from the page disappears instead of keeping its old price)\n' +
        'function currentPrices(rows) {\n' +
        '  const lastCheck = {};\n' +
        '  for (const p of rows || []) if (!lastCheck[p.page_id] || String(p.checked_at) > lastCheck[p.page_id]) lastCheck[p.page_id] = String(p.checked_at);\n' +
        '  const out = {};\n' +
        '  for (const p of rows || []) if (String(p.checked_at) === lastCheck[p.page_id]) out[p.competitor + \'|\' + p.product] = p;\n' +
        '  return out;\n' +
        '}\n' +
        '\n' +
        'const KIND_LABEL = { price_drop: \'Price cut\', price_rise: \'Price rise\', new_product: \'New product\', removed_product: \'Product gone\', out_of_stock: \'Out of stock\', back_in_stock: \'Back in stock\', promotion: \'Promotion\', hiring: \'Hiring\', news: \'News\', messaging: \'Messaging\', layout_warning: \'Check page\', fetch_failed: \'Page down\', other: \'Change\' };\n' +
        '// ---- end lib-cs.js ----\n' +
        'const input = $(\'When Called\').first().json;\n' +
        'const page = input.page;\n' +
        'const read = $(\'Read Page\').first().json;\n' +
        'const at = input.as_of || nowIso();\n' +
        'const base = { page_id: page.page_id, competitor: page.competitor, page_type: page.page_type };\n' +
        'if (read.ok) return [{ json: Object.assign({}, base, { status: \'unchanged\', method: page.last_method || read.method, at, items: parseJson(page.last_items_json, []), changes: [], ai_used: false,\n' +
        '  state: { page_id: page.page_id, last_checked: at, last_status: \'unchanged\', fail_count: 0 } }) }];\n' +
        'const fails = (Number(page.fail_count) || 0) + 1;\n' +
        'const changes = fails === 3 ? [Object.assign({ kind: \'fetch_failed\', item: page.page_type + \' page\', before: \'working\', after: read.error, detail: \'Failed 3 checks in a row\' }, base)] : [];\n' +
        'return [{ json: Object.assign({}, base, { status: \'failed\', method: page.last_method || \'\', at, items: [], changes, ai_used: false, error: read.error,\n' +
        '  state: { page_id: page.page_id, last_checked: at, last_status: \'failed: \' + read.error, fail_count: fails } }) }];\n'
  } },
  output: [{ page_id: 'TS-BIKES', status: 'unchanged', changes: [], items: [], state: {} }]
});

const note = sticky(
  '## Radar 2: Check Page\nOne competitor page per call. The page is fetched and cleaned; product pages with **JSON-LD** structured data are read in code, others by **GPT-5.4 mini**. A SHA-256 **fingerprint** of the cleaned content means the AI only runs when a page has really changed. **Compare** lists price moves, new and removed products and stock changes (or added and removed lines on home, careers and news pages). If a product page suddenly loses most of its products, it says "check this page" instead of reporting them all as gone; three failed fetches in a row report the page as down.',
  [], { position: [160, -120], width: 1240, height: 190, color: 7 }
);

export default workflow('radar-check-page', 'Radar 2: Check Page')
  .add(whenCalled)
  .to(fetchPage)
  .to(readPage)
  .to(fingerprint)
  .to(changed
    .onTrue(needsAi
      .onTrue(readProducts.to(compare))
      .onFalse(compare))
    .onFalse(noChange))
  .add(note);
