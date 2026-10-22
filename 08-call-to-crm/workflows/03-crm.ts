import { workflow, node, trigger, sticky, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'IFuurjqqfST0GLCi', cachedResultName: 'Tidewater Settings' };
const DEALS = { __rl: true, mode: 'id', value: '6fad2EyLoty9oElv', cachedResultName: 'Tidewater Deals' };
const COMPANIES = { __rl: true, mode: 'id', value: 'h1O24r8zgxQeqODi', cachedResultName: 'Tidewater Companies' };
const CONTACTS = { __rl: true, mode: 'id', value: '0jlx2ckch1Gj6Qtr', cachedResultName: 'Tidewater Contacts' };
const ACTIVITY = { __rl: true, mode: 'id', value: 'VUrS7HRsgmNpXROv', cachedResultName: 'Tidewater Activity' };
const HUBSPOT_CRED = { hubspotAppToken: newCredential('HubSpot account') };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 600], parameters: { inputSource: 'passthrough' } },
  output: [{ action: 'get_deal', deal_id: 'D-1001' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 600], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const route = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Route', position: [640, 600], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Which CRM: HubSpot in live mode, the Tidewater tables in test mode.\n' +
        '// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----\n' +
        'const TZ = \'America/New_York\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const dollars = n => \'$\' + Math.round(Number(n) || 0).toLocaleString(\'en-US\');\n' +
        'const day = d => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat(\'ccc, LLL d\') : String(d || \'\');\n' +
        'const mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\n' +
        '\n' +
        '// HubSpot\'s default sales pipeline.\n' +
        'const STAGES = [\n' +
        '  [\'appointmentscheduled\', \'Appointment scheduled\', \'A first meeting is booked.\'],\n' +
        '  [\'qualifiedtobuy\', \'Qualified to buy\', \'Need, rough budget, decision process and timeline are understood.\'],\n' +
        '  [\'presentationscheduled\', \'Presentation scheduled\', \'A demo or presentation is booked or has been given.\'],\n' +
        '  [\'decisionmakerboughtin\', \'Decision maker bought-in\', \'The person who signs has seen it and supports it.\'],\n' +
        '  [\'contractsent\', \'Contract sent\', \'A proposal or contract has been sent.\'],\n' +
        '  [\'closedwon\', \'Closed won\', \'Signed.\'],\n' +
        '  [\'closedlost\', \'Closed lost\', \'The prospect said no.\']\n' +
        '];\n' +
        'const stageIndex = id => STAGES.findIndex(s => s[0] === id);\n' +
        'const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];\n' +
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
        '// Is this quote really in the transcript? (case, punctuation and spacing ignored)\n' +
        'const norm = s => String(s || \'\').toLowerCase().replace(/[’\']/g, "\'").replace(/[^a-z0-9\' ]+/g, \' \').replace(/\\s+/g, \' \').trim();\n' +
        'const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };\n' +
        '\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'const plainToHtml = t => String(t || \'\').split(/\\n{2,}/).map(p => \'<p style="margin:0 0 14px;text-align:left">\' + esc(p).replace(/\\n/g, \'<br>\') + \'</p>\').join(\'\');\n' +
        '// n8n shows a form\'s completion HTML as the whole page, so it needs its own styling.\n' +
        'function formPage(title, inner) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}\'\n' +
        '    + \'.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>\'\n' +
        '    + \'<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>\' + inner + \'</div></body></html>\';\n' +
        '}\n' +
        '// ---- end lib-tdw.js ----\n' +
        'const s = settingsOf($(\'Read Settings\').all());\n' +
        'const i = $(\'When Called\').first().json;\n' +
        'return [{ json: { ...i, route: (s.mode === \'live\' ? \'live_\' : \'test_\') + i.action, pipeline: s.hubspot_pipeline || \'default\' } }];\n'
  } },
  output: [{ action: 'get_deal', deal_id: 'D-1001', route: 'test_get_deal' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Which Action?',
    position: [860, 600],
    parameters: {
      rules: { values: [
        { outputKey: 'test get deal', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'test_get_deal' }], combinator: 'and' } },
        { outputKey: 'test update deal', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'test_update_deal' }], combinator: 'and' } },
        { outputKey: 'test note or task', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'regex' }, rightValue: '^test_(add_note|create_task)$' }], combinator: 'and' } },
        { outputKey: 'live get deal', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'live_get_deal' }], combinator: 'and' } },
        { outputKey: 'live write', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'regex' }, rightValue: '^live_(update_deal|add_note|create_task)$' }], combinator: 'and' } }
      ] }
    }
  }
});

