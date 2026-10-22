import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Reset Demo', position: [200, 300] },
  output: [{}]
});

const clear0 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Deals', position: [420, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: '6fad2EyLoty9oElv', cachedResultName: 'Tidewater Deals' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear1 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Companies', position: [640, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'h1O24r8zgxQeqODi', cachedResultName: 'Tidewater Companies' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Contacts', position: [860, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: '0jlx2ckch1Gj6Qtr', cachedResultName: 'Tidewater Contacts' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear3 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Activity', position: [1080, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'VUrS7HRsgmNpXROv', cachedResultName: 'Tidewater Activity' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear4 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Calls', position: [1300, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: '0hHsTxLEuk6Su6C7', cachedResultName: 'Tidewater Calls' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear5 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Outbox', position: [1520, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'VGQHvXZw7QIaNJgY', cachedResultName: 'Tidewater Outbox' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});

const seed = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Starting CRM', position: [1740, 300], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The demo CRM as it starts: three open deals at different stages, their companies and contacts,\n' +
        '// and a little earlier activity. Every company, person and email is invented (.example domains).\n' +
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
        'const now = DateTime.now().setZone(TZ);\n' +
        'const ago = d => now.minus({ days: d }).toISO();\n' +
        'const companies = [\n' +
        '  { company_id: \'C-201\', name: \'Calloway Dental Group\', domain: \'callowaydental.example\', industry: \'Dental clinics (5 locations)\', size: \'120 staff\' },\n' +
        '  { company_id: \'C-202\', name: \'Pemberton Freight\', domain: \'pembertonfreight.example\', industry: \'Freight and logistics\', size: \'300 staff\' },\n' +
        '  { company_id: \'C-203\', name: \'Ostara Home Care\', domain: \'ostarahomecare.example\', industry: \'Home care (8 branches)\', size: \'450 staff\' }\n' +
        '];\n' +
        'const contacts = [\n' +
        '  { contact_id: \'P-301\', company_id: \'C-201\', name: \'Renee Alvarez\', email: \'renee.alvarez@callowaydental.example\', title: \'Operations Director\' },\n' +
        '  { contact_id: \'P-302\', company_id: \'C-201\', name: \'Mark Feld\', email: \'mark.feld@callowaydental.example\', title: \'COO\' },\n' +
        '  { contact_id: \'P-303\', company_id: \'C-202\', name: \'Tom Reyes\', email: \'tom.reyes@pembertonfreight.example\', title: \'IT Manager\' },\n' +
        '  { contact_id: \'P-304\', company_id: \'C-202\', name: \'Dana Whitcombe\', email: \'dana.whitcombe@pembertonfreight.example\', title: \'CFO\' },\n' +
        '  { contact_id: \'P-305\', company_id: \'C-203\', name: \'Janelle Brooks\', email: \'janelle.brooks@ostarahomecare.example\', title: \'CEO\' }\n' +
        '];\n' +
        'const deals = [\n' +
        '  { deal_id: \'D-1001\', name: \'Calloway Dental: patient reminders\', company_id: \'C-201\', stage: \'appointmentscheduled\', amount: 0, close_date: \'\', owner: \'Maya Collins\', next_step: \'Discovery call with Renee\', updated_at: ago(6) },\n' +
        '  { deal_id: \'D-1002\', name: \'Pemberton Freight: customer tracking portal\', company_id: \'C-202\', stage: \'presentationscheduled\', amount: 65000, close_date: now.plus({ days: 55 }).toISODate(), owner: \'Maya Collins\', next_step: \'Demo follow-up call\', updated_at: ago(7) },\n' +
        '  { deal_id: \'D-1003\', name: \'Ostara Home Care: caregiver scheduling app\', company_id: \'C-203\', stage: \'contractsent\', amount: 28000, close_date: now.plus({ days: 24 }).toISODate(), owner: \'Maya Collins\', next_step: \'Contract call with Janelle\', updated_at: ago(3) }\n' +
        '];\n' +
        'const activity = [\n' +
        '  { activity_id: \'N-SEED1\', deal_id: \'D-1001\', kind: \'note\', title: \'Inbound lead: website form\', body: \'Asked about automating appointment reminders across 5 clinics.\', owner: \'Maya Collins\', due: \'\', status: \'done\', source: \'seed\', created_at: ago(9) },\n' +
        '  { activity_id: \'N-SEED2\', deal_id: \'D-1002\', kind: \'meeting\', title: \'Portal demo with the dispatch team\', body: \'Showed live tracking and the customer portal. Tom Reyes and two dispatchers attended.\', owner: \'Maya Collins\', due: \'\', status: \'done\', source: \'seed\', created_at: ago(7) },\n' +
        '  { activity_id: \'N-SEED3\', deal_id: \'D-1003\', kind: \'email\', title: \'Contract v1 sent\', body: \'Annual contract for 8 branches, $28,000.\', owner: \'Maya Collins\', due: \'\', status: \'done\', source: \'seed\', created_at: ago(3) }\n' +
        '];\n' +
        'return [\n' +
        '  ...companies.map(r => ({ json: { table: \'companies\', ...r } })),\n' +
        '  ...contacts.map(r => ({ json: { table: \'contacts\', ...r } })),\n' +
        '  ...deals.map(r => ({ json: { table: \'deals\', ...r } })),\n' +
        '  ...activity.map(r => ({ json: { table: \'activity\', ...r } }))\n' +
        '];\n'
  } },
  output: [{ table: 'deals', deal_id: 'D-1001' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Which Table?',
    position: [1980, 300],
    parameters: { rules: { values: [
        { outputKey: 'companies', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'companies' }], combinator: 'and' } },
        { outputKey: 'contacts', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'contacts' }], combinator: 'and' } },
        { outputKey: 'deals', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'deals' }], combinator: 'and' } },
        { outputKey: 'activity', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.table }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'activity' }], combinator: 'and' } }
    ] } }
  }
});

