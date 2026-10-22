// The HubSpot API request for a write: PATCH the deal, or create a note or task linked to the deal
// (association types 214 note→deal, 216 task→deal).
// @include lib-tdw.js
const i = $('Route').first().json;
const f = i.fields || {};
let method = 'POST', url = '', body = {};
if (i.action === 'update_deal') {
  method = 'PATCH';
  url = 'https://api.hubapi.com/crm/v3/objects/deals/' + encodeURIComponent(i.deal_id);
  const props = {};
  if (f.stage) props.dealstage = f.stage;
  if (f.amount) props.amount = String(f.amount);
  if (f.close_date) props.closedate = f.close_date;
  if (f.next_step) props.hs_next_step = f.next_step;
  body = { properties: props };
} else if (i.action === 'create_task') {
  url = 'https://api.hubapi.com/crm/v3/objects/tasks';
  body = { properties: { hs_timestamp: DateTime.fromISO(i.due || DateTime.now().toISODate(), { zone: TZ }).set({ hour: 9 }).toISO(), hs_task_subject: i.title, hs_task_body: i.body || '', hs_task_status: 'NOT_STARTED', hs_task_priority: 'MEDIUM' },
    associations: [{ to: { id: i.deal_id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 216 }] }] };
} else {
  url = 'https://api.hubapi.com/crm/v3/objects/notes';
  body = { properties: { hs_timestamp: nowIso(), hs_note_body: '<b>' + esc(i.title) + '</b><br>' + esc(i.body).replace(/\n/g, '<br>') },
    associations: [{ to: { id: i.deal_id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] }] };
}
return [{ json: { method, url, body } }];