// Test CRM: read
const readDeal = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Deal', position: [1100, 200], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: DEALS, returnAll: true, filters: { conditions: [{ keyName: 'deal_id', condition: 'eq', keyValue: expr("{{ $('Route').first().json.deal_id }}") }] } } },
  output: [{ deal_id: 'D-1001', name: 'Calloway Dental: patient reminders', company_id: 'C-201', stage: 'appointmentscheduled' }]
});
const readCompanies = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Companies', position: [1320, 200], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: COMPANIES, returnAll: true } },
  output: [{ company_id: 'C-201', name: 'Calloway Dental Group' }]
});
const readContacts = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Contacts', position: [1540, 200], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CONTACTS, returnAll: true } },
  output: [{ contact_id: 'P-301', company_id: 'C-201', name: 'Renee Alvarez' }]
});
const readActivity = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Activity', position: [1760, 200], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: ACTIVITY, returnAll: true, filters: { conditions: [{ keyName: 'deal_id', condition: 'eq', keyValue: expr("{{ $('Route').first().json.deal_id }}") }] } } },
  output: [{ deal_id: 'D-1001', kind: 'note', title: 'Inbound lead' }]
});
const dealTest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Deal (Test)', position: [1980, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The deal with its company, contacts and recent activity, from the test tables.\n' +
        '// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----\n' +
        'const TZ = \'America/New_York\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const dollars = n => \'$\' + Math.round(Number(n) || 0).toLocaleString(\'en-US\');\n' +
        'const day = d => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat(\'ccc, LLL d\') : String(d || \'\');\n' +
        'const mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\n' +
        '\n' +
        '// HubSpot\'s default sales pipeline.\n' +
        'const STAGES = [\n' +
        '  [\'appointmentscheduled\', \'Appointment scheduled\', \'A first meeting is booked.\'],\n' +
        '  [\'qualifiedtobuy\', \'Qualified to buy\', \'Need, rough budget, decision process and timeline are understood.\'],\n' +
        '  [\'presentationscheduled\', \'Presentation scheduled\', \'A demo or presentation is booked or has been given.\'],\n' +
        '  [\'decisionmakerboughtin\', \'Decision maker bought-in\', \'The person who signs has seen it and supports it.\'],\n' +
        '  [\'contractsent\', \'Contract sent\', \'A proposal or contract has been sent.\'],\n' +
        '  [\'closedwon\', \'Closed won\', \'Signed.\'],\n' +
        '  [\'closedlost\', \'Closed lost\', \'The prospect said no.\']\n' +
        '];\n' +
        'const stageIndex = id => STAGES.findIndex(s => s[0] === id);\n' +
        'const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];\n' +
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
        '// Is this quote really in the transcript? (case, punctuation and spacing ignored)\n' +
        'const norm = s => String(s || \'\').toLowerCase().replace(/[’\']/g, "\'").replace(/[^a-z0-9\' ]+/g, \' \').replace(/\\s+/g, \' \').trim();\n' +
        'const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };\n' +
        '\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'const plainToHtml = t => String(t || \'\').split(/\\n{2,}/).map(p => \'<p style="margin:0 0 14px;text-align:left">\' + esc(p).replace(/\\n/g, \'<br>\') + \'</p>\').join(\'\');\n' +
        '// n8n shows a form\'s completion HTML as the whole page, so it needs its own styling.\n' +
        'function formPage(title, inner) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}\'\n' +
        '    + \'.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>\'\n' +
        '    + \'<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>\' + inner + \'</div></body></html>\';\n' +
        '}\n' +
        '// ---- end lib-tdw.js ----\n' +
        'const id = $(\'Route\').first().json.deal_id;\n' +
        'const deal = $(\'Read Deal\').all().map(i => i.json).find(d => d.deal_id === id) || null;\n' +
        'const company = deal ? ($(\'Read Companies\').all().map(i => i.json).find(c => c.company_id === deal.company_id) || null) : null;\n' +
        'const contacts = deal ? $(\'Read Contacts\').all().map(i => i.json).filter(c => c.company_id === deal.company_id).map(c => ({ contact_id: c.contact_id, name: c.name, email: c.email, title: c.title })) : [];\n' +
        'const activity = $(\'Read Activity\').all().map(i => i.json).filter(a => a.deal_id === id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))\n' +
        '  .map(a => ({ kind: a.kind, title: a.title, body: a.body, due: a.due, status: a.status, created_at: a.created_at }));\n' +
        'if (!deal) return [{ json: { found: false } }];\n' +
        'const { id: _1, createdAt: _2, updatedAt: _3, ...d } = deal;\n' +
        'return [{ json: { found: true, deal: d, company, contacts, activity } }];\n'
  } },
  output: [{ found: true, deal: {}, company: {}, contacts: [], activity: [] }]
});

