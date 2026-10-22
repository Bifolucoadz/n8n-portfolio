import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Reset Demo', position: [200, 300] },
  output: [{}]
});

const clear0 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Candidates', position: [420, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear1 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear CV Files', position: [640, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'nKofBkG4S6UPt1xd', cachedResultName: 'Northgate Files' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear2 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Outbox', position: [860, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'ygMH59WjeBt0Og19', cachedResultName: 'Northgate Outbox' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear3 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Events', position: [1080, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'v5LAsWSJxw2Uj4Ig', cachedResultName: 'Northgate Events' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});
const clear4 = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Clear Calendar', position: [1300, 300], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'deleteRows', dataTableId: { __rl: true, mode: 'id', value: 'CF6YJExhwMKsGY9P', cachedResultName: 'Northgate Calendar' }, filters: { conditions: [{ keyName: 'id', condition: 'gt', keyValue: '0' }] } } },
  output: [{ id: 1 }]
});

const busy = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Busy Times', position: [1520, 300], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Example busy times for the interviewer over the next three weeks, so the slot finder has\n' +
        '// something to work around in test mode (team meeting, client visits, a training morning).\n' +
        '// ---- lib-ngt.js (included by build.py): shared helpers for the Northgate workflows ----\n' +
        'const TZ = \'Europe/London\';\n' +
        'const esc = s => String(s === null || s === undefined ? \'\' : s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\');\n' +
        'const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));\n' +
        'const parseJson = (s, d) => { try { return typeof s === \'string\' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
        'const nowIso = () => DateTime.now().setZone(TZ).toISO();\n' +
        'const newToken = n => Array.from({ length: n || 24 }, () => \'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789\'[Math.floor(Math.random() * 56)]).join(\'\');\n' +
        'const pounds = n => \'£\' + Math.round(Number(n) || 0).toLocaleString(\'en-GB\');\n' +
        'const whenText = iso => DateTime.fromISO(String(iso), { zone: TZ }).toFormat("cccc d LLLL \'at\' h:mm a").replace(\':00 \', \' \');\n' +
        'const firstName = name => String(name || \'\').trim().split(/\\s+/)[0] || \'there\';\n' +
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
        '// Plain, left-aligned email body with the agency\'s name at the top.\n' +
        'function emailHtml(company, paragraphs, extraHtml) {\n' +
        '  const p = paragraphs.map(t => \'<p style="margin:0 0 14px;text-align:left">\' + t + \'</p>\').join(\'\');\n' +
        '  return \'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">\'\n' +
        '    + \'<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#0b6e4f;margin:0 0 18px">\' + esc(company) + \'</div>\'\n' +
        '    + p + (extraHtml || \'\') + \'</div>\';\n' +
        '}\n' +
        '\n' +
        'const BAND_LABEL = { shortlist: \'Shortlist\', review: \'Worth a look\', unlikely: \'Unlikely fit\', knockout: \'Knockout\' };\n' +
        '// ---- end lib-ngt.js ----\n' +
        'const pattern = {\n' +
        '  1: [[\'09:30\', \'11:00\', \'Team meeting\']],\n' +
        '  2: [[\'13:30\', \'16:30\', \'Client visit: Calder Logistics\']],\n' +
        '  3: [[\'10:00\', \'11:00\', \'Hiring manager call\'], [\'15:00\', \'16:00\', \'Candidate interview (another role)\']],\n' +
        '  4: [[\'09:00\', \'13:00\', \'Training: interviewing skills\']],\n' +
        '  5: [[\'14:00\', \'17:00\', \'Client visit: Fernbrook Home\']]\n' +
        '};\n' +
        'const out = [];\n' +
        'let d = DateTime.now().setZone(TZ).startOf(\'day\');\n' +
        'for (let i = 0; i < 21; i++) {\n' +
        '  d = d.plus({ days: 1 });\n' +
        '  for (const [a, b, title] of pattern[d.weekday] || []) {\n' +
        '    const [ah, am] = a.split(\':\').map(Number), [bh, bm] = b.split(\':\').map(Number);\n' +
        '    out.push({ start: d.set({ hour: ah, minute: am }).toISO(), end: d.set({ hour: bh, minute: bm }).toISO(), title, kind: \'busy\', candidate_id: \'\' });\n' +
        '  }\n' +
        '}\n' +
        'return out.map(json => ({ json }));\n'
  } },
  output: [{ start: '2026-10-22T09:30:00.000+01:00', end: '2026-10-22T11:00:00.000+01:00', title: 'Team meeting', kind: 'busy', candidate_id: '' }]
});

const addBusy = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Busy Times', position: [1740, 300], parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'CF6YJExhwMKsGY9P', cachedResultName: 'Northgate Calendar' }, columns: { mappingMode: 'defineBelow', value: {
          start: expr('{{ $json.start }}'),
          end: expr('{{ $json.end }}'),
          title: expr('{{ $json.title }}'),
          kind: expr('{{ $json.kind }}'),
          candidate_id: expr('{{ $json.candidate_id }}')
  }, schema: [
          { id: 'start', displayName: 'start', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'end', displayName: 'end', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'candidate_id', displayName: 'candidate_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
  ] } } },
  output: [{ id: 1 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [1960, 300], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What was cleared and seeded.\n' +
        'return [{ json: { cleared: [\'Northgate Candidates\', \'Northgate Files\', \'Northgate Outbox\', \'Northgate Events\', \'Northgate Calendar\'], busy_slots_added: $(\'Busy Times\').all().length } }];\n'
  } },
  output: [{ busy_slots_added: 15 }]
});

const note = sticky(
  '## Northgate 8: Reset Demo (manual, destructive)\nEmpties the candidates, CV files, outbox, events and calendar tables, then adds example busy times for the interviewer over the next three weeks. Jobs and settings are kept.',
  [], { position: [160, 80], width: 900, height: 160, color: 3 }
);

export default workflow('northgate-reset-demo', 'Northgate 8: Reset Demo')
  .add(run)
  .to(clear0)
  .to(clear1)
  .to(clear2)
  .to(clear3)
  .to(clear4)
  .to(busy)
  .to(addBusy)
  .to(summary)
  .add(note);