const add0 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Companies', position: [2300, 160], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'h1O24r8zgxQeqODi', cachedResultName: 'Tidewater Companies' }, columns: { mappingMode: 'defineBelow', value: {
          company_id: expr('{{ $json.company_id }}'),
          name: expr('{{ $json.name }}'),
          domain: expr('{{ $json.domain }}'),
          industry: expr('{{ $json.industry }}'),
          size: expr('{{ $json.size }}')
  }, schema: [
          { id: 'company_id', displayName: 'company_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'domain', displayName: 'domain', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'industry', displayName: 'industry', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'size', displayName: 'size', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});
const add1 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Contacts', position: [2300, 340], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: '0jlx2ckch1Gj6Qtr', cachedResultName: 'Tidewater Contacts' }, columns: { mappingMode: 'defineBelow', value: {
          contact_id: expr('{{ $json.contact_id }}'),
          company_id: expr('{{ $json.company_id }}'),
          name: expr('{{ $json.name }}'),
          email: expr('{{ $json.email }}'),
          title: expr('{{ $json.title }}')
  }, schema: [
          { id: 'contact_id', displayName: 'contact_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'company_id', displayName: 'company_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});
const add2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Deals', position: [2300, 520], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: '6fad2EyLoty9oElv', cachedResultName: 'Tidewater Deals' }, columns: { mappingMode: 'defineBelow', value: {
          deal_id: expr('{{ $json.deal_id }}'),
          name: expr('{{ $json.name }}'),
          company_id: expr('{{ $json.company_id }}'),
          stage: expr('{{ $json.stage }}'),
          amount: expr('{{ $json.amount }}'),
          close_date: expr('{{ $json.close_date }}'),
          owner: expr('{{ $json.owner }}'),
          next_step: expr('{{ $json.next_step }}'),
          updated_at: expr('{{ $json.updated_at }}')
  }, schema: [
          { id: 'deal_id', displayName: 'deal_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'company_id', displayName: 'company_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'stage', displayName: 'stage', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'amount', displayName: 'amount', required: false, defaultMatch: false, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'close_date', displayName: 'close_date', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'owner', displayName: 'owner', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'next_step', displayName: 'next_step', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});
const add3 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Activity', position: [2300, 700], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'VUrS7HRsgmNpXROv', cachedResultName: 'Tidewater Activity' }, columns: { mappingMode: 'defineBelow', value: {
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
  output: [{ id: 1 }]
});

const note = sticky(
  '## Tidewater 6: Reset Demo (manual, destructive)\nPuts the demo CRM back to where it starts: three open deals (Calloway Dental at appointment scheduled, Pemberton Freight at presentation scheduled, Ostara Home Care at contract sent), their companies and contacts and a little earlier activity. Clears processed calls and the outbox.',
  [], { position: [160, 60], width: 1100, height: 180, color: 3 }
);

export default workflow('tidewater-reset-demo', 'Tidewater 6: Reset Demo')
  .add(run)
  .to(clear0)
  .to(clear1)
  .to(clear2)
  .to(clear3)
  .to(clear4)
  .to(clear5)
  .to(seed)
  .to(which
    .onCase(0, add0)
    .onCase(1, add1)
    .onCase(2, add2)
    .onCase(3, add3))
  .add(note);