// Test CRM: writes
const updateFields = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Changed Fields', position: [1100, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Only the fields being changed, so the rest of the deal row is left alone.\n' +
        '// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----\n' +
        'const TZ = \'America/New_York\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const dollars = n => \'$\' + Math.round(Number(n) || 0).toLocaleString(\'en-US\');\n' +
        'const day = d => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat(\'ccc, LLL d\') : String(d || \'\');\n' +
        'const mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\n' +
        '\n' +
        '// HubSpot\'s default sales pipeline.\n' +
        'const STAGES = [\n' +
        '  [\'appointmentscheduled\', \'Appointment scheduled\', \'A first meeting is booked.\'],\n' +
        '  [\'qualifiedtobuy\', \'Qualified to buy\', \'Need, rough budget, decision process and timeline are understood.\'],\n' +
        '  [\'presentationscheduled\', \'Presentation scheduled\', \'A demo or presentation is booked or has been given.\'],\n' +
        '  [\'decisionmakerboughtin\', \'Decision maker bought-in\', \'The person who signs has seen it and supports it.\'],\n' +
        '  [\'contractsent\', \'Contract sent\', \'A proposal or contract has been sent.\'],\n' +
        '  [\'closedwon\', \'Closed won\', \'Signed.\'],\n' +
        '  [\'closedlost\', \'Closed lost\', \'The prospect said no.\']\n' +
        '];\n' +
        'const stageIndex = id => STAGES.findIndex(s => s[0] === id);\n' +
        'const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];\n' +
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
        '// Is this quote really in the transcript? (case, punctuation and spacing ignored)\n' +
        'const norm = s => String(s || \'\').toLowerCase().replace(/[’\']/g, "\'").replace(/[^a-z0-9\' ]+/g, \' \').replace(/\\s+/g, \' \').trim();\n' +
        'const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };\n' +
        '\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'const plainToHtml = t => String(t || \'\').split(/\\n{2,}/).map(p => \'<p style="margin:0 0 14px;text-align:left">\' + esc(p).replace(/\\n/g, \'<br>\') + \'</p>\').join(\'\');\n' +
        '// n8n shows a form\'s completion HTML as the whole page, so it needs its own styling.\n' +
        'function formPage(title, inner) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}\'\n' +
        '    + \'.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>\'\n' +
        '    + \'<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>\' + inner + \'</div></body></html>\';\n' +
        '}\n' +
        '// ---- end lib-tdw.js ----\n' +
        'const i = $(\'Route\').first().json;\n' +
        'const f = i.fields || {};\n' +
        'const out = { deal_id: i.deal_id, updated_at: nowIso() };\n' +
        'for (const k of [\'stage\', \'amount\', \'close_date\', \'next_step\']) if (f[k] !== undefined && f[k] !== null && f[k] !== \'\') out[k] = f[k];\n' +
        'return [{ json: out }];\n'
  } },
  output: [{ deal_id: 'D-1001', stage: 'qualifiedtobuy', updated_at: '2026-10-21T14:00:00.000-04:00' }]
});
const updateDeal = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Deal Row',
    position: [1320, 420],
    parameters: {
      resource: 'row', operation: 'update', dataTableId: DEALS,
      filters: { conditions: [{ keyName: 'deal_id', condition: 'eq', keyValue: expr('{{ $json.deal_id }}') }] },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'deal_id', displayName: 'deal_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'company_id', displayName: 'company_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'stage', displayName: 'stage', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'amount', displayName: 'amount', required: false, defaultMatch: false, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'close_date', displayName: 'close_date', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'owner', displayName: 'owner', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'next_step', displayName: 'next_step', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ id: 1 }]
});
const activityRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Activity Row', position: [1100, 620], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// A note (logged call) or task row for the test CRM.\n' +
        '// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----\n' +
        'const TZ = \'America/New_York\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const dollars = n => \'$\' + Math.round(Number(n) || 0).toLocaleString(\'en-US\');\n' +
        'const day = d => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat(\'ccc, LLL d\') : String(d || \'\');\n' +
        'const mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\n' +
        '\n' +
        '// HubSpot\'s default sales pipeline.\n' +
        'const STAGES = [\n' +
        '  [\'appointmentscheduled\', \'Appointment scheduled\', \'A first meeting is booked.\'],\n' +
        '  [\'qualifiedtobuy\', \'Qualified to buy\', \'Need, rough budget, decision process and timeline are understood.\'],\n' +
        '  [\'presentationscheduled\', \'Presentation scheduled\', \'A demo or presentation is booked or has been given.\'],\n' +
        '  [\'decisionmakerboughtin\', \'Decision maker bought-in\', \'The person who signs has seen it and supports it.\'],\n' +
        '  [\'contractsent\', \'Contract sent\', \'A proposal or contract has been sent.\'],\n' +
        '  [\'closedwon\', \'Closed won\', \'Signed.\'],\n' +
        '  [\'closedlost\', \'Closed lost\', \'The prospect said no.\']\n' +
        '];\n' +
        'const stageIndex = id => STAGES.findIndex(s => s[0] === id);\n' +
        'const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];\n' +
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
        '// Is this quote really in the transcript? (case, punctuation and spacing ignored)\n' +
        'const norm = s => String(s || \'\').toLowerCase().replace(/[’\']/g, "\'").replace(/[^a-z0-9\' ]+/g, \' \').replace(/\\s+/g, \' \').trim();\n' +
        'const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };\n' +
        '\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'const plainToHtml = t => String(t || \'\').split(/\\n{2,}/).map(p => \'<p style="margin:0 0 14px;text-align:left">\' + esc(p).replace(/\\n/g, \'<br>\') + \'</p>\').join(\'\');\n' +
        '// n8n shows a form\'s completion HTML as the whole page, so it needs its own styling.\n' +
        'function formPage(title, inner) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}\'\n' +
        '    + \'.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>\'\n' +
        '    + \'<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>\' + inner + \'</div></body></html>\';\n' +
        '}\n' +
        '// ---- end lib-tdw.js ----\n' +
        'const i = $(\'Route\').first().json;\n' +
        'return [{ json: {\n' +
        '  activity_id: newId(i.action === \'create_task\' ? \'T-\' : \'N-\'), deal_id: i.deal_id, kind: i.action === \'create_task\' ? \'task\' : (i.kind || \'call\'),\n' +
        '  title: i.title || \'\', body: i.body || \'\', owner: i.owner || \'\', due: i.due || \'\', status: i.action === \'create_task\' ? \'open\' : \'done\',\n' +
        '  source: i.source || \'call-autopilot\', created_at: nowIso()\n' +
        '} }];\n'
  } },
  output: [{ activity_id: 'N-ABCDE', deal_id: 'D-1001', kind: 'call', title: 'Call summary' }]
});
const addActivity = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Activity', position: [1320, 620], parameters: { resource: 'row', operation: 'insert', dataTableId: ACTIVITY, columns: { mappingMode: 'defineBelow', value: {
          activity_id: expr('{{ $json.activity_id }}'),
          deal_id: expr('{{ $json.deal_id }}'),
          kind: expr('{{ $json.kind }}'),
          title: expr('{{ $json.title }}'),
          body: expr('{{ $json.body }}'),
          owner: expr('{{ $json.owner }}'),
          due: expr('{{ $json.due }}'),
          status: expr('{{ $json.status }}'),
          source: expr('{{ $json.source }}'),
          created_at: expr('{{ $json.created_at }}')
  }, schema: [
          { id: 'activity_id', displayName: 'activity_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'deal_id', displayName: 'deal_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'body', displayName: 'body', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'owner', displayName: 'owner', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'due', displayName: 'due', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'source', displayName: 'source', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 5, activity_id: 'N-ABCDE' }]
});

