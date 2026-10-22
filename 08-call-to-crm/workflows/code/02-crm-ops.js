// One CRM write per item: the call note, a task per next step on our side, and the deal fields
// that passed the rules.
// @include lib-tdw.js
const d = $('Decide').first().json;
const p = $('Prepare').first().json;
const fields = {};
for (const c of d.applied) fields[c.field] = c.value;
const ops = [{ action: 'add_note', deal_id: d.deal_id, kind: 'call', title: 'Call: ' + p.crm.deal.name + ' (' + mmss($('Transcript').first().json.duration_s) + ')', body: d.note, owner: d.rep, source: 'call-autopilot' }];
for (const t of d.tasks) ops.push({ action: 'create_task', deal_id: d.deal_id, title: t.title, body: t.quote ? 'From the call: "' + t.quote + '"' : '', due: t.due, owner: t.owner, source: 'call-autopilot' });
if (Object.keys(fields).length) ops.push({ action: 'update_deal', deal_id: d.deal_id, fields });
return ops.map(json => ({ json }));
