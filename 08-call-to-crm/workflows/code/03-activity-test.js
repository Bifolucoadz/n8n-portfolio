// A note (logged call) or task row for the test CRM.
// @include lib-tdw.js
const i = $('Route').first().json;
return [{ json: {
  activity_id: newId(i.action === 'create_task' ? 'T-' : 'N-'), deal_id: i.deal_id, kind: i.action === 'create_task' ? 'task' : (i.kind || 'call'),
  title: i.title || '', body: i.body || '', owner: i.owner || '', due: i.due || '', status: i.action === 'create_task' ? 'open' : 'done',
  source: i.source || 'call-autopilot', created_at: nowIso()
} }];