// Live CRM (HubSpot)
const hsDeal = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'HubSpot Deal',
    position: [1100, 860],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: 'GET',
      url: expr("https://api.hubapi.com/crm/v3/objects/deals/{{ encodeURIComponent($('Route').first().json.deal_id) }}?properties=dealname,dealstage,amount,closedate,hubspot_owner_id,hs_next_step&associations=companies,contacts"),
      authentication: 'predefinedCredentialType', nodeCredentialType: 'hubspotAppToken'
    },
    credentials: HUBSPOT_CRED
  },
  output: [{ id: '123', properties: { dealname: 'Calloway Dental: patient reminders' }, associations: { contacts: { results: [{ id: '501' }] } } }]
});
const hsContacts = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'HubSpot Contacts',
    position: [1320, 860],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: 'POST',
      url: 'https://api.hubapi.com/crm/v3/objects/contacts/batch/read',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'hubspotAppToken',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ properties: ["firstname", "lastname", "email", "jobtitle"], inputs: ((($json.associations || {}).contacts || {}).results || []).map(c => ({ id: c.id })) }) }}'),
      options: {}
    },
    credentials: HUBSPOT_CRED
  },
  output: [{ results: [] }]
});
const dealLive = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Deal (Live)', position: [1540, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The deal with its company and contacts, from HubSpot (deal properties plus associated contacts).\n' +
        'const d = $(\'HubSpot Deal\').first().json || {};\n' +
        'const p = d.properties || {};\n' +
        'const contacts = $(\'HubSpot Contacts\').all().map(i => i.json).filter(c => c && c.properties).map(c => ({\n' +
        '  contact_id: String(c.id), name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(\' \'), email: c.properties.email || \'\', title: c.properties.jobtitle || \'\'\n' +
        '}));\n' +
        'const companyId = (((d.associations || {}).companies || {}).results || [])[0];\n' +
        'return [{ json: {\n' +
        '  found: !!d.id,\n' +
        '  deal: { deal_id: String(d.id || \'\'), name: p.dealname || \'\', company_id: companyId ? String(companyId.id) : \'\', stage: p.dealstage || \'\', amount: Number(p.amount) || 0,\n' +
        '    close_date: (p.closedate || \'\').slice(0, 10), owner: p.hubspot_owner_id || \'\', next_step: p.hs_next_step || \'\' },\n' +
        '  company: { name: p.dealname ? p.dealname.split(\':\')[0] : \'\' },\n' +
        '  contacts,\n' +
        '  activity: []\n' +
        '} }];\n'
  } },
  output: [{ found: true, deal: {}, contacts: [] }]
});
const hsBody = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'HubSpot Request', position: [1100, 1060], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The HubSpot API request for a write: PATCH the deal, or create a note or task linked to the deal\n' +
        '// (association types 214 note→deal, 216 task→deal).\n' +
        '// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----\n' +
        'const TZ = \'America/New_York\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => \'ABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 32)]).join(\'\');\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const dollars = n => \'$\' + Math.round(Number(n) || 0).toLocaleString(\'en-US\');\n' +
        'const day = d => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat(\'ccc, LLL d\') : String(d || \'\');\n' +
        'const mmss = s => Math.floor(s / 60) + \':\' + String(Math.floor(s % 60)).padStart(2, \'0\');\n' +
        '\n' +
        '// HubSpot\'s default sales pipeline.\n' +
        'const STAGES = [\n' +
        '  [\'appointmentscheduled\', \'Appointment scheduled\', \'A first meeting is booked.\'],\n' +
        '  [\'qualifiedtobuy\', \'Qualified to buy\', \'Need, rough budget, decision process and timeline are understood.\'],\n' +
        '  [\'presentationscheduled\', \'Presentation scheduled\', \'A demo or presentation is booked or has been given.\'],\n' +
        '  [\'decisionmakerboughtin\', \'Decision maker bought-in\', \'The person who signs has seen it and supports it.\'],\n' +
        '  [\'contractsent\', \'Contract sent\', \'A proposal or contract has been sent.\'],\n' +
        '  [\'closedwon\', \'Closed won\', \'Signed.\'],\n' +
        '  [\'closedlost\', \'Closed lost\', \'The prospect said no.\']\n' +
        '];\n' +
        'const stageIndex = id => STAGES.findIndex(s => s[0] === id);\n' +
        'const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];\n' +
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
        '// Is this quote really in the transcript? (case, punctuation and spacing ignored)\n' +
        'const norm = s => String(s || \'\').toLowerCase().replace(/[’\']/g, "\'").replace(/[^a-z0-9\' ]+/g, \' \').replace(/\\s+/g, \' \').trim();\n' +
        'const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };\n' +
        '\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        'const plainToHtml = t => String(t || \'\').split(/\\n{2,}/).map(p => \'<p style="margin:0 0 14px;text-align:left">\' + esc(p).replace(/\\n/g, \'<br>\') + \'</p>\').join(\'\');\n' +
        '// n8n shows a form\'s completion HTML as the whole page, so it needs its own styling.\n' +
        'function formPage(title, inner) {\n' +
        '  return \'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\' + esc(title) + \'</title>\'\n' +
        '    + \'<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}\'\n' +
        '    + \'.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}\'\n' +
        '    + \'.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>\'\n' +
        '    + \'<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>\' + inner + \'</div></body></html>\';\n' +
        '}\n' +
        '// ---- end lib-tdw.js ----\n' +
        'const i = $(\'Route\').first().json;\n' +
        'const f = i.fields || {};\n' +
        'let method = \'POST\', url = \'\', body = {};\n' +
        'if (i.action === \'update_deal\') {\n' +
        '  method = \'PATCH\';\n' +
        '  url = \'https://api.hubapi.com/crm/v3/objects/deals/\' + encodeURIComponent(i.deal_id);\n' +
        '  const props = {};\n' +
        '  if (f.stage) props.dealstage = f.stage;\n' +
        '  if (f.amount) props.amount = String(f.amount);\n' +
        '  if (f.close_date) props.closedate = f.close_date;\n' +
        '  if (f.next_step) props.hs_next_step = f.next_step;\n' +
        '  body = { properties: props };\n' +
        '} else if (i.action === \'create_task\') {\n' +
        '  url = \'https://api.hubapi.com/crm/v3/objects/tasks\';\n' +
        '  body = { properties: { hs_timestamp: DateTime.fromISO(i.due || DateTime.now().toISODate(), { zone: TZ }).set({ hour: 9 }).toISO(), hs_task_subject: i.title, hs_task_body: i.body || \'\', hs_task_status: \'NOT_STARTED\', hs_task_priority: \'MEDIUM\' },\n' +
        '    associations: [{ to: { id: i.deal_id }, types: [{ associationCategory: \'HUBSPOT_DEFINED\', associationTypeId: 216 }] }] };\n' +
        '} else {\n' +
        '  url = \'https://api.hubapi.com/crm/v3/objects/notes\';\n' +
        '  body = { properties: { hs_timestamp: nowIso(), hs_note_body: \'<b>\' + esc(i.title) + \'</b><br>\' + esc(i.body).replace(/\\n/g, \'<br>\') },\n' +
        '    associations: [{ to: { id: i.deal_id }, types: [{ associationCategory: \'HUBSPOT_DEFINED\', associationTypeId: 214 }] }] };\n' +
        '}\n' +
        'return [{ json: { method, url, body } }];\n'
  } },
  output: [{ method: 'PATCH', url: 'https://api.hubapi.com/crm/v3/objects/deals/123', body: {} }]
});
const hsWrite = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'HubSpot Write',
    position: [1320, 1060],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: expr('{{ $json.method }}'),
      url: expr('{{ $json.url }}'),
      authentication: 'predefinedCredentialType', nodeCredentialType: 'hubspotAppToken',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: {}
    },
    credentials: HUBSPOT_CRED
  },
  output: [{ id: '777' }]
});

const done = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Done', position: [1760, 720], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The same answer shape for every write, in both modes.\n' +
        'const i = $(\'Route\').first().json;\n' +
        'return [{ json: { ok: true, action: i.action, deal_id: i.deal_id, title: i.title || \'\', id: String(($input.first().json || {}).activity_id || ($input.first().json || {}).id || \'\') } }];\n'
  } },
  output: [{ ok: true, action: 'add_note' }]
});

const note = sticky(
  '## Tidewater 3: CRM\nThe only place that talks to the CRM, so the rest of the system doesn\'t care which one it is.\n- **get_deal**: the deal with its company, contacts and recent activity.\n- **update_deal**: changes only the fields given (stage, amount, close date, next step).\n- **add_note** / **create_task**: logged on the deal.\nTest mode uses the **Tidewater** tables. Live mode uses the HubSpot CRM API (deal properties, notes and tasks associated with the deal); those nodes stay off until a **HubSpot account** (private app token) credential exists.',
  [], { position: [160, 0], width: 1300, height: 200, color: 7 }
);

export default workflow('tidewater-crm', 'Tidewater 3: CRM')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(which
    .onCase(0, readDeal.to(readCompanies).to(readContacts).to(readActivity).to(dealTest))
    .onCase(1, updateFields.to(updateDeal).to(done))
    .onCase(2, activityRow.to(addActivity).to(done))
    .onCase(3, hsDeal.to(hsContacts).to(dealLive))
    .onCase(4, hsBody.to(hsWrite).to(done)))
  .add(note);
